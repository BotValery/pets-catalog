const db = require('../config/database');

async function addCharacterColumn() {
    try {
        // Подключаемся к базе данных
        await db.connect();
        
        // Проверяем, существует ли уже колонка
        const tableInfo = await db.all("PRAGMA table_info(pets)");
        const hasCharacter = tableInfo.some(col => col.name === 'character');
        
        if (!hasCharacter) {
            await db.run('ALTER TABLE pets ADD COLUMN character TEXT');
            console.log('✓ Колонка character успешно добавлена в таблицу pets');
        } else {
            console.log('✓ Колонка character уже существует');
        }
        
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('Ошибка добавления колонки character:', error);
        process.exit(1);
    }
}

addCharacterColumn();

