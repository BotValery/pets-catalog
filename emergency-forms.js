// Функция переключения состояния формы (глобальная для использования в HTML)
window.toggleForm = function(headerElement) {
    const formSection = headerElement.closest('.form-section');
    if (formSection) {
        formSection.classList.toggle('collapsed');
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
                
                // Устанавливаем картинку
                if (imageElement && imageContainer) {
                    if (hasImage) {
                        imageElement.src = image;
                        imageElement.alt = 'Изображение';
                        imageContainer.style.display = 'block';
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
                userId: currentUser.id
            };

            try {
                const editId = lostPetForm.dataset.editId;
                if (editId) {
                    // Редактирование
                    await AnnouncementsSystem.updateAnnouncement(editId, announcement);
                    delete lostPetForm.dataset.editId;
                    NotificationSystem.success('Объявление успешно обновлено!');
                } else {
                    // Создание
                    await AnnouncementsSystem.saveLostPet(announcement);
                    NotificationSystem.success('Объявление о пропаже размещено! Мы поможем найти вашего питомца.');
                }
                await renderAnnouncements();
                lostPetForm.reset();
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
                userId: currentUser.id
            };

            try {
                const editId = foundPetForm.dataset.editId;
                if (editId) {
                    // Редактирование
                    await AnnouncementsSystem.updateAnnouncement(editId, announcement);
                    delete foundPetForm.dataset.editId;
                    NotificationSystem.success('Объявление успешно обновлено!');
                } else {
                    // Создание
                    await AnnouncementsSystem.saveFoundPet(announcement);
                    
                    NotificationSystem.success('Спасибо за вашу помощь! Объявление о находке размещено.');
                }
                
                await renderAnnouncements();
                foundPetForm.reset();
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
                // Перерисовываем только потерянные
                await renderLostAnnouncements();
            } else {
                lostAnnouncements.style.display = 'none';
                lostAnnouncements.innerHTML = ''; // Очищаем неактивный контейнер
                foundAnnouncements.style.display = 'grid';
                // Перерисовываем только найденные
                await renderFoundAnnouncements();
            }
        });
    });

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
            
            if (lostPets.length === 0) {
                lostAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Пока нет объявлений о потерянных животных.</p>';
                return;
            }

            const currentUser = AuthSystem.getCurrentUser();
            
            const isOwner = (announcement) => {
                if (!currentUser) {
                    return false;
                }
                // Проверяем, что userId существует и совпадает
                return announcement.userId != null && announcement.userId === currentUser.id;
            };

            lostAnnouncements.innerHTML = lostPets.map(pet => {
                const ownerCheck = isOwner(pet);
                const petType = pet.type_animal || pet.petType;
                return `
                <div class="pet-card" style="cursor: default;">
                    <div class="pet-info">
                        <div class="pet-name" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                            <span>${pet.name}</span>
                            <span class="announcement-type type-lost" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Потерян</span>
                        </div>
                        <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                            <div class="pet-detail">
                                <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : '♀️'}</span>
                                <span>${getGenderText(pet.gender)}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">📅</span>
                                <span>${pet.age || 'Не указано'}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                <span>${getTypeText(petType)}</span>
                            </div>
                            ${pet.breed ? `
                            <div class="pet-detail">
                                <span class="pet-detail-icon">🏷️</span>
                                <span>${pet.breed}</span>
                            </div>
                            ` : ''}
                            <div class="pet-detail">
                                <span class="pet-detail-icon">🎨</span>
                                <span>${pet.color}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">📍</span>
                                <span>${pet.location}</span>
                            </div>
                        </div>
                        ${pet.description ? `
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                            <strong style="color: #333;">Описание:</strong> ${pet.description}
                        </div>
                        ` : ''}
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                            <strong style="color: #333;">Дата пропажи:</strong> ${formatDate(pet.date)}
                        </div>
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                            <strong style="color: #333;">Контакты:</strong> ${pet.contact}
                        </div>
                        ${isOwner(pet) ? `
                        <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                            <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${pet.id}, 'lost')" title="Отметить как найденное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                ✓ Найден
                            </button>
                            <div style="display: flex; gap: 0.3rem;">
                                <button class="btn-edit-pet" onclick="editAnnouncement(${pet.id}, 'lost')" title="Редактировать">✏️</button>
                                <button class="btn-delete-pet" onclick="deleteAnnouncement(${pet.id})" title="Удалить">🗑️</button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');
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
            const currentUser = AuthSystem.getCurrentUser();
            
            const isOwner = (announcement) => {
                if (!currentUser) {
                    return false;
                }
                // Проверяем, что userId существует и совпадает
                return announcement.userId != null && announcement.userId === currentUser.id;
            };
            
            if (foundPets.length === 0) {
                foundAnnouncements.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Пока нет объявлений о найденных животных.</p>';
                return;
            }

            foundAnnouncements.innerHTML = foundPets.map(pet => {
                const ownerCheck = isOwner(pet);
                const petType = pet.type_animal || pet.petType;
                return `
                <div class="pet-card" style="cursor: default;">
                    <div class="pet-info">
                        <div class="pet-name" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                            <span>Найдено животное</span>
                            <span class="announcement-type type-found" style="font-size: 0.75rem; padding: 0.2rem 0.6rem;">Найден</span>
                        </div>
                        <div class="pet-details-simple" style="align-items: flex-start; gap: 0.3rem; margin-bottom: 0.5rem;">
                            <div class="pet-detail">
                                <span class="pet-detail-icon">${pet.gender === 'male' ? '♂️' : pet.gender === 'female' ? '♀️' : '❓'}</span>
                                <span>${getGenderText(pet.gender)}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">📅</span>
                                <span>${pet.age || 'Неизвестно'}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">${petType === 'dog' ? '🐕' : '🐱'}</span>
                                <span>${getTypeText(petType)}</span>
                            </div>
                            ${pet.breed ? `
                            <div class="pet-detail">
                                <span class="pet-detail-icon">🏷️</span>
                                <span>${pet.breed}</span>
                            </div>
                            ` : ''}
                            <div class="pet-detail">
                                <span class="pet-detail-icon">🎨</span>
                                <span>${pet.color}</span>
                            </div>
                            <div class="pet-detail">
                                <span class="pet-detail-icon">📍</span>
                                <span>${pet.location}</span>
                            </div>
                        </div>
                        ${pet.description ? `
                        <div style="font-size: 0.8rem; color: #666; margin-bottom: 0.5rem; line-height: 1.4;">
                            <strong style="color: #333;">Описание:</strong> ${pet.description}
                        </div>
                        ` : ''}
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                            <strong style="color: #333;">Дата находки:</strong> ${formatDate(pet.date)}
                        </div>
                        <div style="font-size: 0.75rem; color: #666; margin-bottom: 0.3rem;">
                            <strong style="color: #333;">Контакты:</strong> ${pet.contact}
                        </div>
                        ${isOwner(pet) ? `
                        <div class="pet-card-actions" onclick="event.stopPropagation()" style="display: flex; gap: 0.5rem; align-items: center; justify-content: space-between; margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #f0f0f0;">
                            <button class="btn-resolve-announcement" onclick="resolveAnnouncement(${pet.id}, 'found')" title="Отметить как возвращенное" style="background: #4caf50; color: white; border: none; padding: 0.4rem 0.8rem; border-radius: 5px; cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; gap: 0.3rem;">
                                ✓ Вернул
                            </button>
                            <div style="display: flex; gap: 0.3rem;">
                                <button class="btn-edit-pet" onclick="editAnnouncement(${pet.id}, 'found')" title="Редактировать">✏️</button>
                                <button class="btn-delete-pet" onclick="deleteAnnouncement(${pet.id})" title="Удалить">🗑️</button>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
            }).join('');
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

        // Сохраняем ID объявления для обновления
        form.dataset.editId = announcement.id;

        // Открываем форму
        const formSection = form.closest('.form-section');
        if (formSection) {
            formSection.classList.remove('collapsed');
        }

        // Прокручиваем к форме
        form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
});
