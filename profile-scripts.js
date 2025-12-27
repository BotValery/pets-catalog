// Скрипты для страницы профиля
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем доступность сервера
    try {
        await apiClient.request('/health');
    } catch (error) {
        NotificationSystem.warning('Сервер недоступен. Убедитесь, что сервер запущен на http://localhost:3000');
    }
    
    // Получаем элементы
    const notAuthorized = document.getElementById('notAuthorized');
    const userProfile = document.getElementById('userProfile');
    const shelterProfile = document.getElementById('shelterProfile');
    const userProfileForm = document.getElementById('userProfileForm');
    const shelterProfileForm = document.getElementById('shelterProfileForm');
    const userLogoutBtn = document.getElementById('userLogoutBtn');
    const shelterLogoutBtn = document.getElementById('shelterLogoutBtn');
    const userDeleteBtn = document.getElementById('userDeleteBtn');
    const shelterDeleteBtn = document.getElementById('shelterDeleteBtn');

    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    
    if (!currentUser) {
        // Показываем сообщение для неавторизованных
        notAuthorized.style.display = 'block';
        userProfile.style.display = 'none';
        shelterProfile.style.display = 'none';
        return;
    }

    // Загружаем данные профиля
    await loadProfile(currentUser);
    
    // Применяем маску к полям телефона после загрузки данных
    const userPhoneInput = document.getElementById('userPhone');
    const shelterPhoneInput = document.getElementById('shelterPhone');
    if (userPhoneInput && typeof PhoneMask !== 'undefined') {
        PhoneMask.apply(userPhoneInput);
    }
    if (shelterPhoneInput && typeof PhoneMask !== 'undefined') {
        PhoneMask.apply(shelterPhoneInput);
    }

    // Обработчик формы профиля пользователя
    if (userProfileForm) {
        userProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveUserProfile();
        });
    }

    // Обработчик формы профиля передержки
    if (shelterProfileForm) {
        shelterProfileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await saveShelterProfile();
        });
    }

    // Обработчики выхода
    if (userLogoutBtn) {
        userLogoutBtn.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите выйти?')) {
                AuthSystem.logout();
                window.location.href = 'auth.html';
            }
        });
    }

    if (shelterLogoutBtn) {
        shelterLogoutBtn.addEventListener('click', function() {
            if (confirm('Вы уверены, что хотите выйти?')) {
                AuthSystem.logout();
                window.location.href = 'auth.html';
            }
        });
    }

    // Обработчики удаления профиля
    if (userDeleteBtn) {
        userDeleteBtn.addEventListener('click', async function() {
            await deleteUserProfile();
        });
    }

    if (shelterDeleteBtn) {
        shelterDeleteBtn.addEventListener('click', async function() {
            await deleteShelterProfile();
        });
    }

    // Функция загрузки профиля
    async function loadProfile(user) {
        try {
            if (user.type === 'user') {
                // Загружаем данные пользователя через API
                try {
                    const data = await apiClient.getUser(user.id);
                    const userData = data.user;
                    if (userData) {
                        document.getElementById('userName').value = userData.name || '';
                        document.getElementById('userTelegram').value = userData.telegram ? '@' + userData.telegram : '';
                        // Форматируем телефон, если он есть
                        if (userData.phone) {
                            // Если телефон уже в формате +7 (...), оставляем как есть
                            // Иначе форматируем
                            let phoneValue = userData.phone;
                            if (typeof PhoneMask !== 'undefined') {
                                const cleanPhone = PhoneMask.getCleanPhone(userData.phone);
                                if (cleanPhone && cleanPhone.length === 11) {
                                    phoneValue = `+${cleanPhone[0]} (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7, 9)}-${cleanPhone.substring(9, 11)}`;
                                }
                            }
                            document.getElementById('userPhone').value = phoneValue;
                        }
                    }
                } catch (error) {
                    console.error('Ошибка загрузки данных пользователя:', error);
                    // Используем данные из localStorage как fallback
                    document.getElementById('userName').value = user.name || '';
                    document.getElementById('userTelegram').value = user.telegram ? '@' + user.telegram : '';
                    document.getElementById('userPhone').value = user.phone || '';
                }
                userProfile.style.display = 'block';
                shelterProfile.style.display = 'none';
                notAuthorized.style.display = 'none';
            } else if (user.type === 'shelter') {
                // Загружаем данные передержки через API
                try {
                    const data = await apiClient.getShelter(user.id);
                    const shelterData = data.shelter;
                    if (shelterData) {
                        document.getElementById('shelterName').value = shelterData.shelterName || '';
                        document.getElementById('shelterEmail').value = shelterData.email || '';
                        document.getElementById('shelterAddress').value = shelterData.address || '';
                        // Форматируем телефон, если он есть
                        if (shelterData.phone) {
                            // Если телефон уже в формате +7 (...), оставляем как есть
                            // Иначе форматируем
                            let phoneValue = shelterData.phone;
                            if (typeof PhoneMask !== 'undefined') {
                                const cleanPhone = PhoneMask.getCleanPhone(shelterData.phone);
                                if (cleanPhone && cleanPhone.length === 11) {
                                    phoneValue = `+${cleanPhone[0]} (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7, 9)}-${cleanPhone.substring(9, 11)}`;
                                }
                            }
                            document.getElementById('shelterPhone').value = phoneValue;
                        }
                        document.getElementById('shelterCapacity').value = shelterData.capacity || '';
                        document.getElementById('shelterContactPerson').value = shelterData.authorizedPerson || shelterData.contactPerson || '';
                        document.getElementById('shelterDescription').value = shelterData.description || '';
                    }
                } catch (error) {
                    console.error('Ошибка загрузки данных передержки:', error);
                    // Используем данные из localStorage как fallback
                    document.getElementById('shelterName').value = user.shelterName || '';
                    document.getElementById('shelterEmail').value = user.email || '';
                    document.getElementById('shelterAddress').value = user.address || '';
                    document.getElementById('shelterPhone').value = user.phone || '';
                    document.getElementById('shelterContactPerson').value = user.authorizedPerson || '';
                }
                shelterProfile.style.display = 'block';
                userProfile.style.display = 'none';
                notAuthorized.style.display = 'none';
            }
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            NotificationSystem.error('Произошла ошибка при загрузке профиля');
        }
    }

    // Функция сохранения профиля пользователя
    async function saveUserProfile() {
        const currentUser = AuthSystem.getCurrentUser();
        if (!currentUser || currentUser.type !== 'user') {
            NotificationSystem.error('Ошибка авторизации');
            return;
        }

        const formData = new FormData(userProfileForm);
        const password = formData.get('password');
        const passwordConfirm = formData.get('passwordConfirm');

        // Проверка пароля, если он указан
        if (password) {
            if (password.length < 6) {
                NotificationSystem.warning('Пароль должен содержать минимум 6 символов');
                return;
            }
            if (password !== passwordConfirm) {
                NotificationSystem.warning('Пароли не совпадают');
                return;
            }
        }

        try {
            // Получаем чистый номер телефона из маски
            const phone = formData.get('phone');
            const cleanPhone = phone ? PhoneMask.getCleanPhone(phone) : null;
            
            // Получаем telegram и нормализуем (убираем @ если есть)
            const telegram = formData.get('telegram');
            const normalizedTelegram = telegram ? telegram.replace(/^@/, '').trim() : null;
            
            // Подготавливаем данные для обновления
            const userData = {
                name: formData.get('name'),
                telegram: normalizedTelegram,
                phone: cleanPhone || phone
            };
            
            // Пароль обновляется отдельно (если нужно добавить endpoint для смены пароля)
            // Пока не отправляем пароль, так как нет отдельного endpoint для смены пароля
            if (password) {
                // TODO: Добавить endpoint для смены пароля
            }

            // Обновляем профиль через API
            try {
                const result = await apiClient.updateUser(currentUser.id, userData);
                
                // Обновляем данные в localStorage
                const updatedUser = { 
                    ...currentUser, 
                    name: userData.name,
                    telegram: normalizedTelegram,
                    phone: phone // Сохраняем отформатированный номер для отображения
                };
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));

                NotificationSystem.success('Профиль успешно обновлен!');
                
                // Перезагружаем страницу для обновления данных
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Ошибка обновления профиля:', error);
                const errorMessage = error.message || 'Ошибка обновления профиля';
                NotificationSystem.error(errorMessage);
            }
        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            NotificationSystem.error('Произошла ошибка при сохранении профиля');
        }
    }

    // Функция сохранения профиля передержки
    async function saveShelterProfile() {
        const currentUser = AuthSystem.getCurrentUser();
        if (!currentUser || currentUser.type !== 'shelter') {
            NotificationSystem.error('Ошибка авторизации');
            return;
        }

        const formData = new FormData(shelterProfileForm);
        const password = formData.get('password');
        const passwordConfirm = formData.get('passwordConfirm');

        // Проверка пароля, если он указан
        if (password) {
            if (password.length < 6) {
                NotificationSystem.warning('Пароль должен содержать минимум 6 символов');
                return;
            }
            if (password !== passwordConfirm) {
                NotificationSystem.warning('Пароли не совпадают');
                return;
            }
        }

        try {
            // Получаем чистый номер телефона из маски
            const phone = formData.get('phone');
            const cleanPhone = phone ? PhoneMask.getCleanPhone(phone) : null;
            
            // Подготавливаем данные для обновления
            const shelterData = {
                shelterName: formData.get('shelterName'),
                address: formData.get('address'),
                phone: cleanPhone || phone,
                authorizedPerson: formData.get('contactPerson'),
                viber: formData.get('viber') || null,
                telegram: formData.get('telegram') || null,
                website: formData.get('website') || null
            };
            
            // Пароль обновляется отдельно (если нужно добавить endpoint для смены пароля)
            if (password) {
                // TODO: Добавить endpoint для смены пароля
            }

            // Обновляем профиль через API
            try {
                const result = await apiClient.updateShelter(currentUser.id, shelterData);
                
                // Обновляем данные в localStorage
                const updatedShelter = { 
                    ...currentUser, 
                    shelterName: shelterData.shelterName,
                    address: shelterData.address,
                    phone: phone, // Сохраняем отформатированный номер для отображения
                    authorizedPerson: shelterData.authorizedPerson
                };
                localStorage.setItem('currentUser', JSON.stringify(updatedShelter));

                NotificationSystem.success('Профиль успешно обновлен!');
                
                // Перезагружаем страницу для обновления данных
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } catch (error) {
                console.error('Ошибка обновления профиля:', error);
                const errorMessage = error.message || 'Ошибка обновления профиля';
                NotificationSystem.error(errorMessage);
            }
        } catch (error) {
            console.error('Ошибка сохранения профиля:', error);
            NotificationSystem.error('Произошла ошибка при сохранении профиля');
        }
    }

    // Функция удаления профиля пользователя
    async function deleteUserProfile() {
        const currentUser = AuthSystem.getCurrentUser();
        if (!currentUser || currentUser.type !== 'user') {
            NotificationSystem.error('Ошибка авторизации');
            return;
        }

        const confirmMessage = 'Вы уверены, что хотите удалить свой профиль?\n\n' +
            'Это действие нельзя отменить. Все ваши объявления будут удалены.';
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // Дополнительное подтверждение
        const doubleConfirm = confirm('Это действие окончательное. Вы действительно хотите удалить профиль?');
        if (!doubleConfirm) {
            return;
        }

        try {
            await apiClient.deleteUser(currentUser.id);
            
            NotificationSystem.success('Профиль успешно удален');
            
            // Выходим из системы
            AuthSystem.logout();
            
            // Перенаправляем на главную страницу
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            console.error('Ошибка удаления профиля:', error);
            const errorMessage = error.message || 'Ошибка удаления профиля';
            NotificationSystem.error(errorMessage);
        }
    }

    // Функция удаления профиля передержки
    async function deleteShelterProfile() {
        const currentUser = AuthSystem.getCurrentUser();
        if (!currentUser || currentUser.type !== 'shelter') {
            NotificationSystem.error('Ошибка авторизации');
            return;
        }

        const confirmMessage = 'Вы уверены, что хотите удалить профиль передержки?\n\n' +
            'Это действие нельзя отменить. Все ваши объявления и питомцы будут удалены.';
        
        if (!confirm(confirmMessage)) {
            return;
        }

        // Дополнительное подтверждение
        const doubleConfirm = confirm('Это действие окончательное. Вы действительно хотите удалить профиль передержки?');
        if (!doubleConfirm) {
            return;
        }

        try {
            await apiClient.deleteShelter(currentUser.id);
            
            NotificationSystem.success('Профиль передержки успешно удален');
            
            // Выходим из системы
            AuthSystem.logout();
            
            // Перенаправляем на главную страницу
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } catch (error) {
            console.error('Ошибка удаления профиля передержки:', error);
            const errorMessage = error.message || 'Ошибка удаления профиля передержки';
            NotificationSystem.error(errorMessage);
        }
    }
});

