// Пересоздать автоматические обложки (640x480) для всех фото в /uploads
// и удалить превью прежнего формата (_t.jpg).
// Запуск: node scripts/rebuild-covers.js           — только для фото без обложки
//         node scripts/rebuild-covers.js --all     — пересоздать все обложки
// Внимание: --all перезапишет и обложки, выбранные вручную в редакторе.
const fs = require('fs');
const { UPLOADS_DIR, rebuildCover, coverPath, oldThumbPath } = require('../utils/photos');

(async () => {
    const all = process.argv.includes('--all');
    const ids = fs.readdirSync(UPLOADS_DIR).map(f => f.match(/^([a-f0-9]{32})\.jpg$/)).filter(Boolean).map(m => m[1]);
    let made = 0, skipped = 0, failed = 0, removedOld = 0;
    for (const id of ids) {
        if (!all && fs.existsSync(coverPath(id))) { skipped++; }
        else if (await rebuildCover(id)) made++; else failed++;
        if (fs.existsSync(oldThumbPath(id)) && fs.existsSync(coverPath(id))) { fs.unlinkSync(oldThumbPath(id)); removedOld++; }
        process.stdout.write(`\r${made + skipped + failed}/${ids.length}`);
    }
    console.log(`\n✅ Обложек создано: ${made}, уже были: ${skipped}, ошибок: ${failed}, старых превью удалено: ${removedOld}`);
})().catch(err => { console.error('❌', err); process.exit(1); });
