    // Функция переключения состояния формы (глобальная для использования в HTML)
    window.toggleForm = function(headerElement) {
        const formSection = headerElement.closest('.form-section');
        if (formSection) {
            formSection.classList.toggle('collapsed');
        }
    };

    // Функция переключения сворачивания/разворачивания информации о животном
    window.toggleAnnouncementDetails = function(headerElement) {
        const detailsElement = headerElement.nextElementSibling;
        const toggleIcon = headerElement.querySelector('.toggle-icon');
        
        if (detailsElement && detailsElement.classList.contains('announcement-details')) {
            detailsElement.classList.toggle('collapsed');
            
            // Поворачиваем иконку
            if (toggleIcon) {
                if (detailsElement.classList.contains('collapsed')) {
                    toggleIcon.style.transform = 'rotate(0deg)';
                } else {
                    toggleIcon.style.transform = 'rotate(180deg)';
                }
            }
        }
    };

// Загрузка текста и картинки для страницы экстренных ситуаций
async function loadEmergencyText() {
    try {
        const data = await apiClient.getEmergencyText();
        const text = data.text || '';
        const image = data.image || '';
        
        const textElement = document.getElementById('emergencyText');
        const textSection = document.getElementById('emergencyTextSection');
        const imageElement = document.getElementById('emergencyImage');
        const imageContainer = document.getElementById('emergencyImageContainer');
        const textContainer = document.getElementById('emergencyTextContainer');
        
        if (textSection) {
            const hasText = text.trim().length > 0;
            const hasImage = image.trim().length > 0;
            
            if (hasText || hasImage) {
                // Показываем секцию, если есть текст или картинка
                textSection.style.display = 'block';
                
                // Устанавливаем текст
                if (textElement) {
                    if (hasText) {
                        textElement.textContent = text;
                        if (textContainer) {
                            textContainer.style.display = 'block';
                        }
                    } else {
                        if (textContainer) {
                            textContainer.style.display = 'none';
                        }
                    }
                }
                
                // Устанавливаем картинки (может быть одна строка или массив)
                if (imageContainer) {
                    let images = [];
                    if (image) {
                        if (typeof image === 'string' && image.trim() !== '') {
                            try {
                                // Пытаемся распарсить как JSON (массив)
                                images = JSON.parse(image);
                                if (!Array.isArray(images)) {
                                    // Если не массив, значит это старая версия с одной картинкой
                                    images = [image];
                                }
                            } catch (e) {
                                // Если не JSON, значит это одна картинка (старая версия)
                                images = [image];
                            }
                        } else if (Array.isArray(image)) {
                            images = image;
                        }
                    }
                    
                    if (images.length > 0) {
                        imageContainer.innerHTML = '';
                        images.forEach((img, index) => {
                            const imgElement = document.createElement('img');
                            imgElement.src = img;
                            imgElement.alt = `Изображение ${index + 1}`;
                            imgElement.className = 'emergency-image';
                            imgElement.style.cssText = 'max-width: 300px; max-height: 300px; border-radius: 8px; object-fit: cover; box-shadow: 0 4px 8px rgba(0,0,0,0.2); margin-right: 1rem;';
                            imageContainer.appendChild(imgElement);
                        });
                        imageContainer.style.display = 'flex';
                        imageContainer.style.flexWrap = 'wrap';
                        imageContainer.style.gap = '1rem';
                    } else {
                        imageContainer.style.display = 'none';
                    }
                }
            } else {
                // Если нет ни текста, ни картинки, скрываем секцию
                textSection.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки текста и картинки:', error);
        const textSection = document.getElementById('emergencyTextSection');
        if (textSection) {
            // При ошибке скрываем поле
            textSection.style.display = 'none';
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Инициализируем базу данных
    // API инициализируется автоматически
    
    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    
    // Получаем элементы
    const lostPetForm = document.getElementById('lostPetForm');
    const foundPetForm = document.getElementById('foundPetForm');
    const foundCounter = document.getElementById('foundCounter');
    const lostAnnouncements = document.getElementById('lostAnnouncements');
    const foundAnnouncements = document.getElementById('foundAnnouncements');
    const tabButtons = document.querySelectorAll('.tab-btn');
    const lostPhotos = document.getElementById('lostPhotos');
    const foundPhotos = document.getElementById('foundPhotos');
    const lostPhotoPreview = document.getElementById('lostPhotoPreview');
    const foundPhotoPreview = document.getElementById('foundPhotoPreview');
    const dateFilterFrom = document.getElementById('dateFilterFrom');
    const dateFilterTo = document.getElementById('dateFilterTo');
    const resetDateFilterBtn = document.getElementById('resetDateFilter');
    
    // Переменные для хранения всех объявлений
    let allLostPets = [];
    let allFoundPets = [];

    // Устанавливаем сегодняшнюю дату по умолчанию (только если формы видны)
    const today = new Date().toISOString().split('T')[0];
    const lostDateInput = document.getElementById('lostDate');
    const foundDateInput = document.getElementById('foundDate');
    if (lostDateInput) {
        lostDateInput.value = today;
    }
    if (foundDateInput) {
        foundDateInput.value = today;
    }

    // Обновляем счетчик найденных животных
    if (foundCounter) {
        updateCounterDisplay();
    }

    // Загружаем текст для страницы экстренных ситуаций
    loadEmergencyText();

    // Отображаем объявления (для всех пользователей, включая передержки)
    if (lostAnnouncements && foundAnnouncements) {
        await renderAnnouncements();
    }

    // Функция обработки фотографий с оптимизацией
    async function processPhotos(files) {
        const photos = [];
        if (files.length === 0) {
            return photos;
        }

        NotificationSystem.info('Обработка фотографий...');
        
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
                                resolve(e.target.result);
                            }
                        };
                        img.onerror = () => {
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
                NotificationSystem.warning(`Не удалось обработать фотографию "${file.name}". Попробуйте выбрать другое изображение.`);
            }
        }
        
        return photos;
    }

    // Обработчик предпросмотра фотографий для формы "Потерялся"
    if (lostPhotos && lostPhotoPreview) {
        lostPhotos.addEventListener('change', function(e) {
            lostPhotoPreview.innerHTML = '';
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
                    lostPhotoPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Обработчик предпросмотра фотографий для формы "Найден"
    if (foundPhotos && foundPhotoPreview) {
        foundPhotos.addEventListener('change', function(e) {
            foundPhotoPreview.innerHTML = '';
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
                    foundPhotoPreview.appendChild(img);
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Обработчик формы "Мой питомец потерялся"
    if (lostPetForm) {
        lostPetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Проверяем авторизацию
            const currentUser = AuthSystem.getCurrentUser();
            if (!currentUser) {
                NotificationSystem.warning('Пожалуйста, войдите в систему, чтобы разместить объявление');
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 1500);
                return;
            }
            
            const formData = new FormData(lostPetForm);
            
            // Обрабатываем фотографии
            const files = lostPhotos ? lostPhotos.files : [];
            const existingPhotos = JSON.parse(lostPetForm.dataset.existingPhotos || '[]');
            let photos = [...existingPhotos];
            
            if (files.length > 0) {
                const newPhotos = await processPhotos(Array.from(files));
                photos = [...photos, ...newPhotos];
            }
            
            const announcement = {
                name: formData.get('name'),
                petType: formData.get('type'),
                breed: formData.get('breed') || 'Не указано',
                age: formData.get('age') || 'Не указано',
                gender: formData.get('gender'),
                color: formData.get('color'),
                description: formData.get('description'),
                location: formData.get('location'),
                date: formData.get('date'),
                contact: formData.get('contact'),
                photos: photos,
                userId: currentUser.id
            };

            try {
                const editId = lostPetForm.dataset.editId;
                if (editId) {
                    // Редактирование
                    await AnnouncementsSystem.updateAnnouncement(editId, announcement);
                    delete lostPetForm.dataset.editId;
                    delete lostPetForm.dataset.existingPhotos;
                    NotificationSystem.success('Объявление успешно обновлено!');
                } else {
                    // Создание
                    await AnnouncementsSystem.saveLostPet(announcement);
                    NotificationSystem.success('Объявление о пропаже размещено! Мы поможем найти вашего питомца.');
                }
                await renderAnnouncements();
                lostPetForm.reset();
                lostPhotoPreview.innerHTML = '';
                delete lostPetForm.dataset.editId;
                delete lostPetForm.dataset.existingPhotos;
                document.getElementById('lostDate').value = today;
            } catch (error) {
                console.error('Ошибка сохранения:', error);
                NotificationSystem.error('Произошла ошибка при сохранении объявления. Попробуйте еще раз.');
            }
        });
    }

    // Обработчик формы "Я нашел питомца"
    if (foundPetForm) {
        foundPetForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Проверяем авторизацию
            const currentUser = AuthSystem.getCurrentUser();
            if (!currentUser) {
                NotificationSystem.warning('Пожалуйста, войдите в систему, чтобы разместить объявление');
                setTimeout(() => {
                    window.location.href = 'auth.html';
                }, 1500);
                return;
            }
            
            const formData = new FormData(foundPetForm);
            
            // Обрабатываем фотографии
            const files = foundPhotos ? foundPhotos.files : [];
            const existingPhotos = JSON.parse(foundPetForm.dataset.existingPhotos || '[]');
            let photos = [...existingPhotos];
            
            if (files.length > 0) {
                const newPhotos = await processPhotos(Array.from(files));
                photos = [...photos, ...newPhotos];
            }
            
            const announcement = {
                petType: formData.get('type'),
                breed: formData.get('breed') || 'Неизвестно',
                age: formData.get('age') || 'Неизвестно',
                gender: formData.get('gender') || '',
                color: formData.get('color'),
                description: formData.get('description'),
                location: formData.get('location'),
                date: formData.get('date'),
                contact: formData.get('contact'),
                photos: photos,
                userId: currentUser.id
            };

            try {
                const editId = foundPetForm.dataset.editId;
                if (editId) {
                    // Редактирование
                    await AnnouncementsSystem.updateAnnouncement(editId, announcement);
                    delete foundPetForm.dataset.editId;
                    delete foundPetForm.dataset.existingPhotos;
                    NotificationSystem.success('Объявление успешно обновлено!');
                } else {
                    // Создание
                    await AnnouncementsSystem.saveFoundPet(announcement);
                    
                    NotificationSystem.success('Спасибо за вашу помощь! Объявление о находке размещено.');
                }
                
                await renderAnnouncements();
                foundPetForm.reset();
                foundPhotoPreview.innerHTML = '';
                delete foundPetForm.dataset.editId;
                delete foundPetForm.dataset.existingPhotos;
                document.getElementById('foundDate').value = today;
            } catch (error) {
                console.error('Ошибка сохранения:', error);
                NotificationSystem.error('Произошла ошибка при сохранении объявления. Попробуйте еще раз.');
            }
        });
    }

    // Обработчики переключения вкладок
    tabButtons.forEach(btn => {
        btn.addEventListener('click', async function() {
            const tab = this.dataset.tab;
            
            // Обновляем активную вкладку
            tabButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Показываем соответствующий список и перерисовываем объявления
            if (tab === 'lost') {
                foundAnnouncements.style.display = 'none';
                foundAnnouncements.innerHTML = ''; // Очищаем неактивный контейнер
                lostAnnouncements.style.display = 'grid';
                // Перерисовываем только потерянные (с учетом фильтра)
                const fromDate = dateFilterFrom ? dateFilterFrom.value : '';
                const toDate = dateFilterTo ? dateFilterTo.value : '';
                if (allLostPets.length > 0) {
                    renderFilteredLostAnnouncements(fromDate, toDate);
                } else {
                    await renderLostAnnouncements();
                }
            } else {
                lostAnnouncements.style.display = 'none';
                lostAnnouncements.innerHTML = ''; // Очищаем неактивный контейнер
                foundAnnouncements.style.display = 'grid';
                // Перерисовываем только найденные (с учетом фильтра)
                const fromDate = dateFilterFrom ? dateFilterFrom.value : '';
                const toDate = dateFilterTo ? dateFilterTo.value : '';
                if (allFoundPets.length > 0) {
                    renderFilteredFoundAnnouncements(fromDate, toDate);
                } else {
                    await renderFoundAnnouncements();
                }
            }
        });
    });
    
    // Обработчики фильтра по дате
    if (dateFilterFrom) {
        dateFilterFrom.addEventListener('change', function() {
            applyDateFilter();
        });
    }
    
    if (dateFilterTo) {
        dateFilterTo.addEventListener('change', function() {
            applyDateFilter();
        });
    }
    
    if (resetDateFilterBtn) {
        resetDateFilterBtn.addEventListener('click', function() {
            dateFilterFrom.value = '';
            dateFilterTo.value = '';
            applyDateFilter();
        });
    }
    
    // Функция применения фильтра по дате
    function applyDateFilter() {
        const fromDate = dateFilterFrom ? dateFilterFrom.value : '';
        const toDate = dateFilterTo ? dateFilterTo.value : '';
        
        // Определяем активную вкладку
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            const tab = activeTab.dataset.tab;
            if (tab === 'lost') {
                renderFilteredLostAnnouncements(fromDate, toDate);
            } else {
                renderFilteredFoundAnnouncements(fromDate, toDate);
            }
        }
    }
    
    // Функция фильтрации по дате
    function filterByDate(pets, fromDate, toDate) {
        if (!fromDate && !toDate) {
            return pets;
        }
        
        return pets.filter(pet => {
            if (!pet.date) return false;
            
            const petDate = new Date(pet.date);
            petDate.setHours(0, 0, 0, 0);
            
            if (fromDate && toDate) {
                const from = new Date(fromDate);
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                return petDate >= from && petDate <= to;
            } else if (fromDate) {
                const from = new Date(fromDate);
                return petDate >= from;
            } else if (toDate) {
                const to = new Date(toDate);
                to.setHours(23, 59, 59, 999);
                return petDate <= to;
            }
            
            return true;
        });
    }

    // Функция обновления счетчика
    function updateCounterDisplay() {
        const count = AnnouncementsSystem.getFoundCounter();
        foundCounter.textContent = count;
    }

    // Функция отображения объявлений
    async function renderAnnouncements() {
        await renderLostAnnouncements();
        await renderFoundAnnouncements();
    }
    
    // Функция отображения отфильтрованных потерянных объявлений
    function renderFilteredLostAnnouncements(fromDate, toDate) {
        if (!lostAnnouncements || allLostPets.length === 0) {
            return;
        }
        
        const filteredPets = filterByDate(allLostPets, fromDate, toDate);
        
        if (filteredPets.length === 0) {
            lostAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">По выбранным датам объявлений не найдено.</p>';
            return;
        }
        
        const currentUser = AuthSystem.getCurrentUser();
        
        const isOwner = (announcement) => {
            if (!currentUser) {
                return false;
            }
            return announcement.userId != null && announcement.userId === currentUser.id && (!announcement.userType || announcement.userType === currentUser.type);
        };
        
        lostAnnouncements.innerHTML = filteredPets.map(pet => {
            const ownerCheck = isOwner(pet);
            const petType = pet.type_animal || pet.petType;
            let photos = [];
            if (pet.photos) {
                if (Array.isArray(pet.photos)) {
                    photos = pet.photos;
                } else if (typeof pet.photos === 'string') {
                    try {
                        photos = JSON.parse(pet.photos);
                    } catch (e) {
                        console.warn('Ошибка парсинга фотографий:', e);
                        photos = [];
                    }
                }
            }
            const hasPhotos = photos.length > 0;
            
            let imageHtml = `<div class="pet-image announcement-pet-image">${petType === 'dog' ? '🐕' : '🐱'}</div>`;
            if (hasPhotos) {
                imageHtml = `<div class="pet-image announcement-pet-image" style="background-image: url('${escapeHtml(cssUrl(photos[0]))}'); background-size: cover; background-position: center;"></div>`;
            }
            
            return `
                <div class="pet-card announcement-pet-card" style="cursor: default;">
                    ${imageHtml}
                    <div class="pet-info">
                        <div class="pet-name announcement-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; cursor: pointer;" onclick="toggleAnnouncementDetails(this)">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span>${escapeHtml(pet.name)}</span>
                                <span class="announcement-type type-lost" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Потерян</span>
                            </div>
                            <span class="toggle-icon" style="font-size: 1.2rem; transition: transform 0.3s;">▼</span>
                        </div>
                        <div class="announcement-details collapsed">
                            <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : '♀️'}</span>
                                    <span>${getGenderText(pet.gender)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📅</span>
                                    <span>${escapeHtml(pet.age || 'Не указано')}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                    <span>${getTypeText(petType)}</span>
                                </div>
                                ${pet.breed ? `
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🏷️</span>
                                    <span>${escapeHtml(pet.breed)}</span>
                                </div>
                                ` : ''}
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🎨</span>
                                    <span>${escapeHtml(pet.color)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📍</span>
                                    <span>${escapeHtml(pet.location)}</span>
                                </div>
                            </div>
                            ${pet.description ? `
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                                <strong style="color: #333;">Описание:</strong> ${escapeHtml(pet.description)}
                            </div>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Дата пропажи:</strong> ${escapeHtml(formatDate(pet.date))}
                            </div>
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Контакты:</strong> ${escapeHtml(pet.contact)}
                            </div>
                            ${isOwner(pet) ? `
                            <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                                <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${escapeHtml(pet.id)}, 'lost')" title="Отметить как найденное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                    ✓ Найден
                                </button>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button class="btn-edit-pet" onclick="editAnnouncement(${escapeHtml(pet.id)}, 'lost')" title="Редактировать">✏️</button>
                                    <button class="btn-delete-pet" onclick="deleteAnnouncement(${escapeHtml(pet.id)})" title="Удалить">🗑️</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Инициализируем иконки для свернутых объявлений
        setTimeout(() => {
            const toggleIcons = lostAnnouncements.querySelectorAll('.toggle-icon');
            toggleIcons.forEach(icon => {
                icon.style.transform = 'rotate(0deg)';
            });
        }, 100);
    }
    
    // Функция отображения отфильтрованных найденных объявлений
    function renderFilteredFoundAnnouncements(fromDate, toDate) {
        if (!foundAnnouncements || allFoundPets.length === 0) {
            return;
        }
        
        const filteredPets = filterByDate(allFoundPets, fromDate, toDate);
        
        if (filteredPets.length === 0) {
            foundAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">По выбранным датам объявлений не найдено.</p>';
            return;
        }
        
        const currentUser = AuthSystem.getCurrentUser();
        
        const isOwner = (announcement) => {
            if (!currentUser) {
                return false;
            }
            return announcement.userId != null && announcement.userId === currentUser.id && (!announcement.userType || announcement.userType === currentUser.type);
        };
        
        foundAnnouncements.innerHTML = filteredPets.map(pet => {
            const ownerCheck = isOwner(pet);
            const petType = pet.type_animal || pet.petType;
            let photos = [];
            if (pet.photos) {
                if (Array.isArray(pet.photos)) {
                    photos = pet.photos;
                } else if (typeof pet.photos === 'string') {
                    try {
                        photos = JSON.parse(pet.photos);
                    } catch (e) {
                        console.warn('Ошибка парсинга фотографий:', e);
                        photos = [];
                    }
                }
            }
            const hasPhotos = photos.length > 0;
            
            let imageHtml = `<div class="pet-image announcement-pet-image">${petType === 'dog' ? '🐕' : '🐱'}</div>`;
            if (hasPhotos) {
                imageHtml = `<div class="pet-image announcement-pet-image" style="background-image: url('${escapeHtml(cssUrl(photos[0]))}'); background-size: cover; background-position: center;"></div>`;
            }
            
            return `
                <div class="pet-card announcement-pet-card" style="cursor: default;">
                    ${imageHtml}
                    <div class="pet-info">
                        <div class="pet-name announcement-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; cursor: pointer;" onclick="toggleAnnouncementDetails(this)">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span>Найдено животное</span>
                                <span class="announcement-type type-found" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Найден</span>
                            </div>
                            <span class="toggle-icon" style="font-size: 1.2rem; transition: transform 0.3s;">▼</span>
                        </div>
                        <div class="announcement-details collapsed">
                            <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : pet.gender === 'female' ? '♀️' : '❓'}</span>
                                    <span>${getGenderText(pet.gender)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📅</span>
                                    <span>${escapeHtml(pet.age || 'Неизвестно')}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                    <span>${getTypeText(petType)}</span>
                                </div>
                                ${pet.breed ? `
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🏷️</span>
                                    <span>${escapeHtml(pet.breed)}</span>
                                </div>
                                ` : ''}
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🎨</span>
                                    <span>${escapeHtml(pet.color)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📍</span>
                                    <span>${escapeHtml(pet.location)}</span>
                                </div>
                            </div>
                            ${pet.description ? `
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                                <strong style="color: #333;">Описание:</strong> ${escapeHtml(pet.description)}
                            </div>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Дата находки:</strong> ${escapeHtml(formatDate(pet.date))}
                            </div>
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Контакты:</strong> ${escapeHtml(pet.contact)}
                            </div>
                            ${isOwner(pet) ? `
                            <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                                <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${escapeHtml(pet.id)}, 'found')" title="Отметить как возвращенное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                    ✓ Вернул
                                </button>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button class="btn-edit-pet" onclick="editAnnouncement(${escapeHtml(pet.id)}, 'found')" title="Редактировать">✏️</button>
                                    <button class="btn-delete-pet" onclick="deleteAnnouncement(${escapeHtml(pet.id)})" title="Удалить">🗑️</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        // Инициализируем иконки для свернутых объявлений
        setTimeout(() => {
            const toggleIcons = foundAnnouncements.querySelectorAll('.toggle-icon');
            toggleIcons.forEach(icon => {
                icon.style.transform = 'rotate(0deg)';
            });
        }, 100);
    }

    // Функция отображения объявлений о потерянных животных
    async function renderLostAnnouncements() {
        if (!lostAnnouncements) {
            return;
        }
        
        try {
            // Проверяем доступность сервера
            try {
                await apiClient.request('/health');
            } catch (error) {
                lostAnnouncements.innerHTML = '<p style="text-align: center; color: #f56565; padding: 2rem;">Сервер недоступен. Проверьте подключение к интернету.</p>';
                return;
            }
            
            const lostPets = await AnnouncementsSystem.getLostPets();
            
            // Сохраняем все объявления
            allLostPets = lostPets;
            
            // Применяем фильтр по дате
            const fromDate = dateFilterFrom ? dateFilterFrom.value : '';
            const toDate = dateFilterTo ? dateFilterTo.value : '';
            const filteredPets = filterByDate(lostPets, fromDate, toDate);
            
            if (filteredPets.length === 0) {
                lostAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Пока нет объявлений о потерянных животных.</p>';
                return;
            }

            const currentUser = AuthSystem.getCurrentUser();
            
            const isOwner = (announcement) => {
                if (!currentUser) {
                    return false;
                }
                // Проверяем, что userId существует и совпадает
                return announcement.userId != null && announcement.userId === currentUser.id && (!announcement.userType || announcement.userType === currentUser.type);
            };

            lostAnnouncements.innerHTML = filteredPets.map(pet => {
                const ownerCheck = isOwner(pet);
                const petType = pet.type_animal || pet.petType;
                let photos = [];
                if (pet.photos) {
                    if (Array.isArray(pet.photos)) {
                        photos = pet.photos;
                    } else if (typeof pet.photos === 'string') {
                        try {
                            photos = JSON.parse(pet.photos);
                        } catch (e) {
                            console.warn('Ошибка парсинга фотографий:', e);
                            photos = [];
                        }
                    }
                }
                const hasPhotos = photos.length > 0;
                
                // Определяем изображение
                let imageHtml = `<div class="pet-image announcement-pet-image">${petType === 'dog' ? '🐕' : '🐱'}</div>`;
                if (hasPhotos) {
                    imageHtml = `<div class="pet-image announcement-pet-image" style="background-image: url('${escapeHtml(cssUrl(photos[0]))}'); background-size: cover; background-position: center;"></div>`;
                }
                
                return `
                <div class="pet-card announcement-pet-card" style="cursor: default;">
                    ${imageHtml}
                    <div class="pet-info">
                        <div class="pet-name announcement-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; cursor: pointer;" onclick="toggleAnnouncementDetails(this)">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span>${escapeHtml(pet.name)}</span>
                                <span class="announcement-type type-lost" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Потерян</span>
                            </div>
                            <span class="toggle-icon" style="font-size: 1.2rem; transition: transform 0.3s;">▼</span>
                        </div>
                        <div class="announcement-details collapsed">
                            <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : '♀️'}</span>
                                    <span>${getGenderText(pet.gender)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📅</span>
                                    <span>${escapeHtml(pet.age || 'Не указано')}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                    <span>${getTypeText(petType)}</span>
                                </div>
                                ${pet.breed ? `
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🏷️</span>
                                    <span>${escapeHtml(pet.breed)}</span>
                                </div>
                                ` : ''}
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🎨</span>
                                    <span>${escapeHtml(pet.color)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📍</span>
                                    <span>${escapeHtml(pet.location)}</span>
                                </div>
                            </div>
                            ${pet.description ? `
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                                <strong style="color: #333;">Описание:</strong> ${escapeHtml(pet.description)}
                            </div>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Дата пропажи:</strong> ${escapeHtml(formatDate(pet.date))}
                            </div>
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Контакты:</strong> ${escapeHtml(pet.contact)}
                            </div>
                            ${isOwner(pet) ? `
                            <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                                <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${escapeHtml(pet.id)}, 'lost')" title="Отметить как найденное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                    ✓ Найден
                                </button>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button class="btn-edit-pet" onclick="editAnnouncement(${escapeHtml(pet.id)}, 'lost')" title="Редактировать">✏️</button>
                                    <button class="btn-delete-pet" onclick="deleteAnnouncement(${escapeHtml(pet.id)})" title="Удалить">🗑️</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            
            // Инициализируем иконки для свернутых объявлений
            setTimeout(() => {
                const toggleIcons = lostAnnouncements.querySelectorAll('.toggle-icon');
                toggleIcons.forEach(icon => {
                    icon.style.transform = 'rotate(0deg)';
                });
            }, 100);
        } catch (error) {
            console.error('Ошибка загрузки объявлений:', error);
            lostAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Ошибка загрузки объявлений.</p>';
        }
    }

    // Функция отображения объявлений о найденных животных
    async function renderFoundAnnouncements() {
        if (!foundAnnouncements) {
            return;
        }
        
        try {
            // Проверяем доступность сервера
            try {
                await apiClient.request('/health');
            } catch (error) {
                foundAnnouncements.innerHTML = '<p style="text-align: center; color: #f56565; padding: 2rem;">Сервер недоступен. Проверьте подключение к интернету.</p>';
                return;
            }
            
            const foundPets = await AnnouncementsSystem.getFoundPets();
            
            // Сохраняем все объявления
            allFoundPets = foundPets;
            
            // Применяем фильтр по дате
            const fromDate = dateFilterFrom ? dateFilterFrom.value : '';
            const toDate = dateFilterTo ? dateFilterTo.value : '';
            const filteredPets = filterByDate(foundPets, fromDate, toDate);
            
            const currentUser = AuthSystem.getCurrentUser();
            
            const isOwner = (announcement) => {
                if (!currentUser) {
                    return false;
                }
                // Проверяем, что userId существует и совпадает
                return announcement.userId != null && announcement.userId === currentUser.id && (!announcement.userType || announcement.userType === currentUser.type);
            };
            
            if (filteredPets.length === 0) {
                foundAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Пока нет объявлений о найденных животных.</p>';
                return;
            }

            foundAnnouncements.innerHTML = filteredPets.map(pet => {
                const ownerCheck = isOwner(pet);
                const petType = pet.type_animal || pet.petType;
                let photos = [];
                if (pet.photos) {
                    if (Array.isArray(pet.photos)) {
                        photos = pet.photos;
                    } else if (typeof pet.photos === 'string') {
                        try {
                            photos = JSON.parse(pet.photos);
                        } catch (e) {
                            console.warn('Ошибка парсинга фотографий:', e);
                            photos = [];
                        }
                    }
                }
                const hasPhotos = photos.length > 0;
                
                // Определяем изображение
                let imageHtml = `<div class="pet-image announcement-pet-image">${petType === 'dog' ? '🐕' : '🐱'}</div>`;
                if (hasPhotos) {
                    imageHtml = `<div class="pet-image announcement-pet-image" style="background-image: url('${escapeHtml(cssUrl(photos[0]))}'); background-size: cover; background-position: center;"></div>`;
                }
                
                return `
                <div class="pet-card announcement-pet-card" style="cursor: default;">
                    ${imageHtml}
                    <div class="pet-info">
                        <div class="pet-name announcement-header" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; cursor: pointer;" onclick="toggleAnnouncementDetails(this)">
                            <div style="display: flex; align-items: center; gap: 0.5rem;">
                                <span>Найдено животное</span>
                                <span class="announcement-type type-found" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Найден</span>
                            </div>
                            <span class="toggle-icon" style="font-size: 1.2rem; transition: transform 0.3s;">▼</span>
                        </div>
                        <div class="announcement-details collapsed">
                            <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : pet.gender === 'female' ? '♀️' : '❓'}</span>
                                    <span>${getGenderText(pet.gender)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📅</span>
                                    <span>${escapeHtml(pet.age || 'Неизвестно')}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                    <span>${getTypeText(petType)}</span>
                                </div>
                                ${pet.breed ? `
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🏷️</span>
                                    <span>${escapeHtml(pet.breed)}</span>
                                </div>
                                ` : ''}
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">🎨</span>
                                    <span>${escapeHtml(pet.color)}</span>
                                </div>
                                <div class="pet-detail">
                                    <span class="pet-detail-icon">📍</span>
                                    <span>${escapeHtml(pet.location)}</span>
                                </div>
                            </div>
                            ${pet.description ? `
                            <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                                <strong style="color: #333;">Описание:</strong> ${escapeHtml(pet.description)}
                            </div>
                            ` : ''}
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Дата находки:</strong> ${escapeHtml(formatDate(pet.date))}
                            </div>
                            <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                                <strong style="color: #333;">Контакты:</strong> ${escapeHtml(pet.contact)}
                            </div>
                            ${isOwner(pet) ? `
                            <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                                <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${escapeHtml(pet.id)}, 'found')" title="Отметить как возвращенное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                    ✓ Вернул
                                </button>
                                <div style="display: flex; gap: 0.3rem;">
                                    <button class="btn-edit-pet" onclick="editAnnouncement(${escapeHtml(pet.id)}, 'found')" title="Редактировать">✏️</button>
                                    <button class="btn-delete-pet" onclick="deleteAnnouncement(${escapeHtml(pet.id)})" title="Удалить">🗑️</button>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            `;
            }).join('');
            
            // Инициализируем иконки для свернутых объявлений
            setTimeout(() => {
                const toggleIcons = foundAnnouncements.querySelectorAll('.toggle-icon');
                toggleIcons.forEach(icon => {
                    icon.style.transform = 'rotate(0deg)';
                });
            }, 100);
        } catch (error) {
            console.error('Ошибка загрузки объявлений:', error);
            foundAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Ошибка загрузки объявлений.</p>';
        }
    }

    // Функция редактирования объявления
    window.editAnnouncement = async function(announcementId, type) {
        try {
            const announcement = await AnnouncementsSystem.getAnnouncement(announcementId);
            if (!announcement) {
                NotificationSystem.error('Объявление не найдено');
                return;
            }
            openEditAnnouncementModal(announcement, type);
        } catch (error) {
            console.error('Ошибка загрузки объявления:', error);
            const errorMessage = error.response?.error || error.message || 'Не удалось загрузить объявление для редактирования';
            NotificationSystem.error(errorMessage);
        }
    };

    // Функция удаления объявления
    window.deleteAnnouncement = async function(announcementId) {
        if (!confirm('Вы уверены, что хотите удалить это объявление?')) {
            return;
        }

        try {
            await AnnouncementsSystem.deleteAnnouncement(announcementId);
            NotificationSystem.success('Объявление успешно удалено');
            await renderAnnouncements();
        } catch (error) {
            console.error('Ошибка удаления объявления:', error);
            const errorMessage = error.response?.error || error.message || 'Не удалось удалить объявление';
            NotificationSystem.error(errorMessage);
        }
    };

    // Функция для отметки объявления как найденного/вернутого
    window.resolveAnnouncement = async function(announcementId, type) {
        const message = type === 'lost' 
            ? 'Отметить объявление как найденное? Объявление будет скрыто из списка.'
            : 'Отметить объявление как возвращенное? Объявление будет скрыто из списка.';
        
        if (!confirm(message)) {
            return;
        }

        try {
            await AnnouncementsSystem.resolveAnnouncement(announcementId, type);
            
            const successMessage = type === 'lost' 
                ? 'Объявление отмечено как найденное!'
                : 'Объявление отмечено как возвращенное! Спасибо за помощь!';
            
            NotificationSystem.success(successMessage);
            
            // Обновляем счетчик на странице
            if (type === 'found') {
                updateCounterDisplay();
            }
            
            // Перерисовываем объявления
            if (type === 'lost') {
                await renderLostAnnouncements();
            } else {
                await renderFoundAnnouncements();
            }
        } catch (error) {
            console.error('Ошибка отметки объявления:', error);
            const errorMessage = error.response?.error || error.message || 'Не удалось отметить объявление';
            NotificationSystem.error(errorMessage);
        }
    };

    // Функция открытия модального окна редактирования объявления
    function openEditAnnouncementModal(announcement, type) {
        const isLost = type === 'lost';
        const formId = isLost ? 'lostPetForm' : 'foundPetForm';
        const form = document.getElementById(formId);
        
        if (!form) {
            console.error('Форма не найдена:', formId);
            NotificationSystem.error('Форма не найдена');
            return;
        }
        

        // Заполняем форму данными объявления
        if (isLost && announcement.name) {
            document.getElementById('lostName').value = announcement.name;
        }
        if (announcement.type_animal) {
            const typeSelect = isLost ? document.getElementById('lostType') : document.getElementById('foundType');
            if (typeSelect) typeSelect.value = announcement.type_animal;
        }
        if (announcement.breed) {
            const breedInput = isLost ? document.getElementById('lostBreed') : document.getElementById('foundBreed');
            if (breedInput) breedInput.value = announcement.breed;
        }
        if (announcement.age) {
            const ageInput = isLost ? document.getElementById('lostAge') : document.getElementById('foundAge');
            if (ageInput) ageInput.value = announcement.age;
        }
        if (announcement.gender) {
            const genderSelect = isLost ? document.getElementById('lostGender') : document.getElementById('foundGender');
            if (genderSelect) genderSelect.value = announcement.gender;
        }
        if (announcement.color) {
            const colorInput = isLost ? document.getElementById('lostColor') : document.getElementById('foundColor');
            if (colorInput) colorInput.value = announcement.color;
        }
        if (announcement.description) {
            const descTextarea = isLost ? document.getElementById('lostDescription') : document.getElementById('foundDescription');
            if (descTextarea) descTextarea.value = announcement.description;
        }
        if (announcement.location) {
            const locationInput = isLost ? document.getElementById('lostLocation') : document.getElementById('foundLocation');
            if (locationInput) locationInput.value = announcement.location;
        }
        if (announcement.date) {
            const dateInput = isLost ? document.getElementById('lostDate') : document.getElementById('foundDate');
            if (dateInput) dateInput.value = announcement.date.split('T')[0];
        }
        if (announcement.contact) {
            const contactInput = isLost ? document.getElementById('lostContact') : document.getElementById('foundContact');
            if (contactInput) contactInput.value = announcement.contact;
        }

        // Обрабатываем фотографии
        let photos = [];
        if (announcement.photos) {
            if (Array.isArray(announcement.photos)) {
                photos = announcement.photos;
            } else if (typeof announcement.photos === 'string') {
                try {
                    photos = JSON.parse(announcement.photos);
                } catch (e) {
                    console.warn('Ошибка парсинга фотографий при редактировании:', e);
                    photos = [];
                }
            }
        }
        const photoPreview = isLost ? lostPhotoPreview : foundPhotoPreview;
        if (photoPreview) {
            if (photos.length > 0) {
                photoPreview.innerHTML = photos.map((photo, index) => `
                    <div class="photo-preview-item" data-photo-index="${index}">
                        <img src="${escapeHtml(photo)}" alt="Фото ${index + 1}">
                        <button type="button" class="remove-photo" onclick="removePhotoFromAnnouncement(${index}, '${isLost ? 'lost' : 'found'}')">×</button>
                    </div>
                `).join('');
            } else {
                photoPreview.innerHTML = '';
            }
        }

        // Сохраняем ID объявления и существующие фотографии для обновления
        form.dataset.editId = announcement.id;
        form.dataset.existingPhotos = JSON.stringify(photos);

        // Открываем форму
        const formSection = form.closest('.form-section');
        if (formSection) {
            formSection.classList.remove('collapsed');
        }

        // Прокручиваем к форме
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Функция удаления фотографии при редактировании объявления
    window.removePhotoFromAnnouncement = function(index, type) {
        const formId = type === 'lost' ? 'lostPetForm' : 'foundPetForm';
        const form = document.getElementById(formId);
        if (!form || !form.dataset.editId) return;

        const existingPhotos = JSON.parse(form.dataset.existingPhotos || '[]');
        existingPhotos.splice(index, 1);
        form.dataset.existingPhotos = JSON.stringify(existingPhotos);

        const photoPreview = type === 'lost' ? lostPhotoPreview : foundPhotoPreview;
        if (photoPreview) {
            const item = photoPreview.querySelector(`[data-photo-index="${index}"]`);
            if (item) item.remove();
        }
    };
});
