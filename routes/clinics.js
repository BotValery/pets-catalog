const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Проверка и создание таблицы clinics, если её нет
async function ensureClinicsTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='clinics'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS clinics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    hours TEXT NOT NULL,
                    services TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
    } catch (error) {
        console.error('Ошибка создания таблицы clinics:', error);
        throw error;
    }
}

// Получить все ветклиники
router.get('/', async (req, res) => {
    try {
        await ensureClinicsTable();
        const clinics = await db.all('SELECT * FROM clinics ORDER BY name');
        res.json({ clinics });
    } catch (error) {
        console.error('Ошибка получения ветклиник:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить ветклинику по ID
router.get('/:id', async (req, res) => {
    try {
        await ensureClinicsTable();
        const clinic = await db.get('SELECT * FROM clinics WHERE id = ?', [req.params.id]);
        if (!clinic) {
            return res.status(404).json({ error: 'Ветклиника не найдена' });
        }
        res.json({ clinic });
    } catch (error) {
        console.error('Ошибка получения ветклиники:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать ветклинику (только для админа)
router.post('/', 
    authenticateToken,
    requireAdmin,
    [
        body('name').notEmpty().withMessage('Название обязательно'),
        body('address').notEmpty().withMessage('Адрес обязателен'),
        body('phone').notEmpty().withMessage('Телефон обязателен'),
        body('hours').notEmpty().withMessage('Часы работы обязательны')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            await ensureClinicsTable();
            const result = await db.run(`
                INSERT INTO clinics (name, address, phone, hours, services)
                VALUES (?, ?, ?, ?, ?)
            `, [
                req.body.name,
                req.body.address,
                req.body.phone,
                req.body.hours,
                req.body.services || ''
            ]);

            const clinic = await db.get('SELECT * FROM clinics WHERE id = ?', [result.id]);
            res.status(201).json({ clinic });
        } catch (error) {
            console.error('Ошибка создания ветклиники:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

// Обновить ветклинику (только для админа)
router.put('/:id',
    authenticateToken,
    requireAdmin,
    [
        body('name').notEmpty().withMessage('Название обязательно'),
        body('address').notEmpty().withMessage('Адрес обязателен'),
        body('phone').notEmpty().withMessage('Телефон обязателен'),
        body('hours').notEmpty().withMessage('Часы работы обязательны')
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ errors: errors.array() });
            }

            await ensureClinicsTable();
            await db.run(`
                UPDATE clinics 
                SET name = ?, address = ?, phone = ?, hours = ?, services = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                req.body.name,
                req.body.address,
                req.body.phone,
                req.body.hours,
                req.body.services || '',
                req.params.id
            ]);

            const clinic = await db.get('SELECT * FROM clinics WHERE id = ?', [req.params.id]);
            if (!clinic) {
                return res.status(404).json({ error: 'Ветклиника не найдена' });
            }

            res.json({ clinic });
        } catch (error) {
            console.error('Ошибка обновления ветклиники:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

// Удалить ветклинику (только для админа)
router.delete('/:id',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            await ensureClinicsTable();
            const clinic = await db.get('SELECT * FROM clinics WHERE id = ?', [req.params.id]);
            if (!clinic) {
                return res.status(404).json({ error: 'Ветклиника не найдена' });
            }

            await db.run('DELETE FROM clinics WHERE id = ?', [req.params.id]);
            res.json({ message: 'Ветклиника удалена' });
        } catch (error) {
            console.error('Ошибка удаления ветклиники:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

module.exports = router;






















