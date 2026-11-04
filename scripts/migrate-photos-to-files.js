// Перенос фотографий из базы (base64) в файлы /uploads.
// Запуск:  node scripts/migrate-photos-to-files.js           — перенести
//          node scripts/migrate-photos-to-files.js --vacuum  — перенести и сжать файл базы
// Безопасно запускать повторно: уже перенесённые фото не трогаются.
// ПЕРЕД ЗАПУСКОМ СДЕЛАЙТЕ КОПИЮ database.sqlite.
require('dotenv').config();
const db = require('../config/database');
const { storePhotos, parseStored } = require('../utils/photos');

async function migrateTable(table) {
    const rows = await db.all(`SELECT id, photos FROM ${table} WHERE photos LIKE '%data:image%'`);
    let moved = 0, photos = 0, failed = 0;
    for (const row of rows) {
        const list = parseStored(row.photos);
        const stored = await storePhotos(list, Infinity);
        const base64Count = list.filter(p => typeof p === 'string' && p.startsWith('data:image/')).length;
        const storedNew = stored.length - list.filter(p => typeof p === 'string' && p.startsWith('/uploads/')).length;
        failed += Math.max(0, base64Count - storedNew);
        photos += storedNew;
        // Обновляем, только если запись не изменилась за время обработки
        const res = await db.run(`UPDATE ${table} SET photos = ? WHERE id = ? AND photos = ?`,
            [stored.length ? JSON.stringify(stored) : null, row.id, row.photos]);
        if (res.changes) moved++;
        process.stdout.write(`\r${table}: ${moved}/${rows.length}`);
    }
    console.log(`\n✅ ${table}: записей ${moved} из ${rows.length}, фото сохранено ${photos}, не удалось обработать ${failed}`);
}

(async () => {
    await db.connect();
    await migrateTable('pets');
    await migrateTable('announcements');
    if (process.argv.includes('--vacuum')) {
        console.log('🧹 Сжатие базы (VACUUM)...');
        await db.run('VACUUM');
        console.log('✅ Готово');
    }
    await db.close();
})().catch(err => {
    console.error('❌ Ошибка миграции:', err);
    process.exit(1);
});
