const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

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

module.exports = {
    authenticateToken,
    requireAdmin,
    requireShelter,
    requireUserOrShelter,
    JWT_SECRET
};

