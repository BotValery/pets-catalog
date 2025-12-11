const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получить все передержки (публичный endpoint)
router.get('/', async (req, res) => {
    try {
        // Возвращаем только публичную информацию о передержках
        const shelters = await db.all(`
            SELECT 
                id,
                shelterName,
                address,
                phone,
                email,
                authorizedPerson,
                viber,
                telegram,
                website,
                registeredAt
            FROM shelters 
            ORDER BY registeredAt DESC
        `);
        res.json({ shelters });
    } catch (error) {
        console.error('Ошибка получения передержек:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить все передержки с полной информацией (только для админа)
router.get('/admin/all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const shelters = await db.all('SELECT * FROM shelters ORDER BY registeredAt DESC');
        res.json({ shelters });
    } catch (error) {
        console.error('Ошибка получения передержек:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить передержку по ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Передержка может видеть только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const shelter = await db.get('SELECT * FROM shelters WHERE id = ?', [req.params.id]);

        if (!shelter) {
            return res.status(404).json({ error: 'Передержка не найдена' });
        }

        res.json({ shelter });
    } catch (error) {
        console.error('Ошибка получения передержки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить передержку
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        // Передержка может обновлять только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const {
            shelterName,
            authorizedPerson,
            address,
            phone,
            viber,
            telegram,
            website
        } = req.body;

        await db.run(
            `UPDATE shelters SET 
                shelterName = COALESCE(?, shelterName),
                authorizedPerson = COALESCE(?, authorizedPerson),
                address = COALESCE(?, address),
                phone = COALESCE(?, phone),
                viber = COALESCE(?, viber),
                telegram = COALESCE(?, telegram),
                website = COALESCE(?, website)
             WHERE id = ?`,
            [shelterName, authorizedPerson, address, phone, viber, telegram, website, req.params.id]
        );

        const updatedShelter = await db.get('SELECT * FROM shelters WHERE id = ?', [req.params.id]);

        res.json({ shelter: updatedShelter, message: 'Профиль обновлен' });
    } catch (error) {
        console.error('Ошибка обновления передержки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

