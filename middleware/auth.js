const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Без секрета любой может подделать токен входа, поэтому сервер не запускается
if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET не задан в .env (или короче 16 символов). Запуск сервера невозможен.');
}

// Срок входа и «скользящее» продление:
// вход действует TOKEN_TTL; если токену больше RENEW_AFTER_SEC, сервер в ответ на любой
// запрос с авторизацией выдаёт новый токен в заголовке X-Auth-Token (фронтенд его сохраняет).
// Итог: пока человек пользуется сайтом, выходить не нужно; выход — только после 30 дней без визитов.
const TOKEN_TTL = '30d';
const RENEW_AFTER_SEC = 24 * 60 * 60;

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Требуется вход в аккаунт', code: 'AUTH_REQUIRED' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // 401 — вход недействителен (истёк или подделан); фронтенд по нему сбрасывает вход
            return res.status(401).json({
                error: err.name === 'TokenExpiredError' ? 'Сессия истекла. Войдите снова.' : 'Сессия недействительна. Войдите снова.',
                code: 'AUTH_EXPIRED'
            });
        }
        req.user = user;
        if (user.iat && Date.now() / 1000 - user.iat > RENEW_AFTER_SEC) {
            const { iat, exp, ...payload } = user;
            res.setHeader('X-Auth-Token', signToken(payload));
        }
        next();
    });
};

// Middleware для проверки роли админа
const requireAdmin = (req, res, next) => {
    if (req.user.type !== 'admin') {
        return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
};

// Middleware для проверки роли передержки
const requireShelter = (req, res, next) => {
    if (req.user.type !== 'shelter') {
        return res.status(403).json({ error: 'Требуются права передержки' });
    }
    next();
};

// Middleware для проверки роли пользователя или передержки
const requireUserOrShelter = (req, res, next) => {
    if (req.user.type !== 'user' && req.user.type !== 'shelter') {
        return res.status(403).json({ error: 'Требуются права пользователя или передержки' });
    }
    next();
};

// Проверка «это его собственный профиль»: совпадает и id, и тип аккаунта.
// Id пользователей, передержек и админов — из разных таблиц и могут совпадать.
const isSelf = (req, type, id) => req.user.type === type && Number(req.user.id) === Number(id);

module.exports = {
    signToken,
    TOKEN_TTL,
    isSelf,
    authenticateToken,
    requireAdmin,
    requireShelter,
    requireUserOrShelter,
    JWT_SECRET
};

