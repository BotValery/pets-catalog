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

    // Базовый метод для запросов
    async request(endpoint, options = {}) {
        // Определяем базовый URL динамически при каждом запросе
        const apiBaseUrl = getApiBaseUrlDynamic();
        const url = `${apiBaseUrl}${endpoint}`;
        const config = {
            ...options,
            headers: {
                ...this.getHeaders(),
                ...options.headers
            }
        };

        try {
            const response = await fetch(url, config);
            
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

    async saveEmergencyText(text) {
        return await this.request('/admin/settings/emergency-text', {
            method: 'POST',
            body: JSON.stringify({ text })
        });
    }
}

// Создаем глобальный экземпляр
const apiClient = new ApiClient();

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}

