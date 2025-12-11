const db = require('../config/database');

async function checkTable() {
    try {
        await db.connect();
        const info = await db.all('PRAGMA table_info(pets)');
        console.log('Колонки в таблице pets:');
        info.forEach(col => {
            console.log(`  ${col.name} (${col.type})`);
        });
        await db.close();
    } catch (error) {
        console.error('Ошибка:', error);
    }
}

checkTable();

