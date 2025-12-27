// Скрипт для страницы детального просмотра животного
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем подключение к API
    try {
        await apiClient.request('/health');
    } catch (error) {
        console.error('API недоступен:', error);
    }
    
    const petDetailContainer = document.getElementById('petDetailContainer');
    
    // Получаем ID животного из URL
    const urlParams = new URLSearchParams(window.location.search);
    const petId = parseInt(urlParams.get('id'));
    
    if (!petId) {
        petDetailContainer.innerHTML = `
            <div class="error-message">
                <h3>Животное не найдено</h3>
                <p>Неверный идентификатор животного.</p>
                <a href="take-pet.html" class="btn-primary">Вернуться к каталогу</a>
            </div>
        `;
        return;
    }
    
    try {
        // Загружаем данные животного из базы данных
        const data = await apiClient.getPet(petId);
        const pet = data.pet;
        
        if (!pet) {
            petDetailContainer.innerHTML = `
                <div class="error-message">
                    <h3>Животное не найдено</h3>
                    <p>Животное с таким ID не существует или было удалено.</p>
                    <a href="take-pet.html" class="btn-primary">Вернуться к каталогу</a>
                </div>
            `;
            return;
        }
        
        // Проверяем, не пристроено ли животное
        if (pet.adopted) {
            petDetailContainer.innerHTML = `
                <div class="error-message">
                    <h3>Животное уже пристроено</h3>
                    <p>Это животное уже нашло новый дом.</p>
                    <a href="take-pet.html" class="btn-primary">Вернуться к каталогу</a>
                </div>
            `;
            return;
        }
        
        // Отображаем детальную информацию о животном
        renderPetDetail(pet);
        
    } catch (error) {
        console.error('Ошибка загрузки животного:', error);
        petDetailContainer.innerHTML = `
            <div class="error-message">
                <h3>Ошибка загрузки</h3>
                <p>Произошла ошибка при загрузке информации о животном.</p>
                <a href="take-pet.html" class="btn-primary">Вернуться к каталогу</a>
            </div>
        `;
    }
    
    // Функция отображения детальной информации о животном
    function renderPetDetail(pet) {
        // Используем годы и месяцы если они есть, иначе вычисляем из age
        const ageText = getAgeText(pet.age, pet.ageYears, pet.ageMonths);
        const typeText = getTypeText(pet.type);
        const genderText = getGenderText(pet.gender);
        const sizeText = getSizeText(pet.size);
        
        // Галерея фотографий
        let photosHtml = '';
        if (pet.photos && pet.photos.length > 0) {
            photosHtml = `
                <div class="pet-photos-gallery">
                    ${pet.photos.map((photo, index) => `
                        <div class="pet-photo-item ${index === 0 ? 'active' : ''}">
                            <img src="${photo}" alt="Фото ${pet.name} ${index + 1}">
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            photosHtml = `
                <div class="pet-photos-gallery">
                    <div class="pet-photo-item active">
                        <div class="pet-image-large">${pet.icon || (pet.type === 'dog' ? '🐕' : '🐱')}</div>
                    </div>
                </div>
            `;
        }
        
        petDetailContainer.innerHTML = `
            <div class="pet-detail-card">
                <div class="pet-detail-header">
                    <a href="take-pet.html" class="back-link">← Назад к каталогу</a>
                    <h2>${pet.name}</h2>
                </div>
                
                <div class="pet-detail-content">
                    <div class="pet-detail-photos">
                        ${photosHtml}
                    </div>
                    
                    <div class="pet-detail-info">
                        <div class="pet-detail-badges">
                            <span class="pet-badge badge-type-${pet.type}">${typeText}</span>
                        </div>
                        
                        <div class="pet-detail-section">
                            <h3>Основная информация</h3>
                            <div class="pet-info-grid">
                                <div class="pet-info-item">
                                    <span class="info-label">Тип:</span>
                                    <span class="info-value">${typeText}</span>
                                </div>
                                <div class="pet-info-item">
                                    <span class="info-label">Возраст:</span>
                                    <span class="info-value">${ageText}</span>
                                </div>
                                <div class="pet-info-item">
                                    <span class="info-label">Пол:</span>
                                    <span class="info-value">${genderText}</span>
                                </div>
                                <div class="pet-info-item">
                                    <span class="info-label">Размер:</span>
                                    <span class="info-value">${sizeText}</span>
                                </div>
                                ${pet.breed ? `
                                <div class="pet-info-item">
                                    <span class="info-label">Порода:</span>
                                    <span class="info-value">${pet.breed}</span>
                                </div>
                                ` : ''}
                                ${pet.color ? `
                                <div class="pet-info-item">
                                    <span class="info-label">Окрас:</span>
                                    <span class="info-value">${pet.color}</span>
                                </div>
                                ` : ''}
                            </div>
                        </div>
                        
                        ${pet.character ? `
                        <div class="pet-detail-section">
                            <h3>Характер</h3>
                            <p class="pet-character-text">${pet.character}</p>
                        </div>
                        ` : ''}
                        
                        ${pet.description ? `
                        <div class="pet-detail-section">
                            <h3>Описание</h3>
                            <p class="pet-description-text">${pet.description}</p>
                        </div>
                        ` : ''}
                        
                        <div class="pet-detail-actions">
                            <button onclick="applyForPet(${pet.id})" class="btn-apply" id="applyBtn">
                                Хочу взять!
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Функция получения текста возрастной категории
    function getAgeCategoryText(category) {
        const categories = {
            young: 'Молодой',
            adult: 'Взрослый',
            senior: 'Пожилой'
        };
        return categories[category] || category;
    }
    
    // Вспомогательные функции для форматирования текста
    // Используем глобальные функции getAgeText, getTypeText, getGenderText из pets-data.js
    
    function getSizeText(size) {
        const sizes = {
            small: 'Маленький',
            medium: 'Средний',
            large: 'Большой'
        };
        return sizes[size] || size;
    }
    
    // Функция для запроса телефона через модальное окно
    function promptForPhone() {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'confirm-modal-overlay';
            modal.style.zIndex = '10000';
            modal.innerHTML = `
                <div class="confirm-modal" style="max-width: 400px;">
                    <div class="confirm-modal-header">
                        <h3>Введите номер телефона</h3>
                    </div>
                    <div class="confirm-modal-body">
                        <p style="margin-bottom: 1rem;">Для подачи заявки необходимо указать номер телефона</p>
                        <input type="tel" id="phoneInput" class="form-control" placeholder="+7 (___) ___-__-__" style="width: 100%; padding: 0.75rem; font-size: 1rem; border: 1px solid #ddd; border-radius: 4px;">
                    </div>
                    <div class="confirm-modal-actions">
                        <button class="btn-secondary prompt-cancel">Отмена</button>
                        <button class="btn-primary prompt-ok">Подтвердить</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const phoneInput = modal.querySelector('#phoneInput');
            const okBtn = modal.querySelector('.prompt-ok');
            const cancelBtn = modal.querySelector('.prompt-cancel');
            
            // Применяем маску к полю ввода
            if (typeof PhoneMask !== 'undefined') {
                PhoneMask.apply(phoneInput);
            }
            
            // Фокус на поле ввода
            setTimeout(() => phoneInput.focus(), 100);
            
            // Обработка Enter
            phoneInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    okBtn.click();
                }
            });
            
            okBtn.addEventListener('click', () => {
                const phone = phoneInput.value.trim();
                if (phone) {
                    // Проверяем валидность телефона, если доступна функция
                    if (typeof PhoneMask !== 'undefined' && PhoneMask.isValid) {
                        if (!PhoneMask.isValid(phone)) {
                            NotificationSystem.warning('Введите корректный номер телефона');
                            return;
                        }
                    }
                    modal.remove();
                    resolve(phone);
                } else {
                    NotificationSystem.warning('Пожалуйста, введите номер телефона');
                }
            });
            
            cancelBtn.addEventListener('click', () => {
                modal.remove();
                resolve('');
            });
            
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve('');
                }
            });
        });
    }
    
    // Функция "усыновления" животного (создание заявки)
    window.applyForPet = async function(petId) {
        const currentUser = AuthSystem.getCurrentUser();
        
        if (!currentUser) {
            NotificationSystem.warning('Пожалуйста, войдите в систему, чтобы записаться на осмотр');
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 1500);
            return;
        }
        
        if (currentUser.type !== 'user') {
            NotificationSystem.error('Только обычные пользователи могут записываться на осмотр');
            return;
        }
        
        try {
            // Загружаем данные животного, чтобы получить shelterId
            const data = await apiClient.getPet(petId);
        const pet = data.pet;
            
            if (!pet) {
                NotificationSystem.error('Животное не найдено');
                return;
            }
            
            if (pet.adopted) {
                NotificationSystem.warning('Это животное уже пристроено');
                return;
            }
            
            if (!pet.shelterId) {
                NotificationSystem.error('Не указана передержка для этого животного');
                return;
            }
            
            // Проверяем наличие телефона
            let userPhone = currentUser.phone;
            
            if (!userPhone || userPhone.trim() === '') {
                // Запрашиваем телефон через модальное окно
                userPhone = await promptForPhone();
                if (!userPhone || userPhone.trim() === '') {
                    NotificationSystem.warning('Телефон обязателен для подачи заявки');
                    return;
                }
            }
            
            // Создаем заявку с указанием конкретной передержки
            const result = await ApplicationsSystem.createApplication(
                petId,
                pet.shelterId, // Используем shelterId из данных животного
                currentUser.name,
                userPhone,
                currentUser.telegram ? '@' + currentUser.telegram : null
            );
            
            if (result.success) {
                NotificationSystem.success('Заявка успешно подана! Передержка свяжется с вами в ближайшее время.');
                
                // Блокируем кнопку после успешной подачи заявки
                const applyBtn = document.getElementById('applyBtn');
                if (applyBtn) {
                    applyBtn.disabled = true;
                    applyBtn.textContent = 'Заявка подана';
                    applyBtn.style.background = '#48bb78';
                }
            } else {
                NotificationSystem.warning(result.message);
            }
        } catch (error) {
            console.error('Ошибка при создании заявки:', error);
            NotificationSystem.error('Произошла ошибка. Попробуйте еще раз.');
        }
    };
});

