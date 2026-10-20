const db = require('../config/database');
require('dotenv').config();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

async function initDatabase() {
    try {
        await db.connect();

        // Создание таблиц
        console.log('📦 Создание таблиц...');

        // Пользователи
        await db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                telegram TEXT,
                password TEXT NOT NULL,
                phone TEXT UNIQUE,
                city TEXT,
                address TEXT,
                registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        
        // Добавляем поле telegram если его нет (для существующих БД)
        try {
            await db.run('ALTER TABLE users ADD COLUMN telegram TEXT');
        } catch (e) {
            // Поле уже существует, игнорируем ошибку
        }
        
        // Делаем phone уникальным если еще не уникален
        try {
            await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)');
        } catch (e) {
            // Индекс уже существует, игнорируем ошибку
        }
        
        // Создаем индекс для telegram
        try {
            await db.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram)');
        } catch (e) {
            // Индекс уже существует, игнорируем ошибку
        }

        // Передержки
        await db.run(`
            CREATE TABLE IF NOT EXISTS shelters (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                shelterName TEXT NOT NULL,
                authorizedPerson TEXT,
                address TEXT,
                phone TEXT,
                viber TEXT,
                telegram TEXT,
                website TEXT,
                email TEXT UNIQUE,
                password TEXT NOT NULL,
                agreementAccepted BOOLEAN DEFAULT 0,
                registeredAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Админы
        await db.run(`
            CREATE TABLE IF NOT EXISTS admins (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Животные
        await db.run(`
            CREATE TABLE IF NOT EXISTS pets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                breed TEXT,
                age REAL,
                ageYears INTEGER DEFAULT 0,
                ageMonths INTEGER DEFAULT 0,
                ageCategory TEXT,
                gender TEXT,
                size TEXT,
                color TEXT,
                description TEXT,
                photos TEXT,
                shelterId INTEGER,
                shelterName TEXT,
                adopted BOOLEAN DEFAULT 0,
                adoptedAt DATETIME,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (shelterId) REFERENCES shelters(id)
            )
        `);

        // Заявки на животных
        await db.run(`
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                petId INTEGER NOT NULL,
                userId INTEGER,
                userName TEXT,
                userPhone TEXT,
                userEmail TEXT,
                status TEXT DEFAULT 'новое',
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (petId) REFERENCES pets(id),
                FOREIGN KEY (userId) REFERENCES users(id)
            )
        `);

        // Волонтеры
        await db.run(`
            CREATE TABLE IF NOT EXISTS volunteers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                age INTEGER,
                phone TEXT,
                email TEXT UNIQUE,
                city TEXT,
                activities TEXT,
                experience TEXT,
                availability TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Объявления (потерянные/найденные)
        await db.run(`
            CREATE TABLE IF NOT EXISTS announcements (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                name TEXT,
                type_animal TEXT,
                breed TEXT,
                color TEXT,
                size TEXT,
                location TEXT,
                date DATETIME,
                description TEXT,
                contact TEXT,
                photos TEXT,
                age TEXT,
                gender TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Пожертвования
        await db.run(`
            CREATE TABLE IF NOT EXISTS donations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                amount REAL,
                donorName TEXT,
                donorEmail TEXT,
                donorPhone TEXT,
                message TEXT,
                anonymous BOOLEAN DEFAULT 0,
                paymentId TEXT,
                paymentStatus TEXT DEFAULT 'pending',
                vtbOrderId TEXT,
                date DATETIME DEFAULT CURRENT_TIMESTAMP,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Новости госветслужбы
        await db.run(`
            CREATE TABLE IF NOT EXISTS news (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                source TEXT NOT NULL,
                date TEXT NOT NULL,
                important BOOLEAN DEFAULT 0,
                externalLink TEXT,
                createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ Таблицы созданы');

        // Создание индексов
        console.log('📇 Создание индексов...');
        
        await db.run('CREATE INDEX IF NOT EXISTS idx_pets_type ON pets(type)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_pets_shelterId ON pets(shelterId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_applications_petId ON applications(petId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_applications_userId ON applications(userId)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_announcements_type ON announcements(type)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_news_date ON news(date)');
        await db.run('CREATE INDEX IF NOT EXISTS idx_news_important ON news(important)');

        console.log('✅ Индексы созданы');

        // Создание админа по умолчанию
        // Данные берутся из .env (ADMIN_EMAIL, ADMIN_PASSWORD). Если пароль не задан —
        // генерируется случайный и один раз выводится в консоль.
        const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
        const adminPassword = process.env.ADMIN_PASSWORD || crypto.randomBytes(9).toString('base64url');
        
        const existingAdmin = await db.get('SELECT * FROM admins WHERE email = ?', [adminEmail]);
        
        if (!existingAdmin) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            await db.run(
                'INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
                ['Администратор', adminEmail, hashedPassword]
            );
            console.log('✅ Админ создан:');
            console.log(`   Email: ${adminEmail}`);
            console.log(`   Пароль: ${adminPassword}  ← сохраните его, он больше не будет показан`);
        } else {
            console.log('ℹ️  Админ уже существует');
        }

        // Добавление начальных новостей
        console.log('📰 Добавление начальных новостей...');
        const existingNews = await db.get('SELECT COUNT(*) as count FROM news');
        if (existingNews.count === 0) {
            const initialNews = [
                {
                    title: 'Обязательная вакцинация от бешенства',
                    content: 'Управление ветеринарии Забайкальского края напоминает владельцам собак и кошек о необходимости ежегодной вакцинации от бешенства. Вакцинация проводится бесплатно в государственных ветеринарных клиниках. Прививка обязательна для всех домашних животных старше 3 месяцев.',
                    source: 'Управление ветеринарии Забайкальского края',
                    date: '2024-02-25',
                    important: 1
                },
                {
                    title: 'Эпизоотическая ситуация в регионе',
                    content: 'По данным управления ветеринарии, эпизоотическая ситуация в Забайкальском крае стабильная. Случаев особо опасных заболеваний не зарегистрировано. Владельцам животных рекомендуется соблюдать меры профилактики и своевременно вакцинировать питомцев.',
                    source: 'Управление ветеринарии Забайкальского края',
                    date: '2024-02-20',
                    important: 0
                },
                {
                    title: 'Правила содержания животных в г. Чита',
                    content: 'Администрация города Чита напоминает о правилах содержания домашних животных. Собак необходимо выгуливать на поводке и в наморднике в общественных местах. Владельцы обязаны убирать за своими питомцами. Нарушение правил влечет административную ответственность.',
                    source: 'Администрация г. Чита',
                    date: '2024-02-15',
                    important: 1
                },
                {
                    title: 'Бесплатная стерилизация бездомных животных',
                    content: 'В рамках программы по контролю численности бездомных животных управление ветеринарии проводит бесплатную стерилизацию. Владельцы передержек и волонтеры могут обратиться в государственные ветеринарные клиники для организации массовой стерилизации.',
                    source: 'Управление ветеринарии Забайкальского края',
                    date: '2024-02-10',
                    important: 0
                },
                {
                    title: 'Ветеринарные клиники работают в обычном режиме',
                    content: 'Все государственные ветеринарные клиники в г. Чита работают в обычном режиме. Прием ведется по предварительной записи. Для экстренных случаев доступна круглосуточная служба. Контактные телефоны размещены на официальном сайте управления.',
                    source: 'Управление ветеринарии Забайкальского края',
                    date: '2024-02-05',
                    important: 0
                },
                {
                    title: 'Проверка ветеринарных документов',
                    content: 'Управление ветеринарии информирует о проведении плановых проверок ветеринарных документов у владельцев животных. Убедитесь, что у вашего питомца есть ветеринарный паспорт с актуальными прививками. Отсутствие документов может повлечь административную ответственность.',
                    source: 'Управление ветеринарии Забайкальского края',
                    date: '2024-01-30',
                    important: 1
                }
            ];

            for (const news of initialNews) {
                await db.run(
                    'INSERT INTO news (title, content, source, date, important) VALUES (?, ?, ?, ?, ?)',
                    [news.title, news.content, news.source, news.date, news.important]
                );
            }
            console.log('✅ Начальные новости добавлены');
        } else {
            console.log('ℹ️  Новости уже существуют');
        }

        console.log('✅ База данных инициализирована успешно!');
        
        await db.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Ошибка инициализации базы данных:', error);
        process.exit(1);
    }
}

initDatabase();

