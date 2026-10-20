// Переменные окружения загружаем самыми первыми
require('dotenv').config();

// Полифилл для File API (требуется для undici в Node.js 18+)
// Это исправляет ошибку "ReferenceError: File is not defined"
if (typeof global.File === 'undefined' && typeof File === 'undefined') {
    const { ReadableStream } = require('stream/web');
    
    global.File = class File {
        constructor(bits, name, options = {}) {
            this.name = name || '';
            this.lastModified = options.lastModified || Date.now();
            this.size = 0;
            this.type = options.type || '';
            this.bits = bits;
            if (Array.isArray(bits)) {
                this.size = bits.reduce((total, bit) => {
                    if (typeof bit === 'string') return total + bit.length;
                    if (bit instanceof ArrayBuffer) return total + bit.byteLength;
                    if (bit && bit.length) return total + bit.length;
                    return total;
                }, 0);
            }
        }
        stream() {
            return new ReadableStream({
                start: (controller) => {
                    if (Array.isArray(this.bits)) {
                        this.bits.forEach(bit => controller.enqueue(bit));
                    }
                    controller.close();
                }
            });
        }
        async arrayBuffer() {
            return new ArrayBuffer(this.size);
        }
        async text() {
            return '';
        }
        slice(start, end, contentType) {
            return new File([], this.name, { 
                type: contentType || this.type,
                lastModified: this.lastModified 
            });
        }
    };
    
    // Также устанавливаем в глобальную область видимости
    if (typeof globalThis !== 'undefined') {
        globalThis.File = global.File;
    }
}

const express = require('express');
const cors = require('cors');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const cron = require('node-cron');
const db = require('./config/database');
const { syncNews } = require('./scripts/news-parser');
const { publicFilesOnly, securityHeaders, rateLimit } = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 3000;

// Загрузка SSL сертификатов для HTTPS (только если файлы существуют)
let sslOptions = null;
const sslKeyPath = path.join(__dirname, 'ssl/private.key');
const sslCertPath = path.join(__dirname, 'ssl/fullchain.crt');

try {
    if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
        sslOptions = {
            key: fs.readFileSync(sslKeyPath, 'utf8'),
            cert: fs.readFileSync(sslCertPath, 'utf8')
        };
        console.log('✅ SSL сертификаты загружены успешно');
    } else {
        console.warn('⚠️  SSL сертификаты не найдены. HTTPS будет недоступен.');
        console.warn(`   Проверьте наличие файлов: ${sslKeyPath} и ${sslCertPath}`);
    }
} catch (error) {
    console.error('❌ Ошибка при загрузке SSL сертификатов:', error.message);
    console.error('   Приложение будет работать только по HTTP');
}

// Инициализация базы данных
db.connect().catch(err => {
    console.error('Ошибка подключения к базе данных:', err);
    process.exit(1);
});

// Middleware
// За Nginx берём реальный IP клиента из X-Forwarded-For (нужно для ограничения частоты запросов)
app.set('trust proxy', 'loopback');
app.disable('x-powered-by');
app.use(securityHeaders);

// CORS: фронтенд и API работают на одном домене, поэтому чужим сайтам доступ не нужен.
// При необходимости разрешённые адреса можно перечислить в .env: CORS_ORIGINS=https://a.ru,https://b.ru
const corsOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
if (corsOrigins.length > 0) {
    app.use(cors({ origin: corsOrigins }));
} else if (process.env.NODE_ENV !== 'production') {
    app.use(cors());
}
// Увеличиваем лимит размера тела запроса для загрузки фотографий (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статические файлы (фронтенд)
// ВАЖНО: наружу отдаются только файлы фронтенда из корня (html/css/js/картинки),
// база данных, исходники сервера, ssl и .env недоступны
app.use(publicFilesOnly);
app.use(express.static(path.join(__dirname), { dotfiles: 'deny', index: 'index.html' }));

// Ограничение попыток входа и регистрации (защита от подбора паролей)
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: 'Слишком много попыток. Попробуйте через 15 минут.' });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 10, message: 'Слишком много регистраций. Попробуйте позже.' }));
app.use('/api/donations/create-payment', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

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
const donationsRoutes = require('./routes/donations');

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
app.use('/api/donations', donationsRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Неизвестный API-адрес
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Не найдено' });
});

// Общий обработчик ошибок (например, битый JSON или слишком большой запрос)
app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Некорректный JSON в запросе' });
    }
    if (err.type === 'entity.too.large') {
        return res.status(413).json({ error: 'Слишком большой запрос' });
    }
    console.error('Необработанная ошибка:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
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


// Проверка наличия SSL сертификатов
const hasSSLCertificates = sslOptions !== null && 
                           fs.existsSync(sslKeyPath) && 
                           fs.existsSync(sslCertPath);

// Проверка, используется ли Nginx (порт 80 занят)
const checkNginx = () => {
    try {
        const { execSync } = require('child_process');
        const result = execSync('netstat -tlnp 2>/dev/null | grep ":80 " || ss -tlnp 2>/dev/null | grep ":80 " || echo ""', { encoding: 'utf8' });
        return result.includes('nginx');
    } catch (e) {
        return false;
    }
};

// BEHIND_NGINX=true в .env: сайт работает только на внутреннем порту, порты 80/443 занимает Nginx
const nginxInUse = process.env.BEHIND_NGINX === 'true' || checkNginx();

if (hasSSLCertificates && sslOptions && !nginxInUse) {
    // Если Nginx НЕ используется - запускаем HTTPS напрямую
    const httpsServer = https.createServer(sslOptions, app);
    
    httpsServer.listen(443, '0.0.0.0', (err) => {
        if (err) {
            console.error('❌ Ошибка запуска HTTPS сервера:', err.message);
        } else {
            console.log('🔒 HTTPS сервер запущен на порту 443');
            console.log(`📡 API доступен по адресу https://anodruzya.ru/api`);
            console.log(`🌐 Фронтенд доступен по адресу https://anodruzya.ru`);
        }
    });

    const httpServer = http.createServer((req, res) => {
        const host = req.headers.host || 'anodruzya.ru';
        res.writeHead(301, { 'Location': `https://${host}${req.url}` });
        res.end();
    });

    httpServer.listen(80, '0.0.0.0', (err) => {
        if (err) {
            console.error('❌ Ошибка запуска HTTP сервера:', err.message);
        } else {
            console.log('🔄 HTTP сервер запущен на порту 80 (редирект на HTTPS)');
        }
    });

    app.listen(PORT, '127.0.0.1', () => {
        console.log(`🚀 HTTP сервер запущен на порту ${PORT} (для разработки)`);
    });
} else if (nginxInUse) {
    // Если Nginx используется - запускаем только на внутреннем порту
    console.log('✅ Обнаружен Nginx. Запуск в режиме reverse proxy.');
    app.listen(PORT, '127.0.0.1', () => {
        console.log(`🚀 Сервер запущен на порту ${PORT} (для Nginx proxy)`);
        console.log(`📡 Nginx проксирует запросы на http://127.0.0.1:${PORT}`);
        console.log(`🌐 Сайт доступен через Nginx: https://anodruzya.ru`);
    });
} else {
    // Если сертификаты не найдены, запускаем только HTTP
    console.warn('⚠️  SSL сертификаты не найдены. Запуск только HTTP сервера.');
    app.listen(PORT, () => {
        console.log(`🚀 Сервер запущен на порту ${PORT}`);
        console.log(`📡 API доступен по адресу http://localhost:${PORT}/api`);
        console.log(`🌐 Фронтенд доступен по адресу http://localhost:${PORT}`);
    });
}

