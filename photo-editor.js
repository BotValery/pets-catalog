// Редактор обложки карточки (первое фото животного или объявления).
// Подключение к форме:   PhotoCover.attach(form, fileInput)
// Перед отправкой:       photos = PhotoCover.apply(form, photos)
//   — первый элемент превращается в { src, crop, rotate }, если обложку настраивали.
// Если обложку не настраивали, сервер выберет кадр автоматически.
// Нужны cropper.min.js и cropper.min.css (Cropper.js, MIT).
(function () {
    const ASPECT = 4 / 3;

    function el(tag, attrs = {}, children = []) {
        const node = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') node.className = v;
            else if (k === 'text') node.textContent = v;
            else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
            else node.setAttribute(k, v);
        }
        children.forEach(c => node.appendChild(c));
        return node;
    }

    function fileKey(f) { return f ? `file:${f.name}:${f.size}:${f.lastModified}` : null; }

    // Что сейчас является обложкой: первое сохранённое фото или первый выбранный файл
    function currentSource(form, input) {
        let existing = [];
        try { existing = JSON.parse(form.dataset.existingPhotos || '[]'); } catch (e) {}
        if (existing.length && typeof existing[0] === 'string') {
            return { key: 'url:' + existing[0], url: existing[0], saved: true };
        }
        const file = input && input.files && input.files[0];
        if (file && file.type.startsWith('image/')) {
            return { key: fileKey(file), file, saved: false };
        }
        return null;
    }

    // ---------- Модальное окно с рамкой ----------
    function openEditor(imageUrl, initial) {
        return new Promise(resolve => {
            if (typeof Cropper === 'undefined') {
                NotificationSystem.error('Редактор фото не загрузился. Обновите страницу.');
                return resolve(null);
            }
            const img = el('img', { alt: 'Фото для обложки' });
            const zoomOut = el('button', { type: 'button', class: 'pe-btn', title: 'Отдалить', text: '−' });
            const zoomIn = el('button', { type: 'button', class: 'pe-btn', title: 'Приблизить', text: '+' });
            const rotL = el('button', { type: 'button', class: 'pe-btn', title: 'Повернуть влево', text: '⟲' });
            const rotR = el('button', { type: 'button', class: 'pe-btn', title: 'Повернуть вправо', text: '⟳' });
            const cancel = el('button', { type: 'button', class: 'btn-secondary', text: 'Отмена' });
            const done = el('button', { type: 'button', class: 'btn-primary', text: 'Готово' });
            const modal = el('div', { class: 'pe-overlay', role: 'dialog', 'aria-modal': 'true' }, [
                el('div', { class: 'pe-dialog' }, [
                    el('div', { class: 'pe-head' }, [
                        el('h3', { text: 'Обложка карточки' }),
                        el('p', { text: 'Передвиньте фото и рамку так, чтобы животное было хорошо видно. Именно этот кадр покажется в каталоге.' })
                    ]),
                    el('div', { class: 'pe-stage' }, [img]),
                    el('div', { class: 'pe-tools' }, [zoomOut, zoomIn, rotL, rotR]),
                    el('div', { class: 'pe-actions' }, [cancel, done])
                ])
            ]);
            document.body.appendChild(modal);
            document.body.classList.add('pe-open');

            let cropper = null;
            let rotate = 0;
            const close = (result) => {
                if (cropper) cropper.destroy();
                modal.remove();
                document.body.classList.remove('pe-open');
                document.removeEventListener('keydown', onKey);
                resolve(result);
            };
            const onKey = (e) => { if (e.key === 'Escape') close(null); };
            document.addEventListener('keydown', onKey);
            modal.addEventListener('click', (e) => { if (e.target === modal) close(null); });

            img.onload = () => {
                cropper = new Cropper(img, {
                    aspectRatio: ASPECT,
                    viewMode: 1,            // рамка не выходит за пределы фото
                    dragMode: 'move',       // палец/мышь двигают фото
                    autoCropArea: 1,
                    checkOrientation: false,// поворот по EXIF уже делает браузер
                    background: false,
                    responsive: true,
                    toggleDragModeOnDblclick: false,
                    ready() {
                        if (initial && initial.rotate) { cropper.rotate(initial.rotate); rotate = initial.rotate; }
                        if (initial && initial.crop) {
                            const c = cropper.getCanvasData();
                            cropper.setCropBoxData({
                                left: c.left + initial.crop.x * c.width, top: c.top + initial.crop.y * c.height,
                                width: initial.crop.w * c.width, height: initial.crop.h * c.height
                            });
                        }
                    }
                });
            };
            img.onerror = () => { NotificationSystem.error('Не удалось открыть фото'); close(null); };
            img.src = imageUrl;

            zoomIn.onclick = () => cropper && cropper.zoom(0.1);
            zoomOut.onclick = () => cropper && cropper.zoom(-0.1);
            const turn = (deg) => {
                if (!cropper) return;
                rotate = (rotate + deg + 360) % 360;
                cropper.rotate(deg);
                // после поворота растягиваем рамку на всё фото заново
                const c = cropper.getCanvasData();
                cropper.setCropBoxData({ left: c.left, top: c.top, width: c.width, height: c.height });
            };
            rotL.onclick = () => turn(-90);
            rotR.onclick = () => turn(90);
            cancel.onclick = () => close(null);
            done.onclick = () => {
                if (!cropper) return close(null);
                // Рамка в долях от повёрнутого фото — так её понимает сервер
                const c = cropper.getCanvasData();
                const b = cropper.getCropBoxData();
                const crop = {
                    x: (b.left - c.left) / c.width, y: (b.top - c.top) / c.height,
                    w: b.width / c.width, h: b.height / c.height
                };
                let preview = null;
                try { preview = cropper.getCroppedCanvas({ width: 320, height: 240 }).toDataURL('image/jpeg', 0.8); } catch (e) {}
                close({ crop, rotate, preview });
            };
        });
    }

    // ---------- Блок «Обложка» в форме ----------
    function attach(form, input) {
        if (!form || !input || form._coverAttached) return;
        form._coverAttached = true;
        form._cover = null; // { key, crop, rotate, preview }

        const thumb = el('div', { class: 'pe-cover-thumb' });
        const hint = el('div', { class: 'pe-cover-hint' });
        const button = el('button', { type: 'button', class: 'btn-secondary pe-cover-btn', text: '✂️ Настроить обложку' });
        const block = el('div', { class: 'pe-cover', hidden: '' }, [
            thumb, el('div', { class: 'pe-cover-side' }, [el('strong', { text: 'Обложка карточки' }), hint, button])
        ]);
        // ставим блок после превью фото (или сразу после поля выбора файлов)
        const group = input.closest('.form-group') || input.parentElement;
        group.appendChild(block);

        let objectUrl = null;
        function sourceUrl(src) {
            if (src.url) return src.url;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = URL.createObjectURL(src.file);
            return objectUrl;
        }

        function render() {
            const src = currentSource(form, input);
            if (form._cover && (!src || form._cover.key !== src.key)) form._cover = null; // обложка сменилась
            if (!src) { block.hidden = true; return; }
            block.hidden = false;
            thumb.innerHTML = '';
            let previewUrl = null;
            if (form._cover && form._cover.preview) previewUrl = form._cover.preview;
            else if (src.saved && typeof thumbUrl === 'function') previewUrl = thumbUrl(src.url);
            if (previewUrl) thumb.appendChild(el('img', { src: previewUrl, alt: 'Обложка' }));
            else thumb.appendChild(el('span', { text: '🐾' }));
            hint.textContent = form._cover ? 'Кадр выбран вручную' :
                (src.saved ? 'Так выглядит сейчас в каталоге' : 'Кадр подберётся автоматически — или настройте сами');
        }

        async function edit() {
            const src = currentSource(form, input);
            if (!src) return;
            const result = await openEditor(sourceUrl(src), form._cover);
            if (result) form._cover = { key: src.key, ...result };
            render();
        }
        button.addEventListener('click', edit);

        // новый файл стал обложкой — сразу предлагаем кадрировать
        input.addEventListener('change', () => {
            const before = form._cover && form._cover.key;
            render();
            const src = currentSource(form, input);
            if (src && !src.saved && src.key !== before) setTimeout(edit, 150);
        });
        // обложка меняется при загрузке записи на редактирование, удалении фото и сбросе формы
        new MutationObserver(render).observe(form, { attributes: true, attributeFilter: ['data-existing-photos'] });
        form.addEventListener('reset', () => { form._cover = null; setTimeout(render, 0); });
        render();
    }

    function apply(form, photos) {
        if (!form || !form._cover || !Array.isArray(photos) || !photos.length) return photos;
        const input = form.querySelector('input[type="file"]');
        const src = currentSource(form, input);
        if (!src || src.key !== form._cover.key || typeof photos[0] !== 'string') return photos;
        const { crop, rotate } = form._cover;
        return [{ src: photos[0], crop, rotate }, ...photos.slice(1)];
    }

    window.PhotoCover = { attach, apply, openEditor };
})();
