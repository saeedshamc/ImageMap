// --- Canvas interaction: select, drag, resize, zoom, pan, magic wand ---
let interactionMode = 'draw'; // draw | select | pan | wand
let selectedAreaIndex = -1;
let isDraggingArea = false;
let isResizing = false;
let resizeHandle = null;
let dragStartX = 0, dragStartY = 0;
let dragOriginalCoords = '';
let zoomLevel = 1;
let panX = 0, panY = 0;
let isPanning = false;
let panStartX = 0, panStartY = 0;
let wandTolerance = 32;

const HANDLE_SIZE = 8;
const RESIZE_HANDLES = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

function setInteractionMode(mode, btn) {
    if (currentShape === 'poly' && polyPoints.length > 0 && mode !== 'draw') {
        showToast('ابتدا چندضلعی را تمام یا لغو کنید', 'error');
        return;
    }
    interactionMode = mode;
    document.querySelectorAll('.mode-btn[data-mode]').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const wrapper = document.getElementById('imageWrapper');
    if (wrapper) {
        wrapper.classList.toggle('mode-select', mode === 'select');
        wrapper.classList.toggle('mode-pan', mode === 'pan');
        wrapper.classList.toggle('mode-wand', mode === 'wand');
        wrapper.style.cursor = mode === 'pan' ? 'grab' : mode === 'wand' ? 'cell' : mode === 'select' ? 'default' : 'crosshair';
    }
    if (mode !== 'select') selectedAreaIndex = -1;
    renderOverlays();
}

function snapValue(v) {
    if (!document.getElementById('snapGridToggle')?.checked) return v;
    const grid = parseInt(document.getElementById('gridSizeInput')?.value, 10) || 10;
    return Math.round(v / grid) * grid;
}

function selectArea(index) {
    selectedAreaIndex = index;
    renderOverlays();
    highlightAreaInList(index);
}

function highlightAreaInList(index) {
    document.querySelectorAll('.area-item').forEach((el, i) => {
        el.classList.toggle('selected', i === index);
    });
}

function getAreaBounds(area) {
    const coords = area.coords.split(',').map(Number);
    if (area.shape === 'rect') {
        return { x1: coords[0], y1: coords[1], x2: coords[2], y2: coords[3] };
    }
    if (area.shape === 'circle') {
        const [cx, cy, r] = coords;
        return { x1: cx - r, y1: cy - r, x2: cx + r, y2: cy + r, cx, cy, r };
    }
    if (area.shape === 'poly') {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (let i = 0; i < coords.length; i += 2) {
            minX = Math.min(minX, coords[i]);
            maxX = Math.max(maxX, coords[i]);
            minY = Math.min(minY, coords[i + 1]);
            maxY = Math.max(maxY, coords[i + 1]);
        }
        return { x1: minX, y1: minY, x2: maxX, y2: maxY, polyCoords: coords };
    }
    return null;
}

function setAreaBounds(area, bounds) {
    if (area.shape === 'rect') {
        area.coords = `${Math.round(bounds.x1)},${Math.round(bounds.y1)},${Math.round(bounds.x2)},${Math.round(bounds.y2)}`;
    } else if (area.shape === 'circle') {
        const r = Math.round((bounds.x2 - bounds.x1) / 2);
        const cx = Math.round((bounds.x1 + bounds.x2) / 2);
        const cy = Math.round((bounds.y1 + bounds.y2) / 2);
        area.coords = `${cx},${cy},${r}`;
    } else if (area.shape === 'poly' && bounds.polyCoords) {
        area.coords = bounds.polyCoords.map(Math.round).join(',');
    }
}

function moveArea(area, dx, dy) {
    const coords = area.coords.split(',').map(Number);
    if (area.shape === 'rect' || area.shape === 'circle') {
        for (let i = 0; i < coords.length - (area.shape === 'circle' ? 1 : 0); i += 2) {
            coords[i] = snapValue(coords[i] + dx);
            coords[i + 1] = snapValue(coords[i + 1] + dy);
        }
    } else {
        for (let i = 0; i < coords.length; i += 2) {
            coords[i] = snapValue(coords[i] + dx);
            coords[i + 1] = snapValue(coords[i + 1] + dy);
        }
    }
    area.coords = coords.join(',');
}

function hitTestArea(imgX, imgY) {
    for (let i = areas.length - 1; i >= 0; i--) {
        const area = areas[i];
        const b = getAreaBounds(area);
        if (!b) continue;
        if (area.shape === 'circle') {
            const [cx, cy, r] = area.coords.split(',').map(Number);
            const d = Math.hypot(imgX - cx, imgY - cy);
            if (d <= r) return i;
        } else if (area.shape === 'rect') {
            if (imgX >= b.x1 && imgX <= b.x2 && imgY >= b.y1 && imgY <= b.y2) return i;
        } else if (area.shape === 'poly') {
            if (pointInPolygon(imgX, imgY, b.polyCoords)) return i;
        }
    }
    return -1;
}

function pointInPolygon(x, y, coords) {
    let inside = false;
    for (let i = 0, j = coords.length - 2; i < coords.length; j = i, i += 2) {
        const xi = coords[i], yi = coords[i + 1];
        const xj = coords[j], yj = coords[j + 1];
        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }
    return inside;
}

function hitTestHandle(imgX, imgY, area) {
    const b = getAreaBounds(area);
    if (!b || area.shape === 'poly') return null;
    const threshold = 12 / zoomLevel;
    const handles = {
        nw: [b.x1, b.y1], ne: [b.x2, b.y1], sw: [b.x1, b.y2], se: [b.x2, b.y2],
        n: [(b.x1 + b.x2) / 2, b.y1], s: [(b.x1 + b.x2) / 2, b.y2],
        e: [b.x2, (b.y1 + b.y2) / 2], w: [b.x1, (b.y1 + b.y2) / 2]
    };
    for (const [name, [hx, hy]] of Object.entries(handles)) {
        if (Math.abs(imgX - hx) <= threshold && Math.abs(imgY - hy) <= threshold) return name;
    }
    return null;
}

function onSelectMouseDown(e, coords) {
    if (interactionMode !== 'select') return false;

    const areaIdx = selectedAreaIndex >= 0 ? selectedAreaIndex : hitTestArea(coords.x, coords.y);

    if (areaIdx >= 0) {
        const area = areas[areaIdx];
        const handle = hitTestHandle(coords.x, coords.y, area);
        selectedAreaIndex = areaIdx;
        dragOriginalCoords = area.coords;

        if (handle && area.shape !== 'poly') {
            isResizing = true;
            resizeHandle = handle;
        } else {
            isDraggingArea = true;
            dragStartX = coords.x;
            dragStartY = coords.y;
        }
        renderOverlays();
        highlightAreaInList(areaIdx);
        e.stopPropagation();
        return true;
    }

    selectedAreaIndex = -1;
    renderOverlays();
    return false;
}

function onSelectMouseMove(coords) {
    if (!isDraggingArea && !isResizing) return;
    const area = areas[selectedAreaIndex];
    if (!area) return;

    if (isDraggingArea) {
        const dx = coords.x - dragStartX;
        const dy = coords.y - dragStartY;
        area.coords = dragOriginalCoords;
        moveArea(area, dx, dy);
    } else if (isResizing) {
        const orig = dragOriginalCoords.split(',').map(Number);
        let x1, y1, x2, y2;
        if (area.shape === 'rect') {
            [x1, y1, x2, y2] = orig;
            if (resizeHandle.includes('w')) x1 = snapValue(coords.x);
            if (resizeHandle.includes('e')) x2 = snapValue(coords.x);
            if (resizeHandle.includes('n')) y1 = snapValue(coords.y);
            if (resizeHandle.includes('s')) y2 = snapValue(coords.y);
            if (x2 - x1 < 5 || y2 - y1 < 5) return;
            area.coords = `${x1},${y1},${x2},${y2}`;
        } else if (area.shape === 'circle') {
            const [cx, cy] = orig;
            const r = Math.round(Math.hypot(coords.x - cx, coords.y - cy));
            if (r < 5) return;
            area.coords = `${cx},${cy},${r}`;
        }
    }
    renderOverlays();
    updateCode();
}

function onSelectMouseUp() {
    if (isDraggingArea || isResizing) {
        pushHistory();
        scheduleAutoSave();
        updateAreaList();
        updatePreview();
    }
    isDraggingArea = false;
    isResizing = false;
    resizeHandle = null;
}

function renderSelectionHandles(overlay, area, scaleX, scaleY) {
    if (selectedAreaIndex < 0 || areas[selectedAreaIndex] !== area) return;
    const b = getAreaBounds(area);
    if (!b || area.shape === 'poly') return;

    const handles = {
        nw: [b.x1, b.y1], ne: [b.x2, b.y1], sw: [b.x1, b.y2], se: [b.x2, b.y2],
        n: [(b.x1 + b.x2) / 2, b.y1], s: [(b.x1 + b.x2) / 2, b.y2],
        e: [b.x2, (b.y1 + b.y2) / 2], w: [b.x1, (b.y1 + b.y2) / 2]
    };

    Object.values(handles).forEach(([hx, hy]) => {
        const h = document.createElement('div');
        h.className = 'resize-handle';
        h.style.cssText = `left:${hx * scaleX - HANDLE_SIZE / 2}px;top:${hy * scaleY - HANDLE_SIZE / 2}px;width:${HANDLE_SIZE}px;height:${HANDLE_SIZE}px;`;
        overlay.appendChild(h);
    });
}

function applyZoomTransform() {
    const wrapper = document.getElementById('imageWrapper');
    const stage = document.getElementById('imageStageInner');
    if (stage) {
        stage.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
        stage.style.transformOrigin = '0 0';
    }
    renderOverlays();
    updateMinimap?.();
}

function updateZoomUI() {
    const label = document.getElementById('zoomLabel');
    if (label) label.textContent = Math.round(zoomLevel * 100) + '%';
}

function zoomIn() {
    zoomLevel = Math.min(5, zoomLevel * 1.25);
    applyZoomTransform();
    updateZoomUI();
}

function zoomOut() {
    zoomLevel = Math.max(0.25, zoomLevel / 1.25);
    applyZoomTransform();
    updateZoomUI();
}

function zoomReset() {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
    applyZoomTransform();
    updateZoomUI();
}

function onPanMouseDown(e, coords) {
    if (interactionMode !== 'pan') return false;
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    e.target.closest('.image-wrapper')?.classList.add('panning');
    return true;
}

function onPanMouseMove(e) {
    if (!isPanning) return;
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
    applyZoomTransform();
}

function onPanMouseUp() {
    if (isPanning) {
        document.getElementById('imageWrapper')?.classList.remove('panning');
        isPanning = false;
        scheduleAutoSave();
    }
}

function onWheelZoom(e) {
    if (!imageLoaded) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoomLevel = Math.min(5, Math.max(0.25, zoomLevel * delta));
    applyZoomTransform();
    updateZoomUI();
}

// --- Magic Wand ---
function getImageCanvas() {
    const img = document.getElementById('mapImage');
    if (!img || !img.complete) return null;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    try {
        return { canvas, ctx, data: ctx.getImageData(0, 0, canvas.width, canvas.height) };
    } catch {
        showToast('برای Magic Wand عکس باید از فایل محلی یا data URL باشد (CORS)', 'error');
        return null;
    }
}

function colorMatch(idx, data, target, tol) {
    const i = idx * 4;
    return Math.abs(data[i] - target[0]) <= tol
        && Math.abs(data[i + 1] - target[1]) <= tol
        && Math.abs(data[i + 2] - target[2]) <= tol;
}

function magicWandAt(imgX, imgY) {
    const info = getImageCanvas();
    if (!info) return;
    const { data, canvas } = info;
    const w = canvas.width;
    const h = canvas.height;
    const px = Math.round(imgX);
    const py = Math.round(imgY);
    if (px < 0 || py < 0 || px >= w || py >= h) return;

    const startIdx = py * w + px;
    const target = [data.data[startIdx * 4], data.data[startIdx * 4 + 1], data.data[startIdx * 4 + 2]];
    const tol = parseInt(document.getElementById('wandTolerance')?.value, 10) || wandTolerance;

    const visited = new Uint8Array(w * h);
    const stack = [[px, py]];
    const pixels = [];
    const key = (x, y) => y * w + x;

    while (stack.length) {
        const [x, y] = stack.pop();
        const k = key(x, y);
        if (x < 0 || y < 0 || x >= w || y >= h || visited[k]) continue;
        if (!colorMatch(k, data.data, target, tol)) continue;
        visited[k] = 1;
        pixels.push([x, y]);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        if (pixels.length > 80000) break;
    }

    if (pixels.length < 10) {
        showToast('ناحیه‌ای پیدا نشد؛ tolerance را افزایش دهید', 'error');
        return;
    }

    const poly = traceContour(pixels, w, h);
    if (poly.length < 6) {
        showToast('polygon ساخته نشد', 'error');
        return;
    }

    pushHistory();
    const simplified = simplifyPolygon(poly, 3);
    addArea('poly', simplified.join(','), { skipHistory: true });
}

function traceContour(pixels, w, h) {
    const set = new Set(pixels.map(([x, y]) => `${x},${y}`));
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    pixels.forEach(([x, y]) => {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    });

    const contour = [];
    const steps = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
            if (!set.has(`${x},${y}`)) continue;
            let edge = false;
            for (const [dx, dy] of steps) {
                if (!set.has(`${x + dx},${y + dy}`)) { edge = true; break; }
            }
            if (edge) contour.push([x, y]);
        }
    }

    if (contour.length < 3) return [];
    contour.sort((a, b) => Math.atan2(a[1] - minY, a[0] - minX) - Math.atan2(b[1] - minY, b[0] - minX));
    const out = [];
    contour.forEach(([x, y]) => { out.push(x, y); });
    return out;
}

function simplifyPolygon(coords, step) {
    if (coords.length <= 6) return coords;
    const out = [];
    for (let i = 0; i < coords.length; i += step * 2) {
        out.push(coords[i], coords[i + 1]);
    }
    if (out.length < 6) return coords.slice(0, 6);
    return out;
}

function duplicateArea(index) {
    if (index < 0 || !areas[index]) return;
    pushHistory();
    const orig = areas[index];
    const copy = { ...orig, name: orig.name + ' (کپی)' };
    const nums = copy.coords.split(',').map(Number);
    if (copy.shape === 'rect') {
        nums[0] += 10; nums[1] += 10; nums[2] += 10; nums[3] += 10;
    } else if (copy.shape === 'circle') {
        nums[0] += 10; nums[1] += 10;
    } else {
        for (let i = 0; i < nums.length; i += 2) { nums[i] += 10; nums[i + 1] += 10; }
    }
    copy.coords = nums.join(',');
    areas.splice(index + 1, 0, copy);
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    scheduleAutoSave();
    showToast('ناحیه کپی شد', 'success');
}

function setAreaColor(index, color) {
    if (areas[index]) {
        pushHistory();
        areas[index].color = color;
        renderOverlays();
        updateAreaList();
        scheduleAutoSave();
    }
}

function getAreaColor(area, index) {
    if (area.color) return area.color;
    const hues = [160, 200, 280, 40, 0, 320];
    return `hsla(${hues[index % hues.length]}, 70%, 50%, 0.25)`;
}

function getAreaBorderColor(area, index) {
    if (area.color) return area.color;
    const hues = [160, 200, 280, 40, 0, 320];
    return `hsl(${hues[index % hues.length]}, 70%, 55%)`;
}
