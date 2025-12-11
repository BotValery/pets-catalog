const db = require('../config/database');

async function addNewsTable() {
    try {
        await db.connect();
        console.log('📦 Проверка и создание таблицы news...');

        // Проверяем, существует ли таблица
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='news'"
        );

        if (tableExists) {
            console.log('ℹ️  Таблица news уже существует');
        } else {
            // Создаем таблицу
            await db.run(`
                CREATE TABLE news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    date TEXT NOT NULL,
                    important BOOLEAN DEFAULT 0,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица news создана');

            // Создаем индексы
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_date ON news(date)');
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_important ON news(important)');
            console.log('✅ Индексы для таблицы news созданы');
        }

        await db.close();
        console.log('✅ Миграция завершена успешно!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        process.exit(1);
    }
}

addNewsTable();

