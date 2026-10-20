const path = require('path');

// ---------------------------------------------------------------------------
// Раздача статики: отдаём ТОЛЬКО файлы фронтенда из корня проекта.
// Всё остальное (database.sqlite, server.js, routes/, config/, ssl/, .env,
// package.json, резервные копии и т.д.) снаружи недоступно.
// ---------------------------------------------------------------------------
const PUBLIC_EXTENSIONS = new Set([
    '.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf'
]);
// Файлы с разрешённым расширением, которые всё равно нельзя отдавать
const PRIVATE_FILES = new Set(['server.js']);

function publicFilesOnly(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path === '/api' || req.path.startsWith('/api/')) return next(); // API обрабатывается роутами
    let pathname;
    try {
        pathname = decodeURIComponent(req.path);
    } catch (e) {
        return res.status(400).end();
    }
    if (pathname === '/') return next(); // index.html
    const name = pathname.replace(/^\/+/, '');
    const isRootFile = name.length > 0 && !name.includes('/') && !name.includes('\\') && !name.startsWith('.');
    const ext = path.extname(name).toLowerCase();
    if (isRootFile && PUBLIC_EXTENSIONS.has(ext) && !PRIVATE_FILES.has(name.toLowerCase())) {
        return next();
    }
    return res.status(404).send('Not found');
}

// ---------------------------------------------------------------------------
// Базовые защитные заголовки (без внешних зависимостей)
// ---------------------------------------------------------------------------
function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.removeHeader('X-Powered-By');
    next();
}

// ---------------------------------------------------------------------------
// Простой ограничитель частоты запросов (в памяти процесса)
// ---------------------------------------------------------------------------
function rateLimit({ windowMs, max, message }) {
    const hits = new Map();
    setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(key);
        }
    }, Math.min(windowMs, 60 * 1000)).unref();

    return (req, res, next) => {
        const key = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
        const now = Date.now();
        let entry = hits.get(key);
        if (!entry || entry.resetAt <= now) {
            entry = { count: 0, resetAt: now + windowMs };
            hits.set(key, entry);
        }
        entry.count += 1;
        if (entry.count > max) {
            res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ error: message || 'Слишком много запросов. Попробуйте позже.' });
        }
        next();
    };
}

module.exports = { publicFilesOnly, securityHeaders, rateLimit };
