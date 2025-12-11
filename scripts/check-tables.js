const db = require('../config/database');

async function checkTables() {
    try {
        await db.connect();
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        console.log('Таблицы в базе данных:');
        tables.forEach(table => {
            console.log(`  - ${table.name}`);
        });
        await db.close();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

checkTables();

