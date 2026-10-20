// Смена пароля (и при необходимости email) администратора.
// Использование:
//   node scripts/set-admin-password.js <новый_пароль>
//   node scripts/set-admin-password.js <новый_пароль> <новый_email>
// Если админов несколько — меняется первый (с наименьшим id).
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/database');

async function main() {
    const [newPassword, newEmail] = process.argv.slice(2);
    if (!newPassword || newPassword.length < 10) {
        console.error('❌ Укажите новый пароль не короче 10 символов:');
        console.error('   node scripts/set-admin-password.js <новый_пароль> [новый_email]');
        process.exit(1);
    }
    if (newEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        console.error('❌ Некорректный email');
        process.exit(1);
    }

    await db.connect();
    const admin = await db.get('SELECT id, email FROM admins ORDER BY id LIMIT 1');
    if (!admin) {
        console.error('❌ В базе нет администратора. Запустите npm run init-db');
        process.exit(1);
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE admins SET password = ?, email = COALESCE(?, email) WHERE id = ?', [hash, newEmail || null, admin.id]);
    console.log(`✅ Пароль администратора обновлён. Вход: ${newEmail || admin.email}`);
    await db.close();
}

main().catch(err => {
    console.error('❌ Ошибка:', err.message);
    process.exit(1);
});
