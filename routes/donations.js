const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const axios = require('axios');
require('dotenv').config();

const router = express.Router();

// Конфигурация ВТБ API
// Данные для тестового интернет-эквайринга ВТБ
const VTB_API_URL = process.env.VTB_API_URL || 'https://api.vtb.ru'; // URL API ВТБ (уточните для тестового режима)
const VTB_CLIENT_ID = process.env.VTB_CLIENT_ID; // client_id из письма
const VTB_CLIENT_SECRET = process.env.VTB_CLIENT_SECRET; // client_secret из письма
const VTB_MERCHANT_AUTH = process.env.VTB_MERCHANT_AUTHORIZATION; // Merchant-Authorization из письма
const VTB_SUCCESS_URL = process.env.VTB_SUCCESS_URL || 'https://anodruzya.ru/donation-success.html';
const VTB_FAIL_URL = process.env.VTB_FAIL_URL || 'https://anodruzya.ru/donation-fail.html';
const VTB_MODE = process.env.VTB_MODE || 'test'; // test или production

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
        }
    } catch (error) {
        console.error('❌ Ошибка создания таблицы donations:', error);
        throw error;
    }
}

// Получить все донаты (только для админа)
router.get('/', async (req, res) => {
    try {
        await ensureDonationsTable();
        const donations = await db.all('SELECT * FROM donations ORDER BY createdAt DESC');
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
            VTB_API_URL: VTB_API_URL
        });
        
        if (!VTB_CLIENT_ID || !VTB_CLIENT_SECRET || !VTB_MERCHANT_AUTH) {
            console.error('❌ ВТБ API не настроен: отсутствуют VTB_CLIENT_ID, VTB_CLIENT_SECRET или VTB_MERCHANT_AUTHORIZATION');
            console.error('💡 Убедитесь, что файл .env создан и содержит все необходимые переменные');
            
            return res.status(500).json({ 
                error: 'Платежная система не настроена',
                message: 'Пожалуйста, свяжитесь с администратором.'
            });
        }

        // Генерируем уникальный ID для заказа (используем timestamp + случайное число)
        const orderId = `donation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Создаем платеж в ВТБ
        // ⚠️ ВАЖНО: Адаптируйте структуру paymentData под формат из документации ВТБ!
        try {
            console.log('🔄 Начало создания платежа в ВТБ...');
            console.log('📋 Данные доната:', { amount, orderId, anonymous });
            console.log('🔑 Проверка переменных окружения:', {
                hasClientId: !!VTB_CLIENT_ID,
                hasClientSecret: !!VTB_CLIENT_SECRET,
                hasMerchantAuth: !!VTB_MERCHANT_AUTH,
                apiUrl: VTB_API_URL
            });
            
            // Структура запроса для создания платежа в ВТБ
            // ⚠️ ВАЖНО: Адаптируйте под точный формат из PDF инструкции ВТБ!
            const paymentData = {
                // Базовая структура (обновите под формат из PDF инструкции):
                amount: Math.round(amount * 100), // сумма в копейках (или оставьте в рублях, если так требует API)
                currency: 'RUB',
                order_id: orderId,
                description: `Пожертвование в фонд "Друзья на лапки"`,
                return_url: `${VTB_SUCCESS_URL}?orderId=${orderId}`,
                fail_url: `${VTB_FAIL_URL}?orderId=${orderId}`,
                // Дополнительные поля (добавьте, если требуются в документации):
                customer: {
                    name: anonymous ? 'Анонимно' : (donorName || 'Не указано'),
                    email: donorEmail || null,
                    phone: donorPhone || null
                }
            };

            console.log('📤 Данные для отправки в ВТБ:', JSON.stringify(paymentData, null, 2));

            // Авторизация для ВТБ API
            // Используем OAuth2 (client_id + client_secret) и Merchant-Authorization
            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${Buffer.from(`${VTB_CLIENT_ID}:${VTB_CLIENT_SECRET}`).toString('base64')}`,
                'Merchant-Authorization': VTB_MERCHANT_AUTH
            };

            console.log('🔐 Заголовки авторизации:', {
                hasAuth: !!headers.Authorization,
                hasMerchantAuth: !!headers['Merchant-Authorization'],
                authLength: headers.Authorization?.length
            });

            // TODO: Обновите endpoint согласно PDF инструкции ВТБ
            // Типичные варианты:
            // - POST /api/v1/payments
            // - POST /api/payment/create
            // - POST /payment/init
            // - POST /gateway/payment
            const paymentEndpoint = '/api/v1/payments'; // Замените на endpoint из документации
            const fullUrl = `${VTB_API_URL}${paymentEndpoint}`;
            
            console.log('🌐 URL для запроса:', fullUrl);
            
            // Отправляем запрос на создание платежа
            console.log('📡 Отправка запроса в ВТБ API...');
            const vtbResponse = await axios.post(
                fullUrl,
                paymentData,
                { headers }
            );
            
            console.log('✅ Получен ответ от ВТБ:', {
                status: vtbResponse.status,
                data: vtbResponse.data
            });

            // TODO: Обновите обработку ответа согласно PDF инструкции ВТБ
            // Типичные варианты получения URL для редиректа:
            // - vtbResponse.data.payment_url
            // - vtbResponse.data.url
            // - vtbResponse.data.confirmation.url
            // - vtbResponse.data.redirect_url
            // - Или формирование URL на основе payment_id
            
            console.log('📦 Структура ответа от ВТБ:', JSON.stringify(vtbResponse.data, null, 2));
            
            const vtbOrderId = vtbResponse.data.payment_id || vtbResponse.data.id || vtbResponse.data.order_id;
            const confirmationUrl = vtbResponse.data.payment_url || 
                                   vtbResponse.data.url || 
                                   vtbResponse.data.confirmation?.url ||
                                   vtbResponse.data.redirect_url ||
                                   `${VTB_API_URL}/payment/${vtbOrderId}`;
            
            console.log('🔗 URL для редиректа:', confirmationUrl);
            console.log('🆔 ID платежа ВТБ:', vtbOrderId);

            res.json({
                success: true,
                paymentId: vtbResponse.data.id || vtbOrderId,
                confirmationUrl: confirmationUrl,
                orderId: orderId
            });

        } catch (vtbError) {
            console.error('❌ Ошибка создания платежа в ВТБ:', {
                message: vtbError.message,
                response: vtbError.response?.data,
                status: vtbError.response?.status,
                config: {
                    url: vtbError.config?.url,
                    method: vtbError.config?.method
                }
            });

            const errorMessage = vtbError.response?.data?.message || 
                                vtbError.response?.data?.error?.message ||
                                vtbError.message ||
                                'Ошибка создания платежа';

            res.status(500).json({ 
                error: 'Ошибка создания платежа',
                message: errorMessage
            });
        }

    } catch (error) {
        console.error('❌ Критическая ошибка создания доната:', {
            message: error.message,
            stack: error.stack,
            body: req.body,
            errorName: error.name,
            errorCode: error.code
        });
        
        // Отправляем более детальную ошибку в режиме разработки
        const errorResponse = {
            error: 'Ошибка сервера',
            message: error.message || 'Внутренняя ошибка сервера'
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
// ⚠️ ВАЖНО: Адаптируйте обработку webhook под формат из документации ВТБ!
router.post('/webhook', express.json(), async (req, res) => {
    try {
        // TODO: Добавьте проверку подписи согласно PDF инструкции ВТБ
        // ВТБ может отправлять подписанный запрос, нужно проверить подпись
        const signature = req.headers['x-vtb-signature'] || 
                         req.headers['x-signature'] || 
                         req.headers['signature'];
        
        // Пример проверки подписи (адаптируйте под алгоритм из документации):
        // if (signature) {
        //     const expectedSignature = createSignature(req.body, VTB_SECRET_KEY);
        //     if (signature !== expectedSignature) {
        //         console.error('❌ Неверная подпись webhook');
        //         return res.status(401).json({ error: 'Invalid signature' });
        //     }
        // }
        
        // TODO: Обновите обработку webhook согласно PDF инструкции ВТБ
        // Типичные форматы уведомлений:
        // Вариант 1: { type: "payment.succeeded", payment: { id, order_id, status } }
        // Вариант 2: { payment_id, order_id, status, amount }
        // Вариант 3: Другой формат из документации
        
        const event = req.body;
        console.log('📥 Получен webhook от ВТБ:', JSON.stringify(event, null, 2));
        
        // Определяем формат уведомления и извлекаем данные
        let paymentId, donationId, status;
        
        // Вариант 1: Формат с типом события
        if (event.type === 'payment.succeeded' || event.type === 'payment_succeeded') {
            paymentId = event.payment?.id || event.object?.id || event.payment_id;
            donationId = event.payment?.order_id || event.object?.order_id || event.order_id || event.payment?.metadata?.donationId;
            status = 'succeeded';
        } else if (event.type === 'payment.canceled' || event.type === 'payment_canceled' || event.type === 'payment_failed') {
            paymentId = event.payment?.id || event.object?.id || event.payment_id;
            donationId = event.payment?.order_id || event.object?.order_id || event.order_id || event.payment?.metadata?.donationId;
            status = 'canceled';
        }
        // Вариант 2: Прямой формат с полями
        else if (event.status || event.payment_status) {
            paymentId = event.payment_id || event.id;
            donationId = event.order_id || event.donation_id;
            status = (event.status === 'success' || event.status === 'succeeded' || event.payment_status === 'success') ? 'succeeded' : 
                     (event.status === 'failed' || event.status === 'canceled' || event.payment_status === 'failed') ? 'canceled' : 
                     'pending';
        }
        
        // Обновляем статус доната
        if (donationId && status) {
            await db.run(`
                UPDATE donations 
                SET paymentStatus = ?, updatedAt = CURRENT_TIMESTAMP
                WHERE id = ? ${paymentId ? 'AND (paymentId = ? OR vtbOrderId = ?)' : ''}
            `, paymentId ? [status, donationId, paymentId, paymentId] : [status, donationId]);

            console.log(`✅ Статус доната обновлен: donationId=${donationId}, status=${status}, paymentId=${paymentId || 'N/A'}`);
        } else {
            console.warn('⚠️ Не удалось извлечь данные из webhook:', event);
        }

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

