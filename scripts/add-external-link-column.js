const db = require('../config/database');

async function addExternalLinkColumn() {
    try {
        await db.connect();
        console.log('📦 Проверка и добавление колонки externalLink в таблицу news...');

        // Проверяем, существует ли таблица
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='news'"
        );

        if (!tableExists) {
            console.log('⚠️  Таблица news не существует. Создайте её сначала через init-db.js');
            await db.close();
            process.exit(1);
        }

        // Проверяем, существует ли колонка externalLink
        const tableInfo = await db.all("PRAGMA table_info(news)");
        const hasExternalLink = tableInfo.some(col => col.name === 'externalLink');

        if (hasExternalLink) {
            console.log('ℹ️  Колонка externalLink уже существует');
        } else {
            // Добавляем колонку
            await db.run('ALTER TABLE news ADD COLUMN externalLink TEXT');
            console.log('✅ Колонка externalLink добавлена в таблицу news');
        }

        await db.close();
        console.log('✅ Миграция завершена успешно!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        await db.close();
        process.exit(1);
    }
}

addExternalLinkColumn();

