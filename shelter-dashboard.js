// Инициализация панели передержки
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    if (!currentUser || currentUser.type !== 'shelter') {
        NotificationSystem.error('Только передержки могут использовать эту страницу');
        setTimeout(() => {
            window.location.href = 'auth.html';
        }, 1500);
        return;
    }

    // Устанавливаем название передержки
    const shelterNameEl = document.getElementById('shelterName');
    if (shelterNameEl && currentUser.shelterName) {
        shelterNameEl.textContent = `Передержка: ${currentUser.shelterName}`;
    }

    // Получаем элементы
    const addPetForm = document.getElementById('addPetForm');
    const petPhotos = document.getElementById('petPhotos');
    const photoPreview = document.getElementById('photoPreview');
    const dashboardTabs = document.querySelectorAll('.dashboard-tab');
    const tabContents = document.querySelectorAll('.dashboard-tab-content');
    const applicationsContainer = document.getElementById('applicationsContainer');
    const myPetsGrid = document.getElementById('myPetsGrid');
    const adoptedPetsGrid = document.getElementById('adoptedPetsGrid');
    const adoptedSterilizationFilter = document.getElementById('adoptedSterilizationFilter');
    const statPlaced = document.getElementById('statPlaced');
    const statAdopted = document.getElementById('statAdopted');
    const statNewApplications = document.getElementById('statNewApplications');

    // Обработчики переключения вкладок
    dashboardTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // Убираем активный класс у всех вкладок
            dashboardTabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Добавляем активный класс выбранной вкладке
            this.classList.add('active');
            const targetContent = document.getElementById(targetTab + '-tab');
            if (targetContent) {
                targetContent.classList.add('active');
                
                // Загружаем данные при переключении
                if (targetTab === 'applications') {
                    loadApplications();
                } else if (targetTab === 'my-pets') {
                    loadMyPets();
                } else if (targetTab === 'adopted') {
                    loadAdoptedPets();
                }
            }
        });
    });

    // Обработчик формы размещения животного
    if (addPetForm) {
        addPetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            try {
                // Проверяем валидность формы
                if (!addPetForm.checkValidity()) {
                    addPetForm.reportValidity();
                    NotificationSystem.warning('Пожалуйста, заполните все обязательные поля корректно');
                    return;
                }
                
                const formData = new FormData(addPetForm);
                
                // Получаем годы и месяцы
                let ageYears = parseInt(formData.get('ageYears')) || 0;
                let ageMonths = parseInt(formData.get('ageMonths')) || 0;
                
                // Проверяем, что указан хотя бы один месяц
                if (ageYears === 0 && ageMonths === 0) {
                    NotificationSystem.warning('Укажите возраст питомца (хотя бы 1 месяц)');
                    return;
                }
                
                // Валидация: месяцы не должны быть больше 11
                if (ageMonths > 11) {
                    NotificationSystem.warning('Месяцы не могут быть больше 11. Используйте годы для возраста больше года.');
                    return;
                }
                
                // Вычисляем возраст в годах
                const age = ageYears + (ageMonths / 12);
                
                // Проверка обязательных полей
                if (!formData.get('name') || !formData.get('type') || !formData.get('breed') || 
                    !formData.get('gender') || !formData.get('size') || !formData.get('color') ||
                    !formData.get('character') || !formData.get('description')) {
                    NotificationSystem.warning('Пожалуйста, заполните все обязательные поля');
                    return;
                }
                
                // Определяем возрастную категорию
                let ageCategory = 'adult';
                if (age < 1) {
                    ageCategory = 'young';
                } else if (age >= 7) {
                    ageCategory = 'senior';
                }
                
                // Обрабатываем фотографии
                const photos = [];
                const files = petPhotos ? petPhotos.files : [];
                
                if (files.length > 0) {
                    NotificationSystem.info('Обработка фотографий...');
                }
                
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1920;
                const QUALITY = 0.85;
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const photoPromise = new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const img = new Image();
                                img.onload = () => {
                                    try {
                                        let width = img.width;
                                        let height = img.height;
                                        
                                        if (width > MAX_WIDTH || height > MAX_HEIGHT) {
                                            if (width > height) {
                                                height = (height * MAX_WIDTH) / width;
                                                width = MAX_WIDTH;
                                            } else {
                                                width = (width * MAX_HEIGHT) / height;
                                                height = MAX_HEIGHT;
                                            }
                                        }
                                        
                                        const canvas = document.createElement('canvas');
                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, width, height);
                                        
                                        const compressedDataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                                        resolve(compressedDataUrl);
                                    } catch (canvasError) {
                                        console.warn('Не удалось оптимизировать изображение:', canvasError);
                                        resolve(e.target.result);
                                    }
                                };
                                img.onerror = () => {
                                    console.warn('Не удалось загрузить изображение');
                                    resolve(e.target.result);
                                };
                                img.src = e.target.result;
                            };
                            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
                            reader.readAsDataURL(file);
                        });
                        photos.push(await photoPromise);
                    } catch (error) {
                        console.error('Ошибка обработки фотографии:', error);
                        NotificationSystem.warning(`Не удалось обработать фотографию "${file.name}"`);
                    }
                }
                
                const pet = {
                    name: formData.get('name'),
                    type: formData.get('type'),
                    breed: formData.get('breed'),
                    age: age,
                    ageYears: ageYears,
                    ageMonths: ageMonths,
                    ageCategory: ageCategory,
                    gender: formData.get('gender'),
                    size: formData.get('size'),
                    color: formData.get('color'),
                    character: formData.get('character'),
                    description: formData.get('description'),
                    comments: formData.get('comments') || null,
                    foundLocation: formData.get('foundLocation') || null,
                    photos: photos,
                    shelterId: currentUser.id,
                    shelterName: currentUser.shelterName,
                    icon: formData.get('type') === 'dog' ? '🐕' : '🐱',
                    adopted: false,
                    createdAt: new Date().toISOString()
                };
                
                try {
                    const editId = addPetForm.dataset.editId;
                    
                    if (editId) {
                        const existingPhotos = JSON.parse(addPetForm.dataset.existingPhotos || '[]');
                        pet.photos = [...existingPhotos, ...pet.photos];
                        await apiClient.updatePet(editId, pet);
                        NotificationSystem.success('Животное успешно обновлено!');
                        delete addPetForm.dataset.editId;
                        delete addPetForm.dataset.existingPhotos;
                    } else {
                        await apiClient.addPet(pet);
                        NotificationSystem.success('Животное успешно размещено!');
                    }
                    
                    addPetForm.reset();
                    photoPreview.innerHTML = '';
                    
                    // Обновляем статистику и списки
                    await updateStats();
                    await loadMyPets();
                } catch (error) {
                    console.error('Ошибка размещения:', error);
                    let errorMessage = 'Произошла ошибка при размещении животного. Попробуйте еще раз.';
                    
                    if (error.message) {
                        errorMessage = error.message;
                    } else if (error.response) {
                        if (error.response.status === 413) {
                            errorMessage = 'Размер фотографий слишком большой. Пожалуйста, выберите фотографии меньшего размера.';
                        } else if (error.response.error) {
                            errorMessage = error.response.error;
                        }
                    }
                    
                    NotificationSystem.error(errorMessage);
                }
            } catch (unexpectedError) {
                console.error('Неожиданная ошибка:', unexpectedError);
                NotificationSystem.error('Произошла неожиданная ошибка: ' + (unexpectedError.message || 'Неизвестная ошибка'));
            }
        });
    }

    // Обработчик предпросмотра фотографий
    if (petPhotos) {
        petPhotos.addEventListener('change', function(e) {
            photoPreview.innerHTML = '';
            const files = e.target.files;
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const reader = new FileReader();
                reader.onload = function(e) {
                    const img = document.createElement('img');
                    img.src = e.target.result;
                    img.style.width = '100px';
                    img.style.height = '100px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '8px';
                    img.style.margin = '5px';
                    photoPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Загрузка заявок
    async function loadApplications() {
        try {
            applicationsContainer.innerHTML = '<p style="text-align: center; padding: 2rem;">Загрузка заявок...</p>';
            const applications = await ApplicationsSystem.getShelterApplications(currentUser.id);
            const volunteersData = await apiClient.getVolunteers();
            const volunteers = volunteersData.volunteers || [];
            
            let html = `
                <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                    <button class="admin-tab-btn active" onclick="switchApplicationsTab('pet-applications')">📝 Заявки на животных</button>
                    <button class="admin-tab-btn" onclick="switchApplicationsTab('volunteers')">🤝 Волонтеры</button>
                </div>
                
                <div id="pet-applications-section">
            `;
            
            if (applications.length === 0) {
                html += '<p style="text-align: center; padding: 2rem;">Заявок пока нет</p>';
            } else {
                html += '<div class="applications-list">';
                for (const app of applications) {
                    const statusColors = {
                        'новое': '#667eea',
                        'договорились': '#48bb78',
                        'отказались': '#f56565',
                        'забрали': '#38a169',
                        'вернули': '#ed8936'
                    };
                    
                    html += `
                        <div class="application-card">
                            <div class="application-header">
                                <h4>${app.pet ? app.pet.name : 'Животное'}</h4>
                                <span class="application-status" style="background-color: ${statusColors[app.status] || '#999'}">${app.status}</span>
                            </div>
                            <div class="application-info">
                                <p><strong>Пользователь:</strong> ${app.userName}</p>
                                <p><strong>Телефон:</strong> ${app.userPhone}</p>
                                <p><strong>Email:</strong> ${app.userEmail}</p>
                                <p><strong>Дата заявки:</strong> ${new Date(app.createdAt).toLocaleDateString('ru-RU')}</p>
                            </div>
                            <div class="application-actions">
                                <select class="status-select" data-application-id="${app.id}">
                                    <option value="новое" ${app.status === 'новое' ? 'selected' : ''}>Новое</option>
                                    <option value="договорились" ${app.status === 'договорились' ? 'selected' : ''}>Договорились</option>
                                    <option value="отказались" ${app.status === 'отказались' ? 'selected' : ''}>Отказались</option>
                                    <option value="забрали" ${app.status === 'забрали' ? 'selected' : ''}>Забрали</option>
                                    <option value="вернули" ${app.status === 'вернули' ? 'selected' : ''}>Вернули</option>
                                </select>
                            </div>
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            html += `
                </div>
                <div id="volunteers-section" style="display: none;">
            `;
            
            if (volunteers.length === 0) {
                html += '<p style="text-align: center; padding: 2rem;">Заявок от волонтеров пока нет</p>';
            } else {
                html += '<div class="applications-list">';
                volunteers.sort((a, b) => {
                    const dateA = a.date ? new Date(a.date) : new Date(0);
                    const dateB = b.date ? new Date(b.date) : new Date(0);
                    return dateB - dateA;
                });
                
                for (const volunteer of volunteers) {
                    const activitiesMap = {
                        'walking': 'Выгул животных',
                        'foster': 'Временная передержка',
                        'cleaning': 'Уборка в передержке',
                        'social': 'Помощь в соцсетях',
                        'events': 'Организация мероприятий',
                        'car': 'Помощь авто',
                        'curator': 'Кураторство животного',
                        'other': 'Другое'
                    };
                    
                    const activitiesHtml = volunteer.activities && volunteer.activities.length > 0
                        ? volunteer.activities.map(act => `<span class="activity-badge" style="background: #667eea; color: white; padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.85rem; margin-right: 0.5rem;">${activitiesMap[act] || act}</span>`).join('')
                        : '<span class="activity-badge" style="background: #999; color: white; padding: 0.25rem 0.75rem; border-radius: 15px; font-size: 0.85rem;">Не указано</span>';
                    
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
                        <div class="application-card">
                            <div class="application-header">
                                <h4>${volunteer.name}</h4>
                            </div>
                            <div class="application-info">
                                <p><strong>Возраст:</strong> ${volunteer.age || 'Не указан'}</p>
                                <p><strong>Телефон:</strong> ${volunteer.phone || 'Не указан'}</p>
                                <p><strong>Telegram:</strong> ${volunteer.telegram || volunteer.email || 'Не указан'}</p>
                                <p><strong>Город:</strong> ${volunteer.city || 'Не указан'}</p>
                                <p><strong>Дата заявки:</strong> ${dateText}</p>
                            </div>
                            <div style="margin-top: 1rem;">
                                <strong>Виды деятельности:</strong>
                                <div style="margin-top: 0.5rem;">
                                    ${activitiesHtml}
                                </div>
                            </div>
                            ${volunteer.experience ? `<p style="margin-top: 1rem;"><strong>Опыт:</strong> ${volunteer.experience}</p>` : ''}
                            ${volunteer.availability ? `<p style="margin-top: 0.5rem;"><strong>Доступность:</strong> ${volunteer.availability}</p>` : ''}
                        </div>
                    `;
                }
                html += '</div>';
            }
            
            html += '</div>';
            applicationsContainer.innerHTML = html;
            
            // Инициализируем обработчики для select
            setTimeout(() => {
                const selects = applicationsContainer.querySelectorAll('.status-select');
                selects.forEach(select => {
                    const applicationId = select.getAttribute('data-application-id');
                    if (applicationId) {
                        select.addEventListener('change', function() {
                            updateApplicationStatus(parseInt(applicationId), this.value);
                        });
                    }
                });
            }, 100);
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error);
            applicationsContainer.innerHTML = '<p style="text-align: center; padding: 2rem; color: #f56565;">Ошибка загрузки заявок</p>';
        }
    }

    // Переключение вкладок заявок
    window.switchApplicationsTab = function(tabName) {
        const petSection = document.getElementById('pet-applications-section');
        const volunteersSection = document.getElementById('volunteers-section');
        const buttons = document.querySelectorAll('.admin-tab-btn');
        
        // Убираем активный класс у всех кнопок
        buttons.forEach(btn => btn.classList.remove('active'));
        
        // Добавляем активный класс выбранной кнопке
        buttons.forEach(btn => {
            if ((tabName === 'pet-applications' && btn.textContent.includes('Заявки на животных')) ||
                (tabName === 'volunteers' && btn.textContent.includes('Волонтеры'))) {
                btn.classList.add('active');
            }
        });
        
        if (tabName === 'pet-applications') {
            if (petSection) petSection.style.display = 'block';
            if (volunteersSection) volunteersSection.style.display = 'none';
        } else {
            if (petSection) petSection.style.display = 'none';
            if (volunteersSection) volunteersSection.style.display = 'block';
        }
    };

    // Обновление статуса заявки
    window.updateApplicationStatus = async function(applicationId, status) {
        try {
            const result = await ApplicationsSystem.updateApplicationStatus(applicationId, status);
            
            if (result.success) {
                if (status === 'отказались') {
                    NotificationSystem.success('Заявка удалена');
                } else if (status === 'вернули') {
                    NotificationSystem.success('Питомец возвращен в каталог');
                } else {
                    NotificationSystem.success('Статус заявки обновлен');
                }
                
                await updateStats();
                await loadApplications();
                await loadMyPets();
                await loadAdoptedPets();
            } else {
                NotificationSystem.error(result.message || 'Произошла ошибка при обновлении статуса');
            }
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            NotificationSystem.error(error.message || 'Произошла ошибка при обновлении статуса');
        }
    };

    // Загрузка размещенных питомцев
    async function loadMyPets() {
        try {
            myPetsGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Загрузка животных...</p>';
            const data = await apiClient.getShelterPets();
            const pets = data.pets || [];
            
            if (pets.length === 0) {
                myPetsGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Размещенных животных пока нет</p>';
                return;
            }
            
            myPetsGrid.innerHTML = '';
            pets.forEach(pet => {
                const petCard = createPetCard(pet, false);
                myPetsGrid.appendChild(petCard);
            });
            
            // Инициализируем кастомные select после добавления всех карточек
            setTimeout(() => {
                const selects = myPetsGrid.querySelectorAll('select:not(.custom-select-initialized)');
                selects.forEach(select => {
                    if (window.CustomSelect) {
                        try {
                            select.classList.add('custom-select-initialized');
                            new window.CustomSelect(select);
                        } catch (e) {
                            console.warn('Ошибка инициализации select:', e);
                        }
                    }
                });
            }, 100);
        } catch (error) {
            console.error('Ошибка загрузки размещенных питомцев:', error);
            console.error('Детали ошибки:', {
                message: error.message,
                response: error.response,
                stack: error.stack
            });
            const errorMessage = error.response?.error || error.message || 'Неизвестная ошибка';
            myPetsGrid.innerHTML = `<p style="text-align: center; padding: 2rem; color: #f56565;">Ошибка загрузки животных: ${errorMessage}</p>`;
        }
    }

    // Хранилище отданных питомцев для фильтрации
    let adoptedPetsCache = [];

    // Загрузка отданных питомцев
    async function loadAdoptedPets() {
        try {
            adoptedPetsGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Загрузка животных...</p>';
            const data = await apiClient.getShelterAdoptedPets();
            adoptedPetsCache = data.pets || [];
            renderAdoptedPets();
        } catch (error) {
            console.error('Ошибка загрузки отданных питомцев:', error);
            console.error('Детали ошибки:', {
                message: error.message,
                response: error.response,
                stack: error.stack
            });
            const errorMessage = error.response?.error || error.message || 'Неизвестная ошибка';
            adoptedPetsGrid.innerHTML = `<p style="text-align: center; padding: 2rem; color: #f56565;">Ошибка загрузки животных: ${errorMessage}</p>`;
        }
    }

    function renderAdoptedPets() {
        const filterValue = adoptedSterilizationFilter ? adoptedSterilizationFilter.value : 'all';
        const pets = adoptedPetsCache.filter(pet => filterValue === 'all' || pet.sterilizationStatus === filterValue);

        if (pets.length === 0) {
            adoptedPetsGrid.innerHTML = '<p style="text-align: center; padding: 2rem;">Отданных животных пока нет</p>';
            return;
        }

        adoptedPetsGrid.innerHTML = '';
        pets.forEach(pet => {
            const petCard = createPetCard(pet, true);
            adoptedPetsGrid.appendChild(petCard);
        });

        // Инициализируем кастомные select после добавления всех карточек
        setTimeout(() => {
            const selects = adoptedPetsGrid.querySelectorAll('select:not(.custom-select-initialized)');
            selects.forEach(select => {
                if (window.CustomSelect) {
                    try {
                        select.classList.add('custom-select-initialized');
                        new window.CustomSelect(select);
                    } catch (e) {
                        console.warn('Ошибка инициализации select:', e);
                    }
                }
            });
        }, 100);
    }

    if (adoptedSterilizationFilter) {
        adoptedSterilizationFilter.addEventListener('change', renderAdoptedPets);
    }

    // Создание карточки питомца
    function createPetCard(pet, isAdopted) {
        const card = document.createElement('div');
        card.className = 'pet-card';
        
        const ageText = getAgeText(pet.age, pet.ageYears, pet.ageMonths);
        const genderText = getGenderText(pet.gender);
        
        let imageHtml = `<div class="pet-image">${pet.icon || (pet.type === 'dog' ? '🐕' : '🐱')}</div>`;
        if (pet.photos && pet.photos.length > 0) {
            imageHtml = `<div class="pet-image" style="background-image: url('${pet.photos[0]}'); background-size: cover; background-position: center;"></div>`;
        }
        
        // Статусы стерилизации
        const sterilizationStatuses = {
            'sterilized': 'Стерелизована',
            'will_sterilize': 'Сами стерилизуют',
            'under_sterilization': 'Под стерилизацию'
        };
        
        const currentSterilizationStatus = pet.sterilizationStatus || '';
        const sterilizationStatusText = sterilizationStatuses[currentSterilizationStatus] || 'Не указано';
        
        card.innerHTML = `
            ${imageHtml}
            <div class="pet-info">
                <h4>${pet.name}</h4>
                <div class="pet-details-simple">
                    <div class="pet-detail">
                        <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : '♀️'}</span>
                        <span>${genderText}</span>
                    </div>
                    <div class="pet-detail">
                        <span class="pet-detail-icon">📅</span>
                        <span>${ageText}</span>
                    </div>
                </div>
                <div style="margin-top: 0.5rem;">
                    <label style="font-size: 0.9rem; color: #666; display: block; margin-bottom: 0.25rem;">Статус:</label>
                    <select class="adopt-status-select" data-pet-id="${pet.id}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem; margin-bottom: 0.5rem;">
                        <option value="false" ${!isAdopted ? 'selected' : ''}>Не отдан</option>
                        <option value="true" ${isAdopted ? 'selected' : ''}>Отдан</option>
                    </select>
                </div>
                ${isAdopted ? `
                    <p style="color: #48bb78; font-weight: bold; margin-top: 0.5rem;">✅ Отдан</p>
                    <div style="margin-top: 0.5rem;">
                        <label style="font-size: 0.9rem; color: #666; display: block; margin-bottom: 0.25rem;">Статус стерилизации:</label>
                        <select class="sterilization-status-select" data-pet-id="${pet.id}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; font-size: 0.9rem;">
                            <option value="">Не указано</option>
                            <option value="sterilized" ${currentSterilizationStatus === 'sterilized' ? 'selected' : ''}>Стерелизована</option>
                            <option value="will_sterilize" ${currentSterilizationStatus === 'will_sterilize' ? 'selected' : ''}>Сами стерилизуют</option>
                            <option value="under_sterilization" ${currentSterilizationStatus === 'under_sterilization' ? 'selected' : ''}>Под стерилизацию</option>
                        </select>
                    </div>
                ` : ''}
                ${pet.comments ? `
                    <div style="margin-top: 0.75rem; padding: 0.5rem; background: #f0f7ff; border-left: 3px solid #667eea; border-radius: 4px;">
                        <div style="font-size: 0.85rem; color: #667eea; font-weight: bold; margin-bottom: 0.25rem;">💬 Комментарии:</div>
                        <div style="font-size: 0.8rem; color: #555; line-height: 1.4;">${pet.comments}</div>
                    </div>
                ` : ''}
                ${pet.foundLocation ? `
                    <div style="margin-top: 0.5rem; padding: 0.5rem; background: #fff5e6; border-left: 3px solid #ff9800; border-radius: 4px;">
                        <div style="font-size: 0.85rem; color: #ff9800; font-weight: bold; margin-bottom: 0.25rem;">📍 Где нашли:</div>
                        <div style="font-size: 0.8rem; color: #555; line-height: 1.4;">${pet.foundLocation}</div>
                    </div>
                ` : ''}
                <div class="pet-card-actions" onclick="event.stopPropagation()">
                    <button class="btn-edit-pet" onclick="editPet(${pet.id})" title="Редактировать">✏️</button>
                    <button class="btn-delete-pet" onclick="deletePet(${pet.id})" title="Удалить">🗑️</button>
                </div>
            </div>
        `;
        
        // MutationObserver из custom-select.js автоматически инициализирует новые select
        // Не нужно инициализировать вручную, чтобы избежать дублирования
        
        // Добавляем обработчик для select статуса отдачи
        const adoptSelect = card.querySelector('.adopt-status-select');
        if (adoptSelect) {
            adoptSelect.addEventListener('change', function(e) {
                e.stopPropagation();
                const newStatus = this.value === 'true';
                updateAdoptStatus(pet.id, newStatus);
            });
        }
        
        // Добавляем обработчик для select стерилизации
        if (isAdopted) {
            const select = card.querySelector('.sterilization-status-select');
            if (select) {
                select.addEventListener('change', function(e) {
                    e.stopPropagation();
                    updateSterilizationStatus(pet.id, this.value);
                });
            }
        }
        
        card.addEventListener('click', function(e) {
            // Не переходим на страницу деталей, если клик был на элементах управления
            if (!e.target.closest('.pet-card-actions') && 
                !e.target.closest('.sterilization-status-select') && 
                !e.target.closest('.adopt-status-select') &&
                !e.target.closest('.custom-select-wrapper') &&
                !e.target.closest('.custom-select-button') &&
                !e.target.closest('.custom-select-dropdown') &&
                !e.target.closest('.custom-select-options') &&
                !e.target.closest('.custom-select-option')) {
                window.location.href = `pet-detail.html?id=${pet.id}`;
            }
        });
        
        // Предотвращаем закрытие dropdown при наведении на карточку
        // Добавляем обработчик для предотвращения закрытия dropdown при взаимодействии с карточкой
        const customSelectWrappers = card.querySelectorAll('.custom-select-wrapper');
        customSelectWrappers.forEach(wrapper => {
            wrapper.addEventListener('mouseenter', function(e) {
                e.stopPropagation();
            });
            wrapper.addEventListener('mouseleave', function(e) {
                e.stopPropagation();
            });
        });
        
        return card;
    }

    // Вспомогательные функции
    function getAgeText(age, ageYears, ageMonths) {
        if (ageYears !== undefined && ageMonths !== undefined) {
            if (ageYears === 0) {
                return `${ageMonths} ${getMonthWord(ageMonths)}`;
            } else if (ageMonths === 0) {
                return `${ageYears} ${getYearWord(ageYears)}`;
            } else {
                return `${ageYears} ${getYearWord(ageYears)} ${ageMonths} ${getMonthWord(ageMonths)}`;
            }
        }
        if (age < 1) {
            return `${Math.round(age * 12)} мес.`;
        }
        return `${age.toFixed(1)} ${getYearWord(age)}`;
    }

    function getYearWord(years) {
        const lastDigit = years % 10;
        const lastTwoDigits = years % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'лет';
        if (lastDigit === 1) return 'год';
        if (lastDigit >= 2 && lastDigit <= 4) return 'года';
        return 'лет';
    }

    function getMonthWord(months) {
        const lastDigit = months % 10;
        const lastTwoDigits = months % 100;
        if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return 'месяцев';
        if (lastDigit === 1) return 'месяц';
        if (lastDigit >= 2 && lastDigit <= 4) return 'месяца';
        return 'месяцев';
    }

    function getGenderText(gender) {
        return gender === 'male' ? 'Мальчик' : 'Девочка';
    }

    // Редактирование питомца
    window.editPet = async function(petId) {
        try {
            const data = await apiClient.getPet(petId);
            const pet = data.pet;
            
            if (!pet) {
                NotificationSystem.error('Питомец не найден');
                return;
            }

            // Заполняем форму
            document.getElementById('petName').value = pet.name || '';
            document.getElementById('petType').value = pet.type || '';
            document.getElementById('petBreed').value = pet.breed || '';
            document.getElementById('petAgeYears').value = pet.ageYears !== undefined && pet.ageYears !== null ? pet.ageYears : 0;
            document.getElementById('petAgeMonths').value = pet.ageMonths !== undefined && pet.ageMonths !== null ? pet.ageMonths : 0;
            document.getElementById('petGender').value = pet.gender || '';
            document.getElementById('petSize').value = pet.size || '';
            document.getElementById('petColor').value = pet.color || '';
            document.getElementById('petCharacter').value = pet.character || '';
            document.getElementById('petDescription').value = pet.description || '';
            document.getElementById('petComments').value = pet.comments || '';
            document.getElementById('petFoundLocation').value = pet.foundLocation || '';

            // Фотографии
            if (photoPreview) {
                if (pet.photos && pet.photos.length > 0) {
                    photoPreview.innerHTML = pet.photos.map((photo, index) => `
                        <div class="photo-preview-item" data-photo-index="${index}">
                            <img src="${photo}" alt="Фото ${index + 1}">
                            <button type="button" class="remove-photo" onclick="removePhotoFromEdit(${index})">×</button>
                        </div>
                    `).join('');
                } else {
                    photoPreview.innerHTML = '';
                }
            }

            // Сохраняем ID и существующие фотографии
            addPetForm.dataset.editId = pet.id;
            addPetForm.dataset.existingPhotos = JSON.stringify(pet.photos || []);

            // Переключаемся на вкладку размещения
            document.querySelector('[data-tab="add-pet"]').click();
        } catch (error) {
            console.error('Ошибка загрузки питомца:', error);
            NotificationSystem.error('Не удалось загрузить данные питомца');
        }
    };

    // Удаление фотографии при редактировании
    window.removePhotoFromEdit = function(index) {
        if (!addPetForm || !addPetForm.dataset.editId) return;

        const existingPhotos = JSON.parse(addPetForm.dataset.existingPhotos || '[]');
        existingPhotos.splice(index, 1);
        addPetForm.dataset.existingPhotos = JSON.stringify(existingPhotos);

        if (photoPreview) {
            const item = photoPreview.querySelector(`[data-photo-index="${index}"]`);
            if (item) item.remove();
        }
    };

    // Удаление питомца
    window.deletePet = async function(petId) {
        if (!confirm('Вы уверены, что хотите удалить этого питомца? Это действие нельзя отменить.')) {
            return;
        }

        try {
            await apiClient.deletePet(petId);
            NotificationSystem.success('Питомец успешно удален');
            await updateStats();
            await loadMyPets();
            await loadAdoptedPets();
        } catch (error) {
            console.error('Ошибка удаления питомца:', error);
            NotificationSystem.error('Не удалось удалить питомца');
        }
    };

    // Обновление статуса отдачи
    window.updateAdoptStatus = async function(petId, adopted) {
        try {
            await apiClient.updateAdoptStatus(petId, adopted);
            NotificationSystem.success(adopted ? 'Животное отмечено как отданное' : 'Животное возвращено в каталог');
            // Обновляем оба списка
            await loadMyPets();
            await loadAdoptedPets();
            await updateStats();
        } catch (error) {
            console.error('Ошибка обновления статуса отдачи:', error);
            NotificationSystem.error('Не удалось обновить статус');
        }
    };

    // Обновление статуса стерилизации
    window.updateSterilizationStatus = async function(petId, status) {
        try {
            // Разрешаем пустое значение для очистки статуса
            await apiClient.updateSterilizationStatus(petId, status || '');
            NotificationSystem.success('Статус стерилизации обновлен');
            await loadAdoptedPets(); // Обновляем список
        } catch (error) {
            console.error('Ошибка обновления статуса стерилизации:', error);
            const errorMessage = error.message || 'Не удалось обновить статус стерилизации';
            NotificationSystem.error(errorMessage);
        }
    };

    // Обновление статистики
    async function updateStats() {
        try {
            const myPetsData = await apiClient.getShelterPets();
            const adoptedPetsData = await apiClient.getShelterAdoptedPets();
            const applications = await ApplicationsSystem.getShelterApplications(currentUser.id);
            
            const myPets = myPetsData.pets || [];
            const adoptedPets = adoptedPetsData.pets || [];
            const newApplications = applications.filter(app => app.status === 'новое');
            
            if (statPlaced) statPlaced.textContent = myPets.length;
            if (statAdopted) statAdopted.textContent = adoptedPets.length;
            if (statNewApplications) statNewApplications.textContent = newApplications.length;
        } catch (error) {
            console.error('Ошибка обновления статистики:', error);
        }
    }

    // Инициализация
    await updateStats();
    await loadMyPets();
});

