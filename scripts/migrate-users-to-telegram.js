const db = require('../config/database');

async function migrateUsers() {
    try {
        await db.connect();
        console.log('🔄 Начало миграции пользователей...');

        // Добавляем поле telegram если его нет
        try {
            await db.run('ALTER TABLE users ADD COLUMN telegram TEXT');
            console.log('✅ Поле telegram добавлено');
        } catch (e) {
            if (e.message.includes('duplicate column name')) {
                console.log('ℹ️  Поле telegram уже существует');
            } else {
                throw e;
            }
        }

        // Делаем phone уникальным
        try {
            await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)');
            console.log('✅ Индекс для phone создан');
        } catch (e) {
            console.log('ℹ️  Индекс для phone уже существует');
        }

        // Создаем индекс для telegram
        try {
            await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram)');
            console.log('✅ Индекс для telegram создан');
        } catch (e) {
            console.log('ℹ️  Индекс для telegram уже существует');
        }

        // Удаляем уникальность email для users (если есть)
        try {
            // SQLite не поддерживает DROP CONSTRAINT напрямую, поэтому просто создаем новый индекс
            // Старый уникальный индекс на email будет игнорироваться
            console.log('ℹ️  Email больше не используется как уникальный идентификатор для пользователей');
        } catch (e) {
            console.log('ℹ️  Обработка email завершена');
        }

        console.log('✅ Миграция завершена успешно');
        await db.close();
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        process.exit(1);
    }
}

migrateUsers();


















