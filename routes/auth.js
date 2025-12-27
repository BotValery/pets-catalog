const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Проверка и создание таблиц users и shelters, если их нет
async function ensureAuthTables() {
    try {
        // Проверяем наличие таблицы users
        const usersTableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        );

        if (!usersTableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    telegram TEXT,
                    password TEXT NOT NULL,
                    phone TEXT UNIQUE,
                    city TEXT,
                    address TEXT,
                    registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            // Добавляем индексы
            try {
                await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)');
            } catch (e) {
                // Индекс уже существует
            }
            
            try {
                await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram)');
            } catch (e) {
                // Индекс уже существует
            }
            
            console.log('✅ Таблица users создана автоматически');
        }

        // Проверяем наличие таблицы shelters
        const sheltersTableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='shelters'"
        );

        if (!sheltersTableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS shelters (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shelterName TEXT NOT NULL,
                    authorizedPerson TEXT,
                    address TEXT,
                    phone TEXT,
                    viber TEXT,
                    telegram TEXT,
                    website TEXT,
                    email TEXT UNIQUE,
                    password TEXT NOT NULL,
                    agreementAccepted BOOLEAN DEFAULT 0,
                    registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            console.log('✅ Таблица shelters создана автоматически');
        } else {
            // Проверяем, нужно ли мигрировать таблицу (если email имеет NOT NULL constraint)
            try {
                const tableInfo = await db.get(
                    "SELECT sql FROM sqlite_master WHERE type='table' AND name='shelters'"
                );
                
                // Если в схеме есть "email TEXT UNIQUE NOT NULL", нужно мигрировать
                if (tableInfo && tableInfo.sql && tableInfo.sql.includes('email TEXT UNIQUE NOT NULL')) {
                    console.log('🔄 Миграция таблицы shelters: удаление NOT NULL constraint с email...');
                    
                    // Создаем временную таблицу с правильной схемой (email nullable, но с UNIQUE для не-NULL значений)
                    await db.run(`
                        CREATE TABLE IF NOT EXISTS shelters_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            shelterName TEXT NOT NULL,
                            authorizedPerson TEXT,
                            address TEXT,
                            phone TEXT,
                            viber TEXT,
                            telegram TEXT,
                            website TEXT,
                            email TEXT UNIQUE,
                            password TEXT NOT NULL,
                            agreementAccepted BOOLEAN DEFAULT 0,
                            registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `);
                    
                    // Копируем данные из старой таблицы
                    await db.run(`
                        INSERT INTO shelters_new 
                        (id, shelterName, authorizedPerson, address, phone, viber, telegram, website, email, password, agreementAccepted, registeredAt)
                        SELECT id, shelterName, authorizedPerson, address, phone, viber, telegram, website, email, password, agreementAccepted, registeredAt
                        FROM shelters
                    `);
                    
                    // Удаляем старую таблицу
                    await db.run('DROP TABLE shelters');
                    
                    // Переименовываем новую таблицу
                    await db.run('ALTER TABLE shelters_new RENAME TO shelters');
                    
                    // UNIQUE constraint уже включен в определение колонки, дополнительный индекс не нужен
                    
                    console.log('✅ Миграция таблицы shelters завершена');
                }
            } catch (error) {
                // Если миграция не удалась, логируем ошибку, но не прерываем работу
                console.warn('⚠️  Предупреждение при проверке миграции shelters:', error.message);
            }
        }
    } catch (error) {
        console.error('Ошибка создания таблиц auth:', error);
        throw error;
    }
}

// Регистрация пользователя
router.post('/register/user', [
    body('name').trim().notEmpty().withMessage('Имя обязательно'),
    body('telegram').trim().notEmpty().withMessage('Telegram обязателен'),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
    body('phone').trim().notEmpty().withMessage('Телефон обязателен')
], async (req, res) => {
    try {
        // Убеждаемся, что таблицы существуют
        await ensureAuthTables();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { name, telegram, password, phone, city, address } = req.body;

        // Проверяем обязательные поля
        if (!name || !telegram || !password || !phone) {
            return res.status(400).json({ error: 'Все обязательные поля должны быть заполнены' });
        }

        // Нормализуем telegram (убираем @ если есть)
        const normalizedTelegram = telegram.replace(/^@/, '').trim();
        
        if (!normalizedTelegram) {
            return res.status(400).json({ error: 'Telegram обязателен' });
        }

        // Нормализуем телефон для проверки и сохранения
        let normalizedPhone = phone;
        if (phone && phone.trim() !== '') {
            try {
                // Убираем все нецифровые символы
                let cleanPhone = phone.replace(/\D/g, '');
                // Если начинается с 8, заменяем на 7
                if (cleanPhone.startsWith('8')) {
                    cleanPhone = '7' + cleanPhone.substring(1);
                }
                // Если не начинается с 7, добавляем 7
                if (cleanPhone && !cleanPhone.startsWith('7')) {
                    cleanPhone = '7' + cleanPhone;
                }
                // Ограничиваем до 11 цифр
                if (cleanPhone.length > 11) {
                    cleanPhone = cleanPhone.substring(0, 11);
                }
                // Форматируем в стандартный вид: +7 (999) 123-45-67
                if (cleanPhone.length === 11 && cleanPhone.startsWith('7')) {
                    normalizedPhone = `+${cleanPhone[0]} (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7, 9)}-${cleanPhone.substring(9, 11)}`;
                }
                // Если не удалось нормализовать, оставляем оригинальный
            } catch (error) {
                console.error('Ошибка нормализации телефона:', error);
                // В случае ошибки оставляем оригинальный телефон
                normalizedPhone = phone;
            }
        }

        // Проверка существования пользователя по телефону
        if (normalizedPhone && normalizedPhone.trim() !== '') {
            try {
                // Сначала проверяем точное совпадение
                let existingUserByPhone = await db.get('SELECT * FROM users WHERE phone = ?', [phone]);
                if (!existingUserByPhone && normalizedPhone !== phone) {
                    existingUserByPhone = await db.get('SELECT * FROM users WHERE phone = ?', [normalizedPhone]);
                }
                
                // Если не нашли, проверяем по нормализованному номеру (только цифры)
                if (!existingUserByPhone) {
                    const phoneClean = normalizedPhone.replace(/\D/g, '');
                    if (phoneClean && phoneClean.length >= 10) {
                        const allUsers = await db.all('SELECT * FROM users WHERE phone IS NOT NULL');
                        existingUserByPhone = allUsers.find(u => {
                            if (!u.phone) return false;
                            const userPhoneClean = u.phone.replace(/\D/g, '');
                            return userPhoneClean === phoneClean;
                        });
                    }
                }
                
                if (existingUserByPhone) {
                    return res.status(400).json({ error: 'Пользователь с таким телефоном уже существует' });
                }
            } catch (error) {
                console.error('Ошибка проверки существования пользователя по телефону:', error);
                // Продолжаем регистрацию, если проверка не удалась
            }
        }

        // Проверка существования пользователя по telegram
        const existingUserByTelegram = await db.get('SELECT * FROM users WHERE telegram = ?', [normalizedTelegram]);
        if (existingUserByTelegram) {
            return res.status(400).json({ error: 'Пользователь с таким Telegram уже существует' });
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создание пользователя
        console.log('Создание пользователя:', {
            name,
            telegram: normalizedTelegram,
            phone: normalizedPhone,
            hasPassword: !!hashedPassword
        });
        
        const result = await db.run(
            'INSERT INTO users (name, telegram, password, phone, city, address) VALUES (?, ?, ?, ?, ?, ?)',
            [name, normalizedTelegram, hashedPassword, normalizedPhone || phone, city || null, address || null]
        );

        console.log('Результат создания пользователя:', result);

        if (!result || (result.id === undefined && result.lastID === undefined)) {
            console.error('Ошибка: result.id не определен', result);
            return res.status(500).json({ error: 'Ошибка создания пользователя' });
        }

        const userId = result.id || result.lastID;

        // Генерация JWT токена
        const token = jwt.sign(
            { id: userId, phone: normalizedPhone || phone, type: 'user' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Пользователь успешно зарегистрирован',
            token,
            user: {
                id: userId,
                name,
                telegram: normalizedTelegram,
                phone: normalizedPhone || phone,
                type: 'user'
            }
        });
    } catch (error) {
        console.error('Ошибка регистрации пользователя:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ 
            error: 'Ошибка сервера',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Регистрация передержки
router.post('/register/shelter', [
    body('shelterName').trim().notEmpty().withMessage('Название передержки обязательно'),
    body('email').optional({ values: 'falsy' }).trim().custom((value) => {
        // Если email передан и не пустой, проверяем формат
        if (value && value.trim() !== '') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value.trim())) {
                throw new Error('Некорректный email');
            }
        }
        return true;
    }),
    body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
    body('phone').optional({ values: 'falsy' }).trim()
], async (req, res) => {
    try {
        // Убеждаемся, что таблицы существуют
        await ensureAuthTables();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            shelterName,
            authorizedPerson,
            address,
            phone,
            viber,
            telegram,
            website,
            email,
            password,
            agreementAccepted
        } = req.body;

        if (!agreementAccepted) {
            return res.status(400).json({ error: 'Необходимо принять соглашение' });
        }

        // Проверка существования передержки по email (если email указан)
        if (email && email.trim() !== '') {
            const existingShelter = await db.get('SELECT * FROM shelters WHERE email = ?', [email]);
            if (existingShelter) {
                return res.status(400).json({ error: 'Передержка с таким email уже существует' });
            }
        }
        
        // Нормализуем телефон для проверки и сохранения
        let normalizedPhone = phone;
        if (phone && phone.trim() !== '') {
            try {
                // Убираем все нецифровые символы
                let cleanPhone = phone.replace(/\D/g, '');
                // Если начинается с 8, заменяем на 7
                if (cleanPhone.startsWith('8')) {
                    cleanPhone = '7' + cleanPhone.substring(1);
                }
                // Если не начинается с 7, добавляем 7
                if (cleanPhone && !cleanPhone.startsWith('7')) {
                    cleanPhone = '7' + cleanPhone;
                }
                // Форматируем в стандартный вид: +7 (999) 123-45-67
                if (cleanPhone.length === 11 && cleanPhone.startsWith('7')) {
                    normalizedPhone = `+${cleanPhone[0]} (${cleanPhone.substring(1, 4)}) ${cleanPhone.substring(4, 7)}-${cleanPhone.substring(7, 9)}-${cleanPhone.substring(9, 11)}`;
                }
                // Если не удалось нормализовать, оставляем оригинальный
            } catch (error) {
                console.error('Ошибка нормализации телефона:', error);
                // В случае ошибки оставляем оригинальный телефон
                normalizedPhone = phone;
            }
        }

        // Проверка существования передержки по телефону (если телефон указан)
        if (normalizedPhone && normalizedPhone.trim() !== '') {
            try {
                // Сначала проверяем точное совпадение
                let existingShelterByPhone = await db.get('SELECT * FROM shelters WHERE phone = ?', [phone]);
                if (!existingShelterByPhone && normalizedPhone !== phone) {
                    existingShelterByPhone = await db.get('SELECT * FROM shelters WHERE phone = ?', [normalizedPhone]);
                }
                
                // Если не нашли, проверяем по нормализованному номеру (только цифры)
                if (!existingShelterByPhone) {
                    const phoneClean = normalizedPhone.replace(/\D/g, '');
                    if (phoneClean && phoneClean.length >= 10) {
                        const allShelters = await db.all('SELECT * FROM shelters WHERE phone IS NOT NULL');
                        existingShelterByPhone = allShelters.find(s => {
                            if (!s.phone) return false;
                            const shelterPhoneClean = s.phone.replace(/\D/g, '');
                            return shelterPhoneClean === phoneClean;
                        });
                    }
                }
                
                if (existingShelterByPhone) {
                    return res.status(400).json({ error: 'Передержка с таким телефоном уже существует' });
                }
            } catch (error) {
                console.error('Ошибка проверки существования передержки по телефону:', error);
                // Продолжаем регистрацию, если проверка не удалась
            }
        }

        // Хеширование пароля
        const hashedPassword = await bcrypt.hash(password, 10);

        // Создание передержки
        const result = await db.run(
            `INSERT INTO shelters (shelterName, authorizedPerson, address, phone, viber, telegram, website, email, password, agreementAccepted)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [shelterName, authorizedPerson || null, address || null, normalizedPhone || phone || null, viber || null, telegram || null, website || null, email || null, hashedPassword, agreementAccepted ? 1 : 0]
        );

        // Генерация JWT токена
        const tokenIdentifier = email || phone;
        const token = jwt.sign(
            { id: result.id, identifier: tokenIdentifier, type: 'shelter' },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({
            message: 'Передержка успешно зарегистрирована',
            token,
            user: {
                id: result.id,
                shelterName,
                email: email || null,
                phone: phone || null,
                type: 'shelter'
            }
        });
    } catch (error) {
        console.error('Ошибка регистрации передержки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Вход (универсальный - по email или телефону)
router.post('/login', [
    body('identifier').trim().notEmpty().withMessage('Email или телефон обязателен'),
    body('password').notEmpty().withMessage('Пароль обязателен')
], async (req, res) => {
    try {
        // Убеждаемся, что таблицы существуют
        await ensureAuthTables();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { identifier, password } = req.body;
        const isEmail = identifier.includes('@');
        let user = null;
        let userType = null;

        if (isEmail) {
            // Поиск по email (передержки и админы)
            // Сначала ищем передержку
            user = await db.get('SELECT * FROM shelters WHERE email = ?', [identifier]);
            userType = 'shelter';

            // Если не нашли передержку, ищем админа
            if (!user) {
                user = await db.get('SELECT * FROM admins WHERE email = ?', [identifier]);
                userType = 'admin';
            }
        } else {
            // Поиск по телефону (пользователи и передержки)
            // Нормализуем телефон для поиска - получаем только цифры
            let normalizedPhone = identifier.replace(/\D/g, '');
            // Если начинается с 8, заменяем на 7
            if (normalizedPhone.startsWith('8')) {
                normalizedPhone = '7' + normalizedPhone.substring(1);
            }
            // Если не начинается с 7, добавляем 7
            if (!normalizedPhone.startsWith('7')) {
                normalizedPhone = '7' + normalizedPhone;
            }
            // Ограничиваем до 11 цифр
            if (normalizedPhone.length > 11) {
                normalizedPhone = normalizedPhone.substring(0, 11);
            }
            
            // Формируем варианты для поиска
            const phoneWithPlus = '+' + normalizedPhone;
            const phoneFormatted = `+${normalizedPhone[0]} (${normalizedPhone.substring(1, 4)}) ${normalizedPhone.substring(4, 7)}-${normalizedPhone.substring(7, 9)}-${normalizedPhone.substring(9, 11)}`;
            
            // Сначала ищем обычного пользователя (пробуем все варианты формата)
            user = await db.get(
                `SELECT * FROM users WHERE 
                 phone = ? OR phone = ? OR phone = ? OR 
                 REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') = ?`,
                [identifier, phoneWithPlus, phoneFormatted, normalizedPhone]
            );
            userType = 'user';

            // Если не нашли пользователя, ищем передержку по телефону
            if (!user) {
                user = await db.get(
                    `SELECT * FROM shelters WHERE 
                     phone = ? OR phone = ? OR phone = ? OR 
                     REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone, ' ', ''), '(', ''), ')', ''), '-', ''), '+', '') = ?`,
                    [identifier, phoneWithPlus, phoneFormatted, normalizedPhone]
                );
                userType = 'shelter';
            }
        }

        if (!user) {
            return res.status(401).json({ error: 'Неверный email/телефон или пароль' });
        }

        // Проверка пароля
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Неверный email/телефон или пароль' });
        }

        // Генерация JWT токена
        const tokenIdentifier = userType === 'admin' ? user.email : (userType === 'user' ? user.phone : (isEmail ? user.email : user.phone));
        const token = jwt.sign(
            { id: user.id, identifier: tokenIdentifier, type: userType },
            JWT_SECRET,
            { expiresIn: '7d' }
        );

        // Формирование ответа в зависимости от типа пользователя
        let userData;
        if (userType === 'user') {
            userData = {
                id: user.id,
                name: user.name,
                telegram: user.telegram,
                phone: user.phone,
                type: 'user'
            };
        } else if (userType === 'shelter') {
            userData = {
                id: user.id,
                shelterName: user.shelterName,
                email: user.email,
                phone: user.phone,
                type: 'shelter'
            };
        } else {
            userData = {
                id: user.id,
                name: user.name,
                email: user.email,
                type: 'admin'
            };
        }

        res.json({
            message: 'Вход выполнен успешно',
            token,
            user: userData
        });
    } catch (error) {
        console.error('Ошибка входа:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получение текущего пользователя
router.get('/me', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const userType = req.user.type;

        let user;
        if (userType === 'user') {
            user = await db.get('SELECT id, name, telegram, phone, city, address, registeredAt FROM users WHERE id = ?', [userId]);
        } else if (userType === 'shelter') {
            user = await db.get('SELECT * FROM shelters WHERE id = ?', [userId]);
        } else if (userType === 'admin') {
            user = await db.get('SELECT id, name, email, createdAt FROM admins WHERE id = ?', [userId]);
        }

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ user: { ...user, type: userType } });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

