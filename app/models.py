from typing import List, Optional, Dict, Any
from sqlalchemy import (
    create_engine, Column, Integer, String, Date, ForeignKey, Text, Numeric, Boolean, Enum as SQLEnum
)
from sqlalchemy.orm import sessionmaker, declarative_base, Session, relationship
from sqlalchemy.pool import StaticPool
from datetime import date, datetime, timedelta
import enum
from pydantic import BaseModel, ConfigDict

# =================================================================
# 1. НАСТРОЙКА БАЗЫ ДАННЫХ
# =================================================================
Base = declarative_base()

DATABASE_URL = "postgresql+psycopg2://postgres:1234@localhost/libTool"

engine = create_engine(DATABASE_URL, echo=True, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)


# =================================================================
# 2. ПЕРЕЧИСЛЕНИЯ (ENUMS)
# =================================================================
class UserRole(str, enum.Enum):
    SENIOR = "SENIOR"
    REGULAR = "REGULAR"


class IssueStatus(str, enum.Enum):
    ISSUED = "issued"
    RETURNED = "returned"
    OVERDUE = "overdue"


# =================================================================
# 3. МОДЕЛИ SQLALCHEMY
# =================================================================

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    hashed_password = Column(String(100), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.REGULAR)


class Book(Base):
    __tablename__ = "book"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    author = Column(String(100), nullable=False)
    genre = Column(String(50), nullable=True)
    count = Column(Integer, default=1, nullable=False)
    status = Column(String(20), default="available", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)

    issues = relationship("BookIssue", back_populates="book", cascade="all, delete-orphan")


class Reader(Base):
    __tablename__ = "reader"
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    registration_date = Column(Date, default=date.today)
    status = Column(String(20), default="active")
    is_deleted = Column(Boolean, default=False, nullable=False)

    issues = relationship("BookIssue", back_populates="reader", cascade="all, delete-orphan")


class BookIssue(Base):
    __tablename__ = "book_issue"
    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("book.id"), nullable=False)
    reader_id = Column(Integer, ForeignKey("reader.id"), nullable=False)
    issue_date = Column(Date, default=date.today)
    planned_return_date = Column(Date, nullable=False)
    actual_return_date = Column(Date, nullable=True)
    status = Column(String(20), default="issued")

    book = relationship("Book", back_populates="issues")
    reader = relationship("Reader", back_populates="issues")
    fine = relationship("Fine", back_populates="issue", uselist=False, cascade="all, delete-orphan")


class Fine(Base):
    __tablename__ = "fine"
    id = Column(Integer, primary_key=True, index=True)
    issue_id = Column(Integer, ForeignKey("book_issue.id"), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    reason = Column(Text)
    issued_date = Column(Date, default=date.today)
    paid = Column(Boolean, default=False)

    issue = relationship("BookIssue", back_populates="fine")


# =================================================================
# 4. PYDANTIC СХЕМЫ
# =================================================================

class UserOut(BaseModel):
    username: str
    role: str
    model_config = ConfigDict(from_attributes=True)


class BookBase(BaseModel):
    name: str
    author: str
    genre: Optional[str] = None
    count: int = 1


class BookCreate(BookBase): pass


class BookUpdate(BookBase): pass


class BookOut(BookBase):
    id: int
    status: str
    model_config = ConfigDict(from_attributes=True)


class ReaderBase(BaseModel):
    full_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class ReaderCreate(ReaderBase): pass


class ReaderUpdate(ReaderBase):
    status: Optional[str] = "active"


class ReaderOut(ReaderBase):
    id: int
    registration_date: date
    status: str
    books_count: int = 0
    model_config = ConfigDict(from_attributes=True)


class BookIssueBase(BaseModel):
    book_id: int
    reader_id: int
    planned_return_date: date


class BookIssueCreate(BookIssueBase): pass


class BookIssueOut(BookIssueBase):
    id: int
    issue_date: date
    actual_return_date: Optional[date] = None
    status: str
    book_name: Optional[str] = None
    reader_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class FineOut(BaseModel):
    id: int
    issue_id: int
    amount: float
    reason: str
    issued_date: date
    paid: bool
    reader_name: Optional[str] = None
    book_name: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


# =================================================================
# 5. СТОРЫ (БИЗНЕС-ЛОГИКА)
# =================================================================

class BookStore:
    def list_books(self, db: Session) -> List[BookOut]:
        books = db.query(Book).filter(Book.is_deleted == False).all()
        return [BookOut.model_validate(b) for b in books]

    def list_archived_books(self, db: Session) -> List[BookOut]:
        books = db.query(Book).filter(Book.is_deleted == True).all()
        return [BookOut.model_validate(b) for b in books]

    def restore_book(self, db: Session, book_id: int) -> bool:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book or not book.is_deleted: return False
        book.is_deleted = False
        db.commit()
        return True

    def get_book(self, db: Session, book_id: int) -> Optional[Book]:
        return db.query(Book).filter(Book.id == book_id, Book.is_deleted == False).first()

    def create_book(self, db: Session, book_data: BookCreate) -> BookOut:
        db_book = Book(**book_data.model_dump())
        db.add(db_book)
        db.commit()
        db.refresh(db_book)
        return BookOut.model_validate(db_book)

    def update_book(self, db: Session, book_id: int, book_data: BookUpdate) -> Optional[BookOut]:
        book = db.query(Book).filter(Book.id == book_id, Book.is_deleted == False).first()
        if not book: return None
        for key, value in book_data.model_dump().items():
            setattr(book, key, value)
        db.commit()
        db.refresh(book)
        return BookOut.model_validate(book)

    def delete_book(self, db: Session, book_id: int) -> bool:
        book = db.query(Book).filter(Book.id == book_id).first()
        if not book: return False
        book.is_deleted = True
        db.commit()
        return True


class ReaderStore:
    def list_readers(self, db: Session) -> List[ReaderOut]:
        readers = db.query(Reader).filter(Reader.is_deleted == False).all()
        result = []
        for r in readers:
            bc = db.query(BookIssue).filter(BookIssue.reader_id == r.id,
                                            BookIssue.status.in_(["issued", "overdue"])).count()
            res_dict = {
                "id": r.id, "full_name": r.full_name, "phone": r.phone,
                "email": r.email, "address": r.address, "registration_date": r.registration_date,
                "status": r.status, "books_count": bc
            }
            result.append(ReaderOut(**res_dict))
        return result

    def list_archived_readers(self, db: Session) -> List[ReaderOut]:
        readers = db.query(Reader).filter(Reader.is_deleted == True).all()
        result = []
        for r in readers:
            bc = db.query(BookIssue).filter(BookIssue.reader_id == r.id,
                                            BookIssue.status.in_(["issued", "overdue"])).count()
            res_dict = {
                "id": r.id, "full_name": r.full_name, "phone": r.phone,
                "email": r.email, "address": r.address, "registration_date": r.registration_date,
                "status": r.status, "books_count": bc
            }
            result.append(ReaderOut(**res_dict))
        return result

    def restore_reader(self, db: Session, reader_id: int) -> bool:
        reader = db.query(Reader).filter(Reader.id == reader_id).first()
        if not reader or not reader.is_deleted: return False
        reader.is_deleted = False
        db.commit()
        return True

    def create_reader(self, db: Session, reader_data: ReaderCreate) -> ReaderOut:
        db_reader = Reader(**reader_data.model_dump())
        db.add(db_reader)
        db.commit()
        db.refresh(db_reader)
        return ReaderOut.model_validate(db_reader)

    def update_reader(self, db: Session, reader_id: int, reader_data: ReaderUpdate) -> Optional[ReaderOut]:
        reader = db.query(Reader).filter(Reader.id == reader_id, Reader.is_deleted == False).first()
        if not reader: return None
        for key, value in reader_data.model_dump().items():
            setattr(reader, key, value)
        db.commit()
        db.refresh(reader)
        return ReaderOut.model_validate(reader)

    def delete_reader(self, db: Session, reader_id: int) -> bool:
        reader = db.query(Reader).filter(Reader.id == reader_id).first()
        if not reader: return False
        reader.is_deleted = True
        db.commit()
        return True


class BookIssueStore:
    def list_issues(self, db: Session) -> List[BookIssueOut]:
        issues = db.query(BookIssue).all()
        res = []
        for i in issues:
            book_name = f"{i.book.name} - {i.book.author}" if i.book else "Архивная книга"
            reader_name = i.reader.full_name if i.reader else "Архивный читатель"

            res.append(BookIssueOut(
                id=i.id, book_id=i.book_id, reader_id=i.reader_id,
                issue_date=i.issue_date, planned_return_date=i.planned_return_date,
                actual_return_date=i.actual_return_date, status=i.status,
                book_name=book_name, reader_name=reader_name
            ))
        return res

    def issue_book(self, db: Session, issue_data: BookIssueCreate) -> BookIssueOut:
        book = db.query(Book).filter(Book.id == issue_data.book_id).first()
        if not book or book.count <= 0 or book.is_deleted: raise ValueError("Книга недоступна")
        reader = db.query(Reader).filter(Reader.id == issue_data.reader_id).first()
        if not reader or reader.is_deleted: raise ValueError("Читатель недоступен")

        db_issue = BookIssue(**issue_data.model_dump())
        db.add(db_issue)
        book.count -= 1
        if book.count == 0: book.status = "issued"
        db.commit()
        db.refresh(db_issue)
        res = BookIssueOut.model_validate(db_issue)
        res.book_name, res.reader_name = f"{book.name} - {book.author}", db_issue.reader.full_name
        return res

    def return_book(self, db: Session, issue_id: int) -> bool:
        issue = db.query(BookIssue).filter(BookIssue.id == issue_id).first()
        if not issue or issue.status == "returned": return False

        today = date.today()
        issue.status = "returned"
        issue.actual_return_date = today

        if today > issue.planned_return_date:
            delay = (today - issue.planned_return_date).days
            fine_amount = delay * 50
            existing_fine = db.query(Fine).filter(Fine.issue_id == issue.id, Fine.paid == False).first()
            if existing_fine:
                existing_fine.amount = fine_amount
                existing_fine.reason = f"Просрочка возврата на {delay} дн."
            else:
                db.add(Fine(
                    issue_id=issue.id,
                    amount=fine_amount,
                    reason=f"Просрочка возврата на {delay} дн.",
                    issued_date=today
                ))

        book = issue.book
        if book and not book.is_deleted:
            book.count += 1
            book.status = "available"
        db.commit()
        return True

    def check_overdue_issues(self, db: Session):
        issues = db.query(BookIssue).filter(BookIssue.status.in_(["issued", "overdue"])).all()
        today = date.today()
        updated_count = 0

        for issue in issues:
            if issue.planned_return_date < today:
                if issue.status == "issued":
                    issue.status = "overdue"
                    updated_count += 1

                delay = (today - issue.planned_return_date).days
                fine_amount = delay * 50

                existing_fine = db.query(Fine).filter(Fine.issue_id == issue.id, Fine.paid == False).first()
                if existing_fine:
                    if existing_fine.amount != fine_amount:
                        existing_fine.amount = fine_amount
                        existing_fine.reason = f"Просрочка {delay} дн."
                        existing_fine.issued_date = today
                else:
                    db.add(Fine(
                        issue_id=issue.id, amount=fine_amount,
                        reason=f"Просрочка {delay} дн.", issued_date=today, paid=False
                    ))

        db.commit()
        return updated_count

    def mark_issue_overdue(self, db: Session, issue_id: int) -> bool:
        issue = db.query(BookIssue).filter(BookIssue.id == issue_id).first()
        if not issue or issue.status != "issued": return False

        issue.status = "overdue"
        today = date.today()

        if today <= issue.planned_return_date:
            delay = 1
            fine_amount = 50
        else:
            delay = (today - issue.planned_return_date).days
            fine_amount = delay * 50

        existing_fine = db.query(Fine).filter(Fine.issue_id == issue.id, Fine.paid == False).first()
        if not existing_fine:
            db.add(Fine(
                issue_id=issue.id, amount=fine_amount,
                reason=f"Ручная отметка: Просрочка {delay} дн.",
                issued_date=today, paid=False
            ))

        db.commit()
        return True


class FineStore:
    def list_fines(self, db: Session) -> List[FineOut]:
        fines = db.query(Fine).all()
        return [FineOut(
            id=f.id, issue_id=f.issue_id, amount=float(f.amount),
            reason=f.reason, issued_date=f.issued_date, paid=f.paid,
            reader_name=f.issue.reader.full_name if f.issue.reader else "Архивный читатель",
            book_name=f.issue.book.name if f.issue.book else "Архивная книга"
        ) for f in fines]

    def pay_fine(self, db: Session, fine_id: int):
        f = db.query(Fine).filter(Fine.id == fine_id).first()
        if f:
            f.paid = True
            db.commit()
            return True
        return False


book_store = BookStore()
reader_store = ReaderStore()
book_issue_store = BookIssueStore()
fine_store = FineStore()