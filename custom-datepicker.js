// Кастомный календарь для замены input[type="date"]
class CustomDatepicker {
    constructor(inputElement) {
        this.input = inputElement;
        this.isOpen = false;
        this.selectedDate = null;
        this.currentMonth = new Date().getMonth();
        this.currentYear = new Date().getFullYear();
        
        this.init();
    }
    
    init() {
        // Создаем обертку
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'custom-datepicker-wrapper';
        
        // Сохраняем оригинальные стили input
        const originalDisplay = this.input.style.display;
        const originalWidth = this.input.style.width;
        
        // Вставляем обертку перед input
        this.input.parentNode.insertBefore(this.wrapper, this.input);
        
        // Скрываем нативный input, но сохраняем его в DOM для формы
        this.input.style.position = 'absolute';
        this.input.style.opacity = '0';
        this.input.style.pointerEvents = 'none';
        this.input.style.width = '1px';
        this.input.style.height = '1px';
        this.input.style.margin = '0';
        this.input.style.padding = '0';
        this.input.style.border = 'none';
        this.input.style.overflow = 'hidden';
        
        // Перемещаем input в обертку
        this.wrapper.appendChild(this.input);
        
        // Создаем визуальный input
        this.displayInput = document.createElement('input');
        this.displayInput.type = 'text';
        this.displayInput.className = 'custom-datepicker-input';
        this.displayInput.readOnly = true;
        this.displayInput.placeholder = this.input.placeholder || 'Выберите дату';
        
        // Копируем атрибуты
        if (this.input.required) {
            this.displayInput.setAttribute('required', '');
        }
        if (this.input.disabled) {
            this.displayInput.disabled = true;
        }
        
        this.wrapper.appendChild(this.displayInput);
        
        // Устанавливаем начальное значение
        if (this.input.value) {
            const dateValue = new Date(this.input.value + 'T00:00:00');
            if (!isNaN(dateValue.getTime())) {
                this.selectedDate = dateValue;
                this.currentMonth = this.selectedDate.getMonth();
                this.currentYear = this.selectedDate.getFullYear();
                this.updateDisplay();
            }
        } else {
            // Если есть значение по умолчанию из формы
            const defaultValue = this.input.getAttribute('value');
            if (defaultValue) {
                const dateValue = new Date(defaultValue + 'T00:00:00');
                if (!isNaN(dateValue.getTime())) {
                    this.selectedDate = dateValue;
                    this.currentMonth = this.selectedDate.getMonth();
                    this.currentYear = this.selectedDate.getFullYear();
                    this.updateDisplay();
                }
            }
        }
        
        // Создаем календарь
        this.calendar = document.createElement('div');
        this.calendar.className = 'custom-datepicker-calendar';
        this.calendar.style.display = 'none';
        this.wrapper.appendChild(this.calendar);
        
        // Флаг для предотвращения немедленного закрытия
        this.isOpening = false;
        this.openTimestamp = 0;
        this.lastClickTarget = null;
        
        // Обработчики событий - используем mousedown для открытия
        this.displayInput.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            this.lastClickTarget = e.target;
            if (!this.isOpen) {
                this.isOpening = true;
                this.openTimestamp = Date.now();
                // Открываем в следующем тике событийного цикла
                setTimeout(() => {
                    this.open();
                }, 0);
            }
        });
        
        this.displayInput.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // Если календарь открыт и клик был на input, закрываем
            if (this.isOpen && !this.isOpening) {
                this.close();
            }
        });
        
        this.displayInput.addEventListener('focus', (e) => {
            e.preventDefault();
            if (!this.isOpen) {
                this.isOpening = true;
                this.openTimestamp = Date.now();
                setTimeout(() => {
                    this.open();
                }, 0);
            }
        });
        
        // Закрытие при клике вне календаря
        this.clickOutsideHandler = (e) => {
            // Игнорируем клик, если он был на том же элементе, что открыл календарь
            if (e.target === this.lastClickTarget && this.isOpening) {
                return;
            }
            
            // Не закрываем, если клик был на кнопке вкладки админ-панели
            const clickedButton = e.target.closest('.admin-tab-btn[data-subtab]');
            if (clickedButton) {
                return;
            }
            
            // Не закрываем, если клик был внутри секции пользователей
            if (e.target.closest('#usersTab')) {
                return;
            }
            
            // Не закрываем, если календарь только что открылся (менее 300ms назад)
            const timeSinceOpen = Date.now() - this.openTimestamp;
            if (this.isOpening || timeSinceOpen < 300) {
                return;
            }
            
            // Не закрываем, если клик был внутри обертки или календаря
            if (this.wrapper.contains(e.target) || this.calendar.contains(e.target)) {
                return;
            }
            
            // Закрываем только если календарь открыт
            if (this.isOpen) {
                this.close();
            }
        };
        
        // Используем capture phase, но устанавливаем после небольшой задержки
        // чтобы обработчик открытия успел сработать первым
        setTimeout(() => {
            document.addEventListener('mousedown', this.clickOutsideHandler, true);
            document.addEventListener('click', this.clickOutsideHandler, true);
        }, 50);
        
        // Инициализируем календарь (но не показываем)
        this.renderCalendar();
        
        // Слушаем изменения значения в скрытом input (на случай, если оно устанавливается после инициализации)
        const observer = new MutationObserver(() => {
            if (this.input.value && (!this.selectedDate || this.input.value !== this.getIsoDate(this.selectedDate))) {
                const dateValue = new Date(this.input.value + 'T00:00:00');
                if (!isNaN(dateValue.getTime())) {
                    this.selectedDate = dateValue;
                    this.currentMonth = this.selectedDate.getMonth();
                    this.currentYear = this.selectedDate.getFullYear();
                    this.updateDisplay();
                }
            }
        });
        
        // Также слушаем событие input
        this.input.addEventListener('input', () => {
            if (this.input.value && (!this.selectedDate || this.input.value !== this.getIsoDate(this.selectedDate))) {
                const dateValue = new Date(this.input.value + 'T00:00:00');
                if (!isNaN(dateValue.getTime())) {
                    this.selectedDate = dateValue;
                    this.currentMonth = this.selectedDate.getMonth();
                    this.currentYear = this.selectedDate.getFullYear();
                    this.updateDisplay();
                }
            }
        });
    }
    
    getIsoDate(date) {
        if (!date) return '';
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        return `${year}-${month}-${day}`;
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        if (this.input.disabled || this.input.readOnly) return;
        
        // Если календарь еще не создан, создаем его
        if (!this.calendar || !this.calendar.parentNode) {
            this.renderCalendar();
        }
        
        // Устанавливаем флаг открытия и время
        this.isOpening = true;
        this.isOpen = true;
        this.openTimestamp = Date.now();
        this.calendar.style.display = 'block';
        this.displayInput.classList.add('active');
        
        // Обновляем календарь для правильного отображения
        this.renderCalendar();
        
        // Сбрасываем флаг после того, как событие клика обработано
        // Используем requestAnimationFrame для более надежной синхронизации
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.isOpening = false;
            }, 300);
        });
    }
    
    close() {
        this.isOpen = false;
        this.calendar.style.display = 'none';
        this.displayInput.classList.remove('active');
    }
    
    updateDisplay() {
        if (this.selectedDate) {
            const day = String(this.selectedDate.getDate()).padStart(2, '0');
            const month = String(this.selectedDate.getMonth() + 1).padStart(2, '0');
            const year = this.selectedDate.getFullYear();
            this.displayInput.value = `${day}.${month}.${year}`;
            
            // Обновляем скрытый input
            const isoDate = `${year}-${month}-${day}`;
            this.input.value = isoDate;
            
            // Обновляем календарь, если он открыт
            if (this.isOpen) {
                this.renderCalendar();
            }
            
            // Вызываем событие change
            const changeEvent = new Event('change', { bubbles: true });
            this.input.dispatchEvent(changeEvent);
        } else {
            this.displayInput.value = '';
            this.input.value = '';
        }
    }
    
    renderCalendar() {
        this.calendar.innerHTML = '';
        
        // Заголовок с месяцем и годом
        const header = document.createElement('div');
        header.className = 'custom-datepicker-header';
        
        const prevBtn = document.createElement('button');
        prevBtn.className = 'custom-datepicker-nav';
        prevBtn.innerHTML = '‹';
        prevBtn.addEventListener('click', () => this.prevMonth());
        
        const monthYear = document.createElement('div');
        monthYear.className = 'custom-datepicker-month-year';
        const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                           'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
        monthYear.textContent = `${monthNames[this.currentMonth]} ${this.currentYear}`;
        
        const nextBtn = document.createElement('button');
        nextBtn.className = 'custom-datepicker-nav';
        nextBtn.innerHTML = '›';
        nextBtn.addEventListener('click', () => this.nextMonth());
        
        header.appendChild(prevBtn);
        header.appendChild(monthYear);
        header.appendChild(nextBtn);
        
        // Дни недели
        const weekdays = document.createElement('div');
        weekdays.className = 'custom-datepicker-weekdays';
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
        dayNames.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'custom-datepicker-weekday';
            dayEl.textContent = day;
            weekdays.appendChild(dayEl);
        });
        
        // Сетка дат
        const days = document.createElement('div');
        days.className = 'custom-datepicker-days';
        
        const firstDay = new Date(this.currentYear, this.currentMonth, 1);
        const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
        const firstDayOfWeek = (firstDay.getDay() + 6) % 7; // Понедельник = 0
        
        // Дни предыдущего месяца
        const prevMonthLastDay = new Date(this.currentYear, this.currentMonth, 0).getDate();
        for (let i = firstDayOfWeek - 1; i >= 0; i--) {
            const dayEl = document.createElement('div');
            dayEl.className = 'custom-datepicker-day other-month';
            dayEl.textContent = prevMonthLastDay - i;
            days.appendChild(dayEl);
        }
        
        // Дни текущего месяца
        const today = new Date();
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'custom-datepicker-day';
            dayEl.textContent = day;
            
            const date = new Date(this.currentYear, this.currentMonth, day);
            
            // Сегодня
            if (date.toDateString() === today.toDateString()) {
                dayEl.classList.add('today');
            }
            
            // Выбранная дата
            if (this.selectedDate && date.toDateString() === this.selectedDate.toDateString()) {
                dayEl.classList.add('selected');
            }
            
            dayEl.addEventListener('click', () => this.selectDate(date));
            days.appendChild(dayEl);
        }
        
        // Дни следующего месяца
        const totalCells = 42; // 6 недель * 7 дней
        const remainingCells = totalCells - (firstDayOfWeek + lastDay.getDate());
        for (let day = 1; day <= remainingCells; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'custom-datepicker-day other-month';
            dayEl.textContent = day;
            days.appendChild(dayEl);
        }
        
        // Футер с кнопками
        const footer = document.createElement('div');
        footer.className = 'custom-datepicker-footer';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'custom-datepicker-btn clear-btn';
        clearBtn.textContent = 'Очистить';
        clearBtn.addEventListener('click', () => this.clearDate());
        
        const todayBtn = document.createElement('button');
        todayBtn.className = 'custom-datepicker-btn today-btn';
        todayBtn.textContent = 'Сегодня';
        todayBtn.addEventListener('click', () => this.selectToday());
        
        footer.appendChild(clearBtn);
        footer.appendChild(todayBtn);
        
        this.calendar.appendChild(header);
        this.calendar.appendChild(weekdays);
        this.calendar.appendChild(days);
        this.calendar.appendChild(footer);
    }
    
    prevMonth() {
        this.currentMonth--;
        if (this.currentMonth < 0) {
            this.currentMonth = 11;
            this.currentYear--;
        }
        this.renderCalendar();
    }
    
    nextMonth() {
        this.currentMonth++;
        if (this.currentMonth > 11) {
            this.currentMonth = 0;
            this.currentYear++;
        }
        this.renderCalendar();
    }
    
    selectDate(date) {
        this.selectedDate = date;
        this.currentMonth = date.getMonth();
        this.currentYear = date.getFullYear();
        this.updateDisplay();
        this.close();
    }
    
    selectToday() {
        this.selectDate(new Date());
    }
    
    clearDate() {
        this.selectedDate = null;
        this.updateDisplay();
        this.close();
    }
}

// Инициализация всех календарей на странице
function initDatepickers() {
    const dateInputs = document.querySelectorAll('input[type="date"]:not(.custom-datepicker-initialized)');
    dateInputs.forEach(input => {
        input.classList.add('custom-datepicker-initialized');
        new CustomDatepicker(input);
    });
}

// Инициализация при загрузке DOM
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDatepickers);
} else {
    initDatepickers();
}

// Также инициализируем после небольшой задержки для динамически добавленных полей
setTimeout(initDatepickers, 100);

// Обновляем значения календарей после установки значений по умолчанию
setTimeout(() => {
    document.querySelectorAll('input[type="date"].custom-datepicker-initialized').forEach(input => {
        if (input.value) {
            const wrapper = input.closest('.custom-datepicker-wrapper');
            if (wrapper) {
                const displayInput = wrapper.querySelector('.custom-datepicker-input');
                if (displayInput && !displayInput.value) {
                    const dateValue = new Date(input.value + 'T00:00:00');
                    if (!isNaN(dateValue.getTime())) {
                        const day = String(dateValue.getDate()).padStart(2, '0');
                        const month = String(dateValue.getMonth() + 1).padStart(2, '0');
                        const year = dateValue.getFullYear();
                        displayInput.value = `${day}.${month}.${year}`;
                    }
                }
            }
        }
    });
}, 200);

