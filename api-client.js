// ---------------------------------------------------------------------------
// Защита от XSS: любые данные с сервера (имена, описания, контакты и т.д.)
// перед вставкой в HTML через innerHTML нужно пропускать через escapeHtml().
// ---------------------------------------------------------------------------
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Безопасная ссылка для href: разрешены только http(s), mailto, tel и относительные адреса.
// Адрес без схемы (например, "site.ru") дополняется https://
function safeUrl(value) {
    if (!value) return '#';
    let url = String(value).trim();
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url) && !url.startsWith('/') && !url.startsWith('#')) {
        url = 'https://' + url;
    }
    if (!/^(https?:|mailto:|tel:|\/|#)/i.test(url)) return '#';
    return escapeHtml(url);
}

// Безопасный адрес для CSS url('...'): экранируем символы, которыми можно «выйти» из url()
function cssUrl(value) {
    if (!value) return '';
    return String(value).replace(/['"()\\\s]/g, ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'));
}

// Адрес обложки фото для карточек в списках (кадр 4:3):
// /uploads/<id>.jpg -> /uploads/<id>_c.jpg (старые base64-фото возвращаются как есть)
function thumbUrl(url) {
    const m = typeof url === 'string' && url.match(/^\/uploads\/([a-f0-9]{32})(?:_t|_c)?\.jpg$/);
    return m ? '/uploads/' + m[1] + '_c.jpg' : url;
}

if (typeof window !== 'undefined') {
    window.thumbUrl = thumbUrl;
    window.escapeHtml = escapeHtml;
    window.safeUrl = safeUrl;
    window.cssUrl = cssUrl;
}

// API клиент для работы с сервером
// Можно переопределить через window.API_BASE_URL или переменную окружения
// В продакшене используйте относительный путь или установите window.API_BASE_URL
const getApiBaseUrl = () => {
    // Если установлен window.API_BASE_URL, проверяем, не указывает ли он на старый домен
    if (typeof window !== 'undefined' && window.API_BASE_URL) {
        const apiBaseUrl = window.API_BASE_URL;
        // Игнорируем старый домен anodruzya.ru и очищаем его
        if (apiBaseUrl.includes('anodruzya.ru')) {
            console.warn('Обнаружен старый домен в API_BASE_URL, очищаем и используем относительный путь');
            delete window.API_BASE_URL; // Очищаем старый URL
        } else {
            return apiBaseUrl;
        }
    }
    // В продакшене всегда используем относительный путь
    if (typeof window !== 'undefined' && window.location) {
        const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
        if (isProduction) {
            return '/api'; // Относительный путь для продакшена
        }
    }
    return 'http://localhost:3000/api'; // Только для разработки
};

// Определяем базовый URL динамически при каждом запросе, чтобы избежать проблем с кэшированием
const getApiBaseUrlDynamic = () => {
    return getApiBaseUrl();
};

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    // Установка токена
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('authToken', token);
        } else {
            localStorage.removeItem('authToken');
        }
    }

    // Получение заголовков
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    // Вход истёк или недействителен: сбрасываем его, чтобы сайт не показывал «вы вошли»,
    // когда сервер уже не принимает запросы. silent — без перехода на страницу входа.
    handleSessionExpired(silent) {
        this.setToken(null);
        localStorage.removeItem('currentUser');
        if (typeof window === 'undefined') return;
        if (typeof window.updateNavigation === 'function') window.updateNavigation();
        const onAuthPage = /auth\.html$/.test(window.location.pathname);
        if (!window.__sessionExpiredShown && typeof NotificationSystem !== 'undefined' && !onAuthPage) {
            window.__sessionExpiredShown = true;
            NotificationSystem.warning('Сессия истекла — войдите в аккаунт снова', 5000);
        }
        if (!silent && !onAuthPage) {
            const back = window.location.pathname + window.location.search;
            setTimeout(() => { window.location.href = 'auth.html?return=' + encodeURIComponent(back); }, 1500);
        }
    }

    // Базовый метод для запросов
    async request(endpoint, options = {}) {
        // Определяем базовый URL динамически при каждом запросе
        const apiBaseUrl = getApiBaseUrlDynamic();
        const url = `${apiBaseUrl}${endpoint}`;
        const { silent, ...fetchOptions } = options;
        // токен мог обновиться в другой вкладке
        this.token = localStorage.getItem('authToken');
        const sentToken = this.token;
        const config = {
            ...fetchOptions,
            headers: {
                ...this.getHeaders(),
                ...fetchOptions.headers
            }
        };

        try {
            const response = await fetch(url, config);

            // Сервер продлил вход — сохраняем новый токен
            const renewed = response.headers.get('X-Auth-Token');
            if (renewed && sentToken) this.setToken(renewed);

            // Вход истёк: сбрасываем его (только если запрос шёл с токеном)
            if (response.status === 401 && sentToken) {
                let code = null;
                try { code = (await response.clone().json()).code; } catch (e) {}
                if (code === 'AUTH_EXPIRED' || code === 'AUTH_REQUIRED') this.handleSessionExpired(silent);
            }
            
            // Проверяем, есть ли ответ
            if (!response.ok) {
                let errorMessage = 'Ошибка запроса';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorData.message || errorMessage;
                    // Если есть массив ошибок валидации
                    if (errorData.errors && Array.isArray(errorData.errors)) {
                        errorMessage = errorData.errors.map(e => e.msg || e.message).join(', ');
                    }
                } catch (e) {
                    // Если не удалось распарсить JSON, используем статус
                    errorMessage = `Ошибка ${response.status}: ${response.statusText}`;
                }
                const error = new Error(errorMessage);
                error.response = { status: response.status, error: errorMessage };
                throw error;
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Error:', error);
            // Если это ошибка сети
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                const serverUrl = typeof window !== 'undefined' && window.location 
                    ? `${window.location.protocol}//${window.location.host}/api`
                    : 'сервер';
                throw new Error(`Сервер недоступен. Убедитесь, что сервер запущен на ${serverUrl}`);
            }
            throw error;
        }
    }

    // Аутентификация
    async registerUser(userData) {
        const data = await this.request('/auth/register/user', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    async registerShelter(shelterData) {
        const data = await this.request('/auth/register/shelter', {
            method: 'POST',
            body: JSON.stringify(shelterData)
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    async login(identifier, password) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ identifier, password })
        });
        if (data.token) {
            this.setToken(data.token);
        }
        return data;
    }

    async getCurrentUser() {
        return await this.request('/auth/me');
    }

    logout() {
        this.setToken(null);
    }

    // Питомцы
    async getPets(filters = {}) {
        // Удаляем adopted из фильтров, если он есть (это не стандартный фильтр API)
        const apiFilters = { ...filters };
        delete apiFilters.adopted;
        
        const queryParams = new URLSearchParams(apiFilters).toString();
        const endpoint = `/pets${queryParams ? '?' + queryParams : ''}`;
        const data = await this.request(endpoint);
        
        // Фильтруем по adopted на клиенте, если нужно
        if (filters.adopted !== undefined) {
            data.pets = (data.pets || []).filter(pet => pet.adopted === filters.adopted);
        }
        
        return data;
    }

    async getPet(id) {
        return await this.request(`/pets/${id}`);
    }

    async getShelterPets() {
        return await this.request('/pets/shelter/my-pets');
    }

    async getShelterAdoptedPets() {
        return await this.request('/pets/shelter/adopted');
    }

    async getAdoptedCount() {
        return await this.request('/pets/adopted-count');
    }

    async addPet(petData) {
        return await this.request('/pets', {
            method: 'POST',
            body: JSON.stringify(petData)
        });
    }

    async updatePet(id, petData) {
        return await this.request(`/pets/${id}`, {
            method: 'PUT',
            body: JSON.stringify(petData)
        });
    }

    async deletePet(id) {
        return await this.request(`/pets/${id}`, {
            method: 'DELETE'
        });
    }

    async adoptPet(id) {
        return await this.request(`/pets/${id}/adopt`, {
            method: 'PATCH'
        });
    }

    async updateSterilizationStatus(id, status) {
        return await this.request(`/pets/${id}/sterilization`, {
            method: 'PATCH',
            body: JSON.stringify({ sterilizationStatus: status })
        });
    }

    async updateAdoptStatus(id, adopted) {
        return await this.request(`/pets/${id}/adopt-status`, {
            method: 'PATCH',
            body: JSON.stringify({ adopted: adopted })
        });
    }

    // Заявки
    async getApplications() {
        return await this.request('/applications');
    }

    async getApplicationsByPet(petId) {
        return await this.request(`/applications/pet/${petId}`);
    }

    async createApplication(applicationData) {
        return await this.request('/applications', {
            method: 'POST',
            body: JSON.stringify(applicationData)
        });
    }

    async updateApplicationStatus(id, status) {
        return await this.request(`/applications/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ status })
        });
    }

    // Пользователи
    async getUsers() {
        return await this.request('/users');
    }

    async getUser(id) {
        return await this.request(`/users/${id}`);
    }

    async updateUser(id, userData) {
        return await this.request(`/users/${id}`, {
            method: 'PUT',
            body: JSON.stringify(userData)
        });
    }

    async deleteUser(id) {
        return await this.request(`/users/${id}`, {
            method: 'DELETE'
        });
    }

    // Передержки
    async getShelters() {
        return await this.request('/shelters');
    }

    async getShelter(id) {
        return await this.request(`/shelters/${id}`);
    }

    async updateShelter(id, shelterData) {
        return await this.request(`/shelters/${id}`, {
            method: 'PUT',
            body: JSON.stringify(shelterData)
        });
    }

    async deleteShelter(id) {
        return await this.request(`/shelters/${id}`, {
            method: 'DELETE'
        });
    }

    // Волонтеры
    async getVolunteers() {
        return await this.request('/volunteers');
    }

    async createVolunteer(volunteerData) {
        return await this.request('/volunteers', {
            method: 'POST',
            body: JSON.stringify(volunteerData)
        });
    }

    // Объявления
    async getAnnouncements(type = null) {
        const endpoint = `/announcements${type ? `?type=${type}` : ''}`;
        return await this.request(endpoint);
    }

    async createAnnouncement(announcementData) {
        return await this.request('/announcements', {
            method: 'POST',
            body: JSON.stringify(announcementData)
        });
    }

    async getAnnouncement(id) {
        return await this.request(`/announcements/${id}`);
    }

    async updateAnnouncement(id, announcementData) {
        return await this.request(`/announcements/${id}`, {
            method: 'PUT',
            body: JSON.stringify(announcementData)
        });
    }

    async deleteAnnouncement(id) {
        return await this.request(`/announcements/${id}`, {
            method: 'DELETE'
        });
    }

    async resolveAnnouncement(id) {
        return await this.request(`/announcements/${id}/resolve`, {
            method: 'PATCH'
        });
    }

    // Новости
    async getNews() {
        return await this.request('/news');
    }

    async getNewsItem(id) {
        return await this.request(`/news/${id}`);
    }

    async createNews(newsData) {
        return await this.request('/news', {
            method: 'POST',
            body: JSON.stringify(newsData)
        });
    }

    async updateNews(id, newsData) {
        return await this.request(`/news/${id}`, {
            method: 'PUT',
            body: JSON.stringify(newsData)
        });
    }

    async deleteNews(id) {
        return await this.request(`/news/${id}`, {
            method: 'DELETE'
        });
    }

    // Советы ветеринаров
    async getAdvice() {
        return await this.request('/advice');
    }

    async getAdviceItem(id) {
        return await this.request(`/advice/${id}`);
    }

    async createAdvice(adviceData) {
        return await this.request('/advice', {
            method: 'POST',
            body: JSON.stringify(adviceData)
        });
    }

    async updateAdvice(id, adviceData) {
        return await this.request(`/advice/${id}`, {
            method: 'PUT',
            body: JSON.stringify(adviceData)
        });
    }

    async deleteAdvice(id) {
        return await this.request(`/advice/${id}`, {
            method: 'DELETE'
        });
    }

    async syncNews(waitForResult = false) {
        const endpoint = waitForResult ? '/news/sync-wait' : '/news/sync';
        return await this.request(endpoint, {
            method: 'POST'
        });
    }

    // Админ
    async getAdminStats() {
        return await this.request('/admin/stats');
    }

    async getUsersAndShelters() {
        return await this.request('/admin/users-and-shelters');
    }

    // Зоомагазины
    async getShops() {
        return await this.request('/shops');
    }

    async getShop(id) {
        return await this.request(`/shops/${id}`);
    }

    async createShop(shopData) {
        return await this.request('/shops', {
            method: 'POST',
            body: JSON.stringify(shopData)
        });
    }

    async updateShop(id, shopData) {
        return await this.request(`/shops/${id}`, {
            method: 'PUT',
            body: JSON.stringify(shopData)
        });
    }

    async deleteShop(id) {
        return await this.request(`/shops/${id}`, {
            method: 'DELETE'
        });
    }

    // Ветклиники
    async getClinics() {
        return await this.request('/clinics');
    }

    async getClinic(id) {
        return await this.request(`/clinics/${id}`);
    }

    async createClinic(clinicData) {
        return await this.request('/clinics', {
            method: 'POST',
            body: JSON.stringify(clinicData)
        });
    }

    async updateClinic(id, clinicData) {
        return await this.request(`/clinics/${id}`, {
            method: 'PUT',
            body: JSON.stringify(clinicData)
        });
    }

    async deleteClinic(id) {
        return await this.request(`/clinics/${id}`, {
            method: 'DELETE'
        });
    }

    // Настройки
    async getEmergencyText() {
        return await this.request('/settings/emergency-text');
    }

    async saveEmergencyText(text, image = undefined) {
        return await this.request('/admin/settings/emergency-text', {
            method: 'POST',
            body: JSON.stringify({ text, image })
        });
    }

    // Донаты
    async createDonationPayment(donationData) {
        return await this.request('/donations/create-payment', {
            method: 'POST',
            body: JSON.stringify(donationData)
        });
    }

    async getDonationStatus(donationId) {
        return await this.request(`/donations/status/${donationId}`);
    }
}

// Создаем глобальный экземпляр
const apiClient = new ApiClient();

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}

// При открытии страницы тихо проверяем вход: сервер продлит его, а истёкший сразу сбросится
// (имя пропадёт из меню и появится «Вход»), вместо ошибок при первом же действии.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        if (!localStorage.getItem('authToken') || !localStorage.getItem('currentUser')) return;
        apiClient.request('/auth/me', { silent: true }).then(data => {
            if (!data || !data.user) return;
            try {
                const old = JSON.parse(localStorage.getItem('currentUser') || '{}');
                localStorage.setItem('currentUser', JSON.stringify({ ...old, ...data.user }));
            } catch (e) {}
        }).catch(() => {});
    });
}

// ---------------------------------------------------------------------------
// Возврат к тому же месту списка после просмотра карточки животного.
// remember() — перед переходом в карточку; take() — при возврате (кнопка «Назад» браузера
// или ссылка «Назад» на странице животного); scrollTo() — прокрутить к той же карточке.
// ---------------------------------------------------------------------------
const ScrollReturn = {
    KEY: 'scrollReturn',
    MAX_AGE: 2 * 60 * 60 * 1000,
    remember(page, card, extra) {
        try {
            sessionStorage.setItem(this.KEY, JSON.stringify({
                page, id: card && card.dataset ? card.dataset.petId : null,
                offset: card ? Math.round(card.getBoundingClientRect().top) : 0,
                y: Math.round(window.scrollY), extra: extra || null, t: Date.now()
            }));
        } catch (e) {}
    },
    // Вернуть сохранённое место, только если мы действительно вернулись со страницы животного
    take(page) {
        let state = null;
        try { state = JSON.parse(sessionStorage.getItem(this.KEY) || 'null'); } catch (e) {}
        if (!state || state.page !== page || Date.now() - state.t > this.MAX_AGE) return null;
        const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
        const cameBack = (nav && nav.type === 'back_forward') || /pet-detail\.html/.test(document.referrer);
        try { sessionStorage.removeItem(this.KEY); } catch (e) {}
        return cameBack ? state : null;
    },
    scrollTo(state, root) {
        if (!state) return;
        const go = () => {
            const card = state.id && (root || document).querySelector(`[data-pet-id="${CSS.escape(String(state.id))}"]`);
            const y = card ? card.getBoundingClientRect().top + window.scrollY - state.offset : state.y;
            window.scrollTo(0, Math.max(0, y));
        };
        requestAnimationFrame(() => { go(); setTimeout(go, 300); }); // второй раз — после догрузки шрифтов и картинок
    }
};
if (typeof window !== 'undefined') {
    window.ScrollReturn = ScrollReturn;
    // страница достана из кэша браузера целиком — прокрутка уже на месте, сохранённое не нужно
    window.addEventListener('pageshow', e => { if (e.persisted) { try { sessionStorage.removeItem(ScrollReturn.KEY); } catch (err) {} } });
}
