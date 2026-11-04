// Хранение фотографий файлами вместо base64 в базе данных.
// Каждое фото сохраняется в двух размерах:
//   /uploads/<id>.jpg    — до 1600px по большей стороне (страница животного)
//   /uploads/<id>_t.jpg  — превью до 480px (карточки в списках)
// В базе хранится только адрес полного фото, адрес превью получается заменой «.jpg» на «_t.jpg».
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const URL_PREFIX = '/uploads/';
const FULL_SIZE = 1600;
const THUMB_SIZE = 480;
const MAX_PHOTOS = 10;
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // одно фото до 15 МБ
const STORED_URL = /^\/uploads\/([a-f0-9]{32})(?:_t)?\.jpg$/;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function fullPath(id) { return path.join(UPLOADS_DIR, `${id}.jpg`); }
function thumbPath(id) { return path.join(UPLOADS_DIR, `${id}_t.jpg`); }

// Адрес превью для адреса полного фото (для старых base64-данных возвращает их как есть)
function thumbUrl(url) {
    const m = typeof url === 'string' && url.match(STORED_URL);
    return m ? `${URL_PREFIX}${m[1]}_t.jpg` : url;
}

// Сохранить одно фото из data:image/...;base64 в файлы. Возвращает адрес или null.
async function saveDataUrl(dataUrl) {
    const m = /^data:image\/(jpeg|jpg|png|webp|gif|heic|heif|avif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!m) return null;
    const input = Buffer.from(m[2], 'base64');
    if (input.length === 0 || input.length > MAX_INPUT_BYTES) return null;

    const id = crypto.randomBytes(16).toString('hex');
    try {
        const base = sharp(input, { failOn: 'error', limitInputPixels: 80e6 }).rotate(); // rotate() учитывает EXIF-поворот с телефона
        await base.clone()
            .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 80, mozjpeg: true })
            .toFile(fullPath(id));
        await base.clone()
            .resize({ width: THUMB_SIZE, height: THUMB_SIZE, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 72, mozjpeg: true })
            .toFile(thumbPath(id));
        return `${URL_PREFIX}${id}.jpg`;
    } catch (error) {
        console.warn('⚠️ Не удалось обработать фото:', error.message);
        removeFiles([`${URL_PREFIX}${id}.jpg`]);
        return null;
    }
}

// Привести список фото к адресам файлов:
//  - новые фото (data:image/...) сохраняются в файлы;
//  - уже сохранённые (/uploads/...) остаются, превью приводится к полному адресу;
//  - всё остальное отбрасывается.
async function storePhotos(list, maxPhotos = MAX_PHOTOS) {
    if (!Array.isArray(list)) return [];
    const result = [];
    for (const item of list.slice(0, maxPhotos)) {
        if (typeof item !== 'string') continue;
        const stored = item.match(STORED_URL);
        if (stored) {
            if (fs.existsSync(fullPath(stored[1]))) result.push(`${URL_PREFIX}${stored[1]}.jpg`);
            continue;
        }
        if (item.startsWith('data:image/')) {
            const url = await saveDataUrl(item);
            if (url) result.push(url);
        }
    }
    return [...new Set(result)];
}

// Удалить файлы фото (и полный размер, и превью)
function removeFiles(urls) {
    for (const url of urls || []) {
        const m = typeof url === 'string' && url.match(STORED_URL);
        if (!m) continue;
        for (const p of [fullPath(m[1]), thumbPath(m[1])]) {
            fs.promises.unlink(p).catch(() => {});
        }
    }
}

// Разобрать JSON из базы в массив адресов
function parseStored(value) {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Удалить файлы, которые были в старом списке, но пропали из нового
function removeReplaced(oldJson, newList) {
    const keep = new Set(newList || []);
    removeFiles(parseStored(oldJson).filter(u => !keep.has(u)));
}

module.exports = { UPLOADS_DIR, URL_PREFIX, storePhotos, removeFiles, removeReplaced, parseStored, thumbUrl, saveDataUrl };
