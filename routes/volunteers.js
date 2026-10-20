const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Функция для проверки и создания таблицы volunteers, если её нет
async function ensureVolunteersTable() {
    try {
        // Проверяем наличие таблицы volunteers
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='volunteers'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS volunteers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    age INTEGER,
                    phone TEXT,
                    email TEXT,
                    telegram TEXT,
                    city TEXT,
                    activities TEXT,
                    experience TEXT,
                    availability TEXT,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица volunteers создана автоматически');
        } else {
            // Проверяем наличие колонки telegram и добавляем её, если нет
            try {
                const tableInfo = await db.all("PRAGMA table_info(volunteers)");
                const columnNames = tableInfo.map(col => col.name);
                
                if (!columnNames.includes('telegram')) {
                    console.log('📦 Добавление колонки telegram в таблицу volunteers...');
                    await db.run('ALTER TABLE volunteers ADD COLUMN telegram TEXT');
                    console.log('✅ Колонка telegram добавлена');
                }
            } catch (error) {
                // Игнорируем ошибку, если колонка уже существует
            }
        }
    } catch (error) {
        console.error('Ошибка создания таблицы volunteers:', error);
        throw error;
    }
}

// Получить всех волонтеров (для админов и передержек)
router.get('/', authenticateToken, async (req, res) => {
    try {
        if (req.user.type !== 'admin' && req.user.type !== 'shelter') {
            return res.status(403).json({ error: 'Нет доступа' });
        }
        await ensureVolunteersTable();
        
        const volunteers = await db.all('SELECT * FROM volunteers ORDER BY date DESC');
        
        // Парсим activities из JSON строки
        const volunteersWithParsedActivities = volunteers.map(vol => {
            let activities = [];
            if (vol.activities) {
                try {
                    activities = JSON.parse(vol.activities);
                } catch (parseError) {
                    console.warn('Ошибка парсинга activities для волонтера', vol.id, parseError);
                    activities = [];
                }
            }
            return {
                ...vol,
                activities: activities
            };
        });

        res.json({ volunteers: volunteersWithParsedActivities });
    } catch (error) {
        console.error('Ошибка получения волонтеров:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать заявку волонтера
router.post('/', [
    body('name').trim().notEmpty().withMessage('Имя обязательно'),
    body('telegram').optional().trim(),
    body('phone').optional().trim()
], async (req, res) => {
    try {
        await ensureVolunteersTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            name,
            age,
            phone,
            email,
            telegram,
            city,
            activities,
            experience,
            availability
        } = req.body;

        // Проверяем, что activities - это массив
        let activitiesJson = null;
        if (activities) {
            if (Array.isArray(activities)) {
                activitiesJson = JSON.stringify(activities);
            } else {
                console.warn('activities не является массивом:', activities);
                activitiesJson = JSON.stringify([activities]);
            }
        }

        const result = await db.run(
            `INSERT INTO volunteers (name, age, phone, email, telegram, city, activities, experience, availability)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                age || null,
                phone || null,
                email || null,
                telegram || null,
                city || null,
                activitiesJson,
                experience || null,
                availability || null
            ]
        );

        res.status(201).json({
            message: 'Заявка волонтера успешно создана',
            volunteer: {
                id: result.id,
                name
            }
        });
    } catch (error) {
        console.error('Ошибка создания заявки волонтера:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            body: req.body ? {
                name: req.body.name,
                email: req.body.email,
                activitiesCount: req.body.activities ? (Array.isArray(req.body.activities) ? req.body.activities.length : 1) : 0
            } : null
        });
        
        // Проверяем, если это ошибка уникальности
        if (error.code === 'SQLITE_CONSTRAINT_UNIQUE' || error.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ 
                error: 'Данные уже используются',
                message: 'Заявка с такими данными уже существует'
            });
        }
        
        res.status(500).json({ 
            error: 'Ошибка сервера',
            message: error.message || 'Не удалось сохранить заявку волонтера',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

module.exports = router;

