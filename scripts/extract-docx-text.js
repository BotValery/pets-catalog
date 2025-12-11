const fs = require('fs');
const path = require('path');

// Простой метод извлечения текста из .docx через ZIP (так как .docx - это ZIP архив)
function extractTextFromDocx(filePath) {
    try {
        // Пробуем использовать adm-zip, если установлен
        let AdmZip;
        try {
            AdmZip = require('adm-zip');
        } catch (e) {
            console.log('Устанавливаю библиотеку adm-zip...');
            const { execSync } = require('child_process');
            execSync('npm install adm-zip --save-dev', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
            AdmZip = require('adm-zip');
        }

        const zip = new AdmZip(filePath);
        const xml = zip.readAsText('word/document.xml', 'utf8');
        
        // Извлекаем текст из XML
        const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
        if (textMatches) {
            let text = textMatches
                .map(match => {
                    let content = match.replace(/<[^>]+>/g, '');
                    // Декодируем HTML entities
                    content = content.replace(/&lt;/g, '<');
                    content = content.replace(/&gt;/g, '>');
                    content = content.replace(/&amp;/g, '&');
                    content = content.replace(/&quot;/g, '"');
                    content = content.replace(/&apos;/g, "'");
                    return content;
                })
                .join('')
                .replace(/\s+/g, ' ')
                .trim();
            
            // Разбиваем на параграфы (группируем по </w:p>)
            const paragraphs = xml.match(/<w:p[^>]*>[\s\S]*?<\/w:p>/g);
            if (paragraphs) {
                const paragraphTexts = paragraphs.map(p => {
                    const tMatches = p.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
                    if (tMatches) {
                        return tMatches
                            .map(m => m.replace(/<[^>]+>/g, ''))
                            .map(m => {
                                m = m.replace(/&lt;/g, '<');
                                m = m.replace(/&gt;/g, '>');
                                m = m.replace(/&amp;/g, '&');
                                m = m.replace(/&quot;/g, '"');
                                m = m.replace(/&apos;/g, "'");
                                return m;
                            })
                            .join('');
                    }
                    return '';
                }).filter(p => p.trim().length > 0);
                
                return paragraphTexts.join('\n\n');
            }
            
            return text;
        }
        return null;
    } catch (error) {
        console.error(`Ошибка при чтении ${filePath}:`, error.message);
        return null;
    }
}

async function main() {
    const baseDir = path.join(__dirname, '..');
    const files = [
        path.join(baseDir, 'Политика конфиденциальности.docx'),
        path.join(baseDir, 'Согласие.docx')
    ];

    const results = {};

    for (const filePath of files) {
        const fileName = path.basename(filePath);
        if (fs.existsSync(filePath)) {
            console.log(`Обрабатываю: ${fileName}...`);
            const text = extractTextFromDocx(filePath);
            if (text) {
                results[fileName] = text;
                // Сохраняем в файл для удобства
                const outputFile = filePath.replace('.docx', '.txt');
                fs.writeFileSync(outputFile, text, 'utf8');
                console.log(`✓ Текст сохранен в ${path.basename(outputFile)}`);
            } else {
                console.log(`✗ Не удалось извлечь текст из ${fileName}`);
            }
        } else {
            console.log(`✗ Файл ${fileName} не найден`);
        }
    }

    return results;
}

if (require.main === module) {
    main().then(results => {
        console.log('\n=== Извлечение завершено ===');
        // Выводим результаты
        for (const [fileName, text] of Object.entries(results)) {
            console.log(`\n=== ${fileName} ===\n`);
            console.log(text.substring(0, 500) + '...\n');
        }
    }).catch(console.error);
}

module.exports = { extractTextFromDocx, main };

