const db = require('../config/database');

// Данные ветклиник для импорта
const clinicsData = [
    { name: "Ветклиника 'Доктор Айболит'", address: "г. Чита, ул. Ленина, д. 15", phone: "+7 (3022) 35-67-89", hours: "Пн-Вс: 9:00 - 21:00", services: "Терапия, хирургия, стоматология, вакцинация" },
    { name: "Ветеринарный центр 'Лапа помощи'", address: "г. Чита, ул. Амурская, д. 42", phone: "+7 (3022) 26-45-78", hours: "Пн-Сб: 8:00 - 20:00", services: "Терапия, диагностика, вакцинация, стерилизация" },
    { name: "Клиника 'ВетМед'", address: "г. Чита, ул. Чкалова, д. 8", phone: "+7 (3022) 31-23-45", hours: "Круглосуточно", services: "Экстренная помощь, терапия, хирургия, реабилитация" },
    { name: "Ветклиника 'ЗооДоктор'", address: "г. Чита, ул. Бабушкина, д. 25", phone: "+7 (3022) 28-56-12", hours: "Пн-Пт: 10:00 - 19:00, Сб-Вс: 10:00 - 17:00", services: "Терапия, вакцинация, чипирование, консультации" },
    { name: "Ветеринарная служба 'Айболит 24'", address: "г. Чита, ул. Ленинградская, д. 33", phone: "+7 (3022) 45-78-90", hours: "Круглосуточно", services: "Экстренная помощь, выезд на дом, терапия, хирургия" }
];

async function addClinicsTable() {
    try {
        await db.connect();
        console.log('📦 Проверка и создание таблицы clinics...');

        // Проверяем, существует ли таблица
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='clinics'"
        );

        if (!tableExists) {
            // Создаем таблицу
            await db.run(`
                CREATE TABLE clinics (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    address TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    hours TEXT NOT NULL,
                    services TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица clinics создана');

            // Импортируем существующие данные
            if (clinicsData && clinicsData.length > 0) {
                console.log(`📥 Импорт ${clinicsData.length} ветклиник...`);
                for (const clinic of clinicsData) {
                    await db.run(`
                        INSERT INTO clinics (name, address, phone, hours, services)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        clinic.name,
                        clinic.address,
                        clinic.phone,
                        clinic.hours,
                        clinic.services || ''
                    ]);
                }
                console.log('✅ Данные ветклиник импортированы');
            }
        } else {
            console.log('ℹ️  Таблица clinics уже существует');
            // Проверяем, есть ли данные
            const count = await db.get('SELECT COUNT(*) as count FROM clinics');
            if (count.count === 0 && clinicsData.length > 0) {
                console.log(`📥 Импорт ${clinicsData.length} ветклиник...`);
                for (const clinic of clinicsData) {
                    await db.run(`
                        INSERT INTO clinics (name, address, phone, hours, services)
                        VALUES (?, ?, ?, ?, ?)
                    `, [
                        clinic.name,
                        clinic.address,
                        clinic.phone,
                        clinic.hours,
                        clinic.services || ''
                    ]);
                }
                console.log('✅ Данные ветклиник импортированы');
            }
        }

        await db.close();
        console.log('✅ Миграция завершена успешно!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка миграции:', error);
        process.exit(1);
    }
}

addClinicsTable();




















