// Утилиты для форматирования данных о животных
// Данные теперь получаются через API, эти функции используются для отображения

// Функция для получения возраста в текстовом виде
function getAgeText(age, ageYears = null, ageMonths = null) {
    // Если есть конкретные годы и месяцы, используем их
    if (ageYears !== null && ageYears !== undefined && ageMonths !== null && ageMonths !== undefined) {
        if (ageYears === 0 && ageMonths === 0) {
            return '0 мес.';
        }
        if (ageYears === 0) {
            return `${ageMonths} мес.`;
        }
        if (ageMonths === 0) {
            return `${ageYears} ${ageYears === 1 ? 'год' : ageYears < 5 ? 'года' : 'лет'}`;
        }
        return `${ageYears} ${ageYears === 1 ? 'год' : ageYears < 5 ? 'года' : 'лет'}, ${ageMonths} мес.`;
    }
    
    // Иначе вычисляем из возраста в годах (для обратной совместимости)
    if (age < 1) {
        const months = Math.floor(age * 12);
        return `${months} мес.`;
    }
    const years = Math.floor(age);
    const months = Math.floor((age - years) * 12);
    if (months === 0) {
        return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
    }
    return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}, ${months} мес.`;
}

// Функция для получения размера в текстовом виде
function getSizeText(size) {
    const sizes = {
        small: "Маленький",
        medium: "Средний",
        large: "Большой"
    };
    return sizes[size] || size;
}

// Функция для получения типа в текстовом виде
function getTypeText(type) {
    return type === "dog" ? "Собака" : "Кошка";
}

// Функция для получения пола в текстовом виде
function getGenderText(gender) {
    if (!gender) return 'Неизвестно';
    return gender === "male" ? "Мальчик" : "Девочка";
}

