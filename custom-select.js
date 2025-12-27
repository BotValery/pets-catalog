// Кастомные выпадающие меню
// Делаем класс доступным глобально
window.CustomSelect = class CustomSelect {
    constructor(selectElement) {
        this.select = selectElement;
        this.options = Array.from(this.select.options);
        this.selectedIndex = this.select.selectedIndex;
        this.isOpen = false;
        this.createCustomSelect();
        this.bindEvents();
        
        // Отслеживаем изменения в оригинальном select
        const observer = new MutationObserver(() => {
            this.update();
        });
        observer.observe(this.select, { attributes: true, attributeFilter: ['disabled', 'required'] });
        
        // Отслеживаем программные изменения значения
        this.select.addEventListener('change', () => {
            this.update();
        });
    }

    createCustomSelect() {
        // Скрываем оригинальный select
        this.select.style.display = 'none';
        
        // Создаем обертку
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-select-wrapper';
        
        // Проверяем disabled и required
        if (this.select.disabled) {
            this.wrapper.classList.add('disabled');
        }
        if (this.select.hasAttribute('required')) {
            this.wrapper.classList.add('required');
        }
        
        // Создаем кнопку для отображения выбранного значения
        this.button = document.createElement('button');
        this.button.type = 'button';
        this.button.className = 'custom-select-button';
        if (this.select.disabled) {
            this.button.disabled = true;
        }
        this.button.innerHTML = `
            <span class="custom-select-text">${this.getSelectedText()}</span>
            <span class="custom-select-arrow">▼</span>
        `;
        
        // Создаем выпадающий список
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-select-dropdown';
        
        // Создаем список опций
        this.optionsList = document.createElement('ul');
        this.optionsList.className = 'custom-select-options';
        
        this.options.forEach((option, index) => {
            const li = document.createElement('li');
            li.className = 'custom-select-option';
            if (option.value === this.select.value) {
                li.classList.add('selected');
            }
            li.textContent = option.text;
            li.dataset.value = option.value;
            li.dataset.index = index;
            
            li.addEventListener('click', () => {
                this.selectOption(index, option.value);
            });
            
            this.optionsList.appendChild(li);
        });
        
        this.dropdown.appendChild(this.optionsList);
        this.wrapper.appendChild(this.button);
        this.wrapper.appendChild(this.dropdown);
        
        // Вставляем кастомный select после оригинального
        this.select.parentNode.insertBefore(this.wrapper, this.select.nextSibling);
    }

    getSelectedText() {
        const selectedOption = this.options[this.selectedIndex];
        return selectedOption ? selectedOption.text : 'Выберите';
    }

    bindEvents() {
        // Открытие/закрытие по клику на кнопку
        this.button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!this.select.disabled) {
                this.toggle();
            }
        });

        // Закрытие при клике вне элемента
        this.clickHandler = (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        };
        
        document.addEventListener('click', this.clickHandler);

        // Закрытие при нажатии Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Навигация клавиатурой
        this.button.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.open();
                this.highlightNext();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.open();
                this.highlightPrevious();
            }
        });

        this.optionsList.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.highlightNext();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.highlightPrevious();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const highlighted = this.optionsList.querySelector('.highlighted');
                if (highlighted) {
                    highlighted.click();
                }
            }
        });

        // Обновление позиции при прокрутке или изменении размера окна
        this.scrollHandler = () => {
            if (this.isOpen) {
                this.updatePosition();
            }
        };
        
        window.addEventListener('scroll', this.scrollHandler, true);
        window.addEventListener('resize', this.scrollHandler);
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    updatePosition() {
        if (!this.isOpen) return;
        
        // Убеждаемся, что dropdown в body
        if (this.dropdown.parentNode !== document.body) {
            document.body.appendChild(this.dropdown);
        }
        
        requestAnimationFrame(() => {
            const buttonRect = this.button.getBoundingClientRect();
            this.dropdown.style.position = 'fixed';
            this.dropdown.style.top = `${buttonRect.bottom + 4}px`;
            this.dropdown.style.left = `${buttonRect.left}px`;
            this.dropdown.style.width = `${buttonRect.width}px`;
            this.dropdown.style.right = 'auto';
        });
    }

    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.button.classList.add('active');
        this.dropdown.classList.add('open');
        
        // Перемещаем dropdown в body, чтобы избежать обрезания из-за overflow: hidden
        if (this.dropdown.parentNode !== document.body) {
            document.body.appendChild(this.dropdown);
        }
        
        // Устанавливаем позицию для правильного отображения
        this.updatePosition();
        
        // Прокручиваем к выбранному элементу
        const selected = this.optionsList.querySelector('.selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest' });
        }
    }

    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.button.classList.remove('active');
        this.dropdown.classList.remove('open');
        this.optionsList.querySelectorAll('.highlighted').forEach(el => {
            el.classList.remove('highlighted');
        });
        
        // Возвращаем dropdown обратно в wrapper
        if (this.dropdown.parentNode === document.body && this.wrapper) {
            this.wrapper.appendChild(this.dropdown);
            this.dropdown.style.position = 'absolute';
            this.dropdown.style.top = '';
            this.dropdown.style.left = '';
            this.dropdown.style.width = '';
            this.dropdown.style.right = '';
        }
    }

    selectOption(index, value) {
        // Обновляем оригинальный select
        this.select.selectedIndex = index;
        this.selectedIndex = index;
        
        // Обновляем текст кнопки
        this.button.querySelector('.custom-select-text').textContent = this.getSelectedText();
        
        // Обновляем визуальное выделение
        this.optionsList.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
        const selectedLi = this.optionsList.querySelector(`[data-index="${index}"]`);
        if (selectedLi) {
            selectedLi.classList.add('selected');
        }
        
        // Триггерим событие change на оригинальном select
        const changeEvent = new Event('change', { bubbles: true });
        this.select.dispatchEvent(changeEvent);
        
        this.close();
    }

    highlightNext() {
        const highlighted = this.optionsList.querySelector('.highlighted');
        const options = Array.from(this.optionsList.children);
        let nextIndex = 0;
        
        if (highlighted) {
            const currentIndex = options.indexOf(highlighted);
            nextIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
            highlighted.classList.remove('highlighted');
        }
        
        options[nextIndex].classList.add('highlighted');
        options[nextIndex].scrollIntoView({ block: 'nearest' });
    }

    highlightPrevious() {
        const highlighted = this.optionsList.querySelector('.highlighted');
        const options = Array.from(this.optionsList.children);
        let prevIndex = options.length - 1;
        
        if (highlighted) {
            const currentIndex = options.indexOf(highlighted);
            prevIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
            highlighted.classList.remove('highlighted');
        }
        
        options[prevIndex].classList.add('highlighted');
        options[prevIndex].scrollIntoView({ block: 'nearest' });
    }

    // Обновление кастомного select при изменении оригинального
    update() {
        this.selectedIndex = this.select.selectedIndex;
        this.button.querySelector('.custom-select-text').textContent = this.getSelectedText();
        
        // Обновляем визуальное выделение
        this.optionsList.querySelectorAll('.selected').forEach(el => {
            el.classList.remove('selected');
        });
        const selectedLi = this.optionsList.querySelector(`[data-index="${this.selectedIndex}"]`);
        if (selectedLi) {
            selectedLi.classList.add('selected');
        }
        
        // Если dropdown открыт, обновляем позицию
        if (this.isOpen) {
            this.updatePosition();
        }
    }
}

// Инициализация всех кастомных select
function initCustomSelects() {
    // Находим все select элементы
    const selects = document.querySelectorAll('select:not(.custom-select-initialized)');
    
    selects.forEach(select => {
        // Пропускаем select в модальных окнах, которые могут быть динамически созданы
        if (select.closest('.modal-overlay')) {
            return;
        }
        
        select.classList.add('custom-select-initialized');
        new window.CustomSelect(select);
    });
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCustomSelects);
} else {
    initCustomSelects();
}

// Инициализация для динамически добавленных элементов
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) { // Element node
                const selects = node.querySelectorAll ? node.querySelectorAll('select:not(.custom-select-initialized)') : [];
                selects.forEach(select => {
                    if (!select.closest('.modal-overlay')) {
                        select.classList.add('custom-select-initialized');
                        new CustomSelect(select);
                    }
                });
            }
        });
    });
});

observer.observe(document.body, {
    childList: true,
    subtree: true
});
