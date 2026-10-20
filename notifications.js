// Система уведомлений
const NotificationSystem = {
    // Экранирование текста сообщения (сообщения могут содержать данные пользователей)
    _escape(message) {
        if (typeof escapeHtml === 'function') return escapeHtml(message);
        return String(message == null ? '' : message)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },

    // Показать уведомление
    show(message, type = 'info', duration = 3000) {
        // Создаем контейнер для уведомлений, если его нет
        let container = document.getElementById('notificationContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }

        // Создаем уведомление
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = this.getIcon(type);
        notification.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-message">${NotificationSystem._escape(message)}</div>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;

        container.appendChild(notification);

        // Анимация появления
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Автоматическое удаление
        if (duration > 0) {
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => {
                    notification.remove();
                }, 300);
            }, duration);
        }

        return notification;
    },

    // Получить иконку по типу
    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    },

    // Успешное уведомление
    success(message, duration = 3000) {
        return this.show(message, 'success', duration);
    },

    // Ошибка
    error(message, duration = 4000) {
        return this.show(message, 'error', duration);
    },

    // Предупреждение
    warning(message, duration = 4000) {
        return this.show(message, 'warning', duration);
    },

    // Информация
    info(message, duration = 3000) {
        return this.show(message, 'info', duration);
    },

    // Подтверждение (замена confirm)
    confirm(message, onConfirm, onCancel) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.innerHTML = `
            <div class="confirm-modal">
                <div class="confirm-modal-header">
                    <h3>Подтверждение</h3>
                </div>
                <div class="confirm-modal-body">
                    <p>${NotificationSystem._escape(message)}</p>
                </div>
                <div class="confirm-modal-actions">
                    <button class="btn-secondary confirm-cancel">Отмена</button>
                    <button class="btn-primary confirm-ok">ОК</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const okBtn = modal.querySelector('.confirm-ok');
        const cancelBtn = modal.querySelector('.confirm-cancel');

        okBtn.addEventListener('click', () => {
            modal.remove();
            if (onConfirm) onConfirm();
        });

        cancelBtn.addEventListener('click', () => {
            modal.remove();
            if (onCancel) onCancel();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                if (onCancel) onCancel();
            }
        });
    }
};

