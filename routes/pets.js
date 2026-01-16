const express = require('express');
const { body, validationResult, query } = require('express-validator');
const db = require('../config/database');
const { authenticateToken, requireShelter } = require('../middleware/auth');

const router = express.Router();

// Логирование для отладки
console.log('✅ Роуты pets загружены');

// Функция для проверки и создания таблицы pets, если её нет
async function ensurePetsTable() {
    try {
        // Проверяем наличие таблицы pets
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='pets'"
        );

        if (!tableExists) {
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
                    character TEXT,
                    description TEXT,
                    photos TEXT,
                    shelterId INTEGER,
                    shelterName TEXT,
                    adopted BOOLEAN DEFAULT 0,
                    adoptedAt DATETIME,
                    sterilizationStatus TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (shelterId) REFERENCES shelters(id)
                )
            `);
            console.log('✅ Таблица pets создана автоматически');
        } else {
            // Проверяем наличие поля character и добавляем его, если нет
            try {
                const tableInfo = await db.all("PRAGMA table_info(pets)");
                const columnNames = tableInfo.map(col => col.name);
                
                if (!columnNames.includes('character')) {
                    console.log('📦 Добавление колонки character в таблицу pets...');
                    await db.run('ALTER TABLE pets ADD COLUMN character TEXT');
                    console.log('✅ Колонка character добавлена');
                }
                
                if (!columnNames.includes('comments')) {
                    console.log('📦 Добавление колонки comments в таблицу pets...');
                    await db.run('ALTER TABLE pets ADD COLUMN comments TEXT');
                    console.log('✅ Колонка comments добавлена');
                }
                
                if (!columnNames.includes('foundLocation')) {
                    console.log('📦 Добавление колонки foundLocation в таблицу pets...');
                    await db.run('ALTER TABLE pets ADD COLUMN foundLocation TEXT');
                    console.log('✅ Колонка foundLocation добавлена');
                }

                if (!columnNames.includes('sterilizationStatus')) {
                    console.log('📦 Добавление колонки sterilizationStatus в таблицу pets...');
                    await db.run('ALTER TABLE pets ADD COLUMN sterilizationStatus TEXT');
                    console.log('✅ Колонка sterilizationStatus добавлена');
                }
            } catch (error) {
                // Игнорируем ошибку, если колонка уже существует
            }
        }
    } catch (error) {
        console.error('Ошибка создания таблицы pets:', error);
        throw error;
    }
}

// Получить всех питомцев (с фильтрацией)
router.get('/', [
    query('type').optional().isIn(['dog', 'cat', 'all']),
    query('ageCategory').optional().isIn(['young', 'adult', 'senior', 'all']),
    query('gender').optional().isIn(['male', 'female', 'all']),
    query('size').optional().isIn(['small', 'medium', 'large', 'all']),
    query('all').optional()
], async (req, res) => {
    try {
        await ensurePetsTable();
        
        // Если параметр all=true, возвращаем всех питомцев (включая забранных)
        // Иначе возвращаем только непристроенных
        const includeAdopted = req.query.all === 'true';
        let sql = includeAdopted ? 'SELECT * FROM pets' : 'SELECT * FROM pets WHERE adopted = 0';
        const params = [];

        // Фильтры
        if (req.query.type && req.query.type !== 'all') {
            sql += includeAdopted ? ' WHERE type = ?' : ' AND type = ?';
            params.push(req.query.type);
        }
        if (req.query.ageCategory && req.query.ageCategory !== 'all') {
            sql += ' AND ageCategory = ?';
            params.push(req.query.ageCategory);
        }
        if (req.query.gender && req.query.gender !== 'all') {
            sql += ' AND gender = ?';
            params.push(req.query.gender);
        }
        if (req.query.size && req.query.size !== 'all') {
            sql += ' AND size = ?';
            params.push(req.query.size);
        }

        sql += ' ORDER BY createdAt DESC';
        
        // Ограничиваем количество записей для оптимизации (можно увеличить при необходимости)
        const limit = parseInt(req.query.limit) || 1000;
        sql += ` LIMIT ${limit}`;

        const pets = await db.all(sql, params);
        
        // Парсим photos из JSON строки (только первую фотографию для списка, если не запрошены все)
        const includeAllPhotos = req.query.allPhotos === 'true';
        const petsWithParsedPhotos = pets.map(pet => {
            let photos = [];
            if (pet.photos) {
                try {
                    photos = JSON.parse(pet.photos);
                    // Для списка возвращаем только первую фотографию (экономия трафика)
                    if (!includeAllPhotos && photos.length > 0) {
                        photos = [photos[0]];
                    }
                } catch (parseError) {
                    console.warn('Ошибка парсинга photos для питомца', pet.id, parseError);
                    photos = [];
                }
            }
            return {
                ...pet,
                photos: photos
            };
        });

        res.json({ pets: petsWithParsedPhotos });
    } catch (error) {
        console.error('Ошибка получения питомцев:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Получить количество пристроенных животных (публичный endpoint)
router.get('/adopted-count', async (req, res) => {
    try {
        await ensurePetsTable();
        const result = await db.get('SELECT COUNT(*) as count FROM pets WHERE adopted = 1');
        res.json({ count: result ? result.count : 0 });
    } catch (error) {
        console.error('Ошибка получения количества пристроенных животных:', error);
        res.status(500).json({ error: 'Ошибка сервера', count: 0 });
    }
});

// ВАЖНО: Специфичные роуты должны быть ПЕРЕД параметрическим роутом /:id
// Получить питомцев передержки (размещенные, не отданные)
router.get('/shelter/my-pets', authenticateToken, requireShelter, async (req, res) => {
    console.log('📥 Запрос GET /api/pets/shelter/my-pets от пользователя:', req.user?.id);
    try {
        const pets = await db.all(
            'SELECT * FROM pets WHERE shelterId = ? AND adopted = 0 ORDER BY createdAt DESC',
            [req.user.id]
        );
        
        // Парсим photos из JSON строки
        const petsWithParsedPhotos = pets.map(pet => {
            let photos = [];
            if (pet.photos) {
                try {
                    photos = JSON.parse(pet.photos);
                } catch (parseError) {
                    console.warn('Ошибка парсинга photos для питомца', pet.id, parseError);
                    photos = [];
                }
            }
            return {
                ...pet,
                photos: photos
            };
        });

        res.json({ pets: petsWithParsedPhotos });
    } catch (error) {
        console.error('Ошибка получения питомцев передержки:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.id
        });
        res.status(500).json({ 
            error: 'Ошибка сервера',
            message: error.message || 'Не удалось загрузить питомцев'
        });
    }
});

// Получить отданных питомцев передержки
router.get('/shelter/adopted', authenticateToken, requireShelter, async (req, res) => {
    try {
        const pets = await db.all(
            'SELECT * FROM pets WHERE shelterId = ? AND adopted = 1 ORDER BY adoptedAt DESC',
            [req.user.id]
        );
        
        // Парсим photos из JSON строки
        const petsWithParsedPhotos = pets.map(pet => {
            let photos = [];
            if (pet.photos) {
                try {
                    photos = JSON.parse(pet.photos);
                } catch (parseError) {
                    console.warn('Ошибка парсинга photos для питомца', pet.id, parseError);
                    photos = [];
                }
            }
            return {
                ...pet,
                photos: photos
            };
        });

        res.json({ pets: petsWithParsedPhotos });
    } catch (error) {
        console.error('Ошибка получения отданных питомцев:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            userId: req.user?.id
        });
        res.status(500).json({ 
            error: 'Ошибка сервера',
            message: error.message || 'Не удалось загрузить питомцев'
        });
    }
});

// Получить питомца по ID
router.get('/:id', async (req, res) => {
    try {
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        // Парсим photos из JSON строки
        pet.photos = pet.photos ? JSON.parse(pet.photos) : [];

        res.json({ pet });
    } catch (error) {
        console.error('Ошибка получения питомца:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Добавить питомца (только для передержек)
router.post('/', authenticateToken, requireShelter, [
    body('name').trim().notEmpty().withMessage('Имя обязательно'),
    body('type').isIn(['dog', 'cat']).withMessage('Тип должен быть dog или cat'),
    body('gender').isIn(['male', 'female']).withMessage('Пол должен быть male или female'),
    body('size').isIn(['small', 'medium', 'large']).withMessage('Размер должен быть small, medium или large')
], async (req, res) => {
    try {
        await ensurePetsTable();
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const {
            name,
            type,
            breed,
            age,
            ageYears,
            ageMonths,
            ageCategory,
            gender,
            size,
            color,
            character,
            description,
            photos,
            comments,
            foundLocation
        } = req.body;

        // Определяем возрастную категорию если не указана
        let finalAgeCategory = ageCategory;
        if (!finalAgeCategory) {
            const totalAge = ageYears + (ageMonths / 12);
            if (totalAge < 1) {
                finalAgeCategory = 'young';
            } else if (totalAge < 7) {
                finalAgeCategory = 'adult';
            } else {
                finalAgeCategory = 'senior';
            }
        }

        // Получаем информацию о передержке
        const shelter = await db.get('SELECT id, shelterName FROM shelters WHERE id = ?', [req.user.id]);
        
        if (!shelter) {
            console.error('Передержка не найдена для пользователя:', req.user.id);
            return res.status(404).json({ error: 'Передержка не найдена' });
        }
        
        // Проверяем размер фотографий (SQLite TEXT может хранить до ~1GB, но лучше ограничить)
        let photosJson = null;
        if (photos && Array.isArray(photos) && photos.length > 0) {
            try {
                photosJson = JSON.stringify(photos);
                // Проверяем размер (примерно 10MB для всех фотографий)
                if (photosJson.length > 10 * 1024 * 1024) {
                    return res.status(413).json({ 
                        error: 'Размер фотографий слишком большой. Пожалуйста, уменьшите размер или количество фотографий.' 
                    });
                }
            } catch (jsonError) {
                console.error('Ошибка сериализации фотографий:', jsonError);
                return res.status(400).json({ error: 'Неверный формат фотографий' });
            }
        }
        
        const result = await db.run(
            `INSERT INTO pets (name, type, breed, age, ageYears, ageMonths, ageCategory, gender, size, color, character, description, photos, comments, foundLocation, shelterId, shelterName)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name,
                type,
                breed || null,
                age || (ageYears + ageMonths / 12),
                ageYears || 0,
                ageMonths || 0,
                finalAgeCategory,
                gender,
                size,
                color || null,
                character || null,
                description || null,
                photosJson,
                comments || null,
                foundLocation || null,
                shelter.id,
                shelter.shelterName
            ]
        );

        res.status(201).json({
            message: 'Питомец успешно добавлен',
            pet: {
                id: result.id,
                name,
                type,
                shelterName: shelter.shelterName
            }
        });
    } catch (error) {
        console.error('Ошибка добавления питомца:', error);
        console.error('Детали ошибки:', {
            message: error.message,
            stack: error.stack,
            code: error.code,
            body: req.body ? {
                name: req.body.name,
                type: req.body.type,
                photosCount: req.body.photos ? req.body.photos.length : 0
            } : null
        });
        res.status(500).json({ 
            error: 'Ошибка сервера',
            message: error.message || 'Не удалось сохранить питомца в базу данных',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Обновить питомца (только для передержки-владельца)
router.put('/:id', authenticateToken, requireShelter, async (req, res) => {
    try {
        await ensurePetsTable();
        
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        if (pet.shelterId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к этому питомцу' });
        }

        const {
            name,
            breed,
            age,
            ageYears,
            ageMonths,
            ageCategory,
            gender,
            size,
            color,
            character,
            description,
            photos,
            comments,
            foundLocation
        } = req.body;

        await db.run(
            `UPDATE pets SET 
                name = COALESCE(?, name),
                breed = COALESCE(?, breed),
                age = COALESCE(?, age),
                ageYears = COALESCE(?, ageYears),
                ageMonths = COALESCE(?, ageMonths),
                ageCategory = COALESCE(?, ageCategory),
                gender = COALESCE(?, gender),
                size = COALESCE(?, size),
                color = COALESCE(?, color),
                character = COALESCE(?, character),
                description = COALESCE(?, description),
                photos = COALESCE(?, photos),
                comments = COALESCE(?, comments),
                foundLocation = COALESCE(?, foundLocation)
             WHERE id = ?`,
            [
                name, breed, age, ageYears, ageMonths, ageCategory,
                gender, size, color, character, description,
                photos ? JSON.stringify(photos) : null,
                comments, foundLocation,
                req.params.id
            ]
        );

        res.json({ message: 'Питомец обновлен' });
    } catch (error) {
        console.error('Ошибка обновления питомца:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Удалить питомца (только для передержки-владельца)
router.delete('/:id', authenticateToken, requireShelter, async (req, res) => {
    try {
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        if (pet.shelterId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к этому питомцу' });
        }

        await db.run('DELETE FROM pets WHERE id = ?', [req.params.id]);

        res.json({ message: 'Питомец удален' });
    } catch (error) {
        console.error('Ошибка удаления питомца:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обновить статус стерилизации питомца (только для передержки-владельца)
router.patch('/:id/sterilization', authenticateToken, requireShelter, [
    body('sterilizationStatus').isIn(['sterilized', 'will_sterilize', 'under_sterilization']).withMessage('Некорректный статус стерилизации')
], async (req, res) => {
    try {
        await ensurePetsTable(); // гарантируем наличие колонки sterilizationStatus
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        if (pet.shelterId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к этому питомцу' });
        }

        // Проверяем, что питомец отдан
        if (!pet.adopted) {
            return res.status(400).json({ error: 'Можно отметить статус стерилизации только для отданных животных' });
        }

        await db.run(
            'UPDATE pets SET sterilizationStatus = ? WHERE id = ?',
            [req.body.sterilizationStatus, req.params.id]
        );

        res.json({ message: 'Статус стерилизации обновлен' });
    } catch (error) {
        console.error('Ошибка обновления статуса стерилизации:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Изменить статус питомца (отдан/не отдан) - только для передержки-владельца
router.patch('/:id/adopt-status', authenticateToken, requireShelter, [
    body('adopted').isBoolean().withMessage('adopted должен быть boolean')
], async (req, res) => {
    try {
        await ensurePetsTable(); // гарантируем свежую схему перед изменением статусов
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        if (pet.shelterId !== req.user.id) {
            return res.status(403).json({ error: 'Нет доступа к этому питомцу' });
        }

        const { adopted } = req.body;

        if (adopted) {
            // Отмечаем как отданного
            await db.run(
                'UPDATE pets SET adopted = 1, adoptedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [req.params.id]
            );
            res.json({ message: 'Питомец отмечен как отданный' });
        } else {
            // Возвращаем обратно в каталог
            await db.run(
                'UPDATE pets SET adopted = 0, adoptedAt = NULL WHERE id = ?',
                [req.params.id]
            );
            res.json({ message: 'Питомец возвращен в каталог' });
        }
    } catch (error) {
        console.error('Ошибка обновления статуса питомца:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Отметить питомца как забранного (для обратной совместимости)
router.patch('/:id/adopt', authenticateToken, async (req, res) => {
    try {
        const pet = await db.get('SELECT * FROM pets WHERE id = ?', [req.params.id]);
        
        if (!pet) {
            return res.status(404).json({ error: 'Питомец не найден' });
        }

        await db.run(
            'UPDATE pets SET adopted = 1, adoptedAt = CURRENT_TIMESTAMP WHERE id = ?',
            [req.params.id]
        );

        res.json({ message: 'Питомец отмечен как забранный' });
    } catch (error) {
        console.error('Ошибка обновления статуса питомца:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

