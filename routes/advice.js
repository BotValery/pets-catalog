const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Проверка и создание таблицы advice, если её нет
async function ensureAdviceTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='advice'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS advice (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    date TEXT NOT NULL,
                    category TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tips TEXT NOT NULL,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.run('CREATE INDEX IF NOT EXISTS idx_advice_date ON advice(date)');
            await db.run('CREATE INDEX IF NOT EXISTS idx_advice_category ON advice(category)');
            console.log('✅ Таблица advice создана автоматически');
        }
    } catch (error) {
        console.error('❌ Ошибка создания таблицы advice:', error);
        throw error;
    }
}

// Получить все советы
router.get('/', async (req, res) => {
    try {
        await ensureAdviceTable();
        
        const advice = await db.all('SELECT * FROM advice ORDER BY date DESC, createdAt DESC');
        
        // Парсим tips из JSON строки
        const adviceWithParsedTips = advice.map(item => {
            let tips = [];
            if (item.tips) {
                try {
                    tips = JSON.parse(item.tips);
                } catch (parseError) {
                    console.warn('Ошибка парсинга tips для совета', item.id, parseError);
                    tips = [];
                }
            }
            return {
                ...item,
                tips: tips
            };
        });
        
        res.json({ advice: adviceWithParsedTips });
    } catch (error) {
        console.error('Ошибка получения советов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить один совет по ID
router.get('/:id', async (req, res) => {
    try {
        await ensureAdviceTable();
        
        const advice = await db.get('SELECT * FROM advice WHERE id = ?', [req.params.id]);
        
        if (!advice) {
            return res.status(404).json({ error: 'Совет не найден' });
        }
        
        // Парсим tips из JSON строки
        let tips = [];
        if (advice.tips) {
            try {
                tips = JSON.parse(advice.tips);
            } catch (parseError) {
                console.warn('Ошибка парсинга tips для совета', advice.id, parseError);
                tips = [];
            }
        }
        
        res.json({ advice: { ...advice, tips: tips } });
    } catch (error) {
        console.error('Ошибка получения совета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать совет (только для админов)
router.post('/', authenticateToken, requireAdmin, [
    body('title').trim().notEmpty().withMessage('Заголовок обязателен'),
    body('author').trim().notEmpty().withMessage('Автор обязателен'),
    body('date').trim().notEmpty().withMessage('Дата обязательна'),
    body('category').trim().notEmpty().withMessage('Категория обязательна'),
    body('content').trim().notEmpty().withMessage('Содержание обязательно'),
    body('tips').isArray().withMessage('Советы должны быть массивом')
], async (req, res) => {
    try {
        await ensureAdviceTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, author, date, category, content, tips } = req.body;
        
        // Преобразуем массив tips в JSON строку
        const tipsJson = JSON.stringify(tips || []);

        const result = await db.run(
            'INSERT INTO advice (title, author, date, category, content, tips) VALUES (?, ?, ?, ?, ?, ?)',
            [title, author, date, category, content, tipsJson]
        );

        // Получаем ID созданного совета
        const adviceId = result.id || result.lastID;
        if (!adviceId) {
            throw new Error('Не удалось получить ID созданного совета');
        }

        const newAdvice = await db.get('SELECT * FROM advice WHERE id = ?', [adviceId]);
        if (!newAdvice) {
            throw new Error('Не удалось получить созданный совет из базы данных');
        }
        
        // Парсим tips из JSON строки
        let parsedTips = [];
        if (newAdvice.tips) {
            try {
                parsedTips = JSON.parse(newAdvice.tips);
            } catch (parseError) {
                console.warn('Ошибка парсинга tips для нового совета', newAdvice.id, parseError);
                parsedTips = [];
            }
        }

        res.status(201).json({
            message: 'Совет успешно создан',
            advice: { ...newAdvice, tips: parsedTips }
        });
    } catch (error) {
        console.error('Ошибка создания совета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить совет (только для админов)
router.put('/:id', authenticateToken, requireAdmin, [
    body('title').optional().trim().notEmpty().withMessage('Заголовок не может быть пустым'),
    body('author').optional().trim().notEmpty().withMessage('Автор не может быть пустым'),
    body('category').optional().trim().notEmpty().withMessage('Категория не может быть пустой'),
    body('content').optional().trim().notEmpty().withMessage('Содержание не может быть пустым'),
    body('tips').optional().isArray().withMessage('Советы должны быть массивом')
], async (req, res) => {
    try {
        await ensureAdviceTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const advice = await db.get('SELECT * FROM advice WHERE id = ?', [req.params.id]);
        if (!advice) {
            return res.status(404).json({ error: 'Совет не найден' });
        }

        const { title, author, date, category, content, tips } = req.body;
        
        // Если tips передан, преобразуем в JSON строку
        let tipsJson = advice.tips;
        if (tips !== undefined) {
            tipsJson = JSON.stringify(tips || []);
        }

        await db.run(
            'UPDATE advice SET title = ?, author = ?, date = ?, category = ?, content = ?, tips = ? WHERE id = ?',
            [
                title || advice.title,
                author || advice.author,
                date || advice.date,
                category || advice.category,
                content || advice.content,
                tipsJson,
                req.params.id
            ]
        );

        const updatedAdvice = await db.get('SELECT * FROM advice WHERE id = ?', [req.params.id]);
        if (!updatedAdvice) {
            return res.status(404).json({ error: 'Совет не найден после обновления' });
        }
        
        // Парсим tips из JSON строки
        let parsedTips = [];
        if (updatedAdvice.tips) {
            try {
                parsedTips = JSON.parse(updatedAdvice.tips);
            } catch (parseError) {
                console.warn('Ошибка парсинга tips для обновленного совета', updatedAdvice.id, parseError);
                parsedTips = [];
            }
        }

        res.json({
            message: 'Совет успешно обновлен',
            advice: { ...updatedAdvice, tips: parsedTips }
        });
    } catch (error) {
        console.error('Ошибка обновления совета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить совет (только для админов)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await ensureAdviceTable();
        
        const advice = await db.get('SELECT * FROM advice WHERE id = ?', [req.params.id]);
        if (!advice) {
            return res.status(404).json({ error: 'Совет не найден' });
        }

        await db.run('DELETE FROM advice WHERE id = ?', [req.params.id]);

        res.json({ message: 'Совет успешно удален' });
    } catch (error) {
        console.error('Ошибка удаления совета:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;










