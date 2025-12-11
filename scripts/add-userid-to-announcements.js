const db = require('../config/database');

async function addUserIdColumn() {
    try {
        // Подключаемся к базе данных
        await db.connect();
        
        // Проверяем, существует ли уже колонка
        const tableInfo = await db.all("PRAGMA table_info(announcements)");
        const hasUserId = tableInfo.some(col => col.name === 'userId');
        
        if (!hasUserId) {
            await db.run('ALTER TABLE announcements ADD COLUMN userId INTEGER');
            console.log('✓ Колонка userId успешно добавлена в таблицу announcements');
        } else {
            console.log('✓ Колонка userId уже существует');
        }
        
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('Ошибка добавления колонки userId:', error);
        process.exit(1);
    }
}

addUserIdColumn();

