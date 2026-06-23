const PROJECT_VERSION = 1;
const AUTOSAVE_KEY = 'imagemap_autosave';

function getProjectSettings() {
    return {
        mapName: document.getElementById('mapNameInput')?.value.trim() || 'mymap',
        outputImagePath: document.getElementById('outputImagePath')?.value.trim() || '',
        imageAlt: document.getElementById('imageAltInput')?.value.trim() || '',
        responsive: !!document.getElementById('responsiveToggle')?.checked,
        percentCoords: !!document.getElementById('percentCoordsToggle')?.checked,
        snapGrid: !!document.getElementById('snapGridToggle')?.checked,
        gridSize: parseInt(document.getElementById('gridSizeInput')?.value, 10) || 10,
        outputMode: typeof outputMode !== 'undefined' ? outputMode : 'map',
        zoom: typeof zoomLevel !== 'undefined' ? zoomLevel : 1,
        panX: typeof panX !== 'undefined' ? panX : 0,
        panY: typeof panY !== 'undefined' ? panY : 0
    };
}

function applyProjectSettings(settings) {
    if (!settings) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };

    set('mapNameInput', settings.mapName);
    set('outputImagePath', settings.outputImagePath);
    set('imageAltInput', settings.imageAlt);
    setCheck('responsiveToggle', settings.responsive);
    setCheck('percentCoordsToggle', settings.percentCoords);
    setCheck('snapGridToggle', settings.snapGrid);
    set('gridSizeInput', settings.gridSize || 10);

    if (settings.outputMode) {
        outputMode = settings.outputMode;
        document.querySelectorAll('.output-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === settings.outputMode);
        });
    }
    if (settings.zoom !== undefined) {
        zoomLevel = settings.zoom;
        panX = settings.panX || 0;
        panY = settings.panY || 0;
        applyZoomTransform?.();
        updateZoomUI?.();
    }
}

function buildProjectData() {
    return {
        version: PROJECT_VERSION,
        savedAt: new Date().toISOString(),
        imageSrc,
        imageNaturalWidth,
        imageNaturalHeight,
        settings: getProjectSettings(),
        areas: areas.map(a => ({ ...a }))
    };
}

function saveProject() {
    if (!imageLoaded) {
        showToast('ابتدا یک عکس بارگذاری کنید', 'error');
        return;
    }
    const data = buildProjectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (getMapName() || 'project') + '.imap.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('پروژه ذخیره شد', 'success');
}

function loadProjectFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            loadProjectData(data);
        } catch {
            showToast('فایل پروژه نامعتبر است', 'error');
        }
    };
    reader.readAsText(file);
}

function loadProjectData(data) {
    if (!data || !data.imageSrc) {
        showToast('فایل پروژه ناقص است', 'error');
        return;
    }
    areas = (data.areas || []).map(a => ({
        shape: a.shape,
        coords: a.coords,
        name: a.name || 'ناحیه',
        href: a.href || '#',
        alt: a.alt || a.name || '',
        target: a.target || '_self',
        color: a.color || ''
    }));
    applyProjectSettings(data.settings);
    setImage(data.imageSrc, { keepAreas: true });
    resetHistory();
    scheduleAutoSave();
    showToast('پروژه بارگذاری شد', 'success');
}

function scheduleAutoSave() {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(autoSaveProject, 800);
}

let autoSaveTimer = null;

function autoSaveProject() {
    if (!imageLoaded) return;
    try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(buildProjectData()));
    } catch {
        // storage full or private mode
    }
}

function restoreAutoSave() {
    try {
        const raw = localStorage.getItem(AUTOSAVE_KEY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data?.imageSrc || !data?.areas?.length) return;
        if (confirm('پروژه ذخیره‌شده خودکار پیدا شد. بازیابی شود؟')) {
            loadProjectData(data);
        }
    } catch {
        localStorage.removeItem(AUTOSAVE_KEY);
    }
}

function clearAutoSave() {
    localStorage.removeItem(AUTOSAVE_KEY);
}

// --- Import HTML ---
function importHtmlFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => parseAndImportHtml(e.target.result);
    reader.readAsText(file);
}

function importHtmlFromPaste() {
    const text = document.getElementById('importHtmlText')?.value.trim();
    if (!text) {
        showToast('کد HTML را وارد کنید', 'error');
        return;
    }
    parseAndImportHtml(text);
    closeImportModal();
}

function parseAndImportHtml(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const mapEl = doc.querySelector('map');
    const imgEl = doc.querySelector('img[usemap], img');

    if (!mapEl && !doc.querySelectorAll('area').length) {
        showToast('تگ map یا area پیدا نشد', 'error');
        return;
    }

    const importedAreas = [];
    const areaEls = mapEl ? mapEl.querySelectorAll('area') : doc.querySelectorAll('area');
    areaEls.forEach((el, i) => {
        const shape = el.getAttribute('shape') || 'rect';
        let coords = el.getAttribute('coords') || '';
        coords = normalizeImportedCoords(coords, shape);
        importedAreas.push({
            shape,
            coords,
            name: el.getAttribute('title') || el.getAttribute('alt') || `ناحیه ${i + 1}`,
            href: el.getAttribute('href') || '#',
            alt: el.getAttribute('alt') || '',
            target: el.getAttribute('target') || '_self',
            color: ''
        });
    });

    if (importedAreas.length === 0) {
        showToast('هیچ ناحیه‌ای import نشد', 'error');
        return;
    }

    pushHistory();
    areas = importedAreas;

    if (mapEl?.getAttribute('name')) {
        document.getElementById('mapNameInput').value = mapEl.getAttribute('name');
    }

    const imgSrc = imgEl?.getAttribute('src');
    if (imgSrc && !imageLoaded) {
        setImage(imgSrc, { keepAreas: true });
    } else if (imageLoaded) {
        updateAreaList();
        updateCode();
        renderOverlays();
        updatePreview();
        updateAccessibilityReport?.();
    }

    resetHistory();
    scheduleAutoSave();
    showToast(`${importedAreas.length} ناحیه import شد`, 'success');
}

function normalizeImportedCoords(coordsStr, shape) {
    const parts = coordsStr.split(',').map(s => s.trim());
    const hasPercent = parts.some(p => p.endsWith('%'));
    if (!hasPercent || !imageNaturalWidth) {
        return coordsStr.replace(/%/g, '');
    }
    const nums = parts.map(p => parseFloat(p));
    const w = imageNaturalWidth;
    const h = imageNaturalHeight;
    if (shape === 'rect' && nums.length >= 4) {
        return `${Math.round(nums[0] * w / 100)},${Math.round(nums[1] * h / 100)},${Math.round(nums[2] * w / 100)},${Math.round(nums[3] * h / 100)}`;
    }
    if (shape === 'circle' && nums.length >= 3) {
        return `${Math.round(nums[0] * w / 100)},${Math.round(nums[1] * h / 100)},${Math.round(nums[2] * Math.min(w, h) / 100)}`;
    }
    if (shape === 'poly') {
        const out = [];
        for (let i = 0; i < nums.length; i += 2) {
            out.push(Math.round(nums[i] * w / 100));
            out.push(Math.round(nums[i + 1] * h / 100));
        }
        return out.join(',');
    }
    return coordsStr.replace(/%/g, '');
}

function openImportModal() {
    document.getElementById('importModal')?.classList.add('open');
}

function closeImportModal() {
    document.getElementById('importModal')?.classList.remove('open');
    const ta = document.getElementById('importHtmlText');
    if (ta) ta.value = '';
}
