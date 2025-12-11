const db = require('../config/database');

async function addSterilizationColumn() {
    try {
        // Подключаемся к базе данных
        await db.connect();
        
        // Проверяем, существует ли уже колонка
        const tableInfo = await db.all("PRAGMA table_info(pets)");
        const hasSterilization = tableInfo.some(col => col.name === 'sterilizationStatus');
        
        if (!hasSterilization) {
            await db.run('ALTER TABLE pets ADD COLUMN sterilizationStatus TEXT');
            console.log('✓ Колонка sterilizationStatus успешно добавлена в таблицу pets');
        } else {
            console.log('✓ Колонка sterilizationStatus уже существует');
        }
        
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('Ошибка добавления колонки sterilizationStatus:', error);
        process.exit(1);
    }
}

addSterilizationColumn();

