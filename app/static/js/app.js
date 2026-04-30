// static/js/app.js
class LibToolApp {
    constructor() {
        this.books =[];
        this.readers =[];
        this.issues =[];
        this.fines =[];
        this.archivedBooks = [];
        this.archivedReaders =[];
        this.currentPage = 'books';
        this.genresChart = null;
        this.bookSortOrder = 'default';

        this.init();
    }

    init() {
        this.bindEvents();
        this.showPage('books');
        this.applyPermissions();
        this.showNotification('Приложение загружено', 'success');
    }

    bindEvents() {
        console.log('🔧 Инициализация обработчиков событий...');

        document.querySelectorAll('.nav-btn').forEach(btn => {
            if (btn.id === 'btn-logout') return;
            btn.addEventListener('click', (e) => {
                const page = e.currentTarget.dataset.page;
                if (page) {
                    this.showPage(page);
                }
            });
        });

        this.setupButtonHandlers();
        this.setupFormHandlers();
        this.setupFilterHandlers();

        document.getElementById('search-issue-book')?.addEventListener('input', (e) => {
            this.filterIssueSelect('book', e.target.value);
        });
        document.getElementById('search-issue-reader')?.addEventListener('input', (e) => {
            this.filterIssueSelect('reader', e.target.value);
        });
    }

    setupButtonHandlers() {
        const buttons = {
            'btn-new-book': () => this.openBookModal(),
            'btn-new-reader': () => this.openReaderModal(),
            'btn-new-issue': () => this.openIssueModal(),
            'btn-refresh-stats': () => this.loadReports(),
            'btn-export-excel': () => this.exportToExcel(),
            'book-cancel': () => this.closeBookModal(),
            'reader-cancel': () => this.closeReaderModal(),
            'issue-cancel': () => this.closeIssueModal(),
            'book-delete': () => this.deleteBookHandler(),
            'reader-delete': () => this.deleteReaderHandler()
        };

        Object.entries(buttons).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('click', handler);
        });

        document.getElementById('downloadRules')?.addEventListener('click', (e) => {
            e.preventDefault();
            this.downloadRules();
        });
    }

    setupFormHandlers() {
        const forms = {
            'book-form': (e) => this.saveBook(e),
            'reader-form': (e) => this.saveReader(e),
            'issue-form': (e) => this.saveIssue(e)
        };

        Object.entries(forms).forEach(([id, handler]) => {
            document.getElementById(id)?.addEventListener('submit', handler);
        });
    }

    setupFilterHandlers() {
        const filters = {
            'search': () => this.renderBooks(),
            'filter-status': () => this.renderBooks(),
            'search-readers': () => this.renderReaders(),
            'filter-status-readers': () => this.renderReaders(),
            'search-issues': () => this.renderIssues(),
            'filter-status-issues': () => this.renderIssues()
        };

        Object.entries(filters).forEach(([id, handler]) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('input', handler);
                el.addEventListener('change', handler);
            }
        });
    }

    applyPermissions() {
        const role = localStorage.getItem('libtool_role');
        const reportsBtn = document.querySelector('.nav-btn[data-page="reports"]');
        const archiveBtn = document.querySelector('.nav-btn[data-page="archive"]');

        if (role === 'REGULAR') {
            if (reportsBtn) reportsBtn.style.display = 'none';
            if (archiveBtn) archiveBtn.style.display = 'none';

            document.getElementById('btn-new-book')?.classList.add('hidden');
            document.getElementById('btn-new-reader')?.classList.add('hidden');

            if (this.currentPage === 'reports' || this.currentPage === 'archive') {
                this.showPage('books');
            }
        } else {
            if (reportsBtn) reportsBtn.style.display = 'flex';
            if (archiveBtn) {
                archiveBtn.style.display = 'flex';
                archiveBtn.classList.remove('hidden');
            }

            document.getElementById('btn-new-book')?.classList.remove('hidden');
            document.getElementById('btn-new-reader')?.classList.remove('hidden');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }

    showLoading(page, show) {
        const loading = document.getElementById(`${page}-loading`);
        const container = document.getElementById(`${page}-container`);
        if (loading) loading.style.display = show ? 'block' : 'none';
        if (container) container.style.display = show ? 'none' : 'block';
    }

    async apiCall(url, options = {}) {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...options.headers },
            ...options
        });

        if (response.status === 401) {
            showLogin();
            throw new Error('Не авторизован');
        }

        if (!response.ok) {
            throw new Error(`Ошибка: ${response.status}`);
        }

        return response.json();
    }

    showPage(page) {['page', 'nav-btn', 'page-action', 'filter-group'].forEach(className => {
            document.querySelectorAll(`.${className}`).forEach(el => el.classList.remove('active'));
        });

        document.getElementById(`${page}-page`)?.classList.add('active');
        document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
        document.getElementById(`${page}-actions`)?.classList.add('active');
        document.getElementById(`${page}-filters`)?.classList.add('active');

        const titles = {
            'books': '📖 Каталог книг',
            'readers': '👥 Управление читателями',
            'issues': '🔄 Выдача и возврат',
            'fines': '💸 Управление штрафами',
            'archive': '📦 Архив (Удаленные записи)',
            'reports': '📊 Отчеты и статистика'
        };
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) pageTitle.textContent = titles[page] || 'Библиотека';

        this.currentPage = page;
        this.loadPageData();
    }

    async loadPageData() {
        const loaders = {
            'books': () => this.loadBooks(),
            'readers': () => this.loadReaders(),
            'issues': () => this.loadIssues(),
            'fines': () => this.loadFines(),
            'archive': () => this.loadArchive(),
            'reports': () => this.loadReports()
        };
        if (loaders[this.currentPage]) await loaders[this.currentPage]();
    }

    async loadData(type) {
        try {
            this.showLoading(type, true);
            this[type] = await this.apiCall(`/api/${type}`);
            const renderMethod = `render${type.charAt(0).toUpperCase() + type.slice(1)}`;
            if (this[renderMethod]) {
                this[renderMethod]();
            }
        } catch (error) {
            this.showNotification(`Ошибка загрузки: ${error.message}`, 'error');
        } finally {
            this.showLoading(type, false);
        }
    }

    async saveData(type, formData, id = null) {
        const url = id ? `/api/${type}/${id}` : `/api/${type}`;
        const method = id ? 'PUT' : 'POST';
        try {
            await this.apiCall(url, { method, body: JSON.stringify(formData) });

            const singular = type.endsWith('s') ? type.slice(0, -1) : type;
            const cap = singular.charAt(0).toUpperCase() + singular.slice(1);

            if (this[`close${cap}Modal`]) this[`close${cap}Modal`]();
            await this.loadData(type);
            this.showNotification(id ? 'Обновлено' : 'Добавлено', 'success');
        } catch (error) {
            this.showNotification('Ошибка сохранения: ' + error.message, 'error');
        }
    }

    async deleteData(type, id) {
        if (!confirm(`Переместить запись в архив? Она будет скрыта из списков.`)) return;
        try {
            await this.apiCall(`/api/${type}/${id}`, { method: 'DELETE' });
            await this.loadData(type);
            this.showNotification('Запись перенесена в архив', 'success');
        } catch (error) {
            this.showNotification('Ошибка удаления: ' + error.message, 'error');
        }
    }

    // --- КНИГИ ---
    async loadBooks() { await this.loadData('books'); }

    renderBooks() {
        const container = document.getElementById('books-container');
        if (!container) return;

        const search = document.getElementById('search')?.value.toLowerCase() || '';
        const status = document.getElementById('filter-status')?.value || '';

        let filtered = this.books.filter(b =>
            (b.name.toLowerCase().includes(search) || b.author.toLowerCase().includes(search)) &&
            (!status || b.status === status)
        );

        filtered = this.sortBooks(filtered);
        this.renderBooksTableView(container, filtered);
    }

    sortBooks(books) {
        const methods = {
            'count_asc': (a, b) => a.count - b.count,
            'count_desc': (a, b) => b.count - a.count,
            'default': () => 0
        };
        return [...books].sort(methods[this.bookSortOrder] || methods.default);
    }

    setBookSortOrder(order) {
        this.bookSortOrder = order;
        this.renderBooks();
    }

    renderBooksTableView(container, books) {
        const role = localStorage.getItem('libtool_role');

        let html = `
            <div class="table-container">
                <div class="table-header">
                    <div class="sort-controls">
                        <label>Сортировка:</label>
                        <select onchange="app.setBookSortOrder(this.value)">
                            <option value="default">По умолчанию</option>
                            <option value="count_asc">Кол-во (возр.)</option>
                            <option value="count_desc">Кол-во (убыв.)</option>
                        </select>
                    </div>
                </div>
                <table class="table">
                    <thead><tr><th>ID</th><th>Название</th><th>Автор</th><th>Жанр</th><th>Кол-во</th><th>Статус</th><th>Действия</th></tr></thead>
                    <tbody>
        `;

        books.forEach(book => {
            let actionsHtml = `<button class="btn success small" onclick="app.downloadCertificate(${book.id})" title="Сертификат">📄</button>`;

            if (role === 'SENIOR') {
                actionsHtml += `
                    <button class="btn secondary small" onclick="app.editBook(${book.id})">✏️</button>
                    <button class="btn danger small" onclick="app.deleteBook(${book.id})">📦</button>
                `;
            } else {
                actionsHtml += `<span class="text-muted">Только чтение</span>`;
            }

            html += `
                <tr>
                    <td>${book.id}</td>
                    <td><strong>${this.escapeHtml(book.name)}</strong></td>
                    <td>${this.escapeHtml(book.author)}</td>
                    <td>${this.escapeHtml(book.genre || '-')}</td>
                    <td>${book.count}</td>
                    <td class="status-${book.status}">${book.status === 'available' ? 'Доступно' : 'Выдано'}</td>
                    <td><div class="table-actions">${actionsHtml}</div></td>
                </tr>
            `;
        });

        container.innerHTML = html + '</tbody></table></div>';
    }

    // --- ЧИТАТЕЛИ ---
    async loadReaders() { await this.loadData('readers'); }

    renderReaders() {
        const container = document.getElementById('readers-container');
        if (!container) return;

        const search = document.getElementById('search-readers')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filter-status-readers')?.value || '';

        const filtered = this.readers.filter(r => {
            const matchSearch = r.full_name.toLowerCase().includes(search);
            const matchStatus = !statusFilter || r.status === statusFilter;
            return matchSearch && matchStatus;
        });

        const role = localStorage.getItem('libtool_role');
        let html = `
            <div class="table-container">
                <table class="table">
                    <thead><tr><th>ФИО</th><th>Контакты</th><th>Дата рег.</th><th>Книг</th><th>Статус</th><th>Действия</th></tr></thead>
                    <tbody>
        `;

        filtered.forEach(r => {
            let acts = `<button class="btn success small" onclick="app.downloadReaderReport(${r.id})" title="Скачать справку">📄 Справка</button> `;

            if (role === 'SENIOR') {
                acts += `<button class="btn secondary small" onclick="app.editReader(${r.id})">✏️</button>
                         <button class="btn danger small" onclick="app.deleteReader(${r.id})" title="В архив">📦</button>`;
            }

            html += `
                <tr>
                    <td><strong>${this.escapeHtml(r.full_name)}</strong></td>
                    <td>${this.escapeHtml(r.phone || '-')}<br><small>${this.escapeHtml(r.email || '')}</small></td>
                    <td>${new Date(r.registration_date).toLocaleDateString('ru-RU')}</td>
                    <td>${r.books_count}</td>
                    <td class="status-${r.status}">${r.status === 'active' ? 'Активен' : 'Неактивен'}</td>
                    <td><div class="table-actions">${acts}</div></td>
                </tr>
            `;
        });
        container.innerHTML = html + '</tbody></table></div>';
    }

    async downloadReaderReport(readerId) {
        try {
            this.showNotification('Формирование справки...', 'info');
            const res = await fetch(`/api/readers/${readerId}/report`);
            if (!res.ok) throw new Error('Ошибка генерации');
            await this.downloadFile(res, `spravka_chitatelya_${readerId}.docx`);
            this.showNotification('Справка успешно скачана', 'success');
        } catch (e) {
            this.showNotification('Ошибка скачивания справки', 'error');
        }
    }

    // --- ВЫДАЧИ ---
    async loadIssues() { await this.loadData('issues'); }

    renderIssues() {
        const container = document.getElementById('issues-container');
        if (!container) return;

        const search = document.getElementById('search-issues')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('filter-status-issues')?.value || '';

        const filtered = this.issues.filter(i => {
            const matchSearch = i.book_name.toLowerCase().includes(search) || i.reader_name.toLowerCase().includes(search);
            const matchStatus = !statusFilter || i.status === statusFilter;
            return matchSearch && matchStatus;
        });

        let html = `
            <div class="table-container">
                <table class="table">
                    <thead><tr><th>Книга</th><th>Читатель</th><th>Выдана</th><th>Вернуть до</th><th>Статус</th><th>Действия</th></tr></thead>
                    <tbody>
        `;

        filtered.forEach(i => {
            const isOverdue = i.status === 'overdue';
            const canReturn = i.status !== 'returned';
            const statusText = this.getIssueStatusText(i.status);

            html += `
                <tr>
                    <td><strong>${this.escapeHtml(i.book_name)}</strong></td>
                    <td>${this.escapeHtml(i.reader_name)}</td>
                    <td>${new Date(i.issue_date).toLocaleDateString('ru-RU')}</td>
                    <td class="${isOverdue ? 'text-danger' : ''}">${new Date(i.planned_return_date).toLocaleDateString('ru-RU')}</td>
                    <td class="status-${i.status}">${isOverdue ? '⏰ ' : ''}${statusText}</td>
                    <td>
                        <div class="table-actions">
                            ${canReturn ? `<button class="btn primary small" onclick="app.returnIssue(${i.id})">Принять</button>` : '-'}
                        </div>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html + '</tbody></table></div>';
    }

    getIssueStatusText(status) {
        if (!status) return 'Неизвестно';
        const cleanStatus = status.trim().toLowerCase();
        const statusMap = {
            'issued': 'Выдана',
            'returned': 'Возвращена',
            'overdue': 'Просрочена'
        };
        return statusMap[cleanStatus] || status;
    }

    // --- ШТРАФЫ ---
    async loadFines() { await this.loadData('fines'); }

    renderFines() {
        const container = document.getElementById('fines-container');
        if (!container) return;

        if (!this.fines || this.fines.length === 0) {
            container.innerHTML = '<div class="text-center mt-20">Штрафы отсутствуют</div>';
            return;
        }

        let html = `
            <div class="table-container">
                <table class="table">
                    <thead><tr><th>Читатель</th><th>Книга</th><th>Сумма</th><th>Причина</th><th>Статус</th><th>Действия</th></tr></thead>
                    <tbody>
        `;

        this.fines.forEach(f => {
            html += `
                <tr>
                    <td><strong>${this.escapeHtml(f.reader_name)}</strong></td>
                    <td>${this.escapeHtml(f.book_name)}</td>
                    <td><strong class="text-danger">${f.amount} руб.</strong></td>
                    <td>${this.escapeHtml(f.reason)}</td>
                    <td class="status-${f.paid ? 'active' : 'overdue'}">${f.paid ? 'Оплачен' : 'Долг'}</td>
                    <td>
                        <div class="table-actions">
                            ${!f.paid ? `<button class="btn success small" onclick="app.payFine(${f.id})">💰 Оплатить</button>` : '<span class="text-muted">✅ Оплачено</span>'}
                        </div>
                    </td>
                </tr>
            `;
        });
        container.innerHTML = html + '</tbody></table></div>';
    }

    async payFine(id) {
        if (!confirm('Подтвердить оплату штрафа?')) return;
        try {
            await this.apiCall(`/api/fines/${id}/pay`, { method: 'POST' });
            await this.loadFines();
            this.showNotification('Штраф успешно оплачен', 'success');
        } catch (error) {
            this.showNotification('Ошибка оплаты: ' + error.message, 'error');
        }
    }

    // --- АРХИВ ---
    async loadArchive() {
        try {
            this.showLoading('archive', true);
            const [booksRes, readersRes] = await Promise.all([
                this.apiCall('/api/archive/books'),
                this.apiCall('/api/archive/readers')
            ]);
            this.archivedBooks = booksRes;
            this.archivedReaders = readersRes;
            this.renderArchive();
        } catch (error) {
            this.showNotification('Ошибка загрузки архива: ' + error.message, 'error');
        } finally {
            this.showLoading('archive', false);
        }
    }

    renderArchive() {
        const booksContainer = document.getElementById('archive-books-container');
        const readersContainer = document.getElementById('archive-readers-container');
        if (!booksContainer || !readersContainer) return;

        // Рендер удаленных книг
        if (this.archivedBooks.length === 0) {
            booksContainer.innerHTML = '<div class="text-center text-muted">Нет удаленных книг</div>';
        } else {
            let bHtml = `<div class="table-container"><table class="table"><thead><tr><th>ID</th><th>Название</th><th>Автор</th><th>Действия</th></tr></thead><tbody>`;
            this.archivedBooks.forEach(b => {
                bHtml += `<tr>
                    <td>${b.id}</td><td><strong>${this.escapeHtml(b.name)}</strong></td><td>${this.escapeHtml(b.author)}</td>
                    <td><button class="btn success small" onclick="app.restoreRecord('books', ${b.id})">♻️ Восстановить</button></td>
                </tr>`;
            });
            booksContainer.innerHTML = bHtml + '</tbody></table></div>';
        }

        // Рендер удаленных читателей
        if (this.archivedReaders.length === 0) {
            readersContainer.innerHTML = '<div class="text-center text-muted">Нет удаленных читателей</div>';
        } else {
            let rHtml = `<div class="table-container"><table class="table"><thead><tr><th>ID</th><th>ФИО</th><th>Контакты</th><th>Действия</th></tr></thead><tbody>`;
            this.archivedReaders.forEach(r => {
                rHtml += `<tr>
                    <td>${r.id}</td><td><strong>${this.escapeHtml(r.full_name)}</strong></td><td>${this.escapeHtml(r.phone)}</td>
                    <td><button class="btn success small" onclick="app.restoreRecord('readers', ${r.id})">♻️ Восстановить</button></td>
                </tr>`;
            });
            readersContainer.innerHTML = rHtml + '</tbody></table></div>';
        }
    }

    async restoreRecord(type, id) {
        if (!confirm('Восстановить запись из архива?')) return;
        try {
            await this.apiCall(`/api/archive/${type}/${id}/restore`, { method: 'POST' });
            await this.loadArchive();
            this.showNotification('Запись успешно восстановлена', 'success');
        } catch (error) {
            this.showNotification('Ошибка восстановления: ' + error.message, 'error');
        }
    }


    // --- ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ МОДАЛОК И ФАЙЛОВ ---
    async downloadCertificate(id) {
        try {
            this.showNotification('Генерация...', 'info');
            const res = await fetch(`/api/certificate/${id}`);
            await this.downloadFile(res, `sertifikat_${id}.docx`);
        } catch (e) { this.showNotification('Ошибка сертификата', 'error'); }
    }

    async exportToExcel() {
        try {
            this.showNotification('Готовим Excel...', 'info');
            const res = await fetch('/api/issues/export-excel');
            await this.downloadFile(res, 'vydachi.xlsx');
        } catch (e) { this.showNotification('Ошибка Excel', 'error'); }
    }

    async downloadFile(response, name) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async downloadRules() {
        try {
            const res = await fetch('/api/rules/download');
            await this.downloadFile(res, 'rules.pdf');
        } catch (e) { this.showNotification('Ошибка загрузки правил', 'error'); }
    }

    openModal(type, data = null) {
        const modal = document.getElementById(`modal-${type}`);
        if (data) {
            this.fillForm(`${type}-form`, data);
            document.getElementById(`${type}-delete`)?.classList.remove('hidden');
        } else {
            document.getElementById(`${type}-form`).reset();
            document.getElementById(`${type}-id`).value = '';
            document.getElementById(`${type}-delete`)?.classList.add('hidden');
        }
        modal?.classList.remove('hidden');
    }

    closeModal(type) { document.getElementById(`modal-${type}`).classList.add('hidden'); }

    fillForm(formId, data) {
        const prefix = formId.split('-')[0];
        Object.keys(data).forEach(key => {
            let id = `${prefix}-${key}`;
            if (key === 'full_name') id = `${prefix}-name`;
            const el = document.getElementById(id);
            if (el) el.value = data[key];
        });
    }

    openBookModal(book = null) { this.openModal('book', book); }
    closeBookModal() { this.closeModal('book'); }
    async editBook(id) {
        const book = await this.apiCall(`/api/books/${id}`);
        this.openBookModal(book);
    }
    async saveBook(e) {
        e.preventDefault();
        const formData = {
            name: document.getElementById('book-name').value,
            author: document.getElementById('book-author').value,
            genre: document.getElementById('book-genre').value,
            count: parseInt(document.getElementById('book-count').value)
        };
        const id = document.getElementById('book-id').value;
        await this.saveData('books', formData, id);
    }
    async deleteBook(id) { await this.deleteData('books', id); }
    deleteBookHandler() {
        const id = document.getElementById('book-id').value;
        if (id) this.deleteBook(id);
    }

    openReaderModal(reader = null) { this.openModal('reader', reader); }
    closeReaderModal() { this.closeModal('reader'); }
    editReader(id) {
        const r = this.readers.find(x => x.id === id);
        if (r) this.openReaderModal(r);
    }
    async saveReader(e) {
        e.preventDefault();
        const formData = {
            full_name: document.getElementById('reader-name').value,
            phone: document.getElementById('reader-phone').value,
            email: document.getElementById('reader-email').value,
            address: document.getElementById('reader-address').value,
            status: document.getElementById('reader-status').value
        };
        const id = document.getElementById('reader-id').value;
        await this.saveData('readers', formData, id);
    }
    async deleteReader(id) { await this.deleteData('readers', id); }
    deleteReaderHandler() {
        const id = document.getElementById('reader-id').value;
        if (id) this.deleteReader(id);
    }

    async returnIssue(id) {
        if (!confirm('Принять возврат книги?')) return;
        await this.apiCall(`/api/issues/${id}/return`, { method: 'POST' });
        await this.loadIssues();
        this.showNotification('Книга возвращена', 'success');
    }

    openIssueModal() {
        this.populateIssueSelects();
        document.getElementById('issue-date').value = new Date().toISOString().split('T')[0];
        document.getElementById('modal-issue').classList.remove('hidden');
    }

    closeIssueModal() {
        this.closeModal('issue');
    }

    filterIssueSelect(type, query) {
        const select = document.getElementById(`issue-${type}`);
        if (!select) return;

        const q = query.toLowerCase();
        select.innerHTML = `<option value="">Выберите ${type === 'book' ? 'книгу' : 'читателя'}</option>`;

        if (type === 'book') {
            this.books.filter(b => b.count > 0 && (b.name.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)))
                      .forEach(b => select.innerHTML += `<option value="${b.id}">${this.escapeHtml(b.name)} (${b.count} шт)</option>`);
        } else {
            this.readers.filter(r => r.status === 'active' && r.full_name.toLowerCase().includes(q))
                        .forEach(r => select.innerHTML += `<option value="${r.id}">${this.escapeHtml(r.full_name)}</option>`);
        }
    }

    async populateIssueSelects() {
        if (this.books.length === 0) await this.loadBooks();
        if (this.readers.length === 0) await this.loadReaders();

        document.getElementById('search-issue-book').value = '';
        document.getElementById('search-issue-reader').value = '';

        this.filterIssueSelect('book', '');
        this.filterIssueSelect('reader', '');
    }

    async saveIssue(e) {
        e.preventDefault();
        const data = {
            book_id: parseInt(document.getElementById('issue-book').value),
            reader_id: parseInt(document.getElementById('issue-reader').value),
            planned_return_date: document.getElementById('issue-return-date').value
        };
        await this.apiCall('/api/issues', { method: 'POST', body: JSON.stringify(data) });
        this.closeIssueModal();
        await Promise.all([this.loadIssues(), this.loadBooks()]);
        this.showNotification('Книга выдана', 'success');
    }

    // --- ОТЧЕТЫ ---
    async loadReports() {
        try {
            this.showLoading('reports', true);
            const stats = await this.apiCall('/api/reports/stats');
            this.renderReports(stats);
        } catch (error) {
            this.showNotification('Ошибка загрузки отчетов: ' + error.message, 'error');
        } finally {
            this.showLoading('reports', false);
            const loadingEl = document.getElementById('reports-loading');
            if (loadingEl) loadingEl.style.display = 'none';
            const containerEl = document.getElementById('reports-container');
            if (containerEl) containerEl.style.display = 'block';
        }
    }

    renderReports(stats) {
        const container = document.getElementById('reports-container');
        if (!container) return;

        container.innerHTML = `
            <div class="reports-container">
                <div class="report-card">
                    <h3>📊 Статистика системы</h3>
                    <div class="stats-grid">
                        <div class="stat-item"><span>Всего книг:</span> <strong>${stats.books.total}</strong></div>
                        <div class="stat-item"><span>Доступно:</span> <strong>${stats.books.available}</strong></div>
                        <div class="stat-item"><span>Читателей:</span> <strong>${stats.readers.total}</strong></div>
                        <div class="stat-item"><span>Выдано:</span> <strong>${stats.issues.current}</strong></div>
                        <div class="stat-item"><span>Просрочено:</span> <strong class="text-danger">${stats.issues.overdue}</strong></div>
                    </div>
                </div>
                <div class="report-card">
                    <h3>📚 Жанры</h3>
                    <div style="height: 300px;"><canvas id="genreChart"></canvas></div>
                </div>
            </div>
        `;
        this.renderGenreChart(stats.genres);
    }

    renderGenreChart(genres) {
        const ctx = document.getElementById('genreChart').getContext('2d');
        if (this.genresChart) this.genresChart.destroy();
        this.genresChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(genres),
                datasets:[{
                    data: Object.values(genres),
                    backgroundColor:['#3498db', '#e74c3c', '#2ecc71', '#f1c40f', '#9b59b6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ АВТОРИЗАЦИИ ===
let app = null;

function checkAuth() {
    return localStorage.getItem('libtool_logged_in') === 'true';
}

function startApp(role) {
    localStorage.setItem('libtool_logged_in', 'true');
    if (role) {
        localStorage.setItem('libtool_role', role.toUpperCase());
    }

    document.getElementById('login-modal').classList.add('hidden');

    if (!app) {
        app = new LibToolApp();
    } else {
        app.applyPermissions();
    }
}

function showLogin() {
    document.getElementById('login-modal').classList.remove('hidden');
}

function logout() {
    if (confirm('Вы уверены, что хотите выйти?')) {
        localStorage.clear();
        window.location.reload();
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.onclick = logout;

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const errorLabel = document.getElementById('login-error');

            try {
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({ username, password })
                });

                if (!res.ok) throw new Error();

                const data = await res.json();
                startApp(data.role);
            } catch {
                if (errorLabel) errorLabel.classList.remove('hidden');
            }
        };
    }

    if (checkAuth()) {
        startApp(localStorage.getItem('libtool_role'));
    } else {
        showLogin();
    }
});