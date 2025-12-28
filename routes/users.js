const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Получить всех пользователей (только для админа)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const users = await db.all('SELECT id, name, email, phone, city, address, registeredAt FROM users ORDER BY registeredAt DESC');
        res.json({ users });
    } catch (error) {
        console.error('Ошибка получения пользователей:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить пользователя по ID
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        // Пользователь может видеть только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const user = await db.get(
            'SELECT id, name, telegram, phone, city, address, registeredAt FROM users WHERE id = ?',
            [req.params.id]
        );

        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Ошибка получения пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить пользователя
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        // Пользователь может обновлять только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const { name, telegram, phone, city, address } = req.body;

        // Нормализуем telegram (убираем @ если есть)
        const normalizedTelegram = telegram ? telegram.replace(/^@/, '').trim() : null;

        await db.run(
            'UPDATE users SET name = COALESCE(?, name), telegram = COALESCE(?, telegram), phone = COALESCE(?, phone), city = COALESCE(?, city), address = COALESCE(?, address) WHERE id = ?',
            [name, normalizedTelegram, phone, city, address, req.params.id]
        );

        const updatedUser = await db.get(
            'SELECT id, name, telegram, phone, city, address, registeredAt FROM users WHERE id = ?',
            [req.params.id]
        );

        res.json({ user: updatedUser, message: 'Профиль обновлен' });
    } catch (error) {
        console.error('Ошибка обновления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить пользователя
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Пользователь может удалять только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const userId = parseInt(req.params.id);

        // Проверяем существование пользователя
        const user = await db.get('SELECT id FROM users WHERE id = ?', [userId]);
        if (!user) {
            return res.status(404).json({ error: 'Пользователь не найден' });
        }

        // Удаляем все объявления пользователя
        await db.run('DELETE FROM announcements WHERE userId = ?', [userId]);

        // Удаляем заявки пользователя (если есть)
        await db.run('DELETE FROM applications WHERE userId = ?', [userId]);

        // Удаляем пользователя
        await db.run('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Профиль и все связанные объявления успешно удалены' });
    } catch (error) {
        console.error('Ошибка удаления пользователя:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

