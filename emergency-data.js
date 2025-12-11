// Система управления объявлениями через API
const AnnouncementsSystem = {
    // Инициализация
    async init() {
        return true;
    },

    // Получить все объявления о потерянных животных
    async getLostPets() {
        try {
            const data = await apiClient.getAnnouncements('lost');
            return data.announcements || [];
        } catch (error) {
            console.error('Ошибка получения объявлений о потерянных:', error);
            return [];
        }
    },

    // Получить все объявления о найденных животных
    async getFoundPets() {
        try {
            const data = await apiClient.getAnnouncements('found');
            return data.announcements || [];
        } catch (error) {
            console.error('Ошибка получения объявлений о найденных:', error);
            return [];
        }
    },

    // Сохранить объявление о потерянном животном
    async saveLostPet(announcement) {
        try {
            const data = await apiClient.createAnnouncement({
                type: 'lost',
                name: announcement.name,
                type_animal: announcement.petType || announcement.type_animal,
                breed: announcement.breed,
                color: announcement.color,
                size: announcement.size || null,
                location: announcement.location,
                date: announcement.date,
                description: announcement.description,
                contact: announcement.contact,
                photos: announcement.photos || [],
                age: announcement.age || null,
                gender: announcement.gender || null
            });
            
            return data.announcement.id;
        } catch (error) {
            console.error('Ошибка сохранения объявления:', error);
            throw error;
        }
    },

    // Сохранить объявление о найденном животном
    async saveFoundPet(announcement) {
        try {
            const data = await apiClient.createAnnouncement({
                type: 'found',
                name: announcement.name || null,
                type_animal: announcement.petType || announcement.type_animal,
                breed: announcement.breed,
                color: announcement.color,
                size: announcement.size || null,
                location: announcement.location,
                date: announcement.date,
                description: announcement.description,
                contact: announcement.contact,
                photos: announcement.photos || [],
                age: announcement.age || null,
                gender: announcement.gender || null
            });
            
            return data.announcement.id;
        } catch (error) {
            console.error('Ошибка сохранения объявления:', error);
            throw error;
        }
    },

    // Получить счетчик найденных животных
    getFoundCounter() {
        return parseInt(localStorage.getItem('foundCounter')) || 0;
    },

    // Обновить счетчик найденных животных
    updateFoundCounter(count) {
        localStorage.setItem('foundCounter', count);
    },

    // Сбросить счетчик найденных животных
    resetFoundCounter() {
        localStorage.removeItem('foundCounter');
    },

    // Получить объявление по ID
    async getAnnouncement(id) {
        try {
            const data = await apiClient.getAnnouncement(id);
            return data.announcement;
        } catch (error) {
            console.error('Ошибка получения объявления:', error);
            throw error;
        }
    },

    // Обновить объявление
    async updateAnnouncement(id, announcement) {
        try {
            const data = await apiClient.updateAnnouncement(id, {
                name: announcement.name,
                type_animal: announcement.petType || announcement.type_animal,
                breed: announcement.breed,
                color: announcement.color,
                size: announcement.size || null,
                location: announcement.location,
                date: announcement.date,
                description: announcement.description,
                contact: announcement.contact,
                photos: announcement.photos || [],
                age: announcement.age || null,
                gender: announcement.gender || null
            });
            return data.announcement;
        } catch (error) {
            console.error('Ошибка обновления объявления:', error);
            throw error;
        }
    },

    // Удалить объявление
    async deleteAnnouncement(id) {
        try {
            await apiClient.deleteAnnouncement(id);
            return true;
        } catch (error) {
            console.error('Ошибка удаления объявления:', error);
            throw error;
        }
    },

    // Отметить объявление как найденное/вернутое
    async resolveAnnouncement(id, type) {
        try {
            await apiClient.resolveAnnouncement(id);
            
            // Обновляем счетчик для найденных животных
            if (type === 'found') {
                const currentCount = this.getFoundCounter();
                this.updateFoundCounter(currentCount + 1);
            }
            
            return true;
        } catch (error) {
            console.error('Ошибка отметки объявления:', error);
            throw error;
        }
    }
};

// Функция для форматирования даты
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Функции getTypeText и getGenderText теперь определены в pets-data.js
// Используем глобальные функции из pets-data.js, если они доступны
// Если pets-data.js не подключен, определяем локальные версии
if (typeof getTypeText === 'undefined') {
    function getTypeText(type) {
        return type === 'dog' ? 'Собака' : 'Кошка';
    }
    window.getTypeText = getTypeText;
}

if (typeof getGenderText === 'undefined') {
    function getGenderText(gender) {
        if (!gender) return 'Неизвестно';
        return gender === 'male' ? 'Мальчик' : 'Девочка';
    }
    window.getGenderText = getGenderText;
}
