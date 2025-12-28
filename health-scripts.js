// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async function() {
    // Получаем элементы
    const tabButtons = document.querySelectorAll('.help-tab-btn');
    const sections = document.querySelectorAll('.help-section');

    // Инициализация вкладок
    initTabs();
    
    // Загрузка данных
    await renderShops();
    await loadAdvice();
    await loadNews();

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

    // Функция отображения зоомагазинов
    async function renderShops() {
        const shopsList = document.getElementById('shopsList');
        
        try {
            const shopsDataResponse = await apiClient.getShops();
            const shops = shopsDataResponse.shops || [];
            
            if (shops.length === 0) {
                shopsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Информация о зоомагазинах скоро появится.</p>';
                return;
            }
            
            shopsList.innerHTML = shops.map(shop => `
                <div class="shop-card">
                    <div class="shop-name">${shop.name}</div>
                    <div class="shop-info">
                        <strong>📍 Адрес:</strong> ${shop.address}
                    </div>
                    <div class="shop-info">
                        <strong>📞 Телефон:</strong> ${shop.phone}
                    </div>
                    <div class="shop-info">
                        <strong>⏰ Часы работы:</strong> ${shop.hours}
                    </div>
                    ${shop.description ? `
                    <div class="shop-description">
                        ${shop.description}
                    </div>
                    ` : ''}
                    ${shop.products ? `
                    <div class="shop-products">
                        <strong>Товары:</strong> ${shop.products}
                    </div>
                    ` : ''}
                </div>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки зоомагазинов:', error);
            shopsList.innerHTML = '<p style="text-align: center; color: #f5576c; padding: 2rem;">Ошибка загрузки информации о зоомагазинах.</p>';
        }
    }

    // Функция загрузки советов ветеринаров с сервера
    async function loadAdvice() {
        const adviceList = document.getElementById('adviceList');
        adviceList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Загрузка советов...</p>';
        
        try {
            // Проверяем доступность API
            try {
                await apiClient.request('/health');
            } catch (healthError) {
                adviceList.innerHTML = '<p style="text-align: center; color: #d32f2f; padding: 2rem;">Сервер недоступен. Проверьте подключение к серверу.</p>';
                return;
            }
            
            const response = await apiClient.getAdvice();
            const adviceData = response.advice || [];
            
            if (adviceData.length === 0) {
                adviceList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Советы ветеринаров скоро появятся.</p>';
                return;
            }
            
            // Сортируем советы по дате (новые первыми)
            const sortedAdvice = [...adviceData].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateB - dateA;
                }
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
            
            adviceList.innerHTML = sortedAdvice.map(advice => `
                <div class="advice-card">
                    <div class="advice-header">
                        <div>
                            <h4 class="advice-title">${advice.title}</h4>
                            <div class="advice-meta">
                                <span class="advice-author">👨‍⚕️ ${advice.author}</span>
                                <span class="advice-date">📅 ${formatDate(advice.date)}</span>
                                <span class="advice-category">🏷️ ${advice.category}</span>
                            </div>
                        </div>
                    </div>
                    <div class="advice-content">
                        <p>${advice.content}</p>
                        ${advice.tips && advice.tips.length > 0 ? `
                        <div class="advice-tips">
                            <strong>Полезные советы:</strong>
                            <ul>
                                ${advice.tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки советов:', error);
            const errorMessage = error.message || 'Неизвестная ошибка';
            adviceList.innerHTML = `<p style="text-align: center; color: #d32f2f; padding: 2rem;">Ошибка загрузки советов: ${errorMessage}. Попробуйте обновить страницу.</p>`;
        }
    }

    // Функция загрузки новостей с сервера
    async function loadNews() {
        const newsList = document.getElementById('newsList');
        newsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Загрузка новостей...</p>';
        
        try {
            // Проверяем доступность API
            try {
                await apiClient.request('/health');
            } catch (healthError) {
                newsList.innerHTML = '<p style="text-align: center; color: #d32f2f; padding: 2rem;">Сервер недоступен. Проверьте подключение к серверу.</p>';
                return;
            }
            
            const response = await apiClient.getNews();
            const newsData = response.news || [];
            
            if (newsData.length === 0) {
                newsList.innerHTML = '<p style="text-align: center; color: #666; padding: 2rem;">Новости скоро появятся.</p>';
                return;
            }
            
            // Сортируем новости по дате (новые первыми)
            const sortedNews = [...newsData].sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                if (dateA.getTime() !== dateB.getTime()) {
                    return dateB - dateA;
                }
                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
            });
            
            newsList.innerHTML = sortedNews.map(news => `
                <div class="news-card ${news.important ? 'important' : ''}">
                    <div class="news-header">
                        <h4 class="news-title">${news.title}</h4>
                        ${news.important ? '<span class="news-badge">Важно</span>' : ''}
                    </div>
                    <div class="news-meta">
                        <span class="news-date">📅 ${formatDate(news.date)}</span>
                        <span class="news-source">📢 ${news.source}</span>
                    </div>
                    <div class="news-content">
                        <p>${news.content}</p>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Ошибка загрузки новостей:', error);
            const errorMessage = error.message || 'Неизвестная ошибка';
            newsList.innerHTML = `<p style="text-align: center; color: #d32f2f; padding: 2rem;">Ошибка загрузки новостей: ${errorMessage}. Попробуйте обновить страницу.</p>`;
        }
    }

    // Функция форматирования даты
    function formatDate(dateString) {
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 
                       'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
        return `${day} ${months[date.getMonth()]} ${year}`;
    }
});

