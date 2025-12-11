// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем подключение к API
    try {
        await apiClient.request('/health');
    } catch (error) {
        NotificationSystem.error('Сервер недоступен. Проверьте подключение к серверу.');
        console.error('API недоступен:', error);
    }
    
    // Получаем элементы
    const typeFilter = document.getElementById('typeFilter');
    const ageFilter = document.getElementById('ageFilter');
    const genderFilter = document.getElementById('genderFilter');
    const sizeFilter = document.getElementById('sizeFilter');
    const resetBtn = document.getElementById('resetFilters');
    const petsGrid = document.getElementById('petsGrid');
    const resultsCount = document.getElementById('resultsCount');
    const noResults = document.getElementById('noResults');
    const adoptedCounter = document.getElementById('adoptedCounter');
    const shelterPetFormSection = document.getElementById('shelterPetFormSection');
    const addPetForm = document.getElementById('addPetForm');
    const petPhotos = document.getElementById('petPhotos');
    const photoPreview = document.getElementById('photoPreview');

    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    console.log('Текущий пользователь:', currentUser);

    // Объявляем переменную для хранения всех животных
    let allPets = [];

    // Обновляем счетчик пристроенных животных из базы данных
    await updateAdoptedCounter();

    // Загружаем животных из базы данных
    await loadPets();

    // Обработчики событий для фильтров
    typeFilter.addEventListener('change', filterPets);
    ageFilter.addEventListener('change', filterPets);
    genderFilter.addEventListener('change', filterPets);
    sizeFilter.addEventListener('change', filterPets);

    // Обработчик для кнопки сброса фильтров
    resetBtn.addEventListener('click', function() {
        typeFilter.value = 'all';
        ageFilter.value = 'all';
        genderFilter.value = 'all';
        sizeFilter.value = 'all';
        filterPets();
    });

    // Функционал размещения животных перенесен на shelter-dashboard.html
    
    // Проверяем, что форма найдена
    if (!addPetForm) {
        console.error('Форма addPetForm не найдена! Проверьте, что элемент с id="addPetForm" существует в HTML.');
    } else {
        console.log('Форма addPetForm успешно найдена');
    }

    // Функционал управления заявками перенесен на shelter-dashboard.html

    // Обработчик формы размещения животного
    if (addPetForm) {
        console.log('Форма addPetForm найдена, добавляем обработчик submit');
        
        // Также добавляем обработчик на кнопку отправки для отладки
        const submitButton = addPetForm.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.addEventListener('click', function(e) {
                console.log('Кнопка отправки нажата');
                // Не предотвращаем default здесь, чтобы форма могла отправиться
            });
        }
        
        addPetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Форма submit вызван');
            
            try {
                // Проверяем валидность формы
                if (!addPetForm.checkValidity()) {
                    console.error('Форма не валидна');
                    addPetForm.reportValidity();
                    NotificationSystem.warning('Пожалуйста, заполните все обязательные поля корректно');
                    return;
                }
                
                // Проверяем авторизацию заново
                const currentUser = AuthSystem.getCurrentUser();
                console.log('Текущий пользователь:', currentUser);
                if (!currentUser || currentUser.type !== 'shelter') {
                    NotificationSystem.error('Только передержки могут размещать животных. Пожалуйста, войдите как передержка.');
                    return;
                }
                
                const formData = new FormData(addPetForm);
                console.log('Данные формы:', {
                    name: formData.get('name'),
                    type: formData.get('type'),
                    breed: formData.get('breed'),
                    ageYears: formData.get('ageYears'),
                    ageMonths: formData.get('ageMonths')
                });
                
                // Получаем годы и месяцы
                let ageYears = parseInt(formData.get('ageYears')) || 0;
                let ageMonths = parseInt(formData.get('ageMonths')) || 0;
                
                // Проверяем, что указан хотя бы один месяц
                if (ageYears === 0 && ageMonths === 0) {
                    NotificationSystem.warning('Укажите возраст питомца (хотя бы 1 месяц)');
                    return;
                }
                
                // Валидация: месяцы не должны быть больше 11 (проверка на случай если пользователь введет больше)
                if (ageMonths > 11) {
                    NotificationSystem.warning('Месяцы не могут быть больше 11. Используйте годы для возраста больше года.');
                    return;
                }
                
                // Вычисляем возраст в годах (для обратной совместимости)
                const age = ageYears + (ageMonths / 12);
                
                // Проверка обязательных полей
                if (!formData.get('name') || !formData.get('type') || !formData.get('breed') || 
                    !formData.get('gender') || !formData.get('size') || !formData.get('color') ||
                    !formData.get('character') || !formData.get('description')) {
                    NotificationSystem.warning('Пожалуйста, заполните все обязательные поля');
                    return;
                }
                
                // Определяем возрастную категорию (для фильтров)
                let ageCategory = 'adult';
                if (age < 1) {
                    ageCategory = 'young';
                } else if (age >= 7) {
                    ageCategory = 'senior';
                }
                
                // Обрабатываем фотографии с оптимизацией размера
                const photos = [];
                const files = petPhotos ? petPhotos.files : [];
                console.log('Количество выбранных фотографий:', files.length);
                
                if (files.length > 0) {
                    NotificationSystem.info('Обработка фотографий...');
                }
                
                const MAX_WIDTH = 1920; // Максимальная ширина
                const MAX_HEIGHT = 1920; // Максимальная высота
                const QUALITY = 0.85; // Качество JPEG (0.0 - 1.0)
                
                for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    try {
                        const photoPromise = new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                const img = new Image();
                                img.onload = () => {
                                    try {
                                        // Вычисляем новые размеры с сохранением пропорций
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
                                        
                                        // Создаем canvas для сжатия изображения
                                        const canvas = document.createElement('canvas');
                                        canvas.width = width;
                                        canvas.height = height;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, width, height);
                                        
                                        // Конвертируем в base64 с качеством JPEG
                                        const compressedDataUrl = canvas.toDataURL('image/jpeg', QUALITY);
                                        resolve(compressedDataUrl);
                                    } catch (canvasError) {
                                        // Если не удалось оптимизировать, используем оригинал
                                        console.warn('Не удалось оптимизировать изображение, используем оригинал:', canvasError);
                                        resolve(e.target.result);
                                    }
                                };
                                img.onerror = () => {
                                    // Если не удалось загрузить как изображение, используем оригинал
                                    console.warn('Не удалось загрузить изображение, используем оригинал');
                                    resolve(e.target.result);
                                };
                                img.src = e.target.result;
                            };
                            reader.onerror = () => reject(new Error('Ошибка чтения файла'));
                            reader.readAsDataURL(file);
                        });
                        photos.push(await photoPromise);
                        console.log(`Фотография ${i + 1}/${files.length} обработана`);
                    } catch (error) {
                        console.error('Ошибка обработки фотографии:', error);
                        NotificationSystem.warning(`Не удалось обработать фотографию "${file.name}". Попробуйте выбрать другое изображение.`);
                        // Пропускаем проблемную фотографию и продолжаем с остальными
                    }
                }
                
                console.log(`Всего обработано фотографий: ${photos.length}`);
                
                const pet = {
                    name: formData.get('name'),
                    type: formData.get('type'),
                    breed: formData.get('breed'),
                    age: age, // Возраст в годах (для обратной совместимости)
                    ageYears: ageYears, // Годы
                    ageMonths: ageMonths, // Месяцы
                    ageCategory: ageCategory, // Для фильтров
                    gender: formData.get('gender'),
                    size: formData.get('size'),
                    color: formData.get('color'),
                    character: formData.get('character'),
                    description: formData.get('description'),
                    photos: photos,
                    shelterId: currentUser.id,
                    shelterName: currentUser.shelterName,
                    icon: formData.get('type') === 'dog' ? '🐕' : '🐱',
                    adopted: false,
                    createdAt: new Date().toISOString()
                };
                
                console.log('Отправка данных питомца:', {
                    name: pet.name,
                    type: pet.type,
                    breed: pet.breed,
                    ageYears: pet.ageYears,
                    ageMonths: pet.ageMonths,
                    photosCount: pet.photos.length,
                    shelterId: pet.shelterId
                });
                
                try {
                    // Проверяем, редактируем ли мы существующего питомца
                    const editId = addPetForm.dataset.editId;
                    
                    if (editId) {
                        // Редактирование существующего питомца
                        const existingPhotos = JSON.parse(addPetForm.dataset.existingPhotos || '[]');
                        // Объединяем существующие фотографии с новыми
                        pet.photos = [...existingPhotos, ...pet.photos];
                        
                        console.log('Вызов apiClient.updatePet...');
                        await apiClient.updatePet(editId, pet);
                        console.log('Питомец успешно обновлен');
                        NotificationSystem.success('Животное успешно обновлено!');
                        delete addPetForm.dataset.editId;
                        delete addPetForm.dataset.existingPhotos;
                    } else {
                        // Создание нового питомца
                        console.log('Вызов apiClient.addPet...');
                        const response = await apiClient.addPet(pet);
                        console.log('Питомец успешно добавлен:', response);
                        NotificationSystem.success('Животное успешно размещено!');
                    }
                    
                    addPetForm.reset();
                    photoPreview.innerHTML = '';
                    delete addPetForm.dataset.editId;
                    delete addPetForm.dataset.existingPhotos;
                    
                    // Восстанавливаем заголовок и кнопку
                    const formTitle = addPetForm.closest('.shelter-form-section')?.querySelector('h3');
                    if (formTitle) {
                        formTitle.textContent = 'Разместить животное';
                    }
                    const submitBtn = addPetForm.querySelector('button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.textContent = 'Разместить животное';
                    }
                    
                shelterPetFormSection.style.display = 'none';
                await loadPets();
                } catch (error) {
                    console.error('Ошибка размещения:', error);
                    const editId = addPetForm.dataset.editId;
                    let errorMessage = editId ? 'Произошла ошибка при обновлении животного. Попробуйте еще раз.' : 'Произошла ошибка при размещении животного. Попробуйте еще раз.';
                    
                    if (error.message) {
                        errorMessage = error.message;
                    } else if (error.response) {
                        if (error.response.status === 413) {
                            errorMessage = 'Размер фотографий слишком большой. Пожалуйста, выберите фотографии меньшего размера или уменьшите их количество.';
                        } else if (error.response.error) {
                            errorMessage = error.response.error;
                        }
                    }
                    
                    NotificationSystem.error(errorMessage);
                }
            } catch (unexpectedError) {
                console.error('Неожиданная ошибка при отправке формы:', unexpectedError);
                NotificationSystem.error('Произошла неожиданная ошибка: ' + (unexpectedError.message || 'Неизвестная ошибка'));
            }
        });
    } else {
        console.error('Форма addPetForm не найдена!');
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

    // Загрузка животных из базы данных
    async function loadPets() {
        try {
            const data = await apiClient.getPets();
            allPets = data.pets || [];
            
            // Фильтруем только непристроенных животных
            allPets = allPets.filter(pet => !pet.adopted);
            
            renderPets(allPets);
        } catch (error) {
            console.error('Ошибка загрузки животных:', error);
            allPets = [];
            renderPets(allPets);
        }
    }

    // Функция фильтрации животных
    async function filterPets() {
        const filters = {
            type: typeFilter.value,
            ageCategory: ageFilter.value,
            gender: genderFilter.value,
            size: sizeFilter.value
        };

        try {
            let filteredPets = allPets.filter(pet => {
                const matchType = filters.type === 'all' || pet.type === filters.type;
                const matchAge = filters.ageCategory === 'all' || pet.ageCategory === filters.ageCategory;
                const matchGender = filters.gender === 'all' || pet.gender === filters.gender;
                const matchSize = filters.size === 'all' || pet.size === filters.size;
                return matchType && matchAge && matchGender && matchSize;
            });
            renderPets(filteredPets);
        } catch (error) {
            console.error('Ошибка фильтрации:', error);
        }
    }

    // Функция отображения животных
    function renderPets(pets) {
        petsGrid.innerHTML = '';
        resultsCount.textContent = pets.length;

        if (pets.length === 0) {
            noResults.style.display = 'block';
            return;
        }

        noResults.style.display = 'none';

        pets.forEach(pet => {
            const petCard = createPetCard(pet);
            petsGrid.appendChild(petCard);
        });
    }

    // Функция создания карточки животного
    function createPetCard(pet) {
        const card = document.createElement('div');
        card.className = 'pet-card';

        // Используем годы и месяцы если они есть, иначе вычисляем из age
        const ageText = getAgeText(pet.age, pet.ageYears, pet.ageMonths);
        const genderText = getGenderText(pet.gender);

        // Проверяем, является ли текущий пользователь владельцем питомца (передержкой)
        const currentUser = AuthSystem.getCurrentUser();
        const isOwner = currentUser && currentUser.type === 'shelter' && pet.shelterId === currentUser.id;

        // Определяем изображение
        let imageHtml = `<div class="pet-image">${pet.icon || (pet.type === 'dog' ? '🐕' : '🐱')}</div>`;
        if (pet.photos && pet.photos.length > 0) {
            imageHtml = `<div class="pet-image" style="background-image: url('${pet.photos[0]}'); background-size: cover; background-position: center;"></div>`;
        }

        // Упрощенная карточка - только пол и возраст
        card.innerHTML = `
            ${imageHtml}
            <div class="pet-info">
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
                ${isOwner ? `
                <div class="pet-card-actions" onclick="event.stopPropagation()">
                    <button class="btn-edit-pet" onclick="editPet(${pet.id})" title="Редактировать">✏️</button>
                    <button class="btn-delete-pet" onclick="deletePet(${pet.id})" title="Удалить">🗑️</button>
                </div>
                ` : ''}
            </div>
        `;

        // Делаем всю карточку кликабельной для перехода на страницу деталей (кроме кнопок)
        card.addEventListener('click', function(e) {
            if (!e.target.closest('.pet-card-actions')) {
                window.location.href = `pet-detail.html?id=${pet.id}`;
            }
        });

        return card;
    }


    // Функция обновления счетчика
    async function updateAdoptedCounter() {
        try {
            const count = await ApplicationsSystem.getAdoptedCount();
            adoptedCounter.textContent = count;
        } catch (error) {
            console.error('Ошибка обновления счетчика:', error);
            const count = parseInt(localStorage.getItem('adoptedCount')) || 0;
            adoptedCounter.textContent = count;
        }
    }

    // Модальное окно управления заявками
    async function showApplicationsModal() {
        const currentUser = AuthSystem.getCurrentUser();
        if (!currentUser || currentUser.type !== 'shelter') {
            NotificationSystem.error('Только передержки могут управлять заявками');
            return;
        }
        
        try {
            const applications = await ApplicationsSystem.getShelterApplications(currentUser.id);
            const volunteersData = await apiClient.getVolunteers();
            const volunteers = volunteersData.volunteers || [];
            
            let modalHtml = `
                <div class="modal-overlay" id="applicationsModal">
                    <div class="modal-content" style="max-width: 1200px; width: 95%;">
                        <style>
                            #applicationsModal .admin-tabs {
                                display: flex;
                                gap: 1rem;
                                margin-bottom: 1rem;
                                border-bottom: 2px solid #e0e0e0;
                            }
                            #applicationsModal .admin-tab-btn {
                                background: none;
                                border: none;
                                padding: 0.75rem 1.5rem;
                                cursor: pointer;
                                font-size: 1rem;
                                color: #666;
                                border-bottom: 3px solid transparent;
                                transition: all 0.3s;
                            }
                            #applicationsModal .admin-tab-btn:hover {
                                color: #667eea;
                            }
                            #applicationsModal .admin-tab-btn.active {
                                color: #667eea;
                                border-bottom-color: #667eea;
                                font-weight: bold;
                            }
                            #applicationsModal .admin-tab-content {
                                display: none;
                            }
                            #applicationsModal .admin-tab-content.active {
                                display: block;
                            }
                        </style>
                        <div class="modal-header">
                            <h3>Управление заявками</h3>
                            <button class="modal-close" onclick="closeApplicationsModal()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="admin-tabs">
                                <button class="admin-tab-btn active" data-tab="pet-applications" onclick="switchShelterTab('pet-applications')">📝 Заявки на животных</button>
                                <button class="admin-tab-btn" data-tab="volunteers" onclick="switchShelterTab('volunteers')">🤝 Волонтеры</button>
                            </div>
                            
                            <!-- Заявки на животных -->
                            <div id="pet-applications-tab" class="admin-tab-content active">
            `;
            
            if (applications.length === 0) {
                modalHtml += '<p style="text-align: center; padding: 2rem;">Заявок пока нет</p>';
            } else {
                modalHtml += '<div class="applications-list">';
                for (const app of applications) {
                    const statusColors = {
                        'новое': '#667eea',
                        'договорились': '#48bb78',
                        'отказались': '#f56565',
                        'забрали': '#38a169',
                        'вернули': '#ed8936'
                    };
                    
                    modalHtml += `
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
                modalHtml += '</div>';
            }
            
            modalHtml += `
                            </div>
                            
                            <!-- Волонтеры -->
                            <div id="volunteers-tab" class="admin-tab-content">
            `;
            
            if (volunteers.length === 0) {
                modalHtml += '<p style="text-align: center; padding: 2rem;">Заявок от волонтеров пока нет</p>';
            } else {
                modalHtml += '<div class="applications-list">';
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
                    
                    modalHtml += `
                        <div class="application-card">
                            <div class="application-header">
                                <h4>${volunteer.name}</h4>
                            </div>
                            <div class="application-info">
                                <p><strong>Возраст:</strong> ${volunteer.age || 'Не указан'}</p>
                                <p><strong>Телефон:</strong> ${volunteer.phone || 'Не указан'}</p>
                                <p><strong>Email:</strong> ${volunteer.email || 'Не указан'}</p>
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
                modalHtml += '</div>';
            }
            
            modalHtml += `
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            
            // Инициализируем кастомные select в модальном окне
            setTimeout(() => {
                const modalSelects = document.querySelectorAll('#applicationsModal select:not(.custom-select-initialized)');
                modalSelects.forEach(select => {
                    select.classList.add('custom-select-initialized');
                    
                    // Добавляем обработчик change через addEventListener для надежности
                    const applicationId = select.getAttribute('data-application-id');
                    if (applicationId) {
                        select.addEventListener('change', function(e) {
                            console.log('Событие change на select:', { applicationId, value: this.value });
                            updateApplicationStatus(parseInt(applicationId), this.value);
                        });
                    }
                    
                    if (window.CustomSelect) {
                        new window.CustomSelect(select);
                    }
                });
            }, 100);
        } catch (error) {
            console.error('Ошибка загрузки заявок:', error);
            NotificationSystem.error('Произошла ошибка при загрузке заявок');
        }
    }
    
    // Переключение вкладок в модальном окне передержки
    window.switchShelterTab = function(tabName) {
        const modal = document.getElementById('applicationsModal');
        if (!modal) return;
        
        const tabButtons = modal.querySelectorAll('.admin-tab-btn');
        const tabContents = modal.querySelectorAll('.admin-tab-content');
        
        // Убираем активный класс у всех кнопок
        tabButtons.forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Убираем активный класс у всего контента
        tabContents.forEach(content => {
            content.classList.remove('active');
        });
        
        // Добавляем активный класс выбранной кнопке
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Показываем выбранный контент
        const targetContent = modal.querySelector('#' + tabName + '-tab');
        if (targetContent) {
            targetContent.classList.add('active');
        }
    };

    // Обновление статуса заявки
    window.updateApplicationStatus = async function(applicationId, status) {
        try {
            console.log('Обновление статуса заявки:', { applicationId, status });
            const result = await ApplicationsSystem.updateApplicationStatus(applicationId, status);
            console.log('Результат обновления статуса:', result);
            
            if (result.success) {
                // Если статус "отказались", заявка была удалена
                if (status === 'отказались') {
                    NotificationSystem.success('Заявка удалена');
                } else if (status === 'вернули') {
                    NotificationSystem.success('Питомец возвращен в каталог');
                } else {
                    NotificationSystem.success('Статус заявки обновлен');
                }
                
                // Обновляем счетчик и список животных при любом изменении статуса
                console.log('Обновляем счетчик и список питомцев...');
                await updateAdoptedCounter();
                await loadPets();
                console.log('Список питомцев обновлен');
                
                // Обновляем модальное окно
                console.log('Обновляем модальное окно...');
                closeApplicationsModal();
                await showApplicationsModal();
                console.log('Модальное окно обновлено');
            } else {
                console.error('Ошибка обновления статуса:', result.message);
                NotificationSystem.error(result.message || 'Произошла ошибка при обновлении статуса');
            }
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            const errorMessage = error.message || error.response?.error || 'Произошла ошибка при обновлении статуса';
            NotificationSystem.error(errorMessage);
        }
    };

    // Закрытие модального окна
    window.closeApplicationsModal = function() {
        const modal = document.getElementById('applicationsModal');
        if (modal) {
            modal.remove();
        }
    };

    // Функция редактирования питомца
    window.editPet = async function(petId) {
        try {
            console.log('Редактирование питомца:', petId);
            const data = await apiClient.getPet(petId);
            const pet = data.pet;
            
            if (!pet) {
                NotificationSystem.error('Питомец не найден');
                return;
            }

            console.log('Питомец загружен:', pet);
            // Открываем форму редактирования
            openEditPetModal(pet);
        } catch (error) {
            console.error('Ошибка загрузки питомца:', error);
            const errorMessage = error.response?.error || error.message || 'Не удалось загрузить данные питомца';
            NotificationSystem.error(errorMessage);
        }
    };

    // Функция удаления питомца
    window.deletePet = async function(petId) {
        if (!confirm('Вы уверены, что хотите удалить этого питомца? Это действие нельзя отменить.')) {
            return;
        }

        try {
            console.log('Удаление питомца:', petId);
            await apiClient.deletePet(petId);
            NotificationSystem.success('Питомец успешно удален');
            await loadPets();
        } catch (error) {
            console.error('Ошибка удаления питомца:', error);
            const errorMessage = error.response?.error || error.message || 'Не удалось удалить питомца';
            NotificationSystem.error(errorMessage);
        }
    };

    // Функция открытия модального окна редактирования питомца
    function openEditPetModal(pet) {
        const form = addPetForm;
        if (!form) {
            NotificationSystem.error('Форма не найдена');
            return;
        }

        // Заполняем форму данными питомца
        document.getElementById('petName').value = pet.name || '';
        document.getElementById('petType').value = pet.type || '';
        document.getElementById('petBreed').value = pet.breed || '';
        
        // Возраст
        document.getElementById('petAgeYears').value = pet.ageYears !== undefined && pet.ageYears !== null ? pet.ageYears : 0;
        document.getElementById('petAgeMonths').value = pet.ageMonths !== undefined && pet.ageMonths !== null ? pet.ageMonths : 0;
        
        document.getElementById('petGender').value = pet.gender || '';
        document.getElementById('petSize').value = pet.size || '';
        document.getElementById('petColor').value = pet.color || '';
        document.getElementById('petCharacter').value = pet.character || '';
        document.getElementById('petDescription').value = pet.description || '';

        // Фотографии
        const preview = document.getElementById('photoPreview');
        if (preview) {
            if (pet.photos && pet.photos.length > 0) {
                preview.innerHTML = pet.photos.map((photo, index) => `
                    <div class="photo-preview-item" data-photo-index="${index}">
                        <img src="${photo}" alt="Фото ${index + 1}">
                        <button type="button" class="remove-photo" onclick="removePhotoFromEdit(${index})">×</button>
                    </div>
                `).join('');
            } else {
                preview.innerHTML = '';
            }
        }

        // Сохраняем ID питомца и существующие фотографии для редактирования
        form.dataset.editId = pet.id;
        form.dataset.existingPhotos = JSON.stringify(pet.photos || []);

        // Обновляем заголовок формы
        const formTitle = form.closest('.shelter-form-section')?.querySelector('h3');
        if (formTitle) {
            formTitle.textContent = 'Редактировать животное';
        }

        // Обновляем текст кнопки
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.textContent = 'Сохранить изменения';
        }

        // Показываем форму
        if (shelterPetFormSection) {
            shelterPetFormSection.style.display = 'block';
            shelterPetFormSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // Функция удаления фотографии при редактировании
    window.removePhotoFromEdit = function(index) {
        const form = addPetForm;
        if (!form || !form.dataset.editId) return;

        const existingPhotos = JSON.parse(form.dataset.existingPhotos || '[]');
        existingPhotos.splice(index, 1);
        form.dataset.existingPhotos = JSON.stringify(existingPhotos);

        const preview = document.getElementById('photoPreview');
        if (preview) {
            const item = preview.querySelector(`[data-photo-index="${index}"]`);
            if (item) item.remove();
        }
    };
});
