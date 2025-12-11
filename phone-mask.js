// Маска для форматирования номера телефона
const PhoneMask = {
    // Применение маски к полю ввода
    apply(inputElement) {
        if (!inputElement) return;
        
        inputElement.addEventListener('input', function(e) {
            const input = e.target;
            const cursorPosition = input.selectionStart;
            const oldValue = input.value;
            
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
            // Находим позицию, где находится digitBeforeCursor-я цифра в новом значении
            let newCursorPosition = 0;
            let digitCount = 0;
            
            for (let i = 0; i < formatted.length; i++) {
                if (/\d/.test(formatted[i])) {
                    digitCount++;
                    if (digitCount === digitsBeforeCursor) {
                        // Курсор ставим после этой цифры
                        newCursorPosition = i + 1;
                        break;
                    }
                }
            }
            
            // Если все цифры до курсора обработаны, ставим курсор в конец
            if (newCursorPosition === 0) {
                newCursorPosition = formatted.length;
            }
            
            // Устанавливаем курсор
            setTimeout(() => {
                input.setSelectionRange(newCursorPosition, newCursorPosition);
            }, 0);
        });
        
        // Обработка удаления символов (Backspace, Delete)
        inputElement.addEventListener('keydown', function(e) {
            if (e.key === 'Backspace') {
                const input = e.target;
                const cursorPosition = input.selectionStart;
                const value = input.value;
                
                // Если курсор находится на разделителе или после него, перемещаем курсор назад
                if (cursorPosition > 0) {
                    const charBefore = value[cursorPosition - 1];
                    if ([' ', '(', ')', '-'].includes(charBefore)) {
                        e.preventDefault();
                        // Находим предыдущую цифру
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
                
                // Если курсор находится перед разделителем, удаляем следующую цифру
                if (cursorPosition < value.length) {
                    const charAt = value[cursorPosition];
                    if ([' ', '(', ')', '-'].includes(charAt)) {
                        e.preventDefault();
                        // Находим следующую цифру и удаляем её
                        let nextDigitPos = cursorPosition + 1;
                        while (nextDigitPos < value.length && [' ', '(', ')', '-'].includes(value[nextDigitPos])) {
                            nextDigitPos++;
                        }
                        if (nextDigitPos < value.length && /\d/.test(value[nextDigitPos])) {
                            // Удаляем цифру
                            const before = value.substring(0, nextDigitPos);
                            const after = value.substring(nextDigitPos + 1);
                            input.value = before + after;
                            
                            // Устанавливаем курсор на место удаленной цифры
                            setTimeout(() => {
                                input.setSelectionRange(cursorPosition, cursorPosition);
                                input.dispatchEvent(new Event('input'));
                            }, 0);
                        }
                    }
                }
            }
        });
        
        // Обработка вставки (Paste)
        inputElement.addEventListener('paste', function(e) {
            e.preventDefault();
            const input = e.target;
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
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
                
                // Форматируем и устанавливаем значение
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
                // Ставим курсор в конец
                setTimeout(() => {
                    input.setSelectionRange(formatted.length, formatted.length);
                }, 0);
            }
        });
    },
    
    // Получение чистого номера (только цифры)
    getCleanPhone(formattedPhone) {
        if (!formattedPhone) return '';
        
        // Удаляем все нецифровые символы
        let clean = formattedPhone.replace(/\D/g, '');
        
        // Если начинается с 8, заменяем на 7
        if (clean.length > 0 && clean[0] === '8') {
            clean = '7' + clean.substring(1);
        }
        
        // Если не начинается с 7, добавляем 7 в начало
        if (clean.length > 0 && clean[0] !== '7') {
            clean = '7' + clean;
        }
        
        // Ограничиваем до 11 цифр
        if (clean.length > 11) {
            clean = clean.substring(0, 11);
        }
        
        return clean;
    },
    
    // Валидация отформатированного номера
    isValid(formattedPhone) {
        if (!formattedPhone || formattedPhone.trim() === '') {
            return false;
        }
        
        const clean = this.getCleanPhone(formattedPhone);
        
        // Проверяем, что номер содержит ровно 11 цифр и начинается с 7
        return clean.length === 11 && clean[0] === '7';
    }
};
