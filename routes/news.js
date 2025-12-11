const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { syncNews } = require('../scripts/news-parser');

const router = express.Router();

// Проверка и создание таблицы news, если её нет
async function ensureNewsTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='news'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    date TEXT NOT NULL,
                    important BOOLEAN DEFAULT 0,
                    externalLink TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_date ON news(date)');
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_important ON news(important)');
            console.log('✅ Таблица news создана автоматически');
        } else {
            // Проверяем наличие колонки externalLink
            const tableInfo = await db.all("PRAGMA table_info(news)");
            const hasExternalLink = tableInfo.some(col => col.name === 'externalLink');
            
            if (!hasExternalLink) {
                console.log('📦 Добавление колонки externalLink в таблицу news...');
                await db.run('ALTER TABLE news ADD COLUMN externalLink TEXT');
                console.log('✅ Колонка externalLink добавлена');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка создания таблицы news:', error);
        throw error;
    }
}

// Получить все новости
router.get('/', async (req, res) => {
    try {
        // Убеждаемся, что таблица существует
        await ensureNewsTable();
        
        const news = await db.all('SELECT * FROM news ORDER BY date DESC, createdAt DESC');
        res.json({ news });
    } catch (error) {
        console.error('Ошибка получения новостей:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Синхронизация новостей с сайта госветслужбы (только для админов)
// ВАЖНО: Специфичные роуты должны быть ПЕРЕД параметрическими
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔄 Запрос на синхронизацию новостей от админа');
        
        // Запускаем синхронизацию в фоне, чтобы не блокировать ответ
        syncNews()
            .then(result => {
                console.log('✅ Синхронизация завершена:', result);
            })
            .catch(error => {
                console.error('❌ Ошибка синхронизации:', error);
            });
        
        // Возвращаем ответ сразу
        res.json({ 
            message: 'Синхронизация новостей запущена. Результат будет доступен в логах сервера.',
            status: 'processing'
        });
    } catch (error) {
        console.error('Ошибка запуска синхронизации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Синхронизация новостей с ожиданием результата (только для админов)
router.post('/sync-wait', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔄 Запрос на синхронизацию новостей с ожиданием результата');
        
        const result = await syncNews();
        
        if (result.success) {
            res.json({
                message: result.message,
                saved: result.saved,
                skipped: result.skipped,
                total: result.total
            });
        } else {
            res.status(500).json({
                error: result.message,
                saved: result.saved,
                skipped: result.skipped
            });
        }
    } catch (error) {
        console.error('Ошибка синхронизации:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Принудительное обновление контента всех новостей (только для админов)
router.post('/update-content', authenticateToken, requireAdmin, async (req, res) => {
    try {
        console.log('🔄 Запрос на принудительное обновление контента новостей');
        
        const { parseNewsFromGosvet } = require('../scripts/news-parser');
        
        // Получаем все новости с сайта
        const newsItems = await parseNewsFromGosvet();
        
        if (newsItems.length === 0) {
            return res.json({
                message: 'Новости не найдены',
                updated: 0,
                total: 0
            });
        }
        
        // Обновляем контент для всех новостей
        let updatedCount = 0;
        await ensureNewsTable();
        
        for (const news of newsItems) {
            const existing = await db.get(
                'SELECT id, content FROM news WHERE title = ? AND date = ?',
                [news.title, news.date]
            );
            
            if (existing) {
                // Обновляем контент, если новый длиннее или текущий слишком короткий
                if (news.content.length > existing.content.length || 
                    existing.content === news.title || 
                    existing.content.length < 50 ||
                    (existing.content.length < 100 && news.content.length > 100)) {
                    await db.run(
                        'UPDATE news SET content = ?, externalLink = ? WHERE id = ?',
                        [news.content, news.externalLink || null, existing.id]
                    );
                    updatedCount++;
                    console.log(`✅ Обновлен контент: ${news.title.substring(0, 50)}...`);
                }
            }
        }
        
        res.json({
            message: `Обновлено новостей: ${updatedCount} из ${newsItems.length}`,
            updated: updatedCount,
            total: newsItems.length
        });
    } catch (error) {
        console.error('Ошибка обновления контента:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Создать новость (только для админов)
router.post('/', authenticateToken, requireAdmin, [
    body('title').trim().notEmpty().withMessage('Заголовок обязателен'),
    body('content').trim().notEmpty().withMessage('Содержание обязательно'),
    body('source').trim().notEmpty().withMessage('Источник обязателен'),
    body('date').trim().notEmpty().withMessage('Дата обязательна')
], async (req, res) => {
    try {
        await ensureNewsTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { title, content, source, date, important } = req.body;

        const result = await db.run(
            'INSERT INTO news (title, content, source, date, important) VALUES (?, ?, ?, ?, ?)',
            [title, content, source, date, important ? 1 : 0]
        );

        const news = await db.get('SELECT * FROM news WHERE id = ?', [result.id]);

        res.status(201).json({
            message: 'Новость успешно создана',
            news
        });
    } catch (error) {
        console.error('Ошибка создания новости:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

// Обновить новость (только для админов)
router.put('/:id', authenticateToken, requireAdmin, [
    body('title').optional().trim().notEmpty().withMessage('Заголовок не может быть пустым'),
    body('content').optional().trim().notEmpty().withMessage('Содержание не может быть пустым'),
    body('source').optional().trim().notEmpty().withMessage('Источник не может быть пустым')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const news = await db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'Новость не найдена' });
        }

        const { title, content, source, date, important } = req.body;

        await db.run(
            'UPDATE news SET title = ?, content = ?, source = ?, date = ?, important = ? WHERE id = ?',
            [
                title || news.title,
                content || news.content,
                source || news.source,
                date || news.date,
                important !== undefined ? (important ? 1 : 0) : news.important,
                req.params.id
            ]
        );

        const updatedNews = await db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);

        res.json({
            message: 'Новость успешно обновлена',
            news: updatedNews
        });
    } catch (error) {
        console.error('Ошибка обновления новости:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить новость (только для админов)
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const news = await db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'Новость не найдена' });
        }

        await db.run('DELETE FROM news WHERE id = ?', [req.params.id]);

        res.json({ message: 'Новость успешно удалена' });
    } catch (error) {
        console.error('Ошибка удаления новости:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить новость по ID (должен быть после специфичных роутов)
router.get('/:id', async (req, res) => {
    try {
        await ensureNewsTable();
        const news = await db.get('SELECT * FROM news WHERE id = ?', [req.params.id]);
        if (!news) {
            return res.status(404).json({ error: 'Новость не найдена' });
        }
        res.json({ news });
    } catch (error) {
        console.error('Ошибка получения новости:', error);
        res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
    }
});

module.exports = router;

