const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireShelter } = require('../middleware/auth');

const router = express.Router();

// Функция для проверки и создания таблицы applications, если её нет
async function ensureApplicationsTable() {
    try {
        // Проверяем наличие таблицы applications
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='applications'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS applications (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    petId INTEGER NOT NULL,
                    userId INTEGER,
                    userName TEXT,
                    userPhone TEXT,
                    userEmail TEXT,
                    status TEXT DEFAULT 'новое',
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (petId) REFERENCES pets(id),
                    FOREIGN KEY (userId) REFERENCES users(id)
                )
            `);
            console.log('✅ Таблица applications создана автоматически');
        }
    } catch (error) {
        console.error('Ошибка создания таблицы applications:', error);
        throw error;
    }
}

// Получить все заявки (для передержек и админов)
router.get('/', authenticateToken, async (req, res) => {
    try {
        await ensureApplicationsTable();
        
        let sql = 'SELECT * FROM applications';
        const params = [];

        // Если это передержка, показываем только заявки на её питомцев
        if (req.user.type === 'shelter') {
            sql += ' WHERE petId IN (SELECT id FROM pets WHERE shelterId = ?)';
            params.push(req.user.id);
        }

        sql += ' ORDER BY createdAt DESC';

        const applications = await db.all(sql, params);

        // Добавляем информацию о питомцах
        for (const app of applications) {
            if (app.petId) {
                app.pet = await db.get('SELECT * FROM pets WHERE id = ?', [app.petId]);
                if (app.pet && app.pet.photos) {
                    app.pet.photos = JSON.parse(app.pet.photos);
                }
            }
        }

        res.json({ applications });
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить заявки на конкретного питомца
router.get('/pet/:petId', async (req, res) => {
    try {
        const applications = await db.all(
            'SELECT * FROM applications WHERE petId = ? ORDER BY createdAt DESC',
            [req.params.petId]
        );

        res.json({ applications });
    } catch (error) {
        console.error('Ошибка получения заявок:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать заявку на питомца
router.post('/', authenticateToken, [
    body('petId').isInt().withMessage('ID питомца обязателен'),
    body('userName').trim().notEmpty().withMessage('Имя обязательно'),
    body('userPhone').trim().notEmpty().withMessage('Телефон обязателен'),
    body('userEmail').optional().trim() // Может быть email или telegram
], async (req, res) => {
    try {
        await ensureApplicationsTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { petId, userName, userPhone, userEmail } = req.body;

        // Проверяем существование питомца
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [petId]);
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        if (pet.adopted) {
            return res.status(400).json({ error: 'Питомец уже забран' });
        }

        // Создаем заявку
        const result = await db.run(
            'INSERT INTO applications (petId, userId, userName, userPhone, userEmail, status) VALUES (?, ?, ?, ?, ?, ?)',
            [petId, req.user.id, userName, userPhone, userEmail, 'новое']
        );

        res.status(201).json({
            message: 'Заявка успешно создана',
            application: {
                id: result.id,
                petId,
                userName,
                status: 'новое'
            }
        });
    } catch (error) {
        console.error('Ошибка создания заявки:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить статус заявки (для передержек)
router.patch('/:id/status', authenticateToken, requireShelter, [
    body('status').isIn(['новое', 'договорились', 'отказались', 'забрали', 'вернули']).withMessage('Некорректный статус')
], async (req, res) => {
    try {
        await ensureApplicationsTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const application = await db.get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
        
        if (!application) {
            return res.status(404).json({ error: 'Заявка не найдена' });
        }

        // Проверяем, что заявка относится к питомцу этой передержки
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [application.petId]);
        if (pet.shelterId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к этой заявке' });
        }

        // Если статус "отказались", удаляем заявку полностью
        if (req.body.status === 'отказались') {
            await db.run('DELETE FROM applications WHERE id = ?', [req.params.id]);
            res.json({ message: 'Заявка удалена' });
            return;
        }

        await db.run('UPDATE applications SET status = ? WHERE id = ?', [req.body.status, req.params.id]);

        // Если статус "забрали", отмечаем питомца как забранного
        if (req.body.status === 'забрали') {
            await db.run(
                'UPDATE pets SET adopted = 1, adoptedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [application.petId]
            );
        }
        
        // Если статус "вернули", возвращаем питомца (снимаем отметку "забрали")
        if (req.body.status === 'вернули') {
            console.log(`🔄 Возвращаем питомца с ID ${application.petId} в каталог`);
            
            // Проверяем текущее состояние питомца
            const petBefore = await db.get('SELECT * FROM pets WHERE id = ?', [application.petId]);
            console.log(`Питомец до обновления:`, { id: petBefore.id, name: petBefore.name, adopted: petBefore.adopted, adoptedAt: petBefore.adoptedAt });
            
            // Обновляем питомца
            const updateResult = await db.run(
                'UPDATE pets SET adopted = 0, adoptedAt = NULL WHERE id = ?',
                [application.petId]
            );
            console.log(`Результат обновления питомца:`, updateResult);
            
            // Проверяем, что питомец действительно обновлен
            const updatedPet = await db.get('SELECT * FROM pets WHERE id = ?', [application.petId]);
            console.log(`✅ Питомец после обновления:`, { 
                id: updatedPet.id, 
                name: updatedPet.name,
                adopted: updatedPet.adopted, 
                adoptedAt: updatedPet.adoptedAt,
                adoptedType: typeof updatedPet.adopted
            });
            
            if (updatedPet.adopted !== 0 && updatedPet.adopted !== false) {
                console.error(`❌ ОШИБКА: Питомец не был возвращен! adopted = ${updatedPet.adopted} (тип: ${typeof updatedPet.adopted})`);
            }
        }

        res.json({ message: 'Статус заявки обновлен' });
    } catch (error) {
        console.error('Ошибка обновления статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

