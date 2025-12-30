const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Проверка и создание таблицы shops, если её нет
async function ensureShopsTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='shops'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS shops (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    hours TEXT NOT NULL,
                    description TEXT,
                    products TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
        }
    } catch (error) {
        console.error('Ошибка создания таблицы shops:', error);
        throw error;
    }
}

// Получить все зоомагазины
router.get('/', async (req, res) => {
    try {
        await ensureShopsTable();
        const shops = await db.all('SELECT * FROM shops ORDER BY name');
        res.json({ shops });
    } catch (error) {
        console.error('Ошибка получения зоомагазинов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить зоомагазин по ID
router.get('/:id', async (req, res) => {
    try {
        await ensureShopsTable();
        const shop = await db.get('SELECT * FROM shops WHERE id = ?', [req.params.id]);
        if (!shop) {
            return res.status(404).json({ error: 'Зоомагазин не найден' });
        }
        res.json({ shop });
    } catch (error) {
        console.error('Ошибка получения зоомагазина:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать зоомагазин (только для админа)
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

            await ensureShopsTable();
            const result = await db.run(`
                INSERT INTO shops (name, address, phone, hours, description, products)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                req.body.name,
                req.body.address,
                req.body.phone,
                req.body.hours,
                req.body.description || '',
                req.body.products || ''
            ]);

            const shop = await db.get('SELECT * FROM shops WHERE id = ?', [result.id]);
            res.status(201).json({ shop });
        } catch (error) {
            console.error('Ошибка создания зоомагазина:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

// Обновить зоомагазин (только для админа)
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

            await ensureShopsTable();
            await db.run(`
                UPDATE shops 
                SET name = ?, address = ?, phone = ?, hours = ?, description = ?, products = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                req.body.name,
                req.body.address,
                req.body.phone,
                req.body.hours,
                req.body.description || '',
                req.body.products || '',
                req.params.id
            ]);

            const shop = await db.get('SELECT * FROM shops WHERE id = ?', [req.params.id]);
            if (!shop) {
                return res.status(404).json({ error: 'Зоомагазин не найден' });
            }

            res.json({ shop });
        } catch (error) {
            console.error('Ошибка обновления зоомагазина:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

// Удалить зоомагазин (только для админа)
router.delete('/:id',
    authenticateToken,
    requireAdmin,
    async (req, res) => {
        try {
            await ensureShopsTable();
            const shop = await db.get('SELECT * FROM shops WHERE id = ?', [req.params.id]);
            if (!shop) {
                return res.status(404).json({ error: 'Зоомагазин не найден' });
            }

            await db.run('DELETE FROM shops WHERE id = ?', [req.params.id]);
            res.json({ message: 'Зоомагазин удален' });
        } catch (error) {
            console.error('Ошибка удаления зоомагазина:', error);
            res.status(500).json({ error: 'Ошибка сервера' });
        }
    }
);

module.exports = router;




















