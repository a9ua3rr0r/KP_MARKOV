from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.colors import lightgrey, black, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os


def create_rules_pdf():
    # Создаем папку static если её нет
    os.makedirs('static', exist_ok=True)

    # Регистрируем шрифт с поддержкой кириллицы
    try:
        # Для Windows
        font_path = "C:/Windows/Fonts/arial.ttf"
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont('Arial', font_path))
            pdfmetrics.registerFont(TTFont('Arial-Bold', "C:/Windows/Fonts/arialbd.ttf"))
            pdfmetrics.registerFont(TTFont('Arial-Italic', "C:/Windows/Fonts/ariali.ttf"))
            main_font = 'Arial'
        else:
            # Для Linux или если Arial не найден
            main_font = 'Helvetica'
    except:
        main_font = 'Helvetica'

    # Создаем PDF
    c = canvas.Canvas('static/rules.pdf', pagesize=A4)
    width, height = A4

    # Добавляем водяной знак "LibTool" на задний план - менее яркий и на всю страницу
    c.setFillColor(lightgrey)
    c.setFillAlpha(0.25)  # Делаем очень прозрачным
    c.setFont("Helvetica", 60)
    c.rotate(45)

    # Увеличиваем покрытие для всей страницы
    for i in range(-3, 5):
        for j in range(-3, 5):
            c.drawString(i * 250, j * 180, "LibTool")

    c.rotate(-45)
    c.setFillAlpha(1.0)  # Возвращаем нормальную прозрачность для основного текста
    c.setFillColor(black)

    # Основной текст
    c.setFillColor(black)

    # Заголовок
    c.setFont(f"{main_font}-Bold", 16)
    c.drawString(50, height - 80, "ПРАВИЛА БИБЛИОТЕКИ")

    # Основной текст
    c.setFont(main_font, 11)

    rules = [
        "1. ОБЩИЕ ПОЛОЖЕНИЯ",
        "1.1. Библиотека осуществляет выдачу книг читателям на условиях настоящих Правил.",
        "1.2. Читателем библиотеки может стать любой гражданин, достигший 14 лет.",
        "1.3. Регистрация читателей осуществляется при предъявлении документа, удостоверяющего личность.",
        "",
        "2. ПРАВА И ОБЯЗАННОСТИ ЧИТАТЕЛЕЙ",
        "2.1. Читатель имеет право:",
        "   - Бесплатно пользоваться фондами библиотеки",
        "   - Получать книги во временное пользование",
        "   - Получать консультации по работе с каталогами",
        "   - Продлевать срок пользования книгами",
        "2.2. Читатель обязан:",
        "   - Бережно относиться к книгам и другим материалам",
        "   - Возвращать книги в установленные сроки",
        "   - Соблюдать тишину в читальном зале",
        "   - Соблюдать правила внутреннего распорядка",
        "",
        "3. ПОРЯДОК ВЫДАЧИ И ВОЗВРАТА КНИГ",
        "3.1. Максимальный срок пользования книгой - 14 дней.",
        "3.2. Возможно продление срока при отсутствии очереди на данную книгу.",
        "3.3. За утерю или порчу книги читатель возмещает ущерб в 3-х кратном размере.",
        "3.4. При получении книги читатель обязан проверить её целостность.",
        "",
        "4. РЕЖИМ РАБОТЫ",
        "4.1. Библиотека работает с понедельника по пятницу с 9:00 до 18:00.",
        "4.2. Обеденный перерыв: с 13:00 до 14:00.",
        "4.3. Выходные дни: суббота, воскресенье.",
        "",
        "5. САНКЦИИ ЗА НАРУШЕНИЕ ПРАВИЛ",
        "5.1. За нарушение сроков возврата - штраф 10 руб./день за каждую книгу.",
        "5.2. За утерю читательского билета - штраф 50 руб.",
        "5.3. Систематические нарушения могут привести к отлучению от библиотеки.",
        "",
        "6. ЗАКЛЮЧИТЕЛЬНЫЕ ПОЛОЖЕНИЯ",
        "6.1. Настоящие Правила вступают в силу с момента их утверждения.",
        "6.2. Все спорные вопросы решаются администрацией библиотеки.",
    ]

    y_position = height - 110
    line_height = 15

    for rule in rules:
        if y_position < 50:  # Если текст не помещается, создаем новую страницу
            c.showPage()
            # Добавляем водяной знак на новую страницу
            c.setFillColor(lightgrey)
            c.setFillAlpha(0.25)
            c.setFont("Helvetica", 60)
            c.rotate(45)
            for i in range(-3, 5):
                for j in range(-3, 5):
                    c.drawString(i * 250, j * 180, "LibTool")
            c.rotate(-45)
            c.setFillAlpha(1.0)
            c.setFillColor(black)
            c.setFont(main_font, 11)
            y_position = height - 50

        if rule.startswith(('1.', '2.', '3.', '4.', '5.', '6.')) and not rule.startswith(
                ('   -', '1.1', '2.1', '3.1', '4.1', '5.1', '6.1', '1.2', '2.2', '3.2', '4.2', '5.2', '6.2', '1.3', '3.3', '3.4', '1.1', '4.3', '5.3')):
            c.setFont(f"{main_font}-Bold", 11)
        else:
            c.setFont(main_font, 11)

        c.drawString(50, y_position, rule)
        y_position -= line_height

    # Подпись в конце
    y_position -= 20
    c.setFont(f"{main_font}-Bold", 11)
    c.drawString(50, y_position, "Директор библиотеки: ___________________")
    y_position -= 15
    c.drawString(50, y_position, "Дата введения в действие: «___» ________ 20___ г.")

    y_position -= 30
    c.setFont(f"{main_font}-Italic", 9)
    c.drawString(50, y_position, "Документ создан в системе управления библиотекой LibTool")

    c.save()
    print("PDF файл с правилами создан: static/rules.pdf")


if __name__ == "__main__":
    create_rules_pdf()