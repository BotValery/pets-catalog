const db = require('../config/database');

async function clearNews() {
    try {
        await db.connect();
        console.log('🗑️  Очистка таблицы news...');
        
        const result = await db.run('DELETE FROM news');
        console.log(`✅ Удалено ${result.changes} записей из таблицы news`);
        
        // Сбрасываем счетчик автоинкремента
        await db.run('DELETE FROM sqlite_sequence WHERE name="news"');
        console.log('✅ Счетчик автоинкремента сброшен');
        
        await db.close();
        console.log('✅ База данных очищена успешно!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка очистки базы данных:', error);
        process.exit(1);
    }
}

clearNews();


















