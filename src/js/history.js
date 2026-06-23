// --- Undo / Redo ---
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 60;
let historyPaused = false;

function snapshotState() {
    return JSON.stringify({
        areas: areas.map(a => ({ ...a })),
        mapName: document.getElementById('mapNameInput')?.value || 'mymap'
    });
}

function pushHistory() {
    if (historyPaused) return;
    const snap = snapshotState();
    if (historyIndex >= 0 && historyStack[historyIndex] === snap) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }
    updateUndoRedoUI();
}

function restoreFromSnapshot(snap) {
    historyPaused = true;
    const data = JSON.parse(snap);
    areas = data.areas || [];
    const mapInput = document.getElementById('mapNameInput');
    if (mapInput && data.mapName) mapInput.value = data.mapName;
    updateAreaList();
    updateCode();
    renderOverlays();
    updatePreview();
    updateAccessibilityReport?.();
    historyPaused = false;
}

function undoHistory() {
    if (historyIndex <= 0) {
        showToast('چیزی برای بازگشت نیست', 'info');
        return;
    }
    historyIndex--;
    restoreFromSnapshot(historyStack[historyIndex]);
    showToast('بازگشت انجام شد', 'info');
    updateUndoRedoUI();
}

function redoHistory() {
    if (historyIndex >= historyStack.length - 1) {
        showToast('چیزی برای انجام مجدد نیست', 'info');
        return;
    }
    historyIndex++;
    restoreFromSnapshot(historyStack[historyIndex]);
    showToast('انجام مجدد', 'info');
    updateUndoRedoUI();
}

function resetHistory() {
    historyStack = [];
    historyIndex = -1;
    pushHistory();
    updateUndoRedoUI();
}

function updateUndoRedoUI() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
}
