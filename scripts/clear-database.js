const db = require('../config/database');
const fs = require('fs');
const path = require('path');

async function clearDatabase() {
    try {
        console.log('🗑️  Начало очистки базы данных...');
        
        // Подключаемся к базе данных
        await db.connect();
        
        // Получаем список всех таблиц
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        
        console.log(`📋 Найдено таблиц: ${tables.length}`);
        
        // Очищаем каждую таблицу
        for (const table of tables) {
            const tableName = table.name;
            try {
                await db.run(`DELETE FROM ${tableName}`);
                console.log(`✅ Таблица ${tableName} очищена`);
            } catch (error) {
                console.error(`❌ Ошибка очистки таблицы ${tableName}:`, error.message);
            }
        }
        
        // Закрываем соединение
        await db.close();
        
        console.log('✅ База данных полностью очищена!');
        console.log('📊 Все таблицы пусты, структура сохранена.');
        
    } catch (error) {
        console.error('❌ Ошибка при очистке базы данных:', error);
        process.exit(1);
    }
}

// Запускаем очистку
clearDatabase();

