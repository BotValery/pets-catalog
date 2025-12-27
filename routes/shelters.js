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

// Удалить передержку
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Передержка может удалять только свой профиль, админ - любой
        if (req.user.type !== 'admin' && req.user.id !== parseInt(req.params.id)) {
            return res.status(403).json({ error: 'Нет доступа' });
        }

        const shelterId = parseInt(req.params.id);

        // Проверяем существование передержки
        const shelter = await db.get('SELECT id FROM shelters WHERE id = ?', [shelterId]);
        if (!shelter) {
            return res.status(404).json({ error: 'Передержка не найдена' });
        }

        // Удаляем все объявления передержки (если таблица существует)
        try {
            const announcementsTable = await db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='announcements'"
            );
            if (announcementsTable) {
                await db.run('DELETE FROM announcements WHERE userId = ?', [shelterId]);
            }
        } catch (error) {
            console.warn('Предупреждение при удалении объявлений:', error.message);
        }

        // Удаляем заявки на питомцев передержки (сначала заявки, потом питомцев)
        try {
            const applicationsTable = await db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='applications'"
            );
            const petsTable = await db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='pets'"
            );
            
            if (applicationsTable && petsTable) {
                // Получаем ID питомцев передержки
                const pets = await db.all('SELECT id FROM pets WHERE shelterId = ?', [shelterId]);
                if (pets.length > 0) {
                    const petIds = pets.map(p => p.id);
                    const placeholders = petIds.map(() => '?').join(',');
                    await db.run(`DELETE FROM applications WHERE petId IN (${placeholders})`, petIds);
                }
            }
        } catch (error) {
            console.warn('Предупреждение при удалении заявок:', error.message);
        }

        // Удаляем всех питомцев передержки
        try {
            const petsTable = await db.get(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='pets'"
            );
            if (petsTable) {
                await db.run('DELETE FROM pets WHERE shelterId = ?', [shelterId]);
            }
        } catch (error) {
            console.warn('Предупреждение при удалении питомцев:', error.message);
        }

        // Удаляем передержку
        await db.run('DELETE FROM shelters WHERE id = ?', [shelterId]);

        res.json({ message: 'Профиль передержки и все связанные объявления и питомцы успешно удалены' });
    } catch (error) {
        console.error('Ошибка удаления передержки:', error);
        res.status(500).json({ error: 'Ошибка сервера', details: error.message });
    }
});

module.exports = router;

