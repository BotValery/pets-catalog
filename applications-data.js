// Система управления заявками на животных через API
const ApplicationsSystem = {
    // Инициализация
    async init() {
        // Проверка не требуется, API клиент сам обрабатывает ошибки
        return true;
    },

    // Создать заявку на животное
    async createApplication(petId, shelterId, userName, userPhone, userEmail) {
        try {
            const user = AuthSystem.getCurrentUser();
            
            // Проверяем существующие заявки
            const existingApps = await apiClient.getApplicationsByPet(petId);
            if (user && existingApps.applications.some(app => app.userId === user.id)) {
                return { success: false, message: 'Вы уже подали заявку на это животное' };
            }
            
            const data = await apiClient.createApplication({
                petId: petId,
                userName: userName,
                userPhone: userPhone,
                userEmail: userEmail
            });
            
            return { success: true, id: data.application.id };
        } catch (error) {
            console.error('Ошибка создания заявки:', error);
            return { success: false, message: error.message || 'Ошибка создания заявки' };
        }
    },

    // Обновить статус заявки
    async updateApplicationStatus(applicationId, status) {
        try {
            console.log('Отправка запроса на обновление статуса:', { applicationId, status });
            const response = await apiClient.updateApplicationStatus(applicationId, status);
            console.log('Ответ сервера:', response);
            
            // Если статус "забрали", питомец автоматически отмечается как забранный на сервере
            // Если статус "вернули", питомец автоматически возвращается в каталог на сервере
            return { success: true, response };
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            const errorMessage = error.message || error.response?.error || 'Ошибка обновления статуса';
            return { success: false, message: errorMessage };
        }
    },

    // Получить все заявки для передержки
    async getShelterApplications(shelterId) {
        try {
            const data = await apiClient.getApplications();
            const user = AuthSystem.getCurrentUser();
            
            // Если это передержка, сервер вернет только её заявки
            // Если админ, вернутся все заявки
            return data.applications || [];
        } catch (error) {
            console.error('Ошибка получения заявок:', error);
            return [];
        }
    },

    // Получить заявки пользователя
    async getUserApplications(userId) {
        try {
            const data = await apiClient.getApplications();
            return (data.applications || []).filter(app => app.userId === userId);
        } catch (error) {
            console.error('Ошибка получения заявок пользователя:', error);
            return [];
        }
    },

    // Получить количество пристроенных животных
    async getAdoptedCount() {
        try {
            const data = await apiClient.getAdoptedCount();
            return data.count || 0;
        } catch (error) {
            console.error('Ошибка получения количества пристроенных животных:', error);
            return 0;
        }
    }
};
