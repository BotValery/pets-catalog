const axios = require('axios');
const cheerio = require('cheerio');
const db = require('../config/database');

const GOSVET_URL = 'https://gosvet.75.ru/novosti';

/**
 * Парсинг новостей с сайта госветслужбы
 */
async function parseNewsFromGosvet() {
    try {
        console.log('📰 Начало парсинга новостей с gosvet.75.ru...');
        
        // Получаем HTML страницы
        const response = await axios.get(GOSVET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data);
        const newsItems = [];

        // Ищем новости на странице
        // Судя по структуре сайта, новости имеют формат: "DD.MM.YYYY Заголовок"
        
        // Вариант 1: Ищем все элементы с текстом, содержащим дату и заголовок
        const processedTitles = new Set();
        
        // Сначала ищем все ссылки, которые могут вести на новости
        const newsLinks = new Map(); // title -> link
        
        $('a[href*="novosti"], a[href*="news"]').each((index, element) => {
            const $link = $(element);
            const href = $link.attr('href');
            const text = $link.text().trim();
            
            if (href && text.length > 10) {
                // Ищем дату в тексте ссылки
                const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})/);
                if (dateMatch) {
                    const title = text.replace(/\d{2}\.\d{2}\.\d{4}\s*/, '').trim();
                    if (title.length > 15) {
                        let fullLink = href;
                        if (!fullLink.startsWith('http')) {
                            fullLink = fullLink.startsWith('/') ? `https://gosvet.75.ru${fullLink}` : `https://gosvet.75.ru/${fullLink}`;
                        }
                        newsLinks.set(title, fullLink);
                    }
                }
            }
        });
        
        // Ищем в ссылках и блоках
        // Сначала собираем все потенциальные новости
        const potentialNews = [];
        
        $('a, div, li, p, span, td').each((index, element) => {
            const $el = $(element);
            const text = $el.text().trim();
            
            // Ищем паттерн: дата (DD.MM.YYYY) + заголовок
            // Улучшенный паттерн для более точного поиска
            const datePattern = /^(\d{2}\.\d{2}\.\d{4})\s+(.+?)(?:\s*$|\s*[\.\n])/;
            const match = text.match(datePattern);
            
            if (match) {
                const [, dateStr, title] = match;
                const cleanTitle = title.trim();
                
                // Пропускаем, если это не новость
                if (cleanTitle.length < 15 || 
                    cleanTitle.includes('Назад') || 
                    cleanTitle.includes('Далее') || 
                    cleanTitle.match(/^\d+$/) || // Только цифры
                    cleanTitle.includes('Размер шрифта') ||
                    cleanTitle.includes('Цветовая схема') ||
                    cleanTitle.includes('Изображения') ||
                    processedTitles.has(cleanTitle)) {
                    return;
                }
                
                // Преобразуем дату из DD.MM.YYYY в YYYY-MM-DD
                const [day, month, year] = dateStr.split('.');
                const isoDate = `${year}-${month}-${day}`;
                
                // Проверяем, что дата валидна и не слишком старая (не старше 2 лет)
                const date = new Date(isoDate);
                if (isNaN(date.getTime())) {
                    return;
                }
                
                const twoYearsAgo = new Date();
                twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
                if (date < twoYearsAgo) {
                    return; // Пропускаем слишком старые новости
                }
                
                processedTitles.add(cleanTitle);
                
                // Получаем ссылку на полную новость
                let link = $el.attr('href') || $el.find('a').first().attr('href') || $el.closest('a').attr('href');
                
                // Если ссылка не найдена, ищем в нашей карте ссылок
                if (!link && newsLinks.has(cleanTitle)) {
                    link = newsLinks.get(cleanTitle);
                }
                
                // Если все еще нет ссылки, пытаемся найти родительскую ссылку
                if (!link) {
                    const parentLink = $el.closest('a');
                    if (parentLink.length) {
                        link = parentLink.attr('href');
                    }
                }
                
                if (link && !link.startsWith('http')) {
                    link = link.startsWith('/') ? `https://gosvet.75.ru${link}` : `https://gosvet.75.ru/${link}`;
                }
                
                // Определяем важность по ключевым словам
                const importantKeywords = ['важно', 'обязательно', 'карантин', 'бешенство', 'опасно', 'срочно'];
                const isImportant = importantKeywords.some(keyword => 
                    cleanTitle.toLowerCase().includes(keyword)
                );
                
                // Пытаемся получить краткое описание из текущей страницы
                let content = cleanTitle;
                
                // Ищем описание в родительском элементе или соседних
                const parent = $el.parent();
                const nextSibling = $el.next();
                
                if (nextSibling.length && nextSibling.text().trim().length > 30) {
                    const siblingText = nextSibling.text().trim();
                    if (!siblingText.match(/^\d{2}\.\d{2}\.\d{4}/)) { // Не дата следующей новости
                        content = siblingText.substring(0, 300);
                    }
                } else if (parent.text().trim().length > cleanTitle.length + 30) {
                    const parentText = parent.text().trim();
                    // Извлекаем текст после заголовка
                    const titleIndex = parentText.indexOf(cleanTitle);
                    if (titleIndex !== -1) {
                        const afterTitle = parentText.substring(titleIndex + cleanTitle.length).trim();
                        if (afterTitle.length > 30 && !afterTitle.match(/^\d{2}\.\d{2}\.\d{4}/)) {
                            content = afterTitle.substring(0, 300);
                        }
                    }
                }
                
                // Если контент все еще равен заголовку, пытаемся найти больше информации на странице
                if (content === cleanTitle || content.length < 50) {
                    // Ищем следующий элемент после заголовка, который может содержать описание
                    const nextElements = $el.nextAll().slice(0, 3);
                    for (let i = 0; i < nextElements.length; i++) {
                        const nextText = $(nextElements[i]).text().trim();
                        if (nextText.length > 50 && 
                            !nextText.match(/^\d{2}\.\d{2}\.\d{4}/) && 
                            nextText !== cleanTitle &&
                            !nextText.includes('Назад') &&
                            !nextText.includes('Далее')) {
                            content = nextText.substring(0, 500);
                            break;
                        }
                    }
                    
                    // Если все еще нет контента, добавляем дефолтное сообщение
                    if (content === cleanTitle || content.length < 50) {
                        content = cleanTitle + '. Подробнее на сайте Государственной ветеринарной службы Забайкальского края.';
                    }
                }
                
                potentialNews.push({
                    title: cleanTitle,
                    content: content,
                    source: 'Государственная ветеринарная служба Забайкальского края',
                    date: isoDate,
                    important: isImportant,
                    externalLink: link || null,
                    $el: $el // Сохраняем элемент для дальнейшей обработки
                });
            }
        });
        
        // Теперь обрабатываем каждую новость асинхронно
        for (const newsItem of potentialNews) {
            // Если есть ссылка, получаем полный текст новости
            if (newsItem.externalLink && newsItem.externalLink.startsWith('http') && newsItem.externalLink.includes('gosvet.75.ru')) {
                try {
                    console.log(`📄 Получаем полный текст для: ${newsItem.title.substring(0, 50)}...`);
                    const fullResponse = await axios.get(newsItem.externalLink, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                        },
                        timeout: 15000
                    });
                    const $full = cheerio.load(fullResponse.data);
                    
                    // Ищем основной контент новости - пробуем разные селекторы
                    let articleContent = '';
                    
                    // Агрессивно удаляем все лишнее: навигацию, сайдбары, списки новостей, меню
                    $full('script, style, nav, header, footer, .menu, .sidebar, aside, .aside, .side, .side-bar, .sidebar-menu, .news-list, .news-sidebar, .related-news, .other-news, .similar-news, .breadcrumb, .breadcrumbs, .navigation, .nav, .header, .footer, .footer-menu, .social, .share, .tags, .comments, .comment, .author, .meta, .date-time, .date, time, .views, .rating').remove();
                    
                    // Удаляем все ссылки, которые ведут на другие новости (списки новостей)
                    $full('a[href*="novosti"], a[href*="news"]').each((i, el) => {
                        const $link = $full(el);
                        const linkText = $link.text().trim();
                        // Если это ссылка на другую новость (содержит дату в формате DD.MM.YYYY), удаляем её
                        if (linkText.match(/\d{2}\.\d{2}\.\d{4}/) && linkText !== newsItem.title) {
                            $link.remove();
                        }
                    });
                    
                    // Удаляем списки (ul, ol) которые могут содержать другие новости
                    $full('ul, ol').each((i, el) => {
                        const $list = $full(el);
                        const listText = $list.text();
                        // Если список содержит много дат (другие новости), удаляем его
                        const dateMatches = listText.match(/\d{2}\.\d{2}\.\d{4}/g);
                        if (dateMatches && dateMatches.length > 1) {
                            $list.remove();
                        }
                    });
                    
                    // Вариант 1: Ищем основной контент в центральной колонке или статье
                    // Приоритет: ищем блоки, которые содержат заголовок нашей новости
                    const contentSelectors = [
                        'article',
                        'main article',
                        '.article-content',
                        '.news-content',
                        '.news-text',
                        '.content',
                        '.text',
                        'main .content',
                        'main .text',
                        '[class*="article"]',
                        '[class*="content"]',
                        '[class*="text"]',
                        'main',
                        '.post',
                        '.entry'
                    ];
                    
                    let mainContentBlock = null;
                    
                    // Сначала ищем блок, который содержит заголовок нашей новости
                    for (const selector of contentSelectors) {
                        const blocks = $full(selector);
                        for (let i = 0; i < blocks.length; i++) {
                            const block = blocks.eq(i);
                            const blockText = block.text();
                            // Проверяем, содержит ли блок заголовок нашей новости
                            if (blockText.includes(newsItem.title) || blockText.includes(newsItem.title.substring(0, 30))) {
                                mainContentBlock = block;
                                break;
                            }
                        }
                        if (mainContentBlock) break;
                    }
                    
                    // Если не нашли блок с заголовком, берем первый подходящий блок
                    if (!mainContentBlock) {
                        for (const selector of contentSelectors) {
                            const found = $full(selector).first();
                            if (found.length && found.text().trim().length > 200) {
                                mainContentBlock = found;
                                break;
                            }
                        }
                    }
                    
                    // Извлекаем контент из найденного блока
                    if (mainContentBlock && mainContentBlock.length) {
                        // Удаляем из блока все лишнее: заголовки других новостей, ссылки на другие новости
                        mainContentBlock.find('h1, h2, h3, h4, h5, h6').each((i, el) => {
                            const $heading = $full(el);
                            const headingText = $heading.text().trim();
                            // Если заголовок не наш, удаляем его
                            if (headingText !== newsItem.title && !headingText.includes(newsItem.title.substring(0, 20))) {
                                $heading.remove();
                            }
                        });
                        
                        // Извлекаем только параграфы из основного блока
                        const paragraphs = mainContentBlock.find('p').map((i, el) => {
                            let pText = $full(el).text().trim();
                            // Пропускаем короткие параграфы, даты, заголовки других новостей
                            if (pText.length > 50 && 
                                pText !== newsItem.title && 
                                !pText.match(/^\d{2}\.\d{2}\.\d{4}/) &&
                                !pText.match(/^В Забайкалье|^Госветслужба|^Ветврачи|^Проведение|^Информация|^Карантин/) &&
                                !pText.includes('Фото Государственной ветеринарной службы')) {
                                return pText;
                            }
                            return null;
                        }).get().filter(p => p !== null);
                        
                        if (paragraphs.length > 0) {
                            articleContent = paragraphs.join(' ').trim();
                        } else {
                            // Если параграфов нет, берем весь текст блока, но очищаем его
                            let blockText = mainContentBlock.text().trim();
                            
                            // Удаляем заголовок, если он есть в начале
                            if (blockText.startsWith(newsItem.title)) {
                                blockText = blockText.substring(newsItem.title.length).trim();
                            }
                            
                            // Удаляем дату в начале
                            blockText = blockText.replace(/^\d{2}\.\d{2}\.\d{4}.*?\n/, '').trim();
                            
                            // Удаляем подписи к фото
                            blockText = blockText.replace(/Фото Государственной ветеринарной службы.*?\n?/gi, '').trim();
                            
                            
                            // Удаляем заголовки других новостей (строки, начинающиеся с даты)
                            blockText = blockText.split('\n').filter(line => {
                                const trimmed = line.trim();
                                return !trimmed.match(/^\d{2}\.\d{2}\.\d{4}/) && 
                                       trimmed.length > 30 &&
                                       !trimmed.match(/^(В Забайкалье|Госветслужба|Ветврачи|Проведение|Информация|Карантин)/);
                            }).join(' ').trim();
                            
                            if (blockText.length > 100) {
                                articleContent = blockText;
                            }
                        }
                    }
                    
                    // Если все еще не нашли, пробуем найти параграфы в основном контенте страницы
                    if (!articleContent || articleContent.length < 100) {
                        // Удаляем все, что может быть сайдбаром или списком новостей
                        $full('aside, .sidebar, .side, .news-list, ul, ol').remove();
                        
                        const paragraphs = $full('main p, article p, .content p, .text p, [class*="content"] p, [class*="article"] p').map((i, el) => {
                            let pText = $full(el).text().trim();
                            // Пропускаем короткие параграфы, даты, заголовки других новостей
                            if (pText.length > 50 && 
                                pText !== newsItem.title && 
                                !pText.match(/^\d{2}\.\d{2}\.\d{4}/) &&
                                !pText.match(/^(В Забайкалье|Госветслужба|Ветврачи|Проведение|Информация|Карантин)/) &&
                                !pText.includes('Фото Государственной ветеринарной службы')) {
                                return pText;
                            }
                            return null;
                        }).get().filter(p => p !== null);
                        
                        if (paragraphs.length > 0) {
                            articleContent = paragraphs.join(' ').trim();
                        }
                    }
                    
                    // Очищаем контент от лишних пробелов и переносов
                    if (articleContent) {
                        articleContent = articleContent
                            .replace(/\s+/g, ' ')
                            .replace(/\n+/g, '\n')
                            .trim();
                        
                        // Удаляем заголовок, если он есть в начале
                        if (articleContent.startsWith(newsItem.title)) {
                            articleContent = articleContent.substring(newsItem.title.length).trim();
                        }
                        
                        // Удаляем дату, если она есть в начале
                        articleContent = articleContent.replace(/^\d{2}\.\d{2}\.\d{4}.*?\s+/, '').trim();
                        
                        // Удаляем подписи к фото
                        articleContent = articleContent.replace(/Фото Государственной ветеринарной службы.*?/gi, '').trim();
                        
                        
                        // Удаляем строки, которые выглядят как заголовки других новостей
                        // (короткие строки, начинающиеся с определенных слов и заканчивающиеся точкой)
                        const lines = articleContent.split(/[.!?]\s+/);
                        articleContent = lines.filter(line => {
                            const trimmed = line.trim();
                            // Пропускаем очень короткие строки (менее 30 символов), которые могут быть заголовками
                            if (trimmed.length < 30) {
                                return false;
                            }
                            // Пропускаем строки, которые начинаются с типичных начал заголовков других новостей
                            if (trimmed.match(/^(В Забайкалье|Госветслужба|Ветврачи|Проведение|Информация|Карантин|Управление|Администрация)/)) {
                                return false;
                            }
                            // Пропускаем строки с датами в начале
                            if (trimmed.match(/^\d{2}\.\d{2}\.\d{4}/)) {
                                return false;
                            }
                            return true;
                        }).join('. ').trim();
                        
                        
                        // Финальная очистка: удаляем множественные пробелы и переносы
                        articleContent = articleContent.replace(/\s{2,}/g, ' ').trim();
                        
                        if (articleContent.length > 50) {
                            newsItem.content = articleContent; // Сохраняем полный текст без ограничений
                            console.log(`✅ Получен контент для "${newsItem.title.substring(0, 50)}...": ${newsItem.content.length} символов`);
                        } else {
                            console.log(`⚠️ Контент слишком короткий для "${newsItem.title.substring(0, 50)}...": ${articleContent.length} символов`);
                        }
                    } else {
                        console.log(`⚠️ Контент не найден для "${newsItem.title.substring(0, 50)}..."`);
                    }
                } catch (err) {
                    console.log(`❌ Не удалось получить полный текст для ${newsItem.externalLink}: ${err.message}`);
                    // Оставляем контент, полученный из списка новостей
                }
            } else {
                console.log(`⚠️ Ссылка не найдена для новости: ${newsItem.title.substring(0, 50)}...`);
            }
            
            newsItems.push({
                title: newsItem.title,
                content: newsItem.content, // Сохраняем полный текст без ограничений
                source: newsItem.source,
                date: newsItem.date,
                important: newsItem.important,
                externalLink: newsItem.externalLink
            });
        }

        // Если не нашли новости первым способом, пробуем альтернативный
        if (newsItems.length === 0) {
            // Вариант 2: Ищем новости в структурированных блоках
            $('.news-item, .news-list-item, article, [class*="news"]').each((index, element) => {
                const $el = $(element);
                const titleEl = $el.find('h1, h2, h3, h4, .title, .news-title').first();
                const dateEl = $el.find('.date, .news-date, time').first();
                const contentEl = $el.find('.content, .text, .news-content, p').first();
                
                if (titleEl.length && dateEl.length) {
                    const title = titleEl.text().trim();
                    const dateText = dateEl.text().trim();
                    const content = contentEl.length ? contentEl.text().trim() : title;
                    
                    // Парсим дату
                    const datePattern = /(\d{2}\.\d{2}\.\d{4})/;
                    const dateMatch = dateText.match(datePattern);
                    
                    if (dateMatch && title.length > 10) {
                        const [day, month, year] = dateMatch[1].split('.');
                        const isoDate = `${year}-${month}-${day}`;
                        
                        newsItems.push({
                            title: title,
                            content: content.substring(0, 500),
                            source: 'Государственная ветеринарная служба Забайкальского края',
                            date: isoDate,
                            important: false,
                            externalLink: null
                        });
                    }
                }
            });
        }

        // Удаляем дубликаты по заголовку и дате
        const uniqueNews = [];
        const seen = new Set();
        
        for (const news of newsItems) {
            const key = `${news.title}_${news.date}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueNews.push(news);
            }
        }

        console.log(`✅ Найдено ${uniqueNews.length} уникальных новостей`);
        
        return uniqueNews;
    } catch (error) {
        console.error('❌ Ошибка парсинга новостей:', error.message);
        throw error;
    }
}

/**
 * Проверка и создание таблицы news, если её нет
 */
async function ensureNewsTable() {
    try {
        const tableExists = await db.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='news'"
        );

        if (!tableExists) {
            console.log('📦 Таблица news не найдена, создаём...');
            await db.run(`
                CREATE TABLE IF NOT EXISTS news (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    source TEXT NOT NULL,
                    date TEXT NOT NULL,
                    important BOOLEAN DEFAULT 0,
                    externalLink TEXT,
                    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_date ON news(date)');
            await db.run('CREATE INDEX IF NOT EXISTS idx_news_important ON news(important)');
            console.log('✅ Таблица news создана');
        } else {
            // Проверяем наличие колонки externalLink
            const tableInfo = await db.all("PRAGMA table_info(news)");
            const hasExternalLink = tableInfo.some(col => col.name === 'externalLink');
            
            if (!hasExternalLink) {
                console.log('📦 Добавление колонки externalLink в таблицу news...');
                await db.run('ALTER TABLE news ADD COLUMN externalLink TEXT');
                console.log('✅ Колонка externalLink добавлена');
            }
        }
    } catch (error) {
        console.error('❌ Ошибка создания таблицы news:', error);
        throw error;
    }
}

/**
 * Сохранение новостей в базу данных с проверкой на дубликаты
 */
async function saveNewsToDatabase(newsItems) {
    try {
        await db.connect();
        
        // Убеждаемся, что таблица существует
        await ensureNewsTable();
        
        let savedCount = 0;
        let skippedCount = 0;
        
        for (const news of newsItems) {
            // Проверяем, существует ли уже такая новость
            const existing = await db.get(
                'SELECT id FROM news WHERE title = ? AND date = ?',
                [news.title, news.date]
            );
            
            if (!existing) {
                // Сохраняем новую новость
                await db.run(
                    'INSERT INTO news (title, content, source, date, important, externalLink) VALUES (?, ?, ?, ?, ?, ?)',
                    [news.title, news.content, news.source, news.date, news.important ? 1 : 0, news.externalLink || null]
                );
                savedCount++;
            } else {
                // Обновляем контент существующей новости, если он изменился или слишком короткий
                const existingNews = await db.get('SELECT content FROM news WHERE title = ? AND date = ?', [news.title, news.date]);
                const shouldUpdate = !existingNews || 
                    existingNews.content.length < news.content.length || 
                    existingNews.content === news.title || 
                    existingNews.content.length < 50 ||
                    (existingNews.content.length < 100 && news.content.length > 100);
                
                if (shouldUpdate && news.content.length > (existingNews?.content.length || 0)) {
                    await db.run(
                        'UPDATE news SET content = ?, externalLink = ? WHERE title = ? AND date = ?',
                        [news.content, news.externalLink || null, news.title, news.date]
                    );
                    console.log(`✅ Обновлен контент новости: ${news.title} (было: ${existingNews?.content.length || 0} символов, стало: ${news.content.length})`);
                    savedCount++; // Считаем как обновленную
                } else {
                    skippedCount++;
                }
            }
        }
        
        console.log(`✅ Сохранено/обновлено новостей: ${savedCount}, пропущено дубликатов: ${skippedCount}`);
        
        return { saved: savedCount, skipped: skippedCount };
    } catch (error) {
        console.error('❌ Ошибка сохранения новостей:', error);
        throw error;
    }
}

/**
 * Основная функция синхронизации новостей
 */
async function syncNews() {
    try {
        console.log('🔄 Начало синхронизации новостей...');
        
        const newsItems = await parseNewsFromGosvet();
        
        if (newsItems.length === 0) {
            console.log('⚠️ Новости не найдены');
            return { success: false, message: 'Новости не найдены', saved: 0, skipped: 0 };
        }
        
        const result = await saveNewsToDatabase(newsItems);
        
        console.log('✅ Синхронизация завершена успешно');
        
        return {
            success: true,
            message: `Синхронизация завершена. Найдено: ${newsItems.length}, Сохранено новых: ${result.saved}, Пропущено: ${result.skipped}`,
            ...result,
            total: newsItems.length
        };
    } catch (error) {
        console.error('❌ Ошибка синхронизации:', error);
        return {
            success: false,
            message: `Ошибка синхронизации: ${error.message}`,
            saved: 0,
            skipped: 0
        };
    }
}

// Если скрипт запущен напрямую
if (require.main === module) {
    syncNews()
        .then(result => {
            console.log('Результат:', result);
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Критическая ошибка:', error);
            process.exit(1);
        });
}

module.exports = { syncNews, parseNewsFromGosvet };

