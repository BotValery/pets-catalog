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
                    email TEXT UNIQUE,
                    city TEXT,
                    activities TEXT,
                    experience TEXT,
                    availability TEXT,
                    date DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица volunteers создана автоматически');
        }
    } catch (error) {
        console.error('Ошибка создания таблицы volunteers:', error);
        throw error;
    }
}

// Получить всех волонтеров (для админов и передержек)
router.get('/', authenticateToken, async (req, res) => {
    try {
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
    body('email').optional().isEmail().withMessage('Некорректный email'),
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
            city,
            activities,
            experience,
            availability
        } = req.body;

        const result = await db.run(
            `INSERT INTO volunteers (name, age, phone, email, city, activities, experience, availability)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                age || null,
                phone || null,
                email || null,
                city || null,
                activities ? JSON.stringify(activities) : null,
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
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

