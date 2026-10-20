const jwt = require('jsonwebtoken');

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;

// Без секрета любой может подделать токен входа, поэтому сервер не запускается
if (!JWT_SECRET || JWT_SECRET.length < 16) {
    throw new Error('JWT_SECRET не задан в .env (или короче 16 символов). Запуск сервера невозможен.');
}

// Middleware для проверки JWT токена
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({ error: 'Токен доступа отсутствует' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Недействительный токен' });
        }
        req.user = user;
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
    isSelf,
    authenticateToken,
    requireAdmin,
    requireShelter,
    requireUserOrShelter,
    JWT_SECRET
};

