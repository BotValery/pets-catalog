// Скрипт для управления навигацией в зависимости от авторизации
function updateNavigation() {
    // Проверяем авторизацию
    const currentUser = AuthSystem.getCurrentUser();
    
    // Находим ссылки в навигации
    const navLinks = document.querySelectorAll('nav .nav-link');
    
    // Применяем изменения синхронно, используя классы для стабильности
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        
        // Удаляем все классы видимости
        link.classList.remove('nav-hidden', 'nav-visible');
        
        // Скрываем "Вход" если пользователь авторизован
        if (href === 'auth.html') {
            if (currentUser) {
                link.style.display = 'none';
                link.classList.add('nav-hidden');
            } else {
                link.style.display = 'inline-block';
                link.classList.add('nav-visible');
            }
        }
        
        // Скрываем "Профиль" если пользователь не авторизован или если это админ
        if (href === 'profile.html') {
            if (!currentUser || (currentUser && currentUser.type === 'admin')) {
                link.style.display = 'none';
                link.classList.add('nav-hidden');
            } else {
                link.style.display = 'inline-block';
                link.classList.add('nav-visible');
            }
        }
        
        // Показываем "Админ-панель" только для админов
        if (href === 'admin.html') {
            if (currentUser && currentUser.type === 'admin') {
                link.style.display = 'inline-block';
                link.classList.add('nav-visible');
            } else {
                link.style.display = 'none';
                link.classList.add('nav-hidden');
            }
        }
        
        // Показываем "Панель передержки" только для передержек
        if (href === 'shelter-dashboard.html') {
            if (currentUser && currentUser.type === 'shelter') {
                link.style.display = 'inline-block';
                link.classList.add('nav-visible');
            } else {
                link.style.display = 'none';
                link.classList.add('nav-hidden');
            }
        }
    });
}

// Мобильное меню (бургер)
function initMobileMenu() {
    const header = document.querySelector('header');
    const container = header ? header.querySelector('.container') : null;
    const nav = header ? header.querySelector('nav') : null;
    
    if (!header || !container || !nav) return;
    
    // Не создаем повторно
    if (container.querySelector('.mobile-menu-btn')) return;
    
    const btn = document.createElement('button');
    btn.className = 'mobile-menu-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Открыть меню');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<span></span><span></span><span></span>';
    
    container.insertBefore(btn, nav);
    
    const closeMenu = () => {
        header.classList.remove('nav-open');
        btn.setAttribute('aria-expanded', 'false');
    };
    
    btn.addEventListener('click', () => {
        const isOpen = header.classList.toggle('nav-open');
        btn.setAttribute('aria-expanded', String(isOpen));
    });
    
    // Закрываем меню при клике по ссылке
    nav.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 900) {
                closeMenu();
            }
        });
    });
    
    // Сбрасываем состояние при переходе в десктоп
    window.addEventListener('resize', () => {
        if (window.innerWidth > 900) {
            closeMenu();
        }
    });
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', () => {
    initMobileMenu();
    updateNavigation();
});

// Экспортируем функцию для использования в других скриптах
if (typeof window !== 'undefined') {
    window.updateNavigation = updateNavigation;
}

