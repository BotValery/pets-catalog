const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Безопасный разбор JSON-массива (битые данные в БД не должны ронять запрос)
function parseJsonArray(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Является ли текущий пользователь автором объявления (или админом).
// Id пользователей и передержек из разных таблиц могут совпадать, поэтому сверяем и тип автора.
function canManageAnnouncement(req, announcement) {
    if (req.user.type === 'admin') return true;
    if (announcement.userId === null || announcement.userId === undefined) return false;
    if (announcement.userType && announcement.userType !== req.user.type) return false;
    return Number(announcement.userId) === Number(req.user.id);
}

// Функция для проверки и создания таблицы announcements, если её нет
async function ensureAnnouncementsTable() {
    try {
        // Проверяем наличие таблицы announcements
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='announcements'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS announcements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,
                    name TEXT,
                    type_animal TEXT,
                    breed TEXT,
                    color TEXT,
                    size TEXT,
                    location TEXT,
                    date TEXT,
                    description TEXT,
                    contact TEXT,
                    photos TEXT,
                    age TEXT,
                    gender TEXT,
                    userId INTEGER,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица announcements создана автоматически');
        } else {
            // Проверяем наличие поля userId и добавляем его, если нет
            try {
                const tableInfo = await db.all("PRAGMA table_info(announcements)");
                const columnNames = tableInfo.map(col => col.name);
                
                if (!columnNames.includes('userId')) {
                    console.log('📦 Добавление колонки userId в таблицу announcements...');
                    await db.run('ALTER TABLE announcements ADD COLUMN userId INTEGER');
                    console.log('✅ Колонка userId добавлена');
                }
            } catch (error) {
                // Игнорируем ошибку, если колонка уже существует
            }
        }
    } catch (error) {
        console.error('Ошибка создания таблицы announcements:', error);
        throw error;
    }
}

// Функция для проверки и добавления полей age и gender в таблицу announcements
async function ensureAnnouncementsColumns() {
    try {
        // Сначала убеждаемся, что таблица существует
        await ensureAnnouncementsTable();
        
        const tableInfo = await db.all("PRAGMA table_info(announcements)");
        const columnNames = tableInfo.map(col => col.name);
        
        if (!columnNames.includes('age')) {
            console.log('📦 Добавление колонки age в таблицу announcements...');
            await db.run('ALTER TABLE announcements ADD COLUMN age TEXT');
            console.log('✅ Колонка age добавлена');
        }
        
        if (!columnNames.includes('gender')) {
            console.log('📦 Добавление колонки gender в таблицу announcements...');
            await db.run('ALTER TABLE announcements ADD COLUMN gender TEXT');
            console.log('✅ Колонка gender добавлена');
        }
        
        if (!columnNames.includes('userType')) {
            console.log('📦 Добавление колонки userType в таблицу announcements...');
            await db.run('ALTER TABLE announcements ADD COLUMN userType TEXT');
            console.log('✅ Колонка userType добавлена');
        }

        if (!columnNames.includes('resolved')) {
            console.log('📦 Добавление колонки resolved в таблицу announcements...');
            await db.run('ALTER TABLE announcements ADD COLUMN resolved BOOLEAN DEFAULT 0');
            console.log('✅ Колонка resolved добавлена');
        }
    } catch (error) {
        console.error('❌ Ошибка проверки колонок announcements:', error);
        // Не бросаем ошибку, чтобы не ломать работу API
    }
}

// Получить все объявления
router.get('/', async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const type = req.query.type; // 'lost' или 'found'
        
        let sql = 'SELECT * FROM announcements';
        const params = [];

        if (type) {
            sql += ' WHERE type = ? AND (resolved IS NULL OR resolved = 0)';
            params.push(type);
        } else {
            sql += ' WHERE (resolved IS NULL OR resolved = 0)';
        }

        sql += ' ORDER BY createdAt DESC';

        const announcements = await db.all(sql, params);
        
        // Парсим photos из JSON строки и убеждаемся, что userId есть
        const announcementsWithParsedPhotos = announcements.map(ann => ({
            ...ann,
            photos: parseJsonArray(ann.photos),
            userId: ann.userId || null // Явно устанавливаем null если userId отсутствует
        }));

        res.json({ announcements: announcementsWithParsedPhotos });
    } catch (error) {
        console.error('Ошибка получения объявлений:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать объявление
router.post('/', authenticateToken, [
    body('type').isIn(['lost', 'found']).withMessage('Тип должен быть lost или found'),
    body('name').optional().trim(),
    body('type_animal').optional().trim()
], async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            type,
            name,
            type_animal,
            breed,
            color,
            size,
            location,
            date,
            description,
            contact,
            photos,
            age,
            gender
        } = req.body;

        const result = await db.run(
            `INSERT INTO announcements (type, name, type_animal, breed, color, size, location, date, description, contact, photos, age, gender, userId, userType)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                type,
                name || null,
                type_animal || null,
                breed || null,
                color || null,
                size || null,
                location || null,
                date || null,
                description || null,
                contact || null,
                photos ? JSON.stringify(photos) : null,
                age || null,
                gender || null,
                req.user.id,
                req.user.type
            ]
        );

        res.status(201).json({
            message: 'Объявление успешно создано',
            announcement: {
                id: result.id,
                type
            }
        });
    } catch (error) {
        console.error('Ошибка создания объявления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить объявление по ID
router.get('/:id', async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }
        
        // Парсим photos из JSON строки и убеждаемся, что userId есть
        announcement.photos = parseJsonArray(announcement.photos);
        announcement.userId = announcement.userId || null; // Явно устанавливаем null если userId отсутствует
        
        res.json({ announcement });
    } catch (error) {
        console.error('Ошибка получения объявления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить объявление (только для автора)
router.put('/:id', authenticateToken, [
    body('type').optional().isIn(['lost', 'found']).withMessage('Тип должен быть lost или found')
], async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }

        // Проверяем, что пользователь является автором объявления
        // Если userId не существует (старые записи), разрешаем редактирование только админам
        if (!canManageAnnouncement(req, announcement)) {
            return res.status(403).json({ error: 'Нет доступа к этому объявлению' });
        }

        const {
            name,
            type_animal,
            breed,
            color,
            size,
            location,
            date,
            description,
            contact,
            photos,
            age,
            gender
        } = req.body;

        await db.run(
            `UPDATE announcements SET 
                name = COALESCE(?, name),
                type_animal = COALESCE(?, type_animal),
                breed = COALESCE(?, breed),
                color = COALESCE(?, color),
                size = COALESCE(?, size),
                location = COALESCE(?, location),
                date = COALESCE(?, date),
                description = COALESCE(?, description),
                contact = COALESCE(?, contact),
                photos = COALESCE(?, photos),
                age = COALESCE(?, age),
                gender = COALESCE(?, gender)
             WHERE id = ?`,
            [
                name, type_animal, breed, color, size, location, date,
                description, contact,
                photos ? JSON.stringify(photos) : null,
                age, gender,
                req.params.id
            ]
        );

        const updatedAnnouncement = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        updatedAnnouncement.photos = parseJsonArray(updatedAnnouncement.photos);

        res.json({ 
            message: 'Объявление обновлено',
            announcement: updatedAnnouncement
        });
    } catch (error) {
        console.error('Ошибка обновления объявления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить объявление (только для автора)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }

        // Проверяем, что пользователь является автором объявления
        // Если userId не существует (старые записи), разрешаем удаление только админам
        if (!canManageAnnouncement(req, announcement)) {
            return res.status(403).json({ error: 'Нет доступа к этому объявлению' });
        }

        await db.run('DELETE FROM announcements WHERE id = ?', [req.params.id]);

        res.json({ message: 'Объявление удалено' });
    } catch (error) {
        console.error('Ошибка удаления объявления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отметить объявление как найденное/вернутое
router.patch('/:id/resolve', authenticateToken, async (req, res) => {
    try {
        await ensureAnnouncementsColumns();
        
        const announcement = await db.get('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
        
        if (!announcement) {
            return res.status(404).json({ error: 'Объявление не найдено' });
        }

        // Проверяем, что пользователь является автором объявления
        if (!canManageAnnouncement(req, announcement)) {
            return res.status(403).json({ error: 'Нет доступа к этому объявлению' });
        }

        // Отмечаем объявление как решенное
        await db.run('UPDATE announcements SET resolved = 1 WHERE id = ?', [req.params.id]);

        res.json({ 
            message: announcement.type === 'lost' ? 'Объявление отмечено как найденное' : 'Объявление отмечено как возвращенное',
            announcement: {
                id: announcement.id,
                type: announcement.type,
                resolved: true
            }
        });
    } catch (error) {
        console.error('Ошибка отметки объявления:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

