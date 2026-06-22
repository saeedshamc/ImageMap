// --- حالت کلی ---
let currentShape = 'rect';
let areas = [];
let imageLoaded = false;
let imageSrc = '';
let isDrawing = false;
let startX = 0, startY = 0;
let polyPoints = [];
let editingIndex = -1;
let tempOverlay = null;
let lastTouchCoords = null;
let mapName = 'mymap';
let outputImagePath = '';
let imageNaturalWidth = 0;
let imageNaturalHeight = 0;

const imageContainer = document.getElementById('imageContainer');
const coordsDisplay = document.getElementById('coordsDisplay');

// --- آپلود فایل ---
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

// درگ اند دراپ
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        loadImageFile(file);
    } else {
        showToast('لطفا یک فایل عکس انتخاب کنید', 'error');
    }
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) loadImageFile(file);
});

function loadImageFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        setImage(e.target.result);
    };
    reader.readAsDataURL(file);
}

function loadManualUrl() {
    const url = document.getElementById('manualUrl').value.trim();
    if (!url) {
        showToast('لطفا لینک عکس را وارد کنید', 'error');
        return;
    }
    setImage(url);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getOutputImageSrc() {
    const customPath = document.getElementById('outputImagePath')?.value.trim();
    if (customPath) return customPath;
    if (imageSrc.startsWith('data:')) return './your-image.jpg';
    return imageSrc;
}

function setImage(src, options = {}) {
    imageSrc = src;
    imageLoaded = true;
    if (!options.keepAreas) {
        areas = [];
        polyPoints = [];
    }
    updateAreaList();
    updateCode();

    imageContainer.innerHTML = `
        <div class="image-wrapper" id="imageWrapper">
            <div class="drawing-hint" id="drawingHint"></div>
            <div class="area-overlay" id="areaOverlay"></div>
            <img src="${escapeHtml(src)}" id="mapImage" crossorigin="anonymous">
        </div>
    `;

    const img = document.getElementById('mapImage');
    const wrapper = document.getElementById('imageWrapper');

    img.onerror = () => {
        showToast('بارگذاری عکس ناموفق بود؛ مسیر یا لینک را بررسی کنید', 'error');
    };

    img.onload = () => {
        imageNaturalWidth = img.naturalWidth;
        imageNaturalHeight = img.naturalHeight;
        const pathInput = document.getElementById('outputImagePath');
        if (pathInput && !pathInput.value.trim()) {
            pathInput.value = src.startsWith('data:') ? '' : src;
        }
        renderOverlays();
        updateCode();
        updatePreview();
        showToast('عکس با موفقیت بارگذاری شد', 'success');
    };

    // رویدادهای ماوس برای رسم
    wrapper.addEventListener('mousedown', onMouseDown);
    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseup', onMouseUp);
    wrapper.addEventListener('mouseleave', onMouseLeave);

    // رویدادهای لمسی
    wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: false });

    // مخفی کردن بخش آپلود و نمایش ابزارها
    document.getElementById('uploadCard').style.display = 'none';
    document.getElementById('codeCard').style.display = 'block';
    document.getElementById('previewCard').style.display = 'block';
    document.getElementById('outputSettingsCard').style.display = 'block';
    document.getElementById('changeImageBtn').style.display = 'inline-flex';
}

function changeImage() {
    document.getElementById('uploadCard').style.display = 'block';
    document.getElementById('uploadCard').scrollIntoView({ behavior: 'smooth' });
}

// --- گرفتن مختصات نسبی ---
function getCoords(e, element) {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // تبدیل به مختصات عکس واقعی
    const img = document.getElementById('mapImage');
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    return {
        x: Math.round(x * scaleX),
        y: Math.round(y * scaleY),
        cssX: x,
        cssY: y
    };
}

// --- تنظیم شکل ---
function setShape(shape, btn) {
    // اگر در حال رسم چندضلعی هستیم، لغو شود
    if (currentShape === 'poly' && polyPoints.length > 0) {
        polyPoints = [];
        removeTempOverlays();
        hideDrawingHint();
    }
    currentShape = shape;
    document.querySelectorAll('.shape-btn[data-shape]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('undoPointBtn').style.display = 'none';
    document.getElementById('finishPolyBtn').style.display = 'none';
}

// --- رویدادهای ماوس ---
function onMouseDown(e) {
    if (!imageLoaded) return;
    e.preventDefault();

    const wrapper = document.getElementById('imageWrapper');
    const coords = getCoords(e, wrapper);

    if (currentShape === 'poly') {
        // اضافه کردن نقطه
        addPolyPoint(coords);
        return;
    }

    isDrawing = true;
    startX = coords.x;
    startY = coords.y;

    if (currentShape === 'rect') {
        showDrawingHint('موس را رها کنید تا مستطیل کامل شود');
    } else if (currentShape === 'circle') {
        showDrawingHint('موس را رها کنید تا شعاع دایره تعیین شود');
    }
}

function onMouseMove(e) {
    if (!imageLoaded) return;
    const wrapper = document.getElementById('imageWrapper');
    const coords = getCoords(e, wrapper);

    // نمایش مختصات
    coordsDisplay.textContent = `X: ${coords.x}, Y: ${coords.y}`;
    coordsDisplay.classList.add('visible');

    if (!isDrawing) return;

    // رسم پیش‌نمایش
    removeTempOverlays();
    const overlay = document.getElementById('areaOverlay');
    const img = document.getElementById('mapImage');
    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    if (currentShape === 'rect') {
        const left = Math.min(startX, coords.x) * scaleX;
        const top = Math.min(startY, coords.y) * scaleY;
        const width = Math.abs(coords.x - startX) * scaleX;
        const height = Math.abs(coords.y - startY) * scaleY;
        const div = document.createElement('div');
        div.className = 'area-highlight temp';
        div.style.cssText = `left:${left}px; top:${top}px; width:${width}px; height:${height}px; border-style: dashed; opacity: 0.6;`;
        overlay.appendChild(div);
    } else if (currentShape === 'circle') {
        const dx = coords.x - startX;
        const dy = coords.y - startY;
        const radius = Math.round(Math.sqrt(dx * dx + dy * dy));
        const cssRadius = radius * scaleX;
        const cx = startX * scaleX - cssRadius;
        const cy = startY * scaleY - cssRadius;
        const div = document.createElement('div');
        div.className = 'area-highlight circle temp';
        div.style.cssText = `left:${cx}px; top:${cy}px; width:${cssRadius * 2}px; height:${cssRadius * 2}px; border-style: dashed; opacity: 0.6;`;
        overlay.appendChild(div);
    }
}

function onMouseUp(e) {
    if (!isDrawing) return;
    isDrawing = false;
    hideDrawingHint();

    const wrapper = document.getElementById('imageWrapper');
    const coords = getCoords(e, wrapper);
    removeTempOverlays();

    if (currentShape === 'rect') {
        const x1 = Math.min(startX, coords.x);
        const y1 = Math.min(startY, coords.y);
        const x2 = Math.max(startX, coords.x);
        const y2 = Math.max(startY, coords.y);
        if (Math.abs(x2 - x1) < 5 || Math.abs(y2 - y1) < 5) {
            showToast('مستطیل خیلی کوچک است، دوباره تلاش کنید', 'error');
            return;
        }
        addArea('rect', `${x1},${y1},${x2},${y2}`);
    } else if (currentShape === 'circle') {
        const dx = coords.x - startX;
        const dy = coords.y - startY;
        const radius = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (radius < 5) {
            showToast('شعاع خیلی کوچک است، دوباره تلاش کنید', 'error');
            return;
        }
        addArea('circle', `${startX},${startY},${radius}`);
    }
}

function onMouseLeave() {
    coordsDisplay.classList.remove('visible');
    if (isDrawing) {
        isDrawing = false;
        removeTempOverlays();
        hideDrawingHint();
    }
}

// --- رویدادهای لمسی ---
function onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouchCoords = { clientX: touch.clientX, clientY: touch.clientY };
    const mouseEvent = new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY });
    e.target.closest('.image-wrapper').dispatchEvent(mouseEvent);
}

function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouchCoords = { clientX: touch.clientX, clientY: touch.clientY };
    const mouseEvent = new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY });
    e.target.closest('.image-wrapper').dispatchEvent(mouseEvent);
}

function onTouchEnd(e) {
    e.preventDefault();
    if (!lastTouchCoords) return;
    const wrapper = document.getElementById('imageWrapper');
    const mouseEvent = new MouseEvent('mouseup', {
        clientX: lastTouchCoords.clientX,
        clientY: lastTouchCoords.clientY
    });
    wrapper.dispatchEvent(mouseEvent);
}

// --- چندضلعی ---
function addPolyPoint(coords) {
    polyPoints.push({ x: coords.x, y: coords.y, cssX: coords.cssX, cssY: coords.cssY });
    document.getElementById('undoPointBtn').style.display = 'flex';
    document.getElementById('finishPolyBtn').style.display = 'flex';
    showDrawingHint(`${polyPoints.length} نقطه اضافه شد - ادامه دهید یا «اتمام» را بزنید`);
    drawPolyGuides();
}

function drawPolyGuides() {
    const overlay = document.getElementById('areaOverlay');
    overlay.querySelectorAll('.poly-point').forEach(p => p.remove());
    overlay.querySelectorAll('.poly-line').forEach(l => l.remove());

    polyPoints.forEach((pt, i) => {
        const dot = document.createElement('div');
        dot.className = 'poly-point';
        dot.style.cssText = `
            position: absolute; left: ${pt.cssX - 5}px; top: ${pt.cssY - 5}px;
            width: 10px; height: 10px; background: var(--accent); border-radius: 50%;
            pointer-events: none; z-index: 5; box-shadow: 0 0 8px var(--accent);
        `;
        overlay.appendChild(dot);

        if (i > 0) {
            const prev = polyPoints[i - 1];
            const dx = pt.cssX - prev.cssX;
            const dy = pt.cssY - prev.cssY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const line = document.createElement('div');
            line.className = 'poly-line';
            line.style.cssText = `
                position: absolute; left: ${prev.cssX}px; top: ${prev.cssY}px;
                width: ${length}px; height: 2px; background: var(--accent);
                transform-origin: 0 50%; transform: rotate(${angle}deg);
                pointer-events: none; z-index: 4; opacity: 0.7;
            `;
            overlay.appendChild(line);
        }
    });
}

function undoLastPoint() {
    if (polyPoints.length > 0) {
        polyPoints.pop();
        drawPolyGuides();
        if (polyPoints.length === 0) {
            document.getElementById('undoPointBtn').style.display = 'none';
            document.getElementById('finishPolyBtn').style.display = 'none';
            hideDrawingHint();
        } else {
            showDrawingHint(`${polyPoints.length} نقطه اضافه شد`);
        }
    }
}

function finishPoly() {
    if (polyPoints.length < 3) {
        showToast('چندضلعی حداقل ۳ نقطه نیاز دارد', 'error');
        return;
    }
    const coordsStr = polyPoints.map(p => `${p.x},${p.y}`).join(',');
    addArea('poly', coordsStr);
    polyPoints = [];
    const overlay = document.getElementById('areaOverlay');
    overlay.querySelectorAll('.poly-point').forEach(p => p.remove());
    overlay.querySelectorAll('.poly-line').forEach(l => l.remove());
    document.getElementById('undoPointBtn').style.display = 'none';
    document.getElementById('finishPolyBtn').style.display = 'none';
    hideDrawingHint();
}

// --- افزودن ناحیه ---
function addArea(shape, coords) {
    const name = document.getElementById('areaName').value.trim() || `ناحیه ${areas.length + 1}`;
    const href = document.getElementById('areaHref').value.trim() || '#';
    const alt = document.getElementById('areaAlt').value.trim() || name;
    const target = document.getElementById('areaTarget').value;

    areas.push({ shape, coords, name, href, alt, target });
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    showToast(`ناحیه «${name}» اضافه شد`, 'success');

    // پاک کردن فیلدها
    document.getElementById('areaName').value = '';
    document.getElementById('areaAlt').value = '';
}

// --- رندر اورلی‌ها ---
function renderOverlays() {
    const overlay = document.getElementById('areaOverlay');
    if (!overlay) return;
    // حذف اورلی‌های قبلی (غیر temp و غیر poly)
    overlay.querySelectorAll('.area-highlight:not(.temp)').forEach(el => el.remove());
    // حذف نقاط و خطوط چندضلعی هم که باقی مانده
    overlay.querySelectorAll('.poly-point, .poly-line').forEach(el => el.remove());

    const img = document.getElementById('mapImage');
    if (!img) return;
    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    areas.forEach((area, i) => {
        const div = document.createElement('div');
        div.className = 'area-highlight' + (area.shape === 'circle' ? ' circle' : '');
        div.onclick = () => openEditModal(i);

        if (area.shape === 'rect') {
            const [x1, y1, x2, y2] = area.coords.split(',').map(Number);
            div.style.left = (x1 * scaleX) + 'px';
            div.style.top = (y1 * scaleY) + 'px';
            div.style.width = ((x2 - x1) * scaleX) + 'px';
            div.style.height = ((y2 - y1) * scaleY) + 'px';
        } else if (area.shape === 'circle') {
            const [cx, cy, r] = area.coords.split(',').map(Number);
            const cssR = r * scaleX;
            div.style.left = (cx * scaleX - cssR) + 'px';
            div.style.top = (cy * scaleY - cssR) + 'px';
            div.style.width = (cssR * 2) + 'px';
            div.style.height = (cssR * 2) + 'px';
        } else if (area.shape === 'poly') {
            // برای چندضلعی از SVG استفاده می‌کنیم
            const points = area.coords.split(',').map((v, idx) => {
                return idx % 2 === 0 ? v * scaleX : v * scaleY;
            });
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'area-highlight');
            svg.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; border:none; background:none;';
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            let pointsStr = '';
            for (let j = 0; j < points.length; j += 2) {
                pointsStr += `${points[j]},${points[j + 1]} `;
            }
            polygon.setAttribute('points', pointsStr.trim());
            polygon.setAttribute('fill', 'rgba(0, 232, 157, 0.12)');
            polygon.setAttribute('stroke', '#00e89d');
            polygon.setAttribute('stroke-width', '2');
            polygon.style.pointerEvents = 'auto';
            polygon.style.cursor = 'pointer';
            polygon.onclick = () => openEditModal(i);
            svg.appendChild(polygon);
            overlay.appendChild(svg);

            // لیبل
            const label = document.createElement('div');
            label.style.cssText = `
                position: absolute;
                left: ${points[0]}px;
                top: ${points[1] - 28}px;
                background: var(--accent);
                color: var(--bg);
                font-size: 0.7rem;
                font-weight: 600;
                padding: 2px 8px;
                border-radius: 4px;
                white-space: nowrap;
                pointer-events: none;
                z-index: 5;
            `;
            label.textContent = area.name;
            overlay.appendChild(label);
            return; // ادامه نده
        }

        // لیبل
        const label = document.createElement('span');
        label.className = 'area-label';
        label.textContent = area.name;
        div.appendChild(label);

        overlay.appendChild(div);
    });
}

// --- بروزرسانی لیست ---
function updateAreaList() {
    const list = document.getElementById('areaList');
    const empty = document.getElementById('emptyAreas');
    const actions = document.getElementById('areaActions');
    const count = document.getElementById('areaCount');

    count.textContent = areas.length;

    if (areas.length === 0) {
        list.innerHTML = '';
        list.appendChild(empty);
        empty.style.display = 'block';
        actions.hidden = true;
        return;
    }

    empty.style.display = 'none';
    actions.hidden = false;

    list.innerHTML = areas.map((area, i) => {
        let icon = 'fa-vector-square';
        if (area.shape === 'circle') icon = 'fa-circle';
        if (area.shape === 'poly') icon = 'fa-draw-polygon';

        return `
            <div class="area-item" onclick="openEditModal(${i})">
                <div class="shape-icon"><i class="fas ${icon}"></i></div>
                <div class="area-info">
                    <div class="area-name">${escapeHtml(area.name)}</div>
                    <div class="area-coords">${escapeHtml(area.coords)}</div>
                    <div class="area-link">${escapeHtml(area.href)}</div>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); deleteArea(${i})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }).join('');
}

// --- حذف ناحیه ---
function deleteArea(index) {
    const name = areas[index].name;
    areas.splice(index, 1);
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    showToast(`ناحیه «${name}» حذف شد`, 'info');
}

function clearAllAreas() {
    if (areas.length === 0) return;
    areas = [];
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    showToast('تمام نواحی پاک شدند', 'info');
}

// --- مودال ویرایش ---
function openEditModal(index) {
    editingIndex = index;
    const area = areas[index];
    document.getElementById('editName').value = area.name;
    document.getElementById('editHref').value = area.href;
    document.getElementById('editAlt').value = area.alt;
    document.getElementById('editTarget').value = area.target;
    document.getElementById('editModal').classList.add('open');
}

function closeModal() {
    document.getElementById('editModal').classList.remove('open');
    editingIndex = -1;
}

function saveEdit() {
    if (editingIndex < 0) return;
    areas[editingIndex].name = document.getElementById('editName').value.trim() || areas[editingIndex].name;
    areas[editingIndex].href = document.getElementById('editHref').value.trim() || '#';
    areas[editingIndex].alt = document.getElementById('editAlt').value.trim() || areas[editingIndex].name;
    areas[editingIndex].target = document.getElementById('editTarget').value;
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    closeModal();
    showToast('ناحیه بروزرسانی شد', 'success');
}

// بستن مودال با کلیک روی بک‌دراپ
document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

// --- تولید کد ---
function getMapName() {
    const raw = (document.getElementById('mapNameInput')?.value || 'mymap').trim();
    const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, '') || 'mymap';
    mapName = sanitized;
    return sanitized;
}

function getImageAlt() {
    return document.getElementById('imageAltInput')?.value.trim() || 'تصویر نقشه';
}

function buildMapHtml() {
    const name = getMapName();
    const src = getOutputImageSrc();
    const alt = getImageAlt();
    const responsive = document.getElementById('responsiveToggle')?.checked;

    let imgAttrs = `src="${escapeHtml(src)}"\n     usemap="#${name}"\n     alt="${escapeHtml(alt)}"`;
    if (imageNaturalWidth && imageNaturalHeight) {
        imgAttrs += `\n     width="${imageNaturalWidth}"\n     height="${imageNaturalHeight}"`;
    }
    if (responsive) {
        imgAttrs += `\n     style="max-width:100%; height:auto;"`;
    }

    let code = `<img ${imgAttrs}>\n\n<map name="${name}">`;

    if (areas.length === 0) {
        code += `\n  <!-- نواحی هنوز تعریف نشده‌اند -->`;
    } else {
        areas.forEach(area => {
            code += `\n  <area shape="${area.shape}"`
                + `\n        coords="${escapeHtml(area.coords)}"`
                + `\n        href="${escapeHtml(area.href)}"`
                + `\n        alt="${escapeHtml(area.alt)}"`
                + (area.target ? `\n        target="${escapeHtml(area.target)}"` : '')
                + `>`;
        });
    }

    code += `\n</map>`;
    return code;
}

function buildFullPage() {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(getImageAlt())}</title>
</head>
<body>

${buildMapHtml()}

</body>
</html>`;
}

let outputMode = 'map';
function setOutputMode(mode, btn) {
    outputMode = mode;
    document.querySelectorAll('.output-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    updateCode();
}

function updateCode() {
    const output = document.getElementById('codeOutput');
    if (!imageLoaded) {
        output.textContent = '// ابتدا یک عکس بارگذاری کنید';
        return;
    }
    output.textContent = outputMode === 'page' ? buildFullPage() : buildMapHtml();
}

// --- پیش‌نمایش زنده ---
function updatePreview() {
    const frame = document.getElementById('previewFrame');
    if (!frame || !imageLoaded) return;
    const name = getMapName();
    const previewName = name + '_preview';
    let html = `<img src="${escapeHtml(imageSrc)}" usemap="#${previewName}" alt="${escapeHtml(getImageAlt())}" style="max-width:100%; height:auto; display:block; margin:0 auto;">`;
    html += `<map name="${previewName}">`;
    areas.forEach(area => {
        html += `<area shape="${area.shape}" coords="${escapeHtml(area.coords)}" href="${escapeHtml(area.href)}" alt="${escapeHtml(area.alt)}" target="${escapeHtml(area.target || '_self')}" title="${escapeHtml(area.name)}">`;
    });
    html += `</map>`;
    frame.innerHTML = html;
}

// --- دانلود فایل HTML ---
function downloadHtml() {
    if (!imageLoaded) return;
    const content = buildFullPage();
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (getMapName() || 'image-map') + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('فایل HTML دانلود شد', 'success');
}

// --- کپی کد ---
function copyCode() {
    const code = document.getElementById('codeOutput').textContent;
    navigator.clipboard.writeText(code).then(() => {
        showToast('کد با موفقیت کپی شد', 'success');
    }).catch(() => {
        // fallback
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('کد کپی شد', 'success');
    });
}

// --- کمک‌کننده‌ها ---
function removeTempOverlays() {
    const overlay = document.getElementById('areaOverlay');
    if (overlay) {
        overlay.querySelectorAll('.temp').forEach(el => el.remove());
    }
}

function showDrawingHint(text) {
    const hint = document.getElementById('drawingHint');
    if (hint) {
        hint.textContent = text;
        hint.classList.add('show');
    }
}

function hideDrawingHint() {
    const hint = document.getElementById('drawingHint');
    if (hint) hint.classList.remove('show');
}

// --- نوتیفیکیشن ---
let toastTimer = null;
function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// --- ریسایز: رندر مجدد اورلی‌ها ---
window.addEventListener('resize', () => {
    if (imageLoaded) renderOverlays();
});

// --- کیبورد ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        if (currentShape === 'poly' && polyPoints.length > 0) {
            polyPoints = [];
            removeTempOverlays();
            hideDrawingHint();
            document.getElementById('undoPointBtn').style.display = 'none';
            document.getElementById('finishPolyBtn').style.display = 'none';
            showToast('رسم چندضلعی لغو شد', 'info');
        }
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && currentShape === 'poly') {
        e.preventDefault();
        undoLastPoint();
    }
    if (e.key === 'Enter' && currentShape === 'poly' && polyPoints.length >= 3) {
        e.preventDefault();
        finishPoly();
    }
});

// --- مقداردهی اولیه کد ---
updateCode();
