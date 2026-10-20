// Скрипты для админ-панели
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    
    if (!currentUser || currentUser.type !== 'admin') {
        // Перенаправляем на страницу входа, если не админ
        window.location.href = 'auth.html';
        return;
    }
    
    // Проверяем подключение к API
    try {
        await apiClient.request('/health');
    } catch (error) {
        NotificationSystem.error('Сервер недоступен. Проверьте подключение к серверу.');
        console.error('API недоступен:', error);
    }
    
    // Инициализируем вкладки
    initTabs();
    
    // Инициализируем кнопку выхода
    initLogout();
    
    // Загружаем данные
    await loadAdminData();
});

// Инициализация вкладок
function initTabs() {
    const tabButtons = document.querySelectorAll('.admin-tab-btn');
    const tabContents = document.querySelectorAll('.admin-tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            console.log('🔀 Переключение на вкладку:', tabName);
            
            // Убираем активный класс у всех кнопок и контента
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс текущей кнопке и контенту
            this.classList.add('active');
            const targetTab = document.getElementById(tabName + 'Tab');
            if (targetTab) {
                targetTab.classList.add('active');
                console.log('✅ Вкладка активирована:', tabName + 'Tab');
            } else {
                console.error('❌ Вкладка не найдена:', tabName + 'Tab');
            }
            
            // Загружаем данные для выбранной вкладки
            if (tabName === 'volunteers') {
                loadVolunteers();
            } else if (tabName === 'applications') {
                loadAllApplications();
            } else if (tabName === 'users') {
                loadUsersAndShelters();
            } else if (tabName === 'news') {
                loadNews();
            } else if (tabName === 'advice') {
                loadAdvice();
            } else if (tabName === 'shops') {
                loadShops();
            } else if (tabName === 'clinics') {
                loadClinics();
            } else if (tabName === 'settings') {
                loadSettings();
            }
        });
    });
}

// Инициализация кнопки выхода
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            NotificationSystem.confirm(
                'Вы уверены, что хотите выйти?',
                () => {
                    AuthSystem.logout();
                    window.location.href = 'auth.html';
                }
            );
        });
    }
}

// Загрузка данных для админ-панели
async function loadAdminData() {
    try {
        // Получаем статистику через API
        const statsData = await apiClient.getAdminStats();
        const stats = statsData.stats;
        
        // Получаем всех питомцев (включая забранных) для админ-панели
        const allPetsData = await apiClient.getPets({ all: 'true' });
        const allPets = allPetsData.pets || [];
        
        // Фильтруем забранных питомцев (adopted может быть true, 1, '1' или любое truthy значение)
        const adoptedPets = allPets.filter(pet => {
            const adopted = pet.adopted;
            return adopted === true || adopted === 1 || adopted === '1' || (typeof adopted === 'number' && adopted !== 0);
        });
        
        // Получаем волонтеров и заявки
        const volunteersData = await apiClient.getVolunteers();
        const volunteers = volunteersData.volunteers || [];
        const applicationsData = await apiClient.getApplications();
        const applications = applicationsData.applications || [];
        
        // Получаем пользователей и передержки для статистики
        const usersSheltersData = await apiClient.getUsersAndShelters();
        const users = usersSheltersData.users || [];
        const shelters = usersSheltersData.shelters || [];
        
        // Обновляем статистику
        updateStats(allPets, adoptedPets, volunteers, applications, users, shelters);
        
        // Отображаем список забранных питомцев
        displayAdoptedPets(adoptedPets);
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        NotificationSystem.error('Произошла ошибка при загрузке данных');
    }
}

// Обновление статистики
function updateStats(allPets, adoptedPets, volunteers, applications, users, shelters) {
    const totalAdopted = document.getElementById('totalAdopted');
    const totalPets = document.getElementById('totalPets');
    const availablePets = document.getElementById('availablePets');
    const totalVolunteers = document.getElementById('totalVolunteers');
    const totalApplications = document.getElementById('totalApplications');
    
    if (totalAdopted) totalAdopted.textContent = adoptedPets.length;
    if (totalPets) totalPets.textContent = allPets.length;
    if (availablePets) availablePets.textContent = allPets.length - adoptedPets.length;
    if (totalVolunteers) totalVolunteers.textContent = volunteers ? volunteers.length : 0;
    if (totalApplications) totalApplications.textContent = applications ? applications.length : 0;
    
    // Добавляем статистику по пользователям и передержкам, если есть соответствующие элементы
    // Можно добавить в будущем, если понадобится
}

// Отображение списка забранных питомцев
function displayAdoptedPets(adoptedPets) {
    const listContainer = document.getElementById('adoptedPetsList');
    
    if (!listContainer) return;
    
    if (adoptedPets.length === 0) {
        listContainer.innerHTML = '<div class="no-adopted-pets">Пока нет забранных питомцев</div>';
        return;
    }
    
    // Сортируем по дате (самые свежие первыми)
    adoptedPets.sort((a, b) => {
        const dateA = a.adoptedAt ? new Date(a.adoptedAt) : new Date(0);
        const dateB = b.adoptedAt ? new Date(b.adoptedAt) : new Date(0);
        return dateB - dateA;
    });
    
    let html = '';
    
    adoptedPets.forEach(pet => {
        // Используем годы и месяцы если они есть, иначе вычисляем из age
        const ageText = getAgeText(pet.age, pet.ageYears, pet.ageMonths);
        const typeText = getTypeText(pet.type);
        const genderText = getGenderText(pet.gender);
        const sizeText = getSizeText(pet.size);
        
        // Статусы стерилизации
        const sterilizationStatuses = {
            'sterilized': 'Стерелизована',
            'will_sterilize': 'Сами стерилизуют',
            'under_sterilization': 'Под стерилизацию'
        };
        
        const currentSterilizationStatus = pet.sterilizationStatus || '';
        const sterilizationStatusText = sterilizationStatuses[currentSterilizationStatus] || 'Не указано';
        
        // Определяем изображение
        let imageHtml = `<div class="adopted-pet-image">${escapeHtml(pet.icon || (pet.type === 'dog' ? '🐕' : '🐱'))}</div>`;
        
        // Обрабатываем фотографии (могут быть массивом или строкой JSON)
        let photos = [];
        if (pet.photos) {
            if (Array.isArray(pet.photos)) {
                photos = pet.photos;
            } else if (typeof pet.photos === 'string') {
                try {
                    photos = JSON.parse(pet.photos);
                } catch (e) {
                    console.warn('Ошибка парсинга фотографий для питомца', pet.id, e);
                    photos = [];
                }
            }
        }
        
        if (photos.length > 0) {
            imageHtml = `<img src="${escapeHtml(photos[0])}" alt="${escapeHtml(pet.name)}" class="adopted-pet-image">`;
        }
        
        // Форматируем дату
        let adoptedDateText = 'Дата неизвестна';
        if (pet.adoptedAt) {
            const date = new Date(pet.adoptedAt);
            adoptedDateText = date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
        
        // Определяем цвет и иконку для статуса стерилизации
        let sterilizationBadge = '';
        if (currentSterilizationStatus) {
            let badgeColor = '#667eea';
            let badgeIcon = '✓';
            if (currentSterilizationStatus === 'sterilized') {
                badgeColor = '#48bb78';
                badgeIcon = '✓';
            } else if (currentSterilizationStatus === 'will_sterilize') {
                badgeColor = '#ed8936';
                badgeIcon = '📋';
            } else if (currentSterilizationStatus === 'under_sterilization') {
                badgeColor = '#4299e1';
                badgeIcon = '⏳';
            }
            sterilizationBadge = `<div style="margin-top: 0.5rem; padding: 0.5rem; background: ${badgeColor}15; border-left: 3px solid ${badgeColor}; border-radius: 4px;">
                <strong style="color: ${badgeColor};">${badgeIcon} Статус стерилизации:</strong> <span style="color: #333;">${escapeHtml(sterilizationStatusText)}</span>
            </div>`;
        }
        
        html += `
            <div class="adopted-pet-card">
                ${imageHtml}
                <div class="adopted-pet-info">
                    <h3>${escapeHtml(pet.name)}</h3>
                    <div class="adopted-pet-details">
                        <div class="adopted-pet-detail"><strong>Тип:</strong> ${escapeHtml(typeText)}</div>
                        <div class="adopted-pet-detail"><strong>Возраст:</strong> ${escapeHtml(ageText)}</div>
                        <div class="adopted-pet-detail"><strong>Пол:</strong> ${escapeHtml(genderText)}</div>
                        <div class="adopted-pet-detail"><strong>Размер:</strong> ${escapeHtml(sizeText)}</div>
                        ${pet.breed ? `<div class="adopted-pet-detail"><strong>Порода:</strong> ${escapeHtml(pet.breed)}</div>` : ''}
                        ${pet.color ? `<div class="adopted-pet-detail"><strong>Цвет:</strong> ${escapeHtml(pet.color)}</div>` : ''}
                        ${pet.shelterName ? `<div class="adopted-pet-detail"><strong>Передержка:</strong> ${escapeHtml(pet.shelterName)}</div>` : ''}
                    </div>
                    ${pet.description ? `<p style="margin-top: 0.5rem; color: #666;">${escapeHtml(pet.description)}</p>` : ''}
                    <div class="adopted-date">✅ Забран: ${escapeHtml(adoptedDateText)}</div>
                    ${sterilizationBadge}
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// Загрузка волонтеров
async function loadVolunteers() {
    try {
        const data = await apiClient.getVolunteers();
        const volunteers = data.volunteers || [];
        displayVolunteers(volunteers);
    } catch (error) {
        console.error('Ошибка загрузки волонтеров:', error);
        NotificationSystem.error('Произошла ошибка при загрузке волонтеров');
    }
}

// Отображение волонтеров
function displayVolunteers(volunteers) {
    const listContainer = document.getElementById('volunteersList');
    
    if (!listContainer) return;
    
    if (volunteers.length === 0) {
        listContainer.innerHTML = '<div class="no-adopted-pets">Пока нет заявок от волонтеров</div>';
        return;
    }
    
    // Сортируем по дате (самые свежие первыми)
    volunteers.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
    });
    
    let html = '';
    
    volunteers.forEach(volunteer => {
        const activitiesMap = {
            'walking': 'Выгул животных',
            'foster': 'Временная передержка',
            'cleaning': 'Уборка в передержке',
            'social': 'Помощь в соцсетях',
            'events': 'Организация мероприятий',
            'other': 'Другое'
        };
        
        const activitiesHtml = volunteer.activities && volunteer.activities.length > 0
            ? volunteer.activities.map(act => `<span class="activity-badge">${escapeHtml(activitiesMap[act] || act)}</span>`).join('')
            : '<span class="activity-badge">Не указано</span>';
        
        const dateText = volunteer.date 
            ? new Date(volunteer.date).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Дата неизвестна';
        
        html += `
            <div class="volunteer-card">
                <h4>${escapeHtml(volunteer.name)}</h4>
                <div class="volunteer-info">
                    <p><strong>Возраст:</strong> ${escapeHtml(volunteer.age || 'Не указан')}</p>
                    <p><strong>Телефон:</strong> ${escapeHtml(volunteer.phone || 'Не указан')}</p>
                    <p><strong>Email:</strong> ${escapeHtml(volunteer.email || 'Не указан')}</p>
                    <p><strong>Город:</strong> ${escapeHtml(volunteer.city || 'Не указан')}</p>
                    <p><strong>Дата заявки:</strong> ${escapeHtml(dateText)}</p>
                </div>
                <div>
                    <strong>Виды деятельности:</strong>
                    <div class="volunteer-activities">
                        ${activitiesHtml}
                    </div>
                </div>
                ${volunteer.experience ? `<p style="margin-top: 1rem;"><strong>Опыт:</strong> ${escapeHtml(volunteer.experience)}</p>` : ''}
                ${volunteer.availability ? `<p style="margin-top: 0.5rem;"><strong>Доступность:</strong> ${escapeHtml(volunteer.availability)}</p>` : ''}
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// Загрузка всех заявок на животных
async function loadAllApplications() {
    try {
        const data = await apiClient.getApplications();
        const applications = data.applications || [];
        
        // Информация о питомцах уже включена в ответ API
        displayAllApplications(applications);
    } catch (error) {
        console.error('Ошибка загрузки заявок:', error);
        NotificationSystem.error('Произошла ошибка при загрузке заявок');
    }
}

// Отображение всех заявок на животных
function displayAllApplications(applications) {
    const listContainer = document.getElementById('allApplicationsList');
    
    if (!listContainer) return;
    
    if (applications.length === 0) {
        listContainer.innerHTML = '<div class="no-adopted-pets">Пока нет заявок на животных</div>';
        return;
    }
    
    // Сортируем по дате (самые свежие первыми)
    applications.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
        return dateB - dateA;
    });
    
    const statusColors = {
        'новое': '#667eea',
        'договорились': '#48bb78',
        'отказались': '#f56565',
        'забрали': '#38a169',
        'вернули': '#ed8936'
    };
    
    const statusTexts = {
        'новое': 'Новое',
        'договорились': 'Договорились',
        'отказались': 'Отказались',
        'забрали': 'Забрали',
        'вернули': 'Вернули'
    };
    
    let html = '';
    
    applications.forEach(app => {
        const dateText = app.createdAt 
            ? new Date(app.createdAt).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : 'Дата неизвестна';
        
        html += `
            <div class="application-card">
                <h4>${escapeHtml(app.pet ? app.pet.name : 'Животное не найдено')}</h4>
                <span class="application-status" style="background-color: ${escapeHtml(statusColors[app.status] || '#999')}; color: white; padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.85rem;">
                    ${escapeHtml(statusTexts[app.status] || app.status)}
                </span>
                <div class="application-info">
                    <p><strong>Пользователь:</strong> ${escapeHtml(app.userName || 'Не указан')}</p>
                    <p><strong>Телефон:</strong> ${escapeHtml(app.userPhone || 'Не указан')}</p>
                    <p><strong>Email:</strong> ${escapeHtml(app.userEmail || 'Не указан')}</p>
                    <p><strong>Дата заявки:</strong> ${escapeHtml(dateText)}</p>
                    ${app.pet ? `<p><strong>Передержка:</strong> ${escapeHtml(app.pet.shelterName || 'Не указана')}</p>` : ''}
                </div>
            </div>
        `;
    });
    
    listContainer.innerHTML = html;
}

// Переключение вкладок пользователей/передержек
window.switchUsersTab = function(filter, event) {
    // Предотвращаем всплытие события, чтобы не закрывались выпадающие меню
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
    }
    
    // Добавляем флаг, чтобы обработчики закрытия знали, что это клик по вкладке
    if (event && event.target) {
        event.target.setAttribute('data-tab-click', 'true');
        setTimeout(() => {
            if (event.target) {
                event.target.removeAttribute('data-tab-click');
            }
        }, 200);
    }
    
    const buttons = document.querySelectorAll('#usersTab .admin-tab-btn[data-subtab]');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    if (filter === 'users') {
        document.querySelector('[data-subtab="users-only"]').classList.add('active');
    } else if (filter === 'shelters') {
        document.querySelector('[data-subtab="shelters-only"]').classList.add('active');
    } else {
        document.querySelector('[data-subtab="all-users"]').classList.add('active');
    }
    
    loadUsersAndShelters(filter);
};

// Загрузка пользователей и передержек
async function loadUsersAndShelters(filter = 'all') {
    try {
        const data = await apiClient.getUsersAndShelters();
        const users = data.users || [];
        const shelters = data.shelters || [];
        
        displayUsersAndShelters(users, shelters, filter);
    } catch (error) {
        console.error('Ошибка загрузки пользователей и передержек:', error);
        NotificationSystem.error('Произошла ошибка при загрузке данных');
    }
}

// Отображение пользователей и передержек
function displayUsersAndShelters(users, shelters, filter) {
    const listContainer = document.getElementById('usersList');
    
    if (!listContainer) return;
    
    let allItems = [];
    
    // Добавляем пользователей
    if (filter === 'all' || filter === 'users') {
        users.forEach(user => {
            allItems.push({
                type: 'user',
                data: user
            });
        });
    }
    
    // Добавляем передержки
    if (filter === 'all' || filter === 'shelters') {
        shelters.forEach(shelter => {
            allItems.push({
                type: 'shelter',
                data: shelter
            });
        });
    }
    
    if (allItems.length === 0) {
        let message = 'Пока нет зарегистрированных ';
        if (filter === 'users') {
            message += 'пользователей';
        } else if (filter === 'shelters') {
            message += 'передержек';
        } else {
            message += 'пользователей и передержек';
        }
        listContainer.innerHTML = `<div class="no-adopted-pets">${message}</div>`;
        return;
    }
    
    // Сортируем по дате регистрации (самые свежие первыми)
    allItems.sort((a, b) => {
        const dateA = a.data.registeredAt ? new Date(a.data.registeredAt) : new Date(0);
        const dateB = b.data.registeredAt ? new Date(b.data.registeredAt) : new Date(0);
        return dateB - dateA;
    });
    
    let html = '';
    
    allItems.forEach(item => {
        const data = item.data;
        const isUser = item.type === 'user';
        
        // Форматируем дату регистрации
        let regDateText = 'Дата неизвестна';
        if (data.registeredAt) {
            const date = new Date(data.registeredAt);
            regDateText = date.toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
        
        if (isUser) {
            // Карточка пользователя
            html += `
                <div class="user-card">
                    <div class="user-card-header">
                        <h4>
                            ${escapeHtml(data.name || 'Имя не указано')}
                            <span class="user-type-badge">Пользователь</span>
                        </h4>
                        <button class="btn-secondary" onclick="deleteUser(${escapeHtml(data.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #d32f2f; color: white; border: none; cursor: pointer; border-radius: 4px; white-space: nowrap;" title="Удалить пользователя">🗑️ Удалить</button>
                    </div>
                    <div class="user-info">
                        <p><strong>Email:</strong> ${escapeHtml(data.email || 'Не указан')}</p>
                        <p><strong>Телефон:</strong> ${escapeHtml(data.phone || 'Не указан')}</p>
                        ${data.city ? `<p><strong>Город:</strong> ${escapeHtml(data.city)}</p>` : ''}
                        ${data.address ? `<p><strong>Адрес:</strong> ${escapeHtml(data.address)}</p>` : ''}
                    </div>
                    <div class="registration-date">📅 Зарегистрирован: ${escapeHtml(regDateText)}</div>
                </div>
            `;
        } else {
            // Карточка передержки
            html += `
                <div class="shelter-card">
                    <div class="shelter-card-header">
                        <h4>
                            ${escapeHtml(data.shelterName || 'Название не указано')}
                            <span class="shelter-type-badge">Передержка</span>
                        </h4>
                        <button class="btn-secondary" onclick="deleteShelter(${escapeHtml(data.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #d32f2f; color: white; border: none; cursor: pointer; border-radius: 4px; white-space: nowrap;" title="Удалить передержку">🗑️ Удалить</button>
                    </div>
                    <div class="shelter-info">
                        <p><strong>Email:</strong> ${escapeHtml(data.email || 'Не указан')}</p>
                        <p><strong>Телефон:</strong> ${escapeHtml(data.phone || 'Не указан')}</p>
                        ${data.authorizedPerson ? `<p><strong>Уполномоченное лицо:</strong> ${escapeHtml(data.authorizedPerson)}</p>` : ''}
                        ${data.address ? `<p><strong>Адрес:</strong> ${escapeHtml(data.address)}</p>` : ''}
                        ${data.viber ? `<p><strong>Viber:</strong> ${escapeHtml(data.viber)}</p>` : ''}
                        ${data.telegram ? `<p><strong>Telegram:</strong> ${escapeHtml(data.telegram)}</p>` : ''}
                        ${data.website ? `<p><strong>Сайт:</strong> <a href="${safeUrl(data.website)}" target="_blank" style="color: #667eea;">${escapeHtml(data.website)}</a></p>` : ''}
                    </div>
                    <div class="registration-date">📅 Зарегистрирован: ${escapeHtml(regDateText)}</div>
                </div>
            `;
        }
    });
    
    listContainer.innerHTML = html;
}

// Загрузка новостей
async function loadNews() {
    const newsList = document.getElementById('newsList');
    newsList.innerHTML = '<div class="no-adopted-pets">Загрузка...</div>';
    
    try {
        const response = await apiClient.getNews();
        const news = response.news || [];
        displayNews(news);
    } catch (error) {
        console.error('Ошибка загрузки новостей:', error);
        newsList.innerHTML = '<div class="no-adopted-pets" style="color: #d32f2f;">Ошибка загрузки новостей</div>';
    }
}

// Отображение новостей
function displayNews(news) {
    const newsList = document.getElementById('newsList');
    
    if (news.length === 0) {
        newsList.innerHTML = '<div class="no-adopted-pets">Новостей пока нет</div>';
        return;
    }
    
    // Сортируем по дате (новые первыми)
    const sortedNews = [...news].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB - dateA;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    
    newsList.innerHTML = sortedNews.map(item => {
        const date = new Date(item.date);
        const dateText = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        return `
            <div class="application-card" style="position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0;">
                            ${escapeHtml(item.title)}
                            ${item.important ? '<span style="background: #d32f2f; color: white; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; margin-left: 0.5rem;">Важно</span>' : ''}
                        </h4>
                        <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
                            📅 ${escapeHtml(dateText)} | 📢 ${escapeHtml(item.source)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-secondary" onclick="editNews(${escapeHtml(item.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem;">✏️ Редактировать</button>
                        <button class="btn-secondary" onclick="deleteNews(${escapeHtml(item.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #d32f2f; color: white; border: none;">🗑️ Удалить</button>
                    </div>
                </div>
                <p style="margin: 0; color: #666; line-height: 1.6;">${escapeHtml(item.content)}</p>
            </div>
        `;
    }).join('');
}

// Открытие модального окна для добавления/редактирования новости
window.openNewsModal = function(newsId = null) {
    const modal = document.getElementById('newsModal');
    const form = document.getElementById('newsForm');
    const title = document.getElementById('newsModalTitle');
    
    if (newsId) {
        // Редактирование
        title.textContent = 'Редактировать новость';
        form.dataset.newsId = newsId;
        
        // Загружаем данные новости
        apiClient.getNewsItem(newsId).then(response => {
            const news = response.news;
            document.getElementById('newsTitle').value = news.title;
            document.getElementById('newsSource').value = news.source;
            document.getElementById('newsDate').value = news.date;
            document.getElementById('newsContent').value = news.content;
            document.getElementById('newsImportant').checked = news.important === 1 || news.important === true;
        }).catch(error => {
            console.error('Ошибка загрузки новости:', error);
            NotificationSystem.error('Ошибка загрузки новости');
        });
    } else {
        // Добавление
        title.textContent = 'Добавить новость';
        form.dataset.newsId = '';
        form.reset();
        document.getElementById('newsDate').value = new Date().toISOString().split('T')[0];
    }
    
    modal.style.display = 'flex';
};

// Закрытие модального окна
window.closeNewsModal = function() {
    const modal = document.getElementById('newsModal');
    modal.style.display = 'none';
    const form = document.getElementById('newsForm');
    form.reset();
    form.dataset.newsId = '';
};

// Редактирование новости
window.editNews = function(newsId) {
    openNewsModal(newsId);
};

// Удаление новости
window.deleteNews = function(newsId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить эту новость?',
        async () => {
            try {
                await apiClient.deleteNews(newsId);
                NotificationSystem.success('Новость успешно удалена');
                loadNews();
            } catch (error) {
                console.error('Ошибка удаления новости:', error);
                NotificationSystem.error('Ошибка удаления новости');
            }
        }
    );
};

// Синхронизация новостей с сайта госветслужбы
window.syncNewsFromGosvet = async function() {
    const btn = document.getElementById('syncNewsBtn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '⏳ Синхронизация...';
    
    try {
        const result = await apiClient.syncNews(true); // Ждем результат
        
        if (result.saved > 0 || result.skipped > 0) {
            NotificationSystem.success(
                `Синхронизация завершена! Найдено: ${result.total || 0}, Сохранено новых: ${result.saved}, Пропущено дубликатов: ${result.skipped}`
            );
        } else {
            NotificationSystem.warning('Новые новости не найдены или произошла ошибка');
        }
        
        // Обновляем список новостей
        loadNews();
    } catch (error) {
        console.error('Ошибка синхронизации новостей:', error);
        NotificationSystem.error('Ошибка синхронизации новостей: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// Обновление контента существующих новостей
window.updateNewsContent = async function() {
    const btn = document.getElementById('updateContentBtn');
    const originalText = btn.textContent;
    
    btn.disabled = true;
    btn.textContent = '⏳ Обновление контента...';
    
    try {
        const result = await apiClient.request('/news/update-content', {
            method: 'POST'
        });
        
        if (result.updated > 0) {
            NotificationSystem.success(
                `Контент обновлен для ${result.updated} из ${result.total} новостей`
            );
        } else {
            NotificationSystem.warning('Контент новостей уже актуален или новости не найдены');
        }
        
        // Обновляем список новостей
        loadNews();
    } catch (error) {
        console.error('Ошибка обновления контента:', error);
        NotificationSystem.error('Ошибка обновления контента: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
};

// Обработка формы новости
document.addEventListener('DOMContentLoaded', function() {
    const newsForm = document.getElementById('newsForm');
    if (newsForm) {
        newsForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const newsId = this.dataset.newsId;
            const newsData = {
                title: document.getElementById('newsTitle').value.trim(),
                source: document.getElementById('newsSource').value.trim(),
                date: document.getElementById('newsDate').value,
                content: document.getElementById('newsContent').value.trim(),
                important: document.getElementById('newsImportant').checked
            };
            
            try {
                if (newsId) {
                    // Обновление
                    await apiClient.updateNews(newsId, newsData);
                    NotificationSystem.success('Новость успешно обновлена');
                } else {
                    // Создание
                    await apiClient.createNews(newsData);
                    NotificationSystem.success('Новость успешно создана');
                }
                
                closeNewsModal();
                loadNews();
            } catch (error) {
                console.error('Ошибка сохранения новости:', error);
                NotificationSystem.error(error.message || 'Ошибка сохранения новости');
            }
        });
    }
    
    // Закрытие модального окна при клике вне его
    const newsModal = document.getElementById('newsModal');
    if (newsModal) {
        newsModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeNewsModal();
            }
        });
    }

    // Обработка формы совета ветеринара через делегирование событий
    // Используем делегирование, так как форма может быть в скрытом модальном окне
    document.addEventListener('submit', async function(e) {
        const form = e.target;
        
        // Проверяем, что это форма совета
        if (form.id === 'adviceForm') {
            e.preventDefault();
            e.stopPropagation();
            
            // Проверяем наличие обязательных полей формы совета
            const adviceTitle = document.getElementById('adviceTitle');
            if (!adviceTitle) {
                console.error('❌ Поле adviceTitle не найдено!');
                return;
            }
            
            const adviceId = form.dataset.adviceId;
            const tipsText = document.getElementById('adviceTips').value.trim();
            const tips = tipsText.split('\n').filter(tip => tip.trim() !== '').map(tip => tip.trim());
            
            const adviceData = {
                title: document.getElementById('adviceTitle').value.trim(),
                author: document.getElementById('adviceAuthor').value.trim(),
                date: document.getElementById('adviceDate').value,
                category: document.getElementById('adviceCategory').value.trim(),
                content: document.getElementById('adviceContent').value.trim(),
                tips: tips
            };
            
            try {
                if (adviceId) {
                    // Обновление
                    await apiClient.updateAdvice(adviceId, adviceData);
                    NotificationSystem.success('Совет успешно обновлен');
                } else {
                    // Создание
                    await apiClient.createAdvice(adviceData);
                    NotificationSystem.success('Совет успешно создан');
                }
                
                closeAdviceModal();
                loadAdvice();
            } catch (error) {
                console.error('Ошибка сохранения совета:', error);
                NotificationSystem.error(error.message || 'Ошибка сохранения совета');
            }
        }
    });
    
    // Закрытие модального окна при клике вне его
    const adviceModal = document.getElementById('adviceModal');
    if (adviceModal) {
        adviceModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeAdviceModal();
            }
        });
    }

    // Обработка формы зоомагазина
    const shopForm = document.getElementById('shopForm');
    if (shopForm) {
        shopForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const shopId = this.dataset.shopId;
            const shopData = {
                name: document.getElementById('shopName').value.trim(),
                address: document.getElementById('shopAddress').value.trim(),
                phone: document.getElementById('shopPhone').value.trim(),
                hours: document.getElementById('shopHours').value.trim(),
                description: document.getElementById('shopDescription').value.trim(),
                products: document.getElementById('shopProducts').value.trim()
            };
            
            try {
                if (shopId) {
                    // Обновление
                    await apiClient.updateShop(shopId, shopData);
                    NotificationSystem.success('Зоомагазин успешно обновлен');
                } else {
                    // Создание
                    await apiClient.createShop(shopData);
                    NotificationSystem.success('Зоомагазин успешно создан');
                }
                
                closeShopModal();
                loadShops();
            } catch (error) {
                console.error('Ошибка сохранения зоомагазина:', error);
                NotificationSystem.error(error.message || 'Ошибка сохранения зоомагазина');
            }
        });
    }
    
    // Закрытие модального окна зоомагазина при клике вне его
    const shopModal = document.getElementById('shopModal');
    if (shopModal) {
        shopModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeShopModal();
            }
        });
    }

    // Обработка формы ветклиники через делегирование событий
    // Используем делегирование, так как форма может быть в скрытом модальном окне
    document.addEventListener('submit', async function(e) {
        const form = e.target;
        
        // Проверяем, что это форма ветклиники
        if (form.id === 'clinicForm') {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('💾 Сохранение ветклиники...');
            
            // Проверяем наличие обязательных полей формы ветклиники
            const clinicName = document.getElementById('clinicName');
            if (!clinicName) {
                console.error('❌ Поле clinicName не найдено!');
                return;
            }
            
            const clinicId = form.dataset.clinicId;
            const clinicData = {
                name: document.getElementById('clinicName').value.trim(),
                address: document.getElementById('clinicAddress').value.trim(),
                phone: document.getElementById('clinicPhone').value.trim(),
                hours: document.getElementById('clinicHours').value.trim(),
                services: document.getElementById('clinicServices').value.trim()
            };
            
            console.log('📝 Данные ветклиники:', clinicData);
            console.log('🆔 ID ветклиники (для обновления):', clinicId || 'новый');
            
            try {
                if (clinicId) {
                    // Обновление
                    console.log('🔄 Обновление ветклиники...');
                    await apiClient.updateClinic(clinicId, clinicData);
                    NotificationSystem.success('Ветклиника успешно обновлена');
                } else {
                    // Создание
                    console.log('➕ Создание новой ветклиники...');
                    await apiClient.createClinic(clinicData);
                    NotificationSystem.success('Ветклиника успешно создана');
                }
                
                console.log('✅ Ветклиника сохранена, закрываем модальное окно и обновляем список');
                closeClinicModal();
                loadClinics();
            } catch (error) {
                console.error('❌ Ошибка сохранения ветклиники:', error);
                NotificationSystem.error(error.message || 'Ошибка сохранения ветклиники');
            }
        }
    });
    
    // Закрытие модального окна ветклиники при клике вне его
    const clinicModal = document.getElementById('clinicModal');
    if (clinicModal) {
        clinicModal.addEventListener('click', function(e) {
            if (e.target === this) {
                closeClinicModal();
            }
        });
    }
});

// Загрузка зоомагазинов
async function loadShops() {
    try {
        const shopsData = await apiClient.getShops();
        const shops = shopsData.shops || [];
        
        const shopsList = document.getElementById('shopsList');
        if (!shopsList) return;
        
        if (shops.length === 0) {
            shopsList.innerHTML = '<div class="no-adopted-pets">Зоомагазины не найдены</div>';
            return;
        }
        
        shopsList.innerHTML = shops.map(shop => `
            <div class="volunteer-card" style="position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <h4>${escapeHtml(shop.name)}</h4>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-edit-pet" onclick="editShop(${escapeHtml(shop.id)})" title="Редактировать">✏️</button>
                        <button class="btn-delete-pet" onclick="deleteShop(${escapeHtml(shop.id)})" title="Удалить">🗑️</button>
                    </div>
                </div>
                <div class="volunteer-info">
                    <p><strong>📍 Адрес:</strong> ${escapeHtml(shop.address)}</p>
                    <p><strong>📞 Телефон:</strong> ${escapeHtml(shop.phone)}</p>
                    <p><strong>⏰ Часы работы:</strong> ${escapeHtml(shop.hours)}</p>
                </div>
                ${shop.description ? `<p style="margin-top: 0.5rem;"><strong>Описание:</strong> ${escapeHtml(shop.description)}</p>` : ''}
                ${shop.products ? `<p style="margin-top: 0.5rem;"><strong>Товары:</strong> ${escapeHtml(shop.products)}</p>` : ''}
            </div>
        `).join('');
    } catch (error) {
        console.error('Ошибка загрузки зоомагазинов:', error);
        NotificationSystem.error('Ошибка загрузки зоомагазинов');
    }
}

// Открытие модального окна для добавления зоомагазина
window.openShopModal = function(shopId = null) {
    const modal = document.getElementById('shopModal');
    const form = document.getElementById('shopForm');
    const title = document.getElementById('shopModalTitle');
    
    if (!modal || !form || !title) return;
    
    // Очищаем форму
    form.reset();
    form.dataset.shopId = shopId || '';
    
    if (shopId) {
        title.textContent = 'Редактировать зоомагазин';
        // Загружаем данные зоомагазина
        apiClient.getShop(shopId).then(data => {
            const shop = data.shop;
            document.getElementById('shopName').value = shop.name || '';
            document.getElementById('shopAddress').value = shop.address || '';
            document.getElementById('shopPhone').value = shop.phone || '';
            document.getElementById('shopHours').value = shop.hours || '';
            document.getElementById('shopDescription').value = shop.description || '';
            document.getElementById('shopProducts').value = shop.products || '';
        }).catch(error => {
            console.error('Ошибка загрузки зоомагазина:', error);
            NotificationSystem.error('Ошибка загрузки данных зоомагазина');
        });
    } else {
        title.textContent = 'Добавить зоомагазин';
    }
    
    modal.style.display = 'flex';
};

// Закрытие модального окна зоомагазина
window.closeShopModal = function() {
    const modal = document.getElementById('shopModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Редактирование зоомагазина
window.editShop = function(shopId) {
    openShopModal(shopId);
};

// Удаление зоомагазина
window.deleteShop = function(shopId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить этот зоомагазин?',
        async () => {
            try {
                await apiClient.deleteShop(shopId);
                NotificationSystem.success('Зоомагазин успешно удален');
                loadShops();
            } catch (error) {
                console.error('Ошибка удаления зоомагазина:', error);
                NotificationSystem.error(error.message || 'Ошибка удаления зоомагазина');
            }
        }
    );
};

// Загрузка ветклиник
async function loadClinics() {
    try {
        console.log('🔄 Загрузка ветклиник...');
        const clinicsData = await apiClient.getClinics();
        console.log('📦 Данные ветклиник получены:', clinicsData);
        const clinics = clinicsData.clinics || [];
        console.log('🏥 Количество ветклиник:', clinics.length);
        
        const clinicsList = document.getElementById('clinicsList');
        if (!clinicsList) {
            console.error('❌ Элемент clinicsList не найден!');
            return;
        }
        
        if (clinics.length === 0) {
            clinicsList.innerHTML = '<div class="no-adopted-pets">Ветклиники не найдены</div>';
            console.log('ℹ️  Ветклиники не найдены');
            return;
        }
        
        clinicsList.innerHTML = clinics.map(clinic => `
            <div class="volunteer-card" style="position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <h4>${escapeHtml(clinic.name)}</h4>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-edit-pet" onclick="editClinic(${escapeHtml(clinic.id)})" title="Редактировать">✏️</button>
                        <button class="btn-delete-pet" onclick="deleteClinic(${escapeHtml(clinic.id)})" title="Удалить">🗑️</button>
                    </div>
                </div>
                <div class="volunteer-info">
                    <p><strong>📍 Адрес:</strong> ${escapeHtml(clinic.address)}</p>
                    <p><strong>📞 Телефон:</strong> ${escapeHtml(clinic.phone)}</p>
                    <p><strong>⏰ Часы работы:</strong> ${escapeHtml(clinic.hours)}</p>
                </div>
                ${clinic.services ? `<p style="margin-top: 0.5rem;"><strong>🩺 Услуги:</strong> ${escapeHtml(clinic.services)}</p>` : ''}
            </div>
        `).join('');
        console.log('✅ Ветклиники отображены');
    } catch (error) {
        console.error('❌ Ошибка загрузки ветклиник:', error);
        NotificationSystem.error('Ошибка загрузки ветклиник: ' + (error.message || 'Неизвестная ошибка'));
        
        const clinicsList = document.getElementById('clinicsList');
        if (clinicsList) {
            clinicsList.innerHTML = '<div class="no-adopted-pets" style="color: #e53e3e;">Ошибка загрузки ветклиник. Проверьте консоль для деталей.</div>';
        }
    }
}

// Открытие модального окна для добавления ветклиники
window.openClinicModal = function(clinicId = null) {
    const modal = document.getElementById('clinicModal');
    const form = document.getElementById('clinicForm');
    const title = document.getElementById('clinicModalTitle');
    
    if (!modal || !form || !title) return;
    
    // Очищаем форму
    form.reset();
    form.dataset.clinicId = clinicId || '';
    
    if (clinicId) {
        title.textContent = 'Редактировать ветклинику';
        // Загружаем данные ветклиники
        apiClient.getClinic(clinicId).then(data => {
            const clinic = data.clinic;
            document.getElementById('clinicName').value = clinic.name || '';
            document.getElementById('clinicAddress').value = clinic.address || '';
            document.getElementById('clinicPhone').value = clinic.phone || '';
            document.getElementById('clinicHours').value = clinic.hours || '';
            document.getElementById('clinicServices').value = clinic.services || '';
        }).catch(error => {
            console.error('Ошибка загрузки ветклиники:', error);
            NotificationSystem.error('Ошибка загрузки данных ветклиники');
        });
    } else {
        title.textContent = 'Добавить ветклинику';
    }
    
    modal.style.display = 'flex';
};

// Закрытие модального окна ветклиники
window.closeClinicModal = function() {
    const modal = document.getElementById('clinicModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Редактирование ветклиники
window.editClinic = function(clinicId) {
    openClinicModal(clinicId);
};

// Удаление ветклиники
window.deleteClinic = function(clinicId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить эту ветклинику?',
        async () => {
            try {
                await apiClient.deleteClinic(clinicId);
                NotificationSystem.success('Ветклиника успешно удалена');
                loadClinics();
            } catch (error) {
                console.error('Ошибка удаления ветклиники:', error);
                NotificationSystem.error(error.message || 'Ошибка удаления ветклиники');
            }
        }
    );
};

// Обработчик ограничения выбора файлов (максимум 2)
document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('emergencyImageInput');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            if (this.files.length > 2) {
                NotificationSystem.warning('Можно выбрать только 2 картинки. Будут загружены первые 2.');
                // Оставляем только первые 2 файла
                const dt = new DataTransfer();
                for (let i = 0; i < Math.min(2, this.files.length); i++) {
                    dt.items.add(this.files[i]);
                }
                this.files = dt.files;
            }
        });
    }
});

// Загрузка настроек
async function loadSettings() {
    try {
        const data = await apiClient.getEmergencyText();
        const textInput = document.getElementById('emergencyTextInput');
        const imagePreview = document.getElementById('emergencyImagePreview');
        const imagePreviewContainer = document.getElementById('emergencyImagePreviewContainer');
        
        if (textInput) {
            textInput.value = data.text || '';
        }
        
        // Обрабатываем картинки (может быть одна строка или массив)
        let images = [];
        if (data.image) {
            if (typeof data.image === 'string' && data.image.trim() !== '') {
                try {
                    // Пытаемся распарсить как JSON (массив)
                    images = JSON.parse(data.image);
                    if (!Array.isArray(images)) {
                        // Если не массив, значит это старая версия с одной картинкой
                        images = [data.image];
                    }
                } catch (e) {
                    // Если не JSON, значит это одна картинка (старая версия)
                    images = [data.image];
                }
            } else if (Array.isArray(data.image)) {
                images = data.image;
            }
        }
        
        if (images.length > 0) {
            // Показываем превью, если есть картинки
            if (imagePreview && imagePreviewContainer) {
                imagePreviewContainer.innerHTML = '';
                images.forEach((img, index) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = img;
                    imgElement.alt = `Предпросмотр ${index + 1}`;
                    imgElement.style.cssText = 'max-width: 300px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover;';
                    imagePreviewContainer.appendChild(imgElement);
                });
                imagePreview.style.display = 'block';
            }
        } else {
            // Скрываем превью, если картинок нет
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
            if (imagePreviewContainer) {
                imagePreviewContainer.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        NotificationSystem.error('Ошибка загрузки настроек');
    }
}

// Сохранение текста и картинки для страницы экстренных ситуаций
window.saveEmergencySettings = async function() {
    const textInput = document.getElementById('emergencyTextInput');
    const imageInput = document.getElementById('emergencyImageInput');
    
    if (!textInput) {
        return;
    }
    
    const text = textInput.value.trim();
    let images = [];
    
    // Обрабатываем загруженные картинки (до 2-х)
    if (imageInput && imageInput.files && imageInput.files.length > 0) {
        const files = Array.from(imageInput.files).slice(0, 2); // Ограничиваем до 2-х файлов
        
        if (imageInput.files.length > 2) {
            NotificationSystem.warning('Можно загрузить только 2 картинки. Будут загружены первые 2.');
        }
        
        // Проверяем размер каждого файла (максимум 5MB)
        for (const file of files) {
            if (file.size > 5 * 1024 * 1024) {
                NotificationSystem.error(`Размер картинки "${file.name}" не должен превышать 5MB`);
                return;
            }
        }
        
        // Читаем файлы как base64
        try {
            for (const file of files) {
                const imageData = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => resolve(e.target.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });
                images.push(imageData);
            }
        } catch (error) {
            console.error('Ошибка чтения картинки:', error);
            NotificationSystem.error('Ошибка чтения картинки');
            return;
        }
    } else {
        // Если картинки не загружены, проверяем, есть ли уже сохраненные
        const imagePreviewContainer = document.getElementById('emergencyImagePreviewContainer');
        if (imagePreviewContainer) {
            const existingImages = Array.from(imagePreviewContainer.querySelectorAll('img'))
                .map(img => img.src)
                .filter(src => src && src.trim() !== '' && src !== window.location.href);
            images = existingImages;
        }
    }
    
    // Сохраняем как JSON строку (массив)
    const imageValue = images.length > 0 ? JSON.stringify(images) : '';
    
    try {
        await apiClient.saveEmergencyText(text, imageValue);
        NotificationSystem.success('Настройки успешно сохранены');
        
        // Обновляем превью картинок
        const imagePreview = document.getElementById('emergencyImagePreview');
        const imagePreviewContainer = document.getElementById('emergencyImagePreviewContainer');
        
        if (images.length > 0) {
            // Показываем превью, если есть картинки
            if (imagePreview && imagePreviewContainer) {
                imagePreviewContainer.innerHTML = '';
                images.forEach((img, index) => {
                    const imgElement = document.createElement('img');
                    imgElement.src = img;
                    imgElement.alt = `Предпросмотр ${index + 1}`;
                    imgElement.style.cssText = 'max-width: 300px; max-height: 200px; border-radius: 8px; border: 1px solid #ddd; object-fit: cover;';
                    imagePreviewContainer.appendChild(imgElement);
                });
                imagePreview.style.display = 'block';
            }
        } else {
            // Скрываем превью, если картинок нет
            if (imagePreview) {
                imagePreview.style.display = 'none';
            }
            if (imagePreviewContainer) {
                imagePreviewContainer.innerHTML = '';
            }
        }
        
        // Очищаем поле загрузки
        if (imageInput) {
            imageInput.value = '';
        }
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        NotificationSystem.error(error.message || 'Ошибка сохранения настроек');
    }
}

// Удаление всех картинок
window.removeEmergencyImage = async function() {
    try {
        const textInput = document.getElementById('emergencyTextInput');
        const text = textInput ? textInput.value.trim() : '';
        
        await apiClient.saveEmergencyText(text, '');
        NotificationSystem.success('Все картинки удалены');
        
        const imagePreview = document.getElementById('emergencyImagePreview');
        const imagePreviewContainer = document.getElementById('emergencyImagePreviewContainer');
        const imageInput = document.getElementById('emergencyImageInput');
        
        if (imagePreview) {
            imagePreview.style.display = 'none';
        }
        if (imagePreviewContainer) {
            imagePreviewContainer.innerHTML = '';
        }
        if (imageInput) {
            imageInput.value = '';
        }
    } catch (error) {
        console.error('Ошибка удаления картинок:', error);
        NotificationSystem.error(error.message || 'Ошибка удаления картинок');
    }
};

// Загрузка советов ветеринаров
window.loadAdvice = async function() {
    const adviceList = document.getElementById('adviceList');
    if (!adviceList) return;
    
    adviceList.innerHTML = '<div class="no-adopted-pets">Загрузка...</div>';
    
    try {
        const response = await apiClient.getAdvice();
        const advice = response.advice || [];
        window.displayAdvice(advice);
    } catch (error) {
        console.error('Ошибка загрузки советов:', error);
        adviceList.innerHTML = '<div class="no-adopted-pets" style="color: #d32f2f;">Ошибка загрузки советов</div>';
    }
}

// Отображение советов
window.displayAdvice = function(advice) {
    const adviceList = document.getElementById('adviceList');
    if (!adviceList) return;
    
    if (advice.length === 0) {
        adviceList.innerHTML = '<div class="no-adopted-pets">Советов пока нет</div>';
        return;
    }
    
    // Сортируем по дате (новые первыми)
    const sortedAdvice = [...advice].sort((a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        if (dateA.getTime() !== dateB.getTime()) {
            return dateB - dateA;
        }
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    
    adviceList.innerHTML = sortedAdvice.map(item => {
        const date = new Date(item.date);
        const dateText = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
        
        return `
            <div class="application-card" style="position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0;">${escapeHtml(item.title)}</h4>
                        <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
                            👨‍⚕️ ${escapeHtml(item.author)} | 📅 ${escapeHtml(dateText)} | 🏷️ ${escapeHtml(item.category)}
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-secondary" onclick="editAdvice(${escapeHtml(item.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem;">✏️ Редактировать</button>
                        <button class="btn-secondary" onclick="deleteAdvice(${escapeHtml(item.id)})" style="padding: 0.5rem 1rem; font-size: 0.9rem; background: #d32f2f; color: white; border: none;">🗑️ Удалить</button>
                    </div>
                </div>
                <p style="color: #666; margin-bottom: 1rem;">${escapeHtml(item.content)}</p>
                ${item.tips && item.tips.length > 0 ? `
                <div style="background: #f9f9f9; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                    <strong style="color: #667eea; display: block; margin-bottom: 0.5rem;">Полезные советы:</strong>
                    <ul style="margin: 0; padding-left: 1.5rem;">
                        ${item.tips.map(tip => `<li style="color: #666; margin-bottom: 0.25rem;">${escapeHtml(tip)}</li>`).join('')}
                    </ul>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

// Открытие модального окна для добавления/редактирования совета
window.openAdviceModal = function(adviceId = null) {
    const modal = document.getElementById('adviceModal');
    const form = document.getElementById('adviceForm');
    const title = document.getElementById('adviceModalTitle');
    
    if (adviceId) {
        // Редактирование
        title.textContent = 'Редактировать совет ветеринара';
        form.dataset.adviceId = adviceId;
        
        // Загружаем данные совета
        apiClient.getAdviceItem(adviceId).then(response => {
            const advice = response.advice;
            document.getElementById('adviceTitle').value = advice.title;
            document.getElementById('adviceAuthor').value = advice.author;
            document.getElementById('adviceDate').value = advice.date;
            document.getElementById('adviceCategory').value = advice.category;
            document.getElementById('adviceContent').value = advice.content;
            document.getElementById('adviceTips').value = (advice.tips || []).join('\n');
        }).catch(error => {
            console.error('Ошибка загрузки совета:', error);
            NotificationSystem.error('Ошибка загрузки совета');
        });
    } else {
        // Добавление
        title.textContent = 'Добавить совет ветеринара';
        form.dataset.adviceId = '';
        form.reset();
        document.getElementById('adviceDate').value = new Date().toISOString().split('T')[0];
    }
    
    modal.style.display = 'flex';
};

// Закрытие модального окна
window.closeAdviceModal = function() {
    const modal = document.getElementById('adviceModal');
    modal.style.display = 'none';
    const form = document.getElementById('adviceForm');
    form.reset();
    form.dataset.adviceId = '';
};

// Редактирование совета
window.editAdvice = function(adviceId) {
    openAdviceModal(adviceId);
};

// Удаление совета
window.deleteAdvice = function(adviceId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить этот совет?',
        async () => {
            try {
                await apiClient.deleteAdvice(adviceId);
                NotificationSystem.success('Совет успешно удален');
                loadAdvice();
            } catch (error) {
                console.error('Ошибка удаления совета:', error);
                NotificationSystem.error('Ошибка удаления совета');
            }
        }
    );
};

// Удаление пользователя
window.deleteUser = function(userId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить этого пользователя? Все его объявления и заявки также будут удалены.',
        async () => {
            try {
                await apiClient.deleteUser(userId);
                NotificationSystem.success('Пользователь успешно удален');
                // Определяем текущий активный фильтр
                const activeButton = document.querySelector('#usersTab .admin-tab-btn[data-subtab].active');
                let currentFilter = 'all';
                if (activeButton) {
                    const subtab = activeButton.getAttribute('data-subtab');
                    if (subtab === 'users-only') currentFilter = 'users';
                    else if (subtab === 'shelters-only') currentFilter = 'shelters';
                }
                // Обновляем список пользователей и передержек с сохранением фильтра
                loadUsersAndShelters(currentFilter);
            } catch (error) {
                console.error('Ошибка удаления пользователя:', error);
                NotificationSystem.error(error.message || 'Ошибка удаления пользователя');
            }
        }
    );
};

// Удаление передержки
window.deleteShelter = function(shelterId) {
    NotificationSystem.confirm(
        'Вы уверены, что хотите удалить эту передержку? Все связанные данные также будут удалены.',
        async () => {
            try {
                await apiClient.deleteShelter(shelterId);
                NotificationSystem.success('Передержка успешно удалена');
                // Определяем текущий активный фильтр
                const activeButton = document.querySelector('#usersTab .admin-tab-btn[data-subtab].active');
                let currentFilter = 'all';
                if (activeButton) {
                    const subtab = activeButton.getAttribute('data-subtab');
                    if (subtab === 'users-only') currentFilter = 'users';
                    else if (subtab === 'shelters-only') currentFilter = 'shelters';
                }
                // Обновляем список пользователей и передержек с сохранением фильтра
                loadUsersAndShelters(currentFilter);
            } catch (error) {
                console.error('Ошибка удаления передержки:', error);
                NotificationSystem.error(error.message || 'Ошибка удаления передержки');
            }
        }
    );
};

