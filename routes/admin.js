const express = require('express');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const publicRouter = express.Router();

// Все роуты требуют админских прав
router.use(authenticateToken);
router.use(requireAdmin);

// Получить статистику
router.get('/stats', async (req, res) => {
    try {
        // Безопасно получаем статистику, проверяя существование таблиц
        // Whitelist разрешенных имен таблиц для безопасности
        const allowedTables = ['pets', 'users', 'shelters', 'volunteers', 'applications', 'news', 'advice', 'announcements', 'shops', 'clinics'];
        const getCount = async (tableName, whereClause = '') => {
            try {
                // Проверяем, что имя таблицы в whitelist
                if (!allowedTables.includes(tableName)) {
                    console.warn(`Попытка доступа к неразрешенной таблице: ${tableName}`);
                    return 0;
                }
                
                const tableExists = await db.get(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                    [tableName]
                );
                if (!tableExists) return 0;
                
                // Безопасная проверка whereClause (только разрешенные колонки и значения)
                let sql = `SELECT COUNT(*) as count FROM ${tableName}`;
                const params = [];
                
                if (whereClause) {
                    // Разрешенные колонки для фильтрации
                    const allowedColumns = ['adopted', 'id'];
                    const parts = whereClause.split('=');
                    
                    if (parts.length === 2) {
                        const column = parts[0].trim();
                        const value = parts[1].trim();
                        
                        // Проверяем, что колонка разрешена и значение безопасно
                        if (allowedColumns.includes(column) && /^[0-9]+$/.test(value)) {
                            sql += ` WHERE ${column} = ?`;
                            params.push(parseInt(value));
                        }
                    }
                }
                
                const result = await db.get(sql, params);
                return result ? result.count : 0;
            } catch (error) {
                console.error(`Ошибка получения статистики для ${tableName}:`, error);
                return 0;
            }
        };
        
        const stats = {
            totalPets: await getCount('pets'),
            adoptedPets: await getCount('pets', 'adopted = 1'),
            availablePets: await getCount('pets', 'adopted = 0'),
            totalUsers: await getCount('users'),
            totalShelters: await getCount('shelters'),
            totalVolunteers: await getCount('volunteers'),
            totalApplications: await getCount('applications')
        };

        // Преобразуем результаты
        const result = {
            totalPets: stats.totalPets,
            adoptedPets: stats.adoptedPets,
            availablePets: stats.availablePets,
            totalUsers: stats.totalUsers,
            totalShelters: stats.totalShelters,
            totalVolunteers: stats.totalVolunteers,
            totalApplications: stats.totalApplications
        };

        res.json({ stats: result });
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить всех пользователей и передержки
router.get('/users-and-shelters', async (req, res) => {
    try {
        // Проверяем существование таблиц
        const usersTableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        );
        const sheltersTableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='shelters'"
        );
        
        // Если таблицы не существуют, возвращаем пустые массивы
        let users = [];
        let shelters = [];
        
        if (usersTableExists) {
            try {
                // В таблице users нет столбца email, используем telegram как контакт
                users = await db.all(`
                    SELECT 
                        id, 
                        name, 
                        telegram AS email, 
                        phone, 
                        city, 
                        address, 
                        registeredAt 
                    FROM users 
                    ORDER BY registeredAt DESC
                `);
            } catch (error) {
                console.error('Ошибка получения пользователей:', error);
            }
        }
        
        if (sheltersTableExists) {
            try {
                shelters = await db.all('SELECT * FROM shelters ORDER BY registeredAt DESC');
            } catch (error) {
                console.error('Ошибка получения передержек:', error);
            }
        }
        
        res.json({ users, shelters });
    } catch (error) {
        console.error('Ошибка получения пользователей и передержек:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить текст для страницы экстренных ситуаций
router.get('/settings/emergency-text', async (req, res) => {
    try {
        // Проверяем, существует ли таблица settings
        const tableInfo = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
        
        if (tableInfo.length === 0) {
            // Создаем таблицу, если её нет
            await db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);
        }
        
        const setting = await db.get('SELECT value FROM settings WHERE key = ?', ['emergency_text']);
        const text = setting ? setting.value : '';
        
        res.json({ text });
    } catch (error) {
        console.error('Ошибка получения текста:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Сохранить текст для страницы экстренных ситуаций
router.post('/settings/emergency-text', async (req, res) => {
    try {
        const { text } = req.body;
        
        // Проверяем, существует ли таблица settings
        const tableInfo = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
        
        if (tableInfo.length === 0) {
            // Создаем таблицу, если её нет
            await db.run(`CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);
        }
        
        // Сохраняем или обновляем настройку
        await db.run(
            'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            ['emergency_text', text || '']
        );
        
        res.json({ success: true, message: 'Текст успешно сохранен' });
    } catch (error) {
        console.error('Ошибка сохранения текста:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Публичный endpoint для получения текста (без авторизации)
publicRouter.get('/settings/emergency-text', async (req, res) => {
    try {
        const tableInfo = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'");
        
        if (tableInfo.length === 0) {
            return res.json({ text: '' });
        }
        
        const setting = await db.get('SELECT value FROM settings WHERE key = ?', ['emergency_text']);
        const text = setting ? setting.value : '';
        
        res.json({ text });
    } catch (error) {
        console.error('Ошибка получения текста:', error);
        res.json({ text: '' });
    }
});

module.exports = { router, publicRouter };

