// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // API инициализируется автоматически
    
    // Получаем элементы
    const tabButtons = document.querySelectorAll('.help-tab-btn');
    const sections = document.querySelectorAll('.help-section');
    const donationForm = document.getElementById('donationForm');
    const volunteerForm = document.getElementById('volunteerForm');
    const amountButtons = document.querySelectorAll('.amount-btn');
    const donationAmountInput = document.getElementById('donationAmount');

    // Инициализация вкладок
    initTabs();
    
    // Инициализация форм
    initDonationForm();
    initVolunteerForm();
    
    // Загрузка данных
    await renderClinics();

    // Функция инициализации вкладок
    function initTabs() {
        tabButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const targetTab = this.dataset.tab;
                
                // Убираем активный класс у всех кнопок и секций
                tabButtons.forEach(b => b.classList.remove('active'));
                sections.forEach(s => s.classList.remove('active'));
                
                // Добавляем активный класс выбранной кнопке и секции
                this.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
    }

    // Функция инициализации формы пожертвований
    function initDonationForm() {
        // Обработчики кнопок суммы
        amountButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                const amount = this.dataset.amount;
                amountButtons.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                donationAmountInput.value = amount;
            });
        });

        // Обработчик отправки формы
        donationForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(donationForm);
            const amount = parseFloat(formData.get('amount'));
            const name = formData.get('name');
            const anonymous = formData.get('anonymous') === 'on';
            const acceptOffer = formData.get('acceptOffer') === 'on';
            const email = formData.get('email');
            const phone = formData.get('phone');
            const message = formData.get('message');
            
            if (!amount || amount <= 0) {
                NotificationSystem.warning('Пожалуйста, укажите сумму пожертвования');
                return;
            }
            
            if (!acceptOffer) {
                NotificationSystem.warning('Необходимо принять публичную оферту о заключении договора пожертвования');
                return;
            }
            
            // Создаем платеж через ВТБ
            try {
                NotificationSystem.info('Создание платежа...');
                
                const donationData = {
                    amount: amount,
                    donorName: anonymous ? null : name,
                    donorEmail: email || null,
                    donorPhone: phone || null,
                    message: message || null,
                    anonymous: anonymous
                };
                
                const response = await apiClient.createDonationPayment(donationData);
                
                if (response.success && response.confirmationUrl) {
                    // Сохраняем ID доната для проверки статуса
                    localStorage.setItem('lastDonationId', response.donationId);
                    
                    // Перенаправляем на страницу оплаты ВТБ
                    window.location.href = response.confirmationUrl;
                } else {
                    throw new Error('Не удалось создать платеж');
                }
            } catch (error) {
                console.error('Ошибка создания платежа:', error);
                NotificationSystem.error(error.message || 'Произошла ошибка при создании платежа. Попробуйте еще раз.');
            }
        });
    }

    // Функция инициализации формы волонтера
    function initVolunteerForm() {
        volunteerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(volunteerForm);
            const activities = formData.getAll('activities');
            
            if (activities.length === 0) {
                NotificationSystem.warning('Пожалуйста, выберите хотя бы один вид деятельности');
                return;
            }
            
            // Сохраняем заявку волонтера в базу данных
            try {
                const volunteer = {
                    name: formData.get('name'),
                    age: formData.get('age'),
                    phone: formData.get('phone'),
                    telegram: formData.get('telegram'),
                    city: formData.get('city'),
                    activities: activities,
                    experience: formData.get('experience'),
                    availability: formData.get('availability'),
                    date: new Date().toISOString()
                };
                
                await apiClient.createVolunteer(volunteer);
                
                volunteerForm.reset();
                
                NotificationSystem.success('Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.');
            } catch (error) {
                console.error('Ошибка сохранения заявки:', error);
                NotificationSystem.error('Произошла ошибка при сохранении заявки. Попробуйте еще раз.');
            }
        });
    }

    // Функция отображения ветклиник
    async function renderClinics() {
        const clinicsList = document.getElementById('clinicsList');
        
        try {
            const clinicsDataResponse = await apiClient.getClinics();
            const clinics = clinicsDataResponse.clinics || [];
            
            if (clinics.length === 0) {
                clinicsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Информация о ветклиниках скоро появится.</p>';
                return;
            }
            
            clinicsList.innerHTML = clinics.map(clinic => `
                <div class="clinic-card">
                    <div class="clinic-name">${escapeHtml(clinic.name)}</div>
                    <div class="clinic-info">
                        <strong>📍 Адрес:</strong> ${escapeHtml(clinic.address)}
                    </div>
                    <div class="clinic-info">
                        <strong>📞 Телефон:</strong> ${escapeHtml(clinic.phone)}
                    </div>
                    ${clinic.services ? `
                    <div class="clinic-info">
                        <strong>🩺 Услуги:</strong> ${escapeHtml(clinic.services)}
                    </div>
                    ` : ''}
                    <div class="clinic-hours">⏰ ${escapeHtml(clinic.hours)}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки ветклиник:', error);
            clinicsList.innerHTML = '<p style="text-align: center; color: #f5576c; padding: 2rem;">Ошибка загрузки информации о ветклиниках.</p>';
        }
    }

});

