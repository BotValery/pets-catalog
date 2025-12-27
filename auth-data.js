// Система управления пользователями с использованием API
const AuthSystem = {
    // Инициализация (проверка подключения к API)
    async init() {
        try {
            await apiClient.request('/health');
            return true;
        } catch (error) {
            console.error('API недоступен:', error);
            throw new Error('Сервер недоступен. Убедитесь, что сервер запущен.');
        }
    },

    // Регистрация пользователя
    async saveUser(user) {
        try {
            // Получаем чистый номер телефона из маски
            const cleanPhone = user.phone ? PhoneMask.getCleanPhone(user.phone) : null;
            
            const data = await apiClient.registerUser({
                name: user.name,
                telegram: user.telegram,
                password: user.password,
                phone: cleanPhone || user.phone,
                city: user.city || null,
                address: user.address || null
            });
            
            if (data.token && data.user) {
                localStorage.setItem('currentUser', JSON.stringify({ type: 'user', ...data.user }));
            }
            
            return data.user.id;
        } catch (error) {
            console.error('Ошибка регистрации пользователя:', error);
            // Более детальное сообщение об ошибке
            if (error.message) {
                throw new Error(error.message);
            } else if (error.response) {
                throw new Error(error.response.error || 'Ошибка регистрации');
            } else {
                throw new Error('Сервер недоступен. Проверьте подключение к серверу.');
            }
        }
    },

    // Регистрация передержки
    async saveShelter(shelter) {
        try {
            // Получаем чистый номер телефона из маски
            const cleanPhone = shelter.phone ? PhoneMask.getCleanPhone(shelter.phone) : null;
            
            const data = await apiClient.registerShelter({
                shelterName: shelter.shelterName,
                authorizedPerson: shelter.authorizedPerson || null,
                address: shelter.address || null,
                phone: cleanPhone || shelter.phone || null,
                viber: shelter.viber || null,
                telegram: shelter.telegram || null,
                website: shelter.website || null,
                email: shelter.email,
                password: shelter.password,
                agreementAccepted: shelter.agreementAccepted
            });
            
            if (data.token && data.user) {
                localStorage.setItem('currentUser', JSON.stringify({ type: 'shelter', ...data.user }));
        }
            
            return data.user.id;
        } catch (error) {
            console.error('Ошибка регистрации передержки:', error);
            // Более детальное сообщение об ошибке
            if (error.message) {
                throw new Error(error.message);
            } else if (error.response) {
                throw new Error(error.response.error || 'Ошибка регистрации');
            } else {
                throw new Error('Сервер недоступен. Проверьте подключение к серверу.');
            }
        }
    },

    // Сохранить админа (только для миграции, в продакшене админ создается через init-db.js)
    async saveAdmin(admin) {
        return null;
    },

    // Найти пользователя по email (только для админов)
    async findUserByEmail(email) {
        try {
            // Эта функция требует админских прав, поэтому просто возвращаем null
            // Проверка существующего email будет выполнена на сервере при регистрации
            return null;
        } catch (error) {
            console.error('Ошибка поиска пользователя:', error);
            return null;
        }
    },

    // Найти передержку по email (только для админов)
    async findShelterByEmail(email) {
        try {
            // Эта функция требует админских прав, поэтому просто возвращаем null
            // Проверка существующего email будет выполнена на сервере при регистрации
            return null;
        } catch (error) {
            console.error('Ошибка поиска передержки:', error);
            return null;
        }
    },

    // Найти админа по email (не используется через API)
    async findAdminByEmail(email) {
        return null;
    },

    // Вход пользователя (универсальный - по email или телефону)
    async login(identifier, password) {
        try {
            const data = await apiClient.login(identifier, password);
            
            if (data.token && data.user) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                return { success: true, type: data.user.type, user: data.user };
        }

            return { success: false, message: 'Ошибка входа' };
        } catch (error) {
            console.error('Ошибка входа:', error);
            return { success: false, message: error.message || 'Неверный email/телефон или пароль' };
        }
    },

    // Выход
    logout() {
        localStorage.removeItem('currentUser');
        apiClient.logout();
    },

    // Получить текущего пользователя
    getCurrentUser() {
        const userStr = localStorage.getItem('currentUser');
        return userStr ? JSON.parse(userStr) : null;
    },

    // Проверить, авторизован ли пользователь
    isAuthenticated() {
        return this.getCurrentUser() !== null;
    }
};
