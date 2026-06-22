const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        backgroundColor: '#0a0e17',
        title: 'Image Map Builder',
        icon: path.join(__dirname, '..', 'build', 'icon.png'),
        webPreferences: {
            // اپ فقط فایل‌های محلی را نمایش می‌دهد؛ نیازی به دسترسی Node در رندر نیست
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

    // بازکردن لینک‌های خارجی در مرورگر پیش‌فرض سیستم به‌جای داخل اپ
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (/^https?:\/\//i.test(url)) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// منوی ساده با امکان باز کردن DevTools و Reload
function buildMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{ role: 'appMenu' }] : []),
        {
            label: 'فایل',
            submenu: [isMac ? { role: 'close' } : { role: 'quit' }]
        },
        {
            label: 'نمایش',
            submenu: [
                { role: 'reload', label: 'بارگذاری مجدد' },
                { role: 'forceReload', label: 'بارگذاری اجباری' },
                { type: 'separator' },
                { role: 'resetZoom', label: 'بازنشانی بزرگ‌نمایی' },
                { role: 'zoomIn', label: 'بزرگ‌نمایی' },
                { role: 'zoomOut', label: 'کوچک‌نمایی' },
                { type: 'separator' },
                { role: 'togglefullscreen', label: 'تمام‌صفحه' },
                { role: 'toggleDevTools', label: 'ابزار توسعه‌دهنده' }
            ]
        }
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
    buildMenu();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
