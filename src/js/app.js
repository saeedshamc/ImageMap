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
    reader.onload = (e) => setImage(e.target.result);
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
    if (imageSrc.startsWith('data:')) return './images/map.jpg';
    return imageSrc;
}

function refreshAll() {
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    updateAccessibilityReport?.();
    updateMinimap?.();
    scheduleAutoSave?.();
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
        <div class="image-stage-inner" id="imageStageInner">
            <div class="image-wrapper" id="imageWrapper">
                <div class="drawing-hint" id="drawingHint"></div>
                <div class="area-overlay" id="areaOverlay"></div>
                <img src="${escapeHtml(src)}" id="mapImage" crossorigin="anonymous">
            </div>
        </div>
    `;

    const img = document.getElementById('mapImage');
    const wrapper = document.getElementById('imageWrapper');
    const stageInner = document.getElementById('imageStageInner');

    img.onerror = () => showToast('بارگذاری عکس ناموفق بود؛ مسیر یا لینک را بررسی کنید', 'error');

    img.onload = () => {
        imageNaturalWidth = img.naturalWidth;
        imageNaturalHeight = img.naturalHeight;
        const pathInput = document.getElementById('outputImagePath');
        if (pathInput && !pathInput.value.trim()) {
            pathInput.value = src.startsWith('data:') ? './images/map.jpg' : src;
        }
        renderOverlays();
        updateCode();
        updatePreview();
        updateMinimap?.();
        updateAccessibilityReport?.();
        showToast('عکس با موفقیت بارگذاری شد', 'success');
        if (!options.keepAreas) resetHistory?.();
    };

    wrapper.addEventListener('mousedown', onMouseDown);
    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseup', onMouseUp);
    wrapper.addEventListener('mouseleave', onMouseLeave);
    wrapper.addEventListener('wheel', onWheelZoom, { passive: false });

    wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: false });

    document.getElementById('uploadCard').style.display = 'none';
    document.getElementById('codeCard').style.display = 'block';
    document.getElementById('previewCard').style.display = 'block';
    document.getElementById('outputSettingsCard').style.display = 'block';
    document.getElementById('projectCard').style.display = 'block';
    document.getElementById('a11yCard').style.display = 'block';
    document.getElementById('changeImageBtn').style.display = 'inline-flex';

    applyZoomTransform?.();
}

function changeImage() {
    document.getElementById('uploadCard').style.display = 'block';
    document.getElementById('uploadCard').scrollIntoView({ behavior: 'smooth' });
}

function getCoords(e, element) {
    const rect = element.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const img = document.getElementById('mapImage');
    const scaleX = img.naturalWidth / img.clientWidth;
    const scaleY = img.naturalHeight / img.clientHeight;
    return {
        x: Math.round(snapValue(x * scaleX)),
        y: Math.round(snapValue(y * scaleY)),
        cssX: x,
        cssY: y
    };
}

function setShape(shape, btn) {
    if (currentShape === 'poly' && polyPoints.length > 0) {
        polyPoints = [];
        removeTempOverlays();
        hideDrawingHint();
    }
    currentShape = shape;
    interactionMode = 'draw';
    document.querySelectorAll('.shape-btn[data-shape]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.getElementById('undoPointBtn').style.display = 'none';
    document.getElementById('finishPolyBtn').style.display = 'none';
    const wrapper = document.getElementById('imageWrapper');
    if (wrapper) wrapper.style.cursor = 'crosshair';
}

function onMouseDown(e) {
    if (!imageLoaded) return;
    if (e.button !== 0) return;
    e.preventDefault();

    const wrapper = document.getElementById('imageWrapper');
    const coords = getCoords(e, wrapper);

    if (interactionMode === 'pan') {
        onPanMouseDown(e, coords);
        return;
    }

    if (interactionMode === 'wand') {
        magicWandAt(coords.x, coords.y);
        return;
    }

    if (interactionMode === 'select') {
        if (onSelectMouseDown(e, coords)) return;
    }

    if (interactionMode !== 'draw') return;

    if (currentShape === 'poly') {
        addPolyPoint(coords);
        return;
    }

    isDrawing = true;
    startX = coords.x;
    startY = coords.y;

    if (currentShape === 'rect') showDrawingHint('موس را رها کنید تا مستطیل کامل شود');
    else if (currentShape === 'circle') showDrawingHint('موس را رها کنید تا شعاع دایره تعیین شود');
}

function onMouseMove(e) {
    if (!imageLoaded) return;
    const wrapper = document.getElementById('imageWrapper');
    const coords = getCoords(e, wrapper);

    coordsDisplay.textContent = `X: ${coords.x}, Y: ${coords.y}`;
    coordsDisplay.classList.add('visible');

    if (interactionMode === 'pan') {
        onPanMouseMove(e);
        return;
    }

    if (interactionMode === 'select') {
        onSelectMouseMove(coords);
        const idx = hitTestArea(coords.x, coords.y);
        if (idx >= 0) showCanvasTooltip(e, areas[idx]);
        else hideCanvasTooltip();
        return;
    }

    if (!isDrawing) return;

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
        div.style.cssText = `left:${left}px;top:${top}px;width:${width}px;height:${height}px;border-style:dashed;opacity:0.6;`;
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
        div.style.cssText = `left:${cx}px;top:${cy}px;width:${cssRadius * 2}px;height:${cssRadius * 2}px;border-style:dashed;opacity:0.6;`;
        overlay.appendChild(div);
    }
}

function onMouseUp(e) {
    if (interactionMode === 'pan') {
        onPanMouseUp();
        return;
    }
    if (interactionMode === 'select') {
        onSelectMouseUp();
        return;
    }
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
            showToast('مستطیل خیلی کوچک است', 'error');
            return;
        }
        addArea('rect', `${x1},${y1},${x2},${y2}`);
    } else if (currentShape === 'circle') {
        const dx = coords.x - startX;
        const dy = coords.y - startY;
        const radius = Math.round(Math.sqrt(dx * dx + dy * dy));
        if (radius < 5) {
            showToast('شعاع خیلی کوچک است', 'error');
            return;
        }
        addArea('circle', `${startX},${startY},${radius}`);
    }
}

function onMouseLeave() {
    coordsDisplay.classList.remove('visible');
    hideCanvasTooltip();
    if (isDrawing) {
        isDrawing = false;
        removeTempOverlays();
        hideDrawingHint();
    }
    onPanMouseUp();
}

function onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouchCoords = { clientX: touch.clientX, clientY: touch.clientY };
    document.getElementById('imageWrapper')?.dispatchEvent(new MouseEvent('mousedown', { clientX: touch.clientX, clientY: touch.clientY }));
}

function onTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    lastTouchCoords = { clientX: touch.clientX, clientY: touch.clientY };
    document.getElementById('imageWrapper')?.dispatchEvent(new MouseEvent('mousemove', { clientX: touch.clientX, clientY: touch.clientY }));
}

function onTouchEnd(e) {
    e.preventDefault();
    if (!lastTouchCoords) return;
    document.getElementById('imageWrapper')?.dispatchEvent(new MouseEvent('mouseup', {
        clientX: lastTouchCoords.clientX,
        clientY: lastTouchCoords.clientY
    }));
}

function addPolyPoint(coords) {
    polyPoints.push({ x: coords.x, y: coords.y, cssX: coords.cssX, cssY: coords.cssY });
    document.getElementById('undoPointBtn').style.display = 'flex';
    document.getElementById('finishPolyBtn').style.display = 'flex';
    showDrawingHint(`${polyPoints.length} نقطه — «اتمام» را بزنید`);
    drawPolyGuides();
}

function drawPolyGuides() {
    const overlay = document.getElementById('areaOverlay');
    overlay.querySelectorAll('.poly-point, .poly-line').forEach(el => el.remove());
    polyPoints.forEach((pt, i) => {
        const dot = document.createElement('div');
        dot.className = 'poly-point';
        dot.style.cssText = `position:absolute;left:${pt.cssX - 5}px;top:${pt.cssY - 5}px;width:10px;height:10px;background:var(--accent);border-radius:50%;pointer-events:none;z-index:5;`;
        overlay.appendChild(dot);
        if (i > 0) {
            const prev = polyPoints[i - 1];
            const dx = pt.cssX - prev.cssX;
            const dy = pt.cssY - prev.cssY;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            const line = document.createElement('div');
            line.className = 'poly-line';
            line.style.cssText = `position:absolute;left:${prev.cssX}px;top:${prev.cssY}px;width:${length}px;height:2px;background:var(--accent);transform-origin:0 50%;transform:rotate(${angle}deg);pointer-events:none;z-index:4;opacity:0.7;`;
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
            showDrawingHint(`${polyPoints.length} نقطه`);
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
    document.getElementById('areaOverlay')?.querySelectorAll('.poly-point, .poly-line').forEach(el => el.remove());
    document.getElementById('undoPointBtn').style.display = 'none';
    document.getElementById('finishPolyBtn').style.display = 'none';
    hideDrawingHint();
}

function addArea(shape, coords, options = {}) {
    if (!options.skipHistory) pushHistory();
    const name = document.getElementById('areaName').value.trim() || `ناحیه ${areas.length + 1}`;
    const href = document.getElementById('areaHref').value.trim() || '#';
    const alt = document.getElementById('areaAlt').value.trim() || name;
    const target = document.getElementById('areaTarget').value;

    areas.push({ shape, coords, name, href, alt, target, color: '' });
    refreshAll();
    showToast(`ناحیه «${name}» اضافه شد`, 'success');
    document.getElementById('areaName').value = '';
    document.getElementById('areaAlt').value = '';
}

function renderOverlays() {
    const overlay = document.getElementById('areaOverlay');
    if (!overlay) return;
    overlay.querySelectorAll('.area-highlight:not(.temp), .poly-point, .poly-line, .resize-handle, .area-label-float').forEach(el => el.remove());
    overlay.querySelectorAll('svg.area-highlight').forEach(el => el.remove());

    const img = document.getElementById('mapImage');
    if (!img) return;
    const scaleX = img.clientWidth / img.naturalWidth;
    const scaleY = img.clientHeight / img.naturalHeight;

    areas.forEach((area, i) => {
        const borderColor = getAreaBorderColor(area, i);
        const fillColor = getAreaColor(area, i);

        if (area.shape === 'poly') {
            const points = area.coords.split(',').map((v, idx) => idx % 2 === 0 ? v * scaleX : v * scaleY);
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'area-highlight');
            svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border:none;background:none;';
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            let pointsStr = '';
            for (let j = 0; j < points.length; j += 2) pointsStr += `${points[j]},${points[j + 1]} `;
            polygon.setAttribute('points', pointsStr.trim());
            polygon.setAttribute('fill', fillColor);
            polygon.setAttribute('stroke', borderColor);
            polygon.setAttribute('stroke-width', selectedAreaIndex === i ? '3' : '2');
            polygon.style.pointerEvents = 'auto';
            polygon.style.cursor = interactionMode === 'select' ? 'move' : 'pointer';
            polygon.onclick = (ev) => {
                if (interactionMode === 'select') { selectArea(i); ev.stopPropagation(); }
                else openEditModal(i);
            };
            polygon.onmouseenter = (ev) => showCanvasTooltip(ev, area);
            polygon.onmouseleave = hideCanvasTooltip;
            svg.appendChild(polygon);
            overlay.appendChild(svg);
            return;
        }

        const div = document.createElement('div');
        div.className = 'area-highlight' + (area.shape === 'circle' ? ' circle' : '') + (selectedAreaIndex === i ? ' selected' : '');
        div.style.borderColor = borderColor;
        div.style.background = fillColor;
        div.onmouseenter = (ev) => showCanvasTooltip(ev, area);
        div.onmouseleave = hideCanvasTooltip;

        if (interactionMode === 'select') {
            div.onmousedown = (ev) => { ev.stopPropagation(); selectArea(i); onSelectMouseDown(ev, getCoords(ev, div.parentElement.parentElement)); };
        } else {
            div.onclick = () => openEditModal(i);
        }

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
        }

        const label = document.createElement('span');
        label.className = 'area-label';
        label.textContent = area.name;
        div.appendChild(label);
        overlay.appendChild(div);
        renderSelectionHandles(overlay, area, scaleX, scaleY);
    });
}

function updateAreaList() {
    const list = document.getElementById('areaList');
    const empty = document.getElementById('emptyAreas');
    const actions = document.getElementById('areaActions');
    const count = document.getElementById('areaCount');
    const filtered = areas.map((a, i) => ({ a, i })).filter(({ a }) => areaMatchesSearch(a));

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

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>نتیجه‌ای یافت نشد</p></div>';
        return;
    }

    list.innerHTML = filtered.map(({ a: area, i }) => {
        let icon = 'fa-vector-square';
        if (area.shape === 'circle') icon = 'fa-circle';
        if (area.shape === 'poly') icon = 'fa-draw-polygon';
        const colorStyle = area.color ? `style="border-right:3px solid ${area.color}"` : '';

        return `
            <div class="area-item${selectedAreaIndex === i ? ' selected' : ''}" onclick="selectArea(${i})" ${colorStyle}>
                <div class="shape-icon"><i class="fas ${icon}"></i></div>
                <div class="area-info">
                    <div class="area-name">${escapeHtml(area.name)}</div>
                    <div class="area-coords">${escapeHtml(area.coords)}</div>
                    <div class="area-link">${escapeHtml(area.href)}</div>
                </div>
                <button class="dup-btn" title="کپی" onclick="event.stopPropagation(); duplicateArea(${i})"><i class="fas fa-copy"></i></button>
                <input type="color" class="color-picker" value="${area.color || '#00e89d'}" title="رنگ" onclick="event.stopPropagation()" onchange="setAreaColor(${i}, this.value)">
                <button class="delete-btn" onclick="event.stopPropagation(); deleteArea(${i})"><i class="fas fa-trash"></i></button>
            </div>
        `;
    }).join('');
}

function deleteArea(index) {
    pushHistory();
    const name = areas[index].name;
    areas.splice(index, 1);
    if (selectedAreaIndex === index) selectedAreaIndex = -1;
    refreshAll();
    showToast(`ناحیه «${name}» حذف شد`, 'info');
}

function clearAllAreas() {
    if (areas.length === 0) return;
    pushHistory();
    areas = [];
    selectedAreaIndex = -1;
    refreshAll();
    showToast('تمام نواحی پاک شدند', 'info');
}

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
    pushHistory();
    areas[editingIndex].name = document.getElementById('editName').value.trim() || areas[editingIndex].name;
    areas[editingIndex].href = document.getElementById('editHref').value.trim() || '#';
    areas[editingIndex].alt = document.getElementById('editAlt').value.trim() || areas[editingIndex].name;
    areas[editingIndex].target = document.getElementById('editTarget').value;
    refreshAll();
    closeModal();
    showToast('ناحیه بروزرسانی شد', 'success');
}

document.getElementById('editModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
});

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
    if (typeof buildMapHtmlForExport === 'function') return buildMapHtmlForExport();
    const name = getMapName();
    const src = getOutputImageSrc();
    const alt = getImageAlt();
    let imgAttrs = `src="${escapeHtml(src)}" usemap="#${name}" alt="${escapeHtml(alt)}"`;
    if (imageNaturalWidth) imgAttrs += ` width="${imageNaturalWidth}" height="${imageNaturalHeight}"`;
    let code = `<img ${imgAttrs}>\n\n<map name="${name}">`;
    areas.forEach(area => {
        code += `\n  <area shape="${area.shape}" coords="${escapeHtml(area.coords)}" href="${escapeHtml(area.href)}" alt="${escapeHtml(area.alt)}" target="${escapeHtml(area.target)}">`;
    });
    code += `\n</map>`;
    return code;
}

function buildFullPage() {
    return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(getImageAlt())}</title></head>
<body>\n${buildMapHtml()}\n</body></html>`;
}

let outputMode = 'map';
function setOutputMode(mode, btn) {
    outputMode = mode;
    document.querySelectorAll('.output-mode-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.mode === mode);
    });
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

function updatePreview() {
    const frame = document.getElementById('previewFrame');
    if (!frame || !imageLoaded) return;
    const name = getMapName() + '_preview';
    let html = `<img src="${escapeHtml(imageSrc)}" usemap="#${name}" alt="${escapeHtml(getImageAlt())}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
    html += `<map name="${name}">`;
    areas.forEach(area => {
        html += `<area shape="${area.shape}" coords="${escapeHtml(area.coords)}" href="${escapeHtml(area.href)}" alt="${escapeHtml(area.alt)}" target="${escapeHtml(area.target || '_self')}" title="${escapeHtml(area.name)}">`;
    });
    html += `</map>`;
    frame.innerHTML = html;
}

function downloadHtml() {
    if (!imageLoaded) return;
    const content = buildFullPage();
    const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (getMapName() || 'image-map') + '.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('فایل HTML دانلود شد', 'success');
}

function copyCode() {
    const code = document.getElementById('codeOutput').textContent;
    navigator.clipboard.writeText(code).then(() => showToast('کد کپی شد', 'success')).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('کد کپی شد', 'success');
    });
}

function removeTempOverlays() {
    document.getElementById('areaOverlay')?.querySelectorAll('.temp').forEach(el => el.remove());
}

function showDrawingHint(text) {
    const hint = document.getElementById('drawingHint');
    if (hint) { hint.textContent = text; hint.classList.add('show'); }
}

function hideDrawingHint() {
    document.getElementById('drawingHint')?.classList.remove('show');
}

let toastTimer = null;
function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.className = `toast ${type}`;
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2500);
}

window.addEventListener('resize', () => { if (imageLoaded) renderOverlays(); });

document.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;

    if (e.key === 'Escape') {
        closeModal();
        closeImportModal?.();
        if (currentShape === 'poly' && polyPoints.length > 0) {
            polyPoints = [];
            removeTempOverlays();
            hideDrawingHint();
            document.getElementById('undoPointBtn').style.display = 'none';
            document.getElementById('finishPolyBtn').style.display = 'none';
            showToast('رسم لغو شد', 'info');
        }
    }
    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        if (currentShape === 'poly' && polyPoints.length > 0) undoLastPoint();
        else undoHistory();
    }
    if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redoHistory();
    }
    if (e.key === 'Enter' && currentShape === 'poly' && polyPoints.length >= 3) {
        e.preventDefault();
        finishPoly();
    }
    if (e.key === 'Delete' && selectedAreaIndex >= 0 && interactionMode === 'select') {
        deleteArea(selectedAreaIndex);
    }
});

document.getElementById('importModal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeImportModal();
});

document.getElementById('projectFileInput')?.addEventListener('change', (e) => {
    loadProjectFile(e.target.files[0]);
    e.target.value = '';
});

document.getElementById('importHtmlFileInput')?.addEventListener('change', (e) => {
    importHtmlFile(e.target.files[0]);
    e.target.value = '';
});

updateCode();
document.addEventListener('DOMContentLoaded', () => restoreAutoSave?.());
