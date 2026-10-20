// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Проверяем доступность сервера
    try {
        await apiClient.request('/health');
    } catch (error) {
        // Показываем предупреждение, но не блокируем страницу
        NotificationSystem.warning('Сервер недоступен. Регистрация может не работать.');
    }
    
    // Получаем элементы
    const authTabs = document.querySelectorAll('.auth-tab-btn');
    const loginFormSection = document.getElementById('loginForm');
    const registerFormSection = document.getElementById('registerForm');
    const loginFormElement = document.getElementById('loginFormElement');
    const registerUserForm = document.getElementById('registerUserForm');
    const registerShelterForm = document.getElementById('registerShelterForm');
    const userTypeRadios = document.querySelectorAll('input[name="userType"]');
    const userInfo = document.getElementById('userInfo');
    const userInfoContent = document.getElementById('userInfoContent');
    const logoutBtn = document.getElementById('logoutBtn');

    // Проверяем, авторизован ли пользователь
    checkAuth();

    // Обработчики вкладок
    authTabs.forEach(btn => {
        btn.addEventListener('click', function() {
            const tab = this.dataset.tab;
            
            // Убираем активный класс у всех кнопок
            authTabs.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Переключаем формы
            if (tab === 'login') {
                loginFormSection.classList.add('active');
                registerFormSection.classList.remove('active');
            } else if (tab === 'register') {
                loginFormSection.classList.remove('active');
                registerFormSection.classList.add('active');
            }
        });
    });

    // Переключение типа пользователя при регистрации
    userTypeRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'user') {
                registerUserForm.style.display = 'block';
                registerShelterForm.style.display = 'none';
            } else {
                registerUserForm.style.display = 'none';
                registerShelterForm.style.display = 'block';
            }
        });
    });

    // Инициализация масок для полей телефона
    const loginIdentifier = document.getElementById('loginIdentifier');
    PhoneMask.apply(document.getElementById('regUserPhone'));
    PhoneMask.apply(document.getElementById('regShelterPhone'));
    
    // Автоматическое определение типа ввода для поля входа (телефон по умолчанию, но можно email)
    if (loginIdentifier) {
        let isEmailMode = false;
        let maskHandlers = [];
        
        // Функция для удаления обработчиков маски
        function removeMaskHandlers() {
            maskHandlers.forEach(handler => {
                loginIdentifier.removeEventListener('input', handler.input);
                loginIdentifier.removeEventListener('keydown', handler.keydown);
                loginIdentifier.removeEventListener('paste', handler.paste);
            });
            maskHandlers = [];
            loginIdentifier.dataset.phoneMaskApplied = 'false';
        }
        
        // Функция для применения маски телефона
        function applyPhoneMask() {
            if (isEmailMode || loginIdentifier.dataset.phoneMaskApplied === 'true') {
                return;
            }
            
            try {
                // Сохраняем обработчики для последующего удаления
                const inputHandler = function(e) {
                    const input = e.target;
                    const cursorPosition = input.selectionStart;
                    const oldValue = input.value;
                    
                    // Если содержит @, переключаемся на email режим
                    if (oldValue.includes('@')) {
                        removeMaskHandlers();
                        isEmailMode = true;
                        loginIdentifier.type = 'email';
                        return;
                    }
                    
                    // Получаем только цифры
                    let value = oldValue.replace(/\D/g, '');
                    
                    // Если начинается не с 7 или 8, добавляем 7
                    if (value.length > 0 && value[0] !== '7' && value[0] !== '8') {
                        value = '7' + value;
                    }
                    
                    // Если начинается с 8, заменяем на 7
                    if (value.length > 0 && value[0] === '8') {
                        value = '7' + value.substring(1);
                    }
                    
                    // Ограничиваем длину (11 цифр: 7 + 10 цифр)
                    if (value.length > 11) {
                        value = value.substring(0, 11);
                    }
                    
                    // Подсчитываем, сколько цифр было до курсора в старом значении
                    let digitsBeforeCursor = 0;
                    for (let i = 0; i < cursorPosition && i < oldValue.length; i++) {
                        if (/\d/.test(oldValue[i])) {
                            digitsBeforeCursor++;
                        }
                    }
                    
                    // Форматируем номер
                    let formatted = '';
                    if (value.length > 0) {
                        formatted = '+7';
                        if (value.length > 1) {
                            formatted += ' (' + value.substring(1, 4);
                            if (value.length > 4) {
                                formatted += ') ' + value.substring(4, 7);
                                if (value.length > 7) {
                                    formatted += '-' + value.substring(7, 9);
                                    if (value.length > 9) {
                                        formatted += '-' + value.substring(9, 11);
                                    }
                                }
                            } else {
                                formatted += ')';
                            }
                        }
                    }
                    
                    // Устанавливаем отформатированное значение
                    input.value = formatted;
                    
                    // Вычисляем новую позицию курсора
                    let newCursorPosition = 0;
                    let digitCount = 0;
                    
                    for (let i = 0; i < formatted.length; i++) {
                        if (/\d/.test(formatted[i])) {
                            digitCount++;
                            if (digitCount === digitsBeforeCursor) {
                                newCursorPosition = i + 1;
                                break;
                            }
                        }
                    }
                    
                    if (newCursorPosition === 0) {
                        newCursorPosition = formatted.length;
                    }
                    
                    setTimeout(() => {
                        input.setSelectionRange(newCursorPosition, newCursorPosition);
                    }, 0);
                };
                
                const keydownHandler = function(e) {
                    if (e.key === 'Backspace') {
                        const input = e.target;
                        const cursorPosition = input.selectionStart;
                        const value = input.value;
                        
                        if (cursorPosition > 0) {
                            const charBefore = value[cursorPosition - 1];
                            if ([' ', '(', ')', '-'].includes(charBefore)) {
                                e.preventDefault();
                                let newPosition = cursorPosition - 1;
                                while (newPosition > 0 && [' ', '(', ')', '-'].includes(value[newPosition - 1])) {
                                    newPosition--;
                                }
                                input.setSelectionRange(newPosition, newPosition);
                            }
                        }
                    } else if (e.key === 'Delete') {
                        const input = e.target;
                        const cursorPosition = input.selectionStart;
                        const value = input.value;
                        
                        if (cursorPosition < value.length) {
                            const charAt = value[cursorPosition];
                            if ([' ', '(', ')', '-'].includes(charAt)) {
                                e.preventDefault();
                                let nextDigitPos = cursorPosition + 1;
                                while (nextDigitPos < value.length && [' ', '(', ')', '-'].includes(value[nextDigitPos])) {
                                    nextDigitPos++;
                                }
                                if (nextDigitPos < value.length && /\d/.test(value[nextDigitPos])) {
                                    const before = value.substring(0, nextDigitPos);
                                    const after = value.substring(nextDigitPos + 1);
                                    input.value = before + after;
                                    
                                    setTimeout(() => {
                                        input.setSelectionRange(cursorPosition, cursorPosition);
                                        input.dispatchEvent(new Event('input'));
                                    }, 0);
                                }
                            }
                        }
                    }
                };
                
                const pasteHandler = function(e) {
                    e.preventDefault();
                    const input = e.target;
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    
                    // Если вставленный текст содержит @, переключаемся на email
                    if (pastedText.includes('@')) {
                        removeMaskHandlers();
                        isEmailMode = true;
                        loginIdentifier.type = 'email';
                        input.value = pastedText;
                        return;
                    }
                    
                    const digits = pastedText.replace(/\D/g, '');
                    
                    if (digits.length > 0) {
                        let value = digits;
                        if (value[0] === '8') {
                            value = '7' + value.substring(1);
                        } else if (value[0] !== '7') {
                            value = '7' + value;
                        }
                        
                        if (value.length > 11) {
                            value = value.substring(0, 11);
                        }
                        
                        let formatted = '+7';
                        if (value.length > 1) {
                            formatted += ' (' + value.substring(1, 4);
                            if (value.length > 4) {
                                formatted += ') ' + value.substring(4, 7);
                                if (value.length > 7) {
                                    formatted += '-' + value.substring(7, 9);
                                    if (value.length > 9) {
                                        formatted += '-' + value.substring(9, 11);
                                    }
                                }
                            } else {
                                formatted += ')';
                            }
                        }
                        
                        input.value = formatted;
                        setTimeout(() => {
                            input.setSelectionRange(formatted.length, formatted.length);
                        }, 0);
                    }
                };
                
                loginIdentifier.addEventListener('input', inputHandler);
                loginIdentifier.addEventListener('keydown', keydownHandler);
                loginIdentifier.addEventListener('paste', pasteHandler);
                
                maskHandlers = [
                    { input: inputHandler, keydown: keydownHandler, paste: pasteHandler }
                ];
                
                loginIdentifier.dataset.phoneMaskApplied = 'true';
                loginIdentifier.type = 'tel';
            } catch (e) {
            }
        }
        
        // Обработчик ввода для определения типа
        loginIdentifier.addEventListener('input', function() {
            const value = this.value.trim();
            
            // Если содержит @ или начинается с буквы, это email
            if (value.includes('@') || /^[a-zA-Z]/.test(value)) {
                if (!isEmailMode) {
                    removeMaskHandlers();
                    isEmailMode = true;
                    this.type = 'email';
                }
            } else if ((value.startsWith('+') || /^\d/.test(value)) && !isEmailMode) {
                // Если начинается с + или цифры и не в режиме email, применяем маску
                if (this.dataset.phoneMaskApplied !== 'true') {
                    applyPhoneMask();
                }
            }
        });
        
        // При фокусе определяем тип
        loginIdentifier.addEventListener('focus', function() {
            const value = this.value.trim();
            if (!value) {
                // Если поле пустое, готовимся к вводу телефона
                isEmailMode = false;
                this.type = 'tel';
            } else if (value.includes('@') || /^[a-zA-Z]/.test(value)) {
                // Если уже есть @ или начинается с буквы, это email
                isEmailMode = true;
                this.type = 'email';
                removeMaskHandlers();
            } else {
                // Иначе это телефон
                isEmailMode = false;
                this.type = 'tel';
                if (this.dataset.phoneMaskApplied !== 'true') {
                    applyPhoneMask();
                }
            }
        });
    }

    // Обработчик входа
    loginFormElement.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const identifier = document.getElementById('loginIdentifier').value.trim();
        const password = document.getElementById('loginPassword').value;
        
        // Проверяем, что поле заполнено
        if (!identifier) {
            NotificationSystem.warning('Введите телефон');
            return;
        }
        
        // Определяем тип идентификатора
        const isEmail = identifier.includes('@');
        let normalizedIdentifier = identifier;
        
        // Валидация и нормализация
        if (isEmail) {
            // Простая проверка email (для админа)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(identifier)) {
                NotificationSystem.warning('Введите корректный email');
                return;
            }
        } else {
            // По умолчанию проверяем как телефон
            if (!PhoneMask.isValid(identifier)) {
                NotificationSystem.warning('Введите корректный номер телефона');
                return;
            }
            // Нормализуем телефон: получаем чистый номер и добавляем +
            const cleanPhone = PhoneMask.getCleanPhone(identifier);
            normalizedIdentifier = '+' + cleanPhone;
        }
        
        try {
            const result = await AuthSystem.login(normalizedIdentifier, password);
            
            if (result.success) {
                loginFormElement.reset();
                // Сбрасываем флаг маски
                if (loginIdentifier) {
                    loginIdentifier.dataset.phoneMaskApplied = 'false';
                    loginIdentifier.type = 'text';
                }
                // Перенаправляем на главную страницу
                window.location.href = 'index.html';
            } else {
                NotificationSystem.error(result.message);
            }
        } catch (error) {
            console.error('Ошибка входа:', error);
            NotificationSystem.error('Произошла ошибка при входе. Попробуйте еще раз.');
        }
    });

    // Обработчик регистрации обычного пользователя
    registerUserForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(registerUserForm);
        const password = formData.get('password');
        const passwordConfirm = formData.get('passwordConfirm');
        
        if (password !== passwordConfirm) {
            NotificationSystem.warning('Пароли не совпадают');
            return;
        }
        
        if (password.length < 6) {
            NotificationSystem.warning('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        try {
            // Объединяем имя и фамилию
            const name = formData.get('name');
            const surname = formData.get('surname');
            const fullName = surname ? `${name} ${surname}`.trim() : name;
            
            if (!fullName || fullName.trim() === '') {
                NotificationSystem.warning('Имя обязательно');
                return;
            }
            
            const user = {
                name: fullName,
                phone: formData.get('phone'),
                telegram: formData.get('telegram'),
                password: password,
                agreementAccepted: formData.get('agreement') === 'on'
            };
            
            // Проверяем соглашение
            if (!user.agreementAccepted) {
                NotificationSystem.warning('Необходимо принять соглашение на пользование сайтом');
                return;
            }
            
            // Проверяем валидность телефона
            if (!user.phone || !PhoneMask.isValid(user.phone)) {
                NotificationSystem.warning('Введите корректный номер телефона');
                return;
            }
            
            // Проверяем наличие telegram
            if (!user.telegram || user.telegram.trim() === '') {
                NotificationSystem.warning('Введите Telegram');
                return;
            }
            
            // Нормализуем telegram (убираем @ если есть)
            user.telegram = user.telegram.replace(/^@/, '').trim();
            
            // Пытаемся зарегистрировать пользователя
            // Проверка существующего email будет выполнена на сервере
            await AuthSystem.saveUser(user);
            NotificationSystem.success('Регистрация успешна! Теперь вы можете войти в систему.');
            registerUserForm.reset();
            
            // Переключаемся на вкладку входа
            authTabs[0].click();
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            // Показываем конкретное сообщение об ошибке
            const errorMessage = error.message || 'Произошла ошибка при регистрации. Попробуйте еще раз.';
            NotificationSystem.error(errorMessage);
        }
    });

    // Обработчик регистрации передержки
    registerShelterForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const formData = new FormData(registerShelterForm);
        const password = formData.get('password');
        const passwordConfirm = formData.get('passwordConfirm');
        
        if (password !== passwordConfirm) {
            NotificationSystem.warning('Пароли не совпадают');
            return;
        }
        
        if (password.length < 6) {
            NotificationSystem.warning('Пароль должен содержать минимум 6 символов');
            return;
        }
        
        try {
            const shelter = {
                shelterName: formData.get('name'),
                authorizedPerson: formData.get('authorizedPerson'),
                address: formData.get('address'),
                phone: formData.get('phone'),
                viber: formData.get('viber') || '',
                telegram: formData.get('telegram') || '',
                website: formData.get('website') || '',
                email: formData.get('email'),
                password: password,
                agreementAccepted: formData.get('agreement') === 'on'
            };
            
            // Проверяем соглашение
            if (!shelter.agreementAccepted) {
                NotificationSystem.warning('Необходимо принять соглашение на пользование сайтом');
                return;
            }
            
            // Проверяем валидность телефона
            if (shelter.phone && !PhoneMask.isValid(shelter.phone)) {
                NotificationSystem.warning('Введите корректный номер телефона');
                return;
            }
            
            // Проверяем email, если он указан
            if (shelter.email && shelter.email.trim() !== '') {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(shelter.email)) {
                    NotificationSystem.warning('Введите корректный email');
                    return;
                }
            } else {
                // Если email не указан, убираем его из данных
                shelter.email = null;
            }
            
            // Пытаемся зарегистрировать передержку
            // Проверка существующего email будет выполнена на сервере
            await AuthSystem.saveShelter(shelter);
            NotificationSystem.success('Передержка успешно зарегистрирована! Теперь вы можете войти в систему.');
            registerShelterForm.reset();
            
            // Переключаемся на вкладку входа
            authTabs[0].click();
        } catch (error) {
            console.error('Ошибка регистрации:', error);
            // Показываем конкретное сообщение об ошибке
            const errorMessage = error.message || 'Произошла ошибка при регистрации. Попробуйте еще раз.';
            NotificationSystem.error(errorMessage);
        }
    });

    // Обработчик выхода
    logoutBtn.addEventListener('click', function() {
        NotificationSystem.confirm(
            'Вы уверены, что хотите выйти?',
            () => {
                AuthSystem.logout();
                checkAuth();
                NotificationSystem.info('Вы вышли из системы');
                // Обновляем навигацию
                updateNavigation();
            }
        );
    });

    // Функция обновления навигации
    function updateNavigation() {
        // Используем глобальную функцию, если она доступна
        if (typeof window.updateNavigation === 'function') {
            window.updateNavigation();
        } else {
            // Fallback для случаев, когда navigation.js еще не загружен
        const currentUser = AuthSystem.getCurrentUser();
        const navLinks = document.querySelectorAll('nav .nav-link');
        
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            
            if (href === 'auth.html') {
                link.style.display = currentUser ? 'none' : 'inline-block';
            }
            
            if (href === 'profile.html') {
                    if (currentUser && currentUser.type === 'admin') {
                        link.style.display = 'none';
                    } else {
                link.style.display = currentUser ? 'inline-block' : 'none';
                    }
                }
                
                if (href === 'admin.html') {
                    link.style.display = (currentUser && currentUser.type === 'admin') ? 'inline-block' : 'none';
            }
        });
        }
    }

    // Функция проверки авторизации
    function checkAuth() {
        const currentUser = AuthSystem.getCurrentUser();
        
        if (currentUser) {
            // Показываем информацию о пользователе
            loginFormSection.classList.remove('active');
            registerFormSection.classList.remove('active');
            document.querySelector('.auth-container').style.display = 'none';
            userInfo.style.display = 'block';
            
            if (currentUser.type === 'admin') {
                userInfoContent.innerHTML = `
                    <div class="user-card">
                        <div class="user-type-badge" style="background: #667eea; color: white;">👑 Администратор</div>
                        <div class="user-details">
                            <p><strong>Имя:</strong> ${escapeHtml(currentUser.name || 'Администратор')}</p>
                            <p><strong>Email:</strong> ${escapeHtml(currentUser.email)}</p>
                            <p><strong>Роль:</strong> Администратор системы</p>
                        </div>
                        <div style="margin-top: 1rem;">
                            <a href="admin.html" class="submit-btn" style="display: inline-block; text-decoration: none; text-align: center;">Перейти в админ-панель</a>
                        </div>
                    </div>
                `;
            } else if (currentUser.type === 'user') {
                userInfoContent.innerHTML = `
                    <div class="user-card">
                        <div class="user-type-badge user">👤 Обычный пользователь</div>
                        <div class="user-details">
                            <p><strong>Имя:</strong> ${escapeHtml(currentUser.name)} ${escapeHtml(currentUser.surname || '')}</p>
                            <p><strong>Telegram:</strong> ${escapeHtml(currentUser.telegram ? '@' + currentUser.telegram : 'Не указан')}</p>
                            <p><strong>Телефон:</strong> ${escapeHtml(currentUser.phone)}</p>
                        </div>
                    </div>
                `;
            } else {
                userInfoContent.innerHTML = `
                    <div class="user-card">
                        <div class="user-type-badge shelter">🏠 Передержка</div>
                        <div class="user-details">
                            <p><strong>Название:</strong> ${escapeHtml(currentUser.shelterName)}</p>
                            <p><strong>Уполномоченное лицо:</strong> ${escapeHtml(currentUser.authorizedPerson || currentUser.contactPerson || '')}</p>
                            <p><strong>Адрес:</strong> ${escapeHtml(currentUser.address)}</p>
                            <p><strong>Email:</strong> ${escapeHtml(currentUser.email)}</p>
                            <p><strong>Телефон:</strong> ${escapeHtml(currentUser.phone)}</p>
                            ${currentUser.viber ? `<p><strong>Viber:</strong> ${escapeHtml(currentUser.viber)}</p>` : ''}
                            ${currentUser.telegram ? `<p><strong>Telegram:</strong> ${escapeHtml(currentUser.telegram)}</p>` : ''}
                            ${currentUser.website ? `<p><strong>Сайт:</strong> <a href="${safeUrl(currentUser.website)}" target="_blank">${escapeHtml(currentUser.website)}</a></p>` : ''}
                        </div>
                    </div>
                `;
            }
            
            // Обновляем навигацию
            updateNavigation();
        } else {
            // Показываем формы входа/регистрации
            document.querySelector('.auth-container').style.display = 'block';
            loginFormSection.classList.add('active');
            registerFormSection.classList.remove('active');
            userInfo.style.display = 'none';
            
            // Устанавливаем активную вкладку "Вход"
            authTabs.forEach((btn, index) => {
                if (index === 0) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            
            // Обновляем навигацию
            updateNavigation();
        }
    }
});

