const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const axios = require('axios');
const crypto = require('crypto');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

// Конфигурация ВТБ API
// Данные для тестового интернет-эквайринга ВТБ
// Тестовый URL (Песочница): https://hackaton.bankingapi.ru/api/smb/efcp/e-commerce/api/v1/{наименование_эндпоинта}
// ⚠️ ВАЖНО: Если в .env указан VTB_API_URL, он должен быть: https://hackaton.bankingapi.ru/api/smb/efcp/e-commerce/api/v1
const VTB_API_BASE_URL = process.env.VTB_API_URL || 'https://hackaton.bankingapi.ru/api/smb/efcp/e-commerce/api/v1';
const VTB_CLIENT_ID = process.env.VTB_CLIENT_ID; // client_id из письма
const VTB_CLIENT_SECRET = process.env.VTB_CLIENT_SECRET; // client_secret из письма
const VTB_MERCHANT_AUTH = process.env.VTB_MERCHANT_AUTHORIZATION; // Merchant-Authorization из письма
const VTB_SUCCESS_URL = process.env.VTB_SUCCESS_URL || 'https://anodruzya.ru/donation-success.html';
const VTB_FAIL_URL = process.env.VTB_FAIL_URL || 'https://anodruzya.ru/donation-fail.html';
const VTB_MODE = process.env.VTB_MODE || 'test'; // test или production

// Кэш для access_token (чтобы не получать токен при каждом запросе)
let vtbAccessToken = null;
let vtbTokenExpiresAt = null;

// Получение access_token через OAuth2 (согласно документации ВТБ раздел 4.16.1)
async function getVtbAccessToken() {
    // Проверяем, есть ли валидный токен в кэше
    if (vtbAccessToken && vtbTokenExpiresAt && Date.now() < vtbTokenExpiresAt) {
        console.log('✅ Используем кэшированный access_token');
        return vtbAccessToken;
    }

    try {
        console.log('🔄 Получение access_token через OAuth2...');
        
        // URL для получения токена (тестовая среда)
        // Согласно документации, endpoint может быть /oauth/token или /token
        const tokenUrl = VTB_API_BASE_URL.replace('/api/v1', '') + '/oauth/token';
        
        // Альтернативные варианты URL для токена
        const tokenUrls = [
            tokenUrl,
            VTB_API_BASE_URL.replace('/api/v1', '') + '/token',
            'https://hackaton.bankingapi.ru/oauth/token',
            'https://hackaton.bankingapi.ru/token'
        ];

        let tokenResponse = null;
        let lastError = null;

        // Пробуем разные варианты URL
        for (const url of tokenUrls) {
            try {
                console.log(`🔍 Попытка получить токен с URL: ${url}`);
                tokenResponse = await axios.post(
                    url,
                    new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: VTB_CLIENT_ID,
                        client_secret: VTB_CLIENT_SECRET
                    }),
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 10000
                    }
                );
                
                if (tokenResponse.status === 200 && tokenResponse.data.access_token) {
                    console.log('✅ Токен успешно получен');
                    break;
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось получить токен с ${url}:`, error.message);
                lastError = error;
                continue;
            }
        }

        if (!tokenResponse || !tokenResponse.data.access_token) {
            throw new Error('Не удалось получить access_token. Проверьте client_id и client_secret.');
        }

        vtbAccessToken = tokenResponse.data.access_token;
        // Токен обычно действителен 3600 секунд (1 час), но используем 3300 для безопасности
        const expiresIn = tokenResponse.data.expires_in || 3300;
        vtbTokenExpiresAt = Date.now() + (expiresIn * 1000);

        console.log('✅ Access_token получен и сохранен в кэш');
        return vtbAccessToken;

    } catch (error) {
        console.error('❌ Ошибка получения access_token:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });
        throw error;
    }
}

// Проверка и создание таблицы donations, если её нет
async function ensureDonationsTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='donations'"
        );

        if (!tableExists) {
            await db.run(`
                CREATE TABLE IF NOT EXISTS donations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    amount REAL NOT NULL,
                    donorName TEXT,
                    donorEmail TEXT,
                    donorPhone TEXT,
                    message TEXT,
                    anonymous BOOLEAN DEFAULT 0,
                    paymentId TEXT UNIQUE,
                    paymentStatus TEXT DEFAULT 'pending',
                    vtbOrderId TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ Таблица donations создана автоматически');
        } else {
            // Старая версия таблицы (из init-db.js) — добавляем недостающие колонки.
            // В SQLite нельзя добавить колонку с DEFAULT CURRENT_TIMESTAMP, поэтому даты заполняем при вставке.
            await db.ensureColumn('donations', 'anonymous', 'BOOLEAN DEFAULT 0');
            await db.ensureColumn('donations', 'paymentId', 'TEXT');
            await db.ensureColumn('donations', 'paymentStatus', "TEXT DEFAULT 'pending'");
            await db.ensureColumn('donations', 'vtbOrderId', 'TEXT');
            await db.ensureColumn('donations', 'createdAt', 'DATETIME');
            await db.ensureColumn('donations', 'updatedAt', 'DATETIME');
        }
    } catch (error) {
        console.error('❌ Ошибка создания таблицы donations:', error);
        throw error;
    }
}

// Получить все донаты (только для админа)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        await ensureDonationsTable();
        const donations = await db.all('SELECT * FROM donations ORDER BY COALESCE(createdAt, date) DESC');
        res.json({ donations });
    } catch (error) {
        console.error('Ошибка получения донатов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создать платеж через ВТБ
router.post('/create-payment', [
    body('amount').isFloat({ min: 1 }).withMessage('Сумма пожертвования должна быть больше 0'),
    body('donorName').optional().trim(),
    body('donorEmail').optional().isEmail().withMessage('Некорректный email'),
    body('donorPhone').optional().trim(),
    body('message').optional().trim(),
    body('anonymous').optional().isBoolean()
], async (req, res) => {
    try {
        console.log('📥 Получен запрос на создание платежа:', {
            amount: req.body.amount,
            hasName: !!req.body.donorName,
            anonymous: req.body.anonymous
        });
        
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.error('❌ Ошибки валидации:', errors.array());
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, donorName, donorEmail, donorPhone, message, anonymous } = req.body;

        // Проверяем наличие необходимых переменных окружения для ВТБ
        console.log('🔍 Проверка переменных окружения:', {
            VTB_CLIENT_ID: VTB_CLIENT_ID ? '✅' : '❌',
            VTB_CLIENT_SECRET: VTB_CLIENT_SECRET ? '✅' : '❌',
            VTB_MERCHANT_AUTH: VTB_MERCHANT_AUTH ? '✅' : '❌',
            VTB_API_BASE_URL: VTB_API_BASE_URL
        });
        
        if (!VTB_CLIENT_ID || !VTB_CLIENT_SECRET || !VTB_MERCHANT_AUTH) {
            console.error('❌ ВТБ API не настроен: отсутствуют VTB_CLIENT_ID, VTB_CLIENT_SECRET или VTB_MERCHANT_AUTHORIZATION');
            console.error('💡 Убедитесь, что файл .env создан и содержит все необходимые переменные');
            
            return res.status(500).json({ 
                error: 'Платежная система не настроена',
                message: 'Пожалуйста, свяжитесь с администратором.'
            });
        }

        // Генерируем уникальный ID для заказа
        const orderId = `donation_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

        // Сохраняем пожертвование в БД со статусом pending ДО обращения в банк
        await ensureDonationsTable();
        const isAnonymous = anonymous === true || anonymous === 'true';
        const insertResult = await db.run(
            `INSERT INTO donations (amount, donorName, donorEmail, donorPhone, message, anonymous, paymentId, paymentStatus, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [
                Number(amount),
                isAnonymous ? null : (donorName || null),
                isAnonymous ? null : (donorEmail || null),
                isAnonymous ? null : (donorPhone || null),
                message || null,
                isAnonymous ? 1 : 0,
                orderId
            ]
        );
        const donationId = insertResult.id;

        // Создаем платеж в ВТБ
        // ⚠️ ВАЖНО: Адаптируйте структуру paymentData под формат из документации ВТБ!
        try {
            console.log('🔄 Начало создания платежа в ВТБ...');
            console.log('📋 Данные доната:', { amount, orderId, anonymous });
            console.log('🔑 Проверка переменных окружения:', {
                hasClientId: !!VTB_CLIENT_ID,
                hasClientSecret: !!VTB_CLIENT_SECRET,
                hasMerchantAuth: !!VTB_MERCHANT_AUTH,
                apiBaseUrl: VTB_API_BASE_URL
            });
            
            // Структура запроса для создания ордера согласно документации ВТБ
            // Раздел 4.12.1: POST v1/orders
            // amount - сумма в копейках (integer)
            // orderId - уникальный идентификатор заказа (string, до 100 символов)
            // description - описание заказа (string, до 500 символов)
            // returnUrl - URL для возврата после успешной оплаты
            // failUrl - URL для возврата после неуспешной оплаты
            const paymentData = {
                amount: Math.round(amount * 100), // сумма в копейках
                orderId: orderId, // уникальный идентификатор заказа
                description: `Пожертвование в фонд "Друзья на лапках"`,
                returnUrl: `${VTB_SUCCESS_URL}?donationId=${donationId}`,
                failUrl: `${VTB_FAIL_URL}?donationId=${donationId}`
                // customer - опциональное поле, можно добавить если нужно
            };

            console.log('📤 Данные для отправки в ВТБ:', JSON.stringify(paymentData, null, 2));

            // Авторизация для ВТБ API согласно документации
            // Согласно разделу 4.4 "Безопасность использования API" и 4.16.1:
            // Для тестовой среды нужно получить access_token через OAuth2
            // Затем использовать его в заголовке Authorization: Bearer <token>
            // И также нужен заголовок Merchant-Authorization
            
            let accessToken;
            try {
                // Пробуем получить access_token
                accessToken = await getVtbAccessToken();
            } catch (tokenError) {
                console.warn('⚠️ Не удалось получить access_token, используем Basic Auth как fallback');
                console.warn('⚠️ Ошибка получения токена:', tokenError.message);
                // Если не удалось получить токен, используем Basic Auth как fallback
                accessToken = null;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Merchant-Authorization': VTB_MERCHANT_AUTH
            };

            // Используем Bearer токен, если получен, иначе Basic Auth
            if (accessToken) {
                headers['Authorization'] = `Bearer ${accessToken}`;
                console.log('🔐 Используется Authorization: Bearer <token>');
            } else {
                headers['Authorization'] = `Basic ${Buffer.from(`${VTB_CLIENT_ID}:${VTB_CLIENT_SECRET}`).toString('base64')}`;
                console.log('🔐 Используется Authorization: Basic (fallback)');
            }

            console.log('🔐 Заголовки авторизации:', {
                hasAuth: !!headers.Authorization,
                hasMerchantAuth: !!headers['Merchant-Authorization'],
                authLength: headers.Authorization?.length,
                merchantAuthLength: headers['Merchant-Authorization']?.length,
            });

            // Endpoint для создания платежа согласно документации ВТБ
            // Раздел 4.12.1: POST v1/orders
            // Базовый URL уже содержит /api/v1, поэтому endpoint просто /orders
            const paymentEndpoint = '/orders'; // POST v1/orders согласно документации
            const fullUrl = `${VTB_API_BASE_URL}${paymentEndpoint}`;
            
            console.log('🌐 URL для запроса:', fullUrl);
            console.log('📋 Endpoint:', paymentEndpoint);
            
            // Проверка доступности базового URL (опционально)
            try {
                console.log('🔍 Проверка доступности базового URL...');
                const healthCheck = await axios.get(VTB_API_BASE_URL.replace('/api/v1', ''), { 
                    timeout: 5000,
                    validateStatus: () => true // Принимаем любой статус
                });
                console.log('✅ Базовый URL доступен, статус:', healthCheck.status);
            } catch (healthError) {
                console.warn('⚠️ Базовый URL недоступен или не отвечает:', healthError.message);
                console.warn('💡 Проверьте правильность URL в документации ВТБ!');
            }
            
            // Отправляем запрос на создание платежа
            console.log('📡 Отправка запроса в ВТБ API...');
            console.log('⏱️ Таймаут установлен: 30 секунд');
            
            const vtbResponse = await axios.post(
                fullUrl,
                paymentData,
                { 
                    headers,
                    timeout: 30000, // 30 секунд таймаут
                    validateStatus: function (status) {
                        // Принимаем любые статусы для логирования
                        return status >= 200 && status < 600;
                    }
                }
            );
            
            console.log('✅ Получен ответ от ВТБ:', {
                status: vtbResponse.status,
                data: vtbResponse.data
            });
            
            // Проверяем статус ответа
            if (vtbResponse.status >= 400) {
                const errorData = vtbResponse.data;
                const errorMessage = errorData?.message || 
                                    errorData?.error?.message || 
                                    errorData?.error ||
                                    `ВТБ API вернул ошибку: ${vtbResponse.status}`;
                
                console.error('❌ ВТБ API вернул ошибку:', {
                    status: vtbResponse.status,
                    statusText: vtbResponse.statusText,
                    data: errorData,
                    errorMessage: errorMessage
                });
                
                // Бросаем ошибку с понятным сообщением
                const error = new Error(errorMessage);
                error.status = vtbResponse.status;
                error.responseData = errorData;
                throw error;
            }

            // TODO: Обновите обработку ответа согласно PDF инструкции ВТБ
            // Типичные варианты получения URL для редиректа:
            // - vtbResponse.data.payment_url
            // - vtbResponse.data.url
            // - vtbResponse.data.confirmation.url
            // - vtbResponse.data.redirect_url
            // - Или формирование URL на основе payment_id
            
            // Обработка ответа согласно документации ВТБ
            // Раздел 4.12.1: POST v1/orders возвращает объект с полями:
            // - orderId - идентификатор заказа
            // - formUrl - URL для редиректа на страницу оплаты
            // - orderStatus - статус заказа
            console.log('📦 Структура ответа от ВТБ:', JSON.stringify(vtbResponse.data, null, 2));
            
            // Извлекаем данные из ответа
            // Проверяем различные возможные варианты структуры ответа
            const responseData = vtbResponse.data;
            const vtbOrderId = responseData.orderId || orderId;
            
            // Пытаемся найти URL для редиректа в разных возможных полях
            const confirmationUrl = responseData.formUrl || 
                                  responseData.paymentUrl ||
                                  responseData.url ||
                                  responseData.redirectUrl ||
                                  responseData.confirmationUrl;
            
            if (!confirmationUrl) {
                console.error('❌ ВТБ API не вернул URL для редиректа в ответе:', {
                    responseData: responseData,
                    availableFields: Object.keys(responseData || {})
                });
                throw new Error('ВТБ API не вернул URL для редиректа на страницу оплаты. Проверьте структуру ответа в логах.');
            }
            
            console.log('🔗 URL для редиректа:', confirmationUrl);
            console.log('🆔 ID заказа ВТБ:', vtbOrderId);

            await db.run(
                'UPDATE donations SET vtbOrderId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?',
                [String(vtbOrderId), donationId]
            );

            res.json({
                success: true,
                donationId: donationId,
                paymentId: vtbOrderId,
                confirmationUrl: confirmationUrl,
                orderId: orderId
            });

        } catch (vtbError) {
            await db.run(
                "UPDATE donations SET paymentStatus = 'failed', updatedAt = CURRENT_TIMESTAMP WHERE id = ?",
                [donationId]
            ).catch(() => {});

            // Проверяем, это таймаут или другая ошибка
            const isTimeout = vtbError.code === 'ECONNABORTED' || vtbError.message.includes('timeout');
            const isNetworkError = vtbError.code === 'ECONNREFUSED' || vtbError.code === 'ENOTFOUND';
            
            // Детальное логирование ошибки
            console.error('❌ Ошибка создания платежа в ВТБ:', {
                message: vtbError.message,
                code: vtbError.code,
                name: vtbError.name,
                isTimeout: isTimeout,
                isNetworkError: isNetworkError,
                response: {
                    status: vtbError.response?.status,
                    statusText: vtbError.response?.statusText,
                    data: vtbError.response?.data
                },
                request: {
                    url: vtbError.config?.url,
                    method: vtbError.config?.method,
                    timeout: vtbError.config?.timeout,
                    headers: vtbError.config?.headers ? Object.keys(vtbError.config.headers) : undefined
                },
                stack: vtbError.stack
            });

            let errorMessage;
            let statusCode = 500;
            
            if (isTimeout) {
                errorMessage = 'Таймаут при обращении к платежной системе. Попробуйте позже.';
            } else if (isNetworkError) {
                errorMessage = 'Не удалось подключиться к платежной системе. Проверьте URL API.';
            } else if (vtbError.response) {
                // Есть ответ от сервера
                statusCode = vtbError.response.status || 500;
                const responseData = vtbError.response.data;
                
                // Пытаемся извлечь понятное сообщение об ошибке
                errorMessage = responseData?.message || 
                              responseData?.error?.message ||
                              responseData?.error ||
                              responseData?.description ||
                              `Ошибка от ВТБ API: ${statusCode}`;
                              
                // Логируем полный ответ для отладки
                console.error('📋 Полный ответ от ВТБ API:', JSON.stringify(responseData, null, 2));
            } else {
                errorMessage = vtbError.message || 'Ошибка создания платежа';
            }

            res.status(statusCode).json({ 
                error: 'Ошибка создания платежа',
                message: errorMessage,
                details: process.env.NODE_ENV !== 'production' ? {
                    code: vtbError.code,
                    status: statusCode,
                    url: vtbError.config?.url,
                    responseData: vtbError.response?.data
                } : undefined
            });
        }

    } catch (error) {
        console.error('❌ Критическая ошибка создания доната:', {
            message: error.message,
            stack: error.stack,
            errorName: error.name,
            errorCode: error.code
        });
        
        // Отправляем более детальную ошибку в режиме разработки
        const errorResponse = {
            error: 'Ошибка сервера',
            message: 'Внутренняя ошибка сервера'
        };
        
        // В режиме разработки добавляем детали
        if (process.env.NODE_ENV !== 'production') {
            errorResponse.details = {
                name: error.name,
                code: error.code,
                stack: error.stack
            };
        }
        
        res.status(500).json(errorResponse);
    }
});

// Webhook от ВТБ для уведомлений о статусе платежа
// Защита: адрес webhook должен содержать секрет из .env (VTB_WEBHOOK_SECRET):
//   https://anodruzya.ru/api/donations/webhook?secret=<VTB_WEBHOOK_SECRET>
// Без секрета webhook отключён — иначе кто угодно мог бы «оплатить» пожертвование.
// TODO: когда будет документация ВТБ по подписи уведомлений — добавить проверку подписи.
const VTB_WEBHOOK_SECRET = process.env.VTB_WEBHOOK_SECRET;

function safeEqual(a, b) {
    const bufA = Buffer.from(String(a || ''));
    const bufB = Buffer.from(String(b || ''));
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
}

router.post('/webhook', async (req, res) => {
    try {
        if (!VTB_WEBHOOK_SECRET) {
            console.warn('⚠️ Webhook ВТБ отклонён: VTB_WEBHOOK_SECRET не задан в .env');
            return res.status(503).json({ error: 'Webhook не настроен' });
        }
        const providedSecret = req.query.secret || req.headers['x-webhook-secret'];
        if (!safeEqual(providedSecret, VTB_WEBHOOK_SECRET)) {
            console.warn('⚠️ Webhook ВТБ отклонён: неверный секрет');
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const event = req.body || {};
        console.log('📥 Получен webhook от ВТБ:', JSON.stringify(event));

        // Наш orderId (donation_...) и/или id заказа на стороне ВТБ
        const orderId = event.orderId || event.order_id || event.payment?.order_id || event.object?.order_id;
        const rawStatus = String(
            event.orderStatus || event.status || event.payment_status || event.type || ''
        ).toLowerCase();

        let status = null;
        if (/(succeed|success|paid|deposited|completed|approved)/.test(rawStatus)) status = 'succeeded';
        else if (/(cancel|fail|declin|reject|expired|reversed|refund)/.test(rawStatus)) status = 'canceled';

        if (!orderId || !status) {
            console.warn('⚠️ Не удалось извлечь данные из webhook');
            return res.status(200).json({ received: true });
        }

        await ensureDonationsTable();
        const result = await db.run(
            `UPDATE donations SET paymentStatus = ?, updatedAt = CURRENT_TIMESTAMP
             WHERE paymentId = ? OR vtbOrderId = ?`,
            [status, String(orderId), String(orderId)]
        );
        console.log(`✅ Webhook: orderId=${orderId}, status=${status}, обновлено записей: ${result.changes}`);

        res.status(200).json({ received: true });
    } catch (error) {
        console.error('❌ Ошибка обработки webhook:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Проверка статуса платежа
router.get('/status/:donationId', async (req, res) => {
    try {
        await ensureDonationsTable();
        const donation = await db.get('SELECT * FROM donations WHERE id = ?', [req.params.donationId]);
        
        if (!donation) {
            return res.status(404).json({ error: 'Донат не найден' });
        }

        res.json({
            donationId: donation.id,
            status: donation.paymentStatus,
            amount: donation.amount
        });
    } catch (error) {
        console.error('Ошибка проверки статуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

module.exports = router;

