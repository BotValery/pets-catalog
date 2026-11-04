// Хранение фотографий файлами вместо base64 в базе данных.
// Каждое фото сохраняется так:
//   /uploads/<id>.jpg    — фото целиком, до 1600px по большей стороне (страница животного)
//   /uploads/<id>_c.jpg  — обложка для карточек 640x480 (4:3): кадр из редактора
//                          или автоматический кадр (у вертикальных фото — чуть выше центра)
// В базе хранится только адрес полного фото, адрес обложки получается заменой «.jpg» на «_c.jpg».
//
// На вход storePhotos принимает элементы двух видов:
//   'data:image/...;base64,...'  или  '/uploads/<id>.jpg'                   — как есть
//   { src: <одно из двух выше>, crop: {x, y, w, h}, rotate: 0|90|180|270 }   — с кадрированием
// crop — доли (0..1) от размеров уже повёрнутого фото, rotate — поворот по часовой стрелке.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads');
const URL_PREFIX = '/uploads/';
const FULL_SIZE = 1600;
const COVER_W = 640;
const COVER_H = 480;
const AUTO_TOP_BIAS = 0.35; // 0.5 — строго по центру, 0 — по верхнему краю
const MAX_PHOTOS = 10;
const MAX_INPUT_BYTES = 15 * 1024 * 1024; // одно фото до 15 МБ
const STORED_URL = /^\/uploads\/([a-f0-9]{32})(?:_t|_c)?\.jpg$/;

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const fullPath = id => path.join(UPLOADS_DIR, `${id}.jpg`);
const coverPath = id => path.join(UPLOADS_DIR, `${id}_c.jpg`);
const oldThumbPath = id => path.join(UPLOADS_DIR, `${id}_t.jpg`); // превью прежнего формата
const newId = () => crypto.randomBytes(16).toString('hex');

// Адрес обложки для адреса полного фото (для старых base64-данных возвращает их как есть)
function thumbUrl(url) {
    const m = typeof url === 'string' && url.match(STORED_URL);
    return m ? `${URL_PREFIX}${m[1]}_c.jpg` : url;
}

function normalizeRotate(value) {
    const r = ((Math.round(Number(value) / 90) * 90) % 360 + 360) % 360;
    return [0, 90, 180, 270].includes(r) ? r : 0;
}

// Проверить и привести рамку к допустимым долям; null — рамки нет
function normalizeCrop(crop) {
    if (!crop || typeof crop !== 'object') return null;
    let { x, y, w, h } = crop;
    [x, y, w, h] = [x, y, w, h].map(Number);
    if (![x, y, w, h].every(Number.isFinite)) return null;
    x = Math.min(Math.max(x, 0), 1); y = Math.min(Math.max(y, 0), 1);
    w = Math.min(Math.max(w, 0), 1 - x); h = Math.min(Math.max(h, 0), 1 - y);
    if (w < 0.02 || h < 0.02) return null;
    return { x, y, w, h };
}

// Построить обложку 640x480 из уже повёрнутого изображения
async function writeCover(orientedBuffer, crop, outPath) {
    let img = sharp(orientedBuffer);
    if (crop) {
        const { width, height } = await img.metadata();
        const left = Math.floor(crop.x * width), top = Math.floor(crop.y * height);
        const w = Math.max(1, Math.min(width - left, Math.round(crop.w * width)));
        const h = Math.max(1, Math.min(height - top, Math.round(crop.h * height)));
        img = img.extract({ left, top, width: w, height: h })
            .resize({ width: COVER_W, height: COVER_H, fit: 'cover' });
    } else {
        // Автоматический кадр 4:3. У вертикальных фото берём область чуть выше центра (35% запаса сверху):
        // голова животного обычно в верхней половине снимка. Поиск «главного» средствами sharp
        // на фото животных проверяли — он цепляется за контрастный фон (доски, сетку, мебель).
        const { width, height } = await img.metadata();
        const targetH = Math.round(width * COVER_H / COVER_W);
        if (targetH < height) {
            const top = Math.round((height - targetH) * AUTO_TOP_BIAS);
            img = img.extract({ left: 0, top, width, height: targetH });
        } else {
            const targetW = Math.min(width, Math.round(height * COVER_W / COVER_H));
            img = img.extract({ left: Math.round((width - targetW) / 2), top: 0, width: targetW, height });
        }
        img = img.resize({ width: COVER_W, height: COVER_H, fit: 'cover' });
    }
    await img.flatten({ background: '#ffffff' }).jpeg({ quality: 78, mozjpeg: true }).toFile(outPath);
}

// Сохранить изображение (буфер) с поворотом и рамкой. Возвращает адрес или null.
async function saveImage(input, { crop = null, rotate = 0 } = {}) {
    const id = newId();
    try {
        // rotate() без аргумента — поворот по EXIF с телефона, затем поворот из редактора
        let oriented = sharp(input, { failOn: 'error', limitInputPixels: 80e6 }).rotate();
        if (rotate) oriented = sharp(await oriented.toBuffer()).rotate(rotate);
        const orientedBuffer = await oriented
            .resize({ width: FULL_SIZE, height: FULL_SIZE, fit: 'inside', withoutEnlargement: true })
            .flatten({ background: '#ffffff' })
            .jpeg({ quality: 80, mozjpeg: true })
            .toBuffer();
        await fs.promises.writeFile(fullPath(id), orientedBuffer);
        await writeCover(orientedBuffer, crop, coverPath(id));
        return `${URL_PREFIX}${id}.jpg`;
    } catch (error) {
        console.warn('⚠️ Не удалось обработать фото:', error.message);
        removeFiles([`${URL_PREFIX}${id}.jpg`]);
        return null;
    }
}

// Сохранить одно фото из data:image/...;base64
async function saveDataUrl(dataUrl, opts) {
    const m = /^data:image\/(jpeg|jpg|png|webp|gif|heic|heif|avif);base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
    if (!m) return null;
    const input = Buffer.from(m[2], 'base64');
    if (input.length === 0 || input.length > MAX_INPUT_BYTES) return null;
    return saveImage(input, opts);
}

// Привести список фото к адресам файлов (см. описание форматов в начале файла)
async function storePhotos(list, maxPhotos = MAX_PHOTOS) {
    if (!Array.isArray(list)) return [];
    const result = [];
    for (const raw of list.slice(0, maxPhotos)) {
        const item = typeof raw === 'string' ? { src: raw } : (raw && typeof raw === 'object' ? raw : null);
        if (!item || typeof item.src !== 'string') continue;
        const crop = normalizeCrop(item.crop);
        const rotate = normalizeRotate(item.rotate);
        const edited = Boolean(crop) || rotate !== 0;

        const stored = item.src.match(STORED_URL);
        if (stored) {
            const id = stored[1];
            if (!fs.existsSync(fullPath(id))) continue;
            if (!edited) {
                if (!fs.existsSync(coverPath(id))) await rebuildCover(id); // старое фото без обложки
                result.push(`${URL_PREFIX}${id}.jpg`);
            } else {
                // Изменённое фото получает новое имя, чтобы браузеры не показывали старую обложку из кэша
                const url = await saveImage(await fs.promises.readFile(fullPath(id)), { crop, rotate });
                result.push(url || `${URL_PREFIX}${id}.jpg`);
            }
            continue;
        }
        if (item.src.startsWith('data:image/')) {
            const url = await saveDataUrl(item.src, { crop, rotate });
            if (url) result.push(url);
        }
    }
    return [...new Set(result)];
}

// Пересоздать автоматическую обложку для уже сохранённого фото
async function rebuildCover(id) {
    try {
        await writeCover(await fs.promises.readFile(fullPath(id)), null, coverPath(id));
        return true;
    } catch (error) {
        console.warn('⚠️ Не удалось сделать обложку', id, error.message);
        return false;
    }
}

// Удалить файлы фото (полный размер, обложку и превью прежнего формата)
function removeFiles(urls) {
    for (const url of urls || []) {
        const m = typeof url === 'string' && url.match(STORED_URL);
        if (!m) continue;
        for (const p of [fullPath(m[1]), coverPath(m[1]), oldThumbPath(m[1])]) {
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

module.exports = {
    UPLOADS_DIR, URL_PREFIX, storePhotos, removeFiles, removeReplaced, parseStored,
    thumbUrl, saveDataUrl, rebuildCover, fullPath, coverPath, oldThumbPath
};
