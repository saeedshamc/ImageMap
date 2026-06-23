// --- Accessibility report ---
function updateAccessibilityReport() {
    const panel = document.getElementById('a11yReport');
    if (!panel) return;

    const issues = [];
    areas.forEach((area, i) => {
        if (!area.alt || area.alt === area.name) {
            if (!area.alt) issues.push({ level: 'warn', text: `ناحیه «${area.name}»: alt خالی است` });
        }
        if (!area.href || area.href === '#') {
            issues.push({ level: 'info', text: `ناحیه «${area.name}»: href خالی یا #` });
        }
        const b = getAreaBounds(area);
        if (b) {
            const w = b.x2 - b.x1;
            const h = b.y2 - b.y1;
            if (w < 20 || h < 20) {
                issues.push({ level: 'warn', text: `ناحیه «${area.name}»: خیلی کوچک (${Math.round(w)}×${Math.round(h)}px)` });
            }
        }
    });

    if (!imageLoaded) {
        panel.innerHTML = '<p class="a11y-empty">ابتدا عکس بارگذاری کنید</p>';
        return;
    }
    const altInput = document.getElementById('imageAltInput')?.value.trim();
    if (!altInput) {
        issues.unshift({ level: 'warn', text: 'عکس alt ندارد' });
    }

    if (issues.length === 0) {
        panel.innerHTML = '<p class="a11y-ok"><i class="fas fa-check-circle"></i> مشکل دسترسی‌پذیری یافت نشد</p>';
        return;
    }

    panel.innerHTML = issues.map(i =>
        `<div class="a11y-item a11y-${i.level}"><i class="fas fa-${i.level === 'warn' ? 'exclamation-triangle' : 'info-circle'}"></i> ${escapeHtml(i.text)}</div>`
    ).join('');
}

// --- Minimap ---
function updateMinimap() {
    const mm = document.getElementById('minimapCanvas');
    const wrap = document.getElementById('minimapWrap');
    if (!mm || !wrap || !imageLoaded) return;

    wrap.style.display = imageNaturalWidth > 800 || imageNaturalHeight > 600 ? 'block' : 'none';
    const ctx = mm.getContext('2d');
    const img = document.getElementById('mapImage');
    const scale = Math.min(120 / imageNaturalWidth, 80 / imageNaturalHeight);
    mm.width = imageNaturalWidth * scale;
    mm.height = imageNaturalHeight * scale;
    ctx.drawImage(img, 0, 0, mm.width, mm.height);
    ctx.strokeStyle = '#00e89d';
    ctx.lineWidth = 1;
    areas.forEach(area => {
        const b = getAreaBounds(area);
        if (!b) return;
        ctx.strokeRect(b.x1 * scale, b.y1 * scale, (b.x2 - b.x1) * scale, (b.y2 - b.y1) * scale);
    });
}

// --- Split view ---
let splitViewActive = false;

function toggleSplitView() {
    splitViewActive = !splitViewActive;
    document.getElementById('leftColumn')?.classList.toggle('split-active', splitViewActive);
    document.getElementById('splitViewBtn')?.classList.toggle('active', splitViewActive);
    if (splitViewActive) {
        document.getElementById('previewCard').style.display = 'block';
        updatePreview();
    }
}

// --- Area search filter ---
let areaSearchQuery = '';

function filterAreaList() {
    areaSearchQuery = (document.getElementById('areaSearchInput')?.value || '').trim().toLowerCase();
    updateAreaList();
}

function areaMatchesSearch(area) {
    if (!areaSearchQuery) return true;
    return area.name.toLowerCase().includes(areaSearchQuery)
        || area.href.toLowerCase().includes(areaSearchQuery)
        || area.coords.includes(areaSearchQuery);
}

// --- Canvas tooltip ---
function showCanvasTooltip(e, area) {
    const tip = document.getElementById('canvasTooltip');
    if (!tip || !area) return;
    tip.innerHTML = `<strong>${escapeHtml(area.name)}</strong><br><span dir="ltr">${escapeHtml(area.href)}</span>`;
    tip.style.left = (e.clientX + 12) + 'px';
    tip.style.top = (e.clientY + 12) + 'px';
    tip.classList.add('show');
}

function hideCanvasTooltip() {
    document.getElementById('canvasTooltip')?.classList.remove('show');
}
