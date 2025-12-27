const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./config/database');
const { syncNews } = require('./scripts/news-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Инициализация базы данных
db.connect().catch(err => {
    console.error('Ошибка подключения к базе данных:', err);
    process.exit(1);
});

// Middleware
app.use(cors());
// Увеличиваем лимит размера тела запроса для загрузки фотографий (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы (фронтенд)
app.use(express.static(path.join(__dirname)));

// Импорт роутов
const authRoutes = require('./routes/auth');
const petsRoutes = require('./routes/pets');
const usersRoutes = require('./routes/users');
const sheltersRoutes = require('./routes/shelters');
const applicationsRoutes = require('./routes/applications');
const volunteersRoutes = require('./routes/volunteers');
const announcementsRoutes = require('./routes/announcements');
const newsRoutes = require('./routes/news');
const adviceRoutes = require('./routes/advice');
const adminRoutes = require('./routes/admin');
const shopsRoutes = require('./routes/shops');
const clinicsRoutes = require('./routes/clinics');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/pets', petsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/shelters', sheltersRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/volunteers', volunteersRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/advice', adviceRoutes);
app.use('/api/admin', adminRoutes.router);
app.use('/api', adminRoutes.publicRouter); // Публичные роуты админки (настройки)
app.use('/api/shops', shopsRoutes);
app.use('/api/clinics', clinicsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Автоматическая синхронизация новостей
// Запускается каждый день в 6:00 утра
cron.schedule('0 6 * * *', async () => {
    try {
        await syncNews();
    } catch (error) {
        console.error('❌ Ошибка автоматической синхронизации:', error);
    }
}, {
    scheduled: true,
    timezone: "Asia/Chita"
});

// Также можно запускать каждые 12 часов (в 6:00 и 18:00)
// Раскомментируйте, если нужно более частое обновление:
// cron.schedule('0 6,18 * * *', async () => { ... });


// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на порту ${PORT}`);
    console.log(`📡 API доступен по адресу http://localhost:${PORT}/api`);
    console.log(`🌐 Фронтенд доступен по адресу http://localhost:${PORT}`);
});

