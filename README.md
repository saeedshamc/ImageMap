# Image Map Builder

A visual tool for creating HTML image maps. Upload an image, draw clickable regions (rectangle, circle, or polygon), configure each area (name, link, alt text, target), then copy or download the full `<img usemap>` + `<map>` output.

Runs as a **standalone offline web app** (open in any browser) or as a **Windows desktop app** (`.exe`) built with Electron.

**Fully offline:** Vazirmatn (Persian font) and Font Awesome icons are bundled locally under `src/vendor/`. No internet connection is required to use the app.

## Features

- Upload via drag & drop, file picker, or image URL
- Draw rectangle, circle, and polygon regions on the image
- Edit and delete individual areas
- Configure map name, image path in output, alt text, and responsive styling
- Export as “img + map only” or a complete HTML page
- Copy code to clipboard or download an HTML file
- Live, clickable preview of all regions
- Custom app icon for web (favicon) and Windows builds

## Project structure

```
ImageMap/
├── build/
│   └── icon.ico           # Windows / Electron app icon
├── electron/
│   └── main.js            # Electron main process
├── src/
│   ├── assets/
│   │   └── logo.ico       # Favicon and header logo (web UI)
│   ├── index.html         # UI shell
│   ├── css/
│   │   └── styles.css
│   ├── js/
│   │   └── app.js         # Application logic
│   └── vendor/            # Offline assets
│       ├── fontawesome/
│       └── vazirmatn/
├── logo.ico               # Source icon (copied to build/ and src/assets/)
├── package.json
├── LICENSE
└── README.md
```

## Web version (no install)

Open `src/index.html` in your browser. Everything works offline.

## Desktop development

```bash
npm install
npm start
```

## Build Windows executables

```bash
npm install
npm run dist:win
```

Outputs are written to `release/`:

| Artifact | Description |
|----------|-------------|
| `Image Map Builder Setup x.x.x.exe` | NSIS installer (desktop & Start Menu shortcuts) |
| `ImageMapBuilder-Portable-x.x.x.exe` | Portable build (no installation required) |

Portable build only:

```bash
npm run dist:portable
```

Unpacked app (for quick testing without installer):

```bash
npm run pack
```

Output: `release/win-unpacked/Image Map Builder.exe`

## App icon

The project ships with a custom icon:

- `build/icon.ico` — used by Electron and electron-builder (exe, shortcuts, taskbar)
- `src/assets/logo.ico` — favicon and header logo in the web UI

To replace the icon, update `logo.ico` at the project root, then copy it to both paths:

```powershell
Copy-Item logo.ico build\icon.ico -Force
Copy-Item logo.ico src\assets\logo.ico -Force
```

Recommended size: at least **256×256** pixels in `.ico` format.

## Troubleshooting

### Electron failed to install (`npm start`)

If you see `Electron failed to install correctly`, the Electron binary was not extracted into `node_modules/electron/dist`. Try:

```powershell
Remove-Item -Recurse -Force node_modules\electron\dist -ErrorAction SilentlyContinue
node node_modules\electron\install.js
```

If that still fails (e.g. antivirus blocking extraction), extract manually with 7-Zip:

```powershell
$zip = Get-ChildItem "$env:LOCALAPPDATA\electron\Cache" -Recurse -Filter "electron-v*-win32-x64.zip" | Select-Object -First 1
New-Item -ItemType Directory -Path node_modules\electron\dist -Force | Out-Null
& ".\node_modules\7zip-bin\win\x64\7za.exe" x -bd $zip.FullName "-o$PWD\node_modules\electron\dist"
Set-Content node_modules\electron\path.txt "electron.exe" -NoNewline
```

### Electron download timeout (`npm install`)

If `npm install` fails with network errors reaching GitHub, use a mirror:

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
```

Or add to a project `.npmrc` file:

```
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

### Build error: file in use (`app.asar`)

Close any running instance of Image Map Builder, close File Explorer windows on `release/`, then:

```powershell
Remove-Item -Recurse -Force release
npm run dist:win
```

### Build error: symbolic link / winCodeSign

On Windows, enable **Developer Mode** (`Settings → System → For developers`) or run PowerShell **as Administrator**, then rebuild.

For unsigned local builds you can also try:

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm run dist:win
```

## License

MIT — see [LICENSE](LICENSE).

---

# Image Map Builder (فارسی)

ابزار بصری برای ساخت **Image Map** در HTML. یک عکس آپلود کنید، نواحی قابل کلیک (مستطیل، دایره، چندضلعی) رسم کنید، تنظیمات هر ناحیه (نام، لینک، alt، target) را وارد کنید و در نهایت کد `<img usemap>` + `<map>` را کپی یا به‌صورت فایل HTML دانلود کنید.

هم به‌صورت **وب‌اپ آفلاین** (باز کردن در مرورگر) و هم **اپ دسکتاپ ویندوز** (`.exe`) با Electron قابل اجراست.

**کاملاً آفلاین:** فونت Vazirmatn و آیکن‌های Font Awesome به‌صورت محلی در `src/vendor/` قرار دارند و برای اجرا به اینترنت نیاز نیست.

## امکانات

- آپلود با drag & drop، انتخاب فایل، یا لینک عکس
- رسم نواحی مستطیل / دایره / چندضلعی روی عکس
- ویرایش و حذف هر ناحیه
- تنظیم نام نقشه، مسیر عکس در خروجی، alt و استایل واکنش‌گرا
- خروجی «فقط img + map» یا «صفحه HTML کامل»
- کپی کد و دانلود فایل HTML
- پیش‌نمایش زنده و قابل کلیک
- آیکن اختصاصی برای وب (favicon) و بیلد ویندوز

## ساختار پروژه

```
ImageMap/
├── build/icon.ico           # آیکن Electron و exe ویندوز
├── electron/main.js         # فرایند اصلی Electron
├── src/
│   ├── assets/logo.ico      # favicon و لوگوی هدر
│   ├── index.html
│   ├── css/styles.css
│   ├── js/app.js
│   └── vendor/              # منابع آفلاین
├── logo.ico                 # فایل منبع آیکن
├── package.json
└── README.md
```

## نسخه وب (بدون نصب)

فایل `src/index.html` را در مرورگر باز کنید.

## اجرای نسخه دسکتاپ (توسعه)

```bash
npm install
npm start
```

## ساخت exe برای ویندوز

```bash
npm install
npm run dist:win
```

خروجی‌ها در `release/`:

| فایل | توضیح |
|------|--------|
| `Image Map Builder Setup x.x.x.exe` | نصب‌کننده NSIS |
| `ImageMapBuilder-Portable-x.x.x.exe` | نسخه portable (بدون نصب) |

فقط portable:

```bash
npm run dist:portable
```

## آیکن برنامه

- `build/icon.ico` — exe، shortcut و taskbar
- `src/assets/logo.ico` — favicon و لوگوی UI

برای تعویض آیکن، `logo.ico` را در ریشه پروژه جایگزین کنید و کپی کنید:

```powershell
Copy-Item logo.ico build\icon.ico -Force
Copy-Item logo.ico src\assets\logo.ico -Force
```

حداقل اندازه پیشنهادی: **256×256** پیکسل، فرمت `.ico`

## رفع اشکال

### Electron نصب نشد

```powershell
Remove-Item -Recurse -Force node_modules\electron\dist -ErrorAction SilentlyContinue
node node_modules\electron\install.js
```

### خطای شبکه هنگام npm install

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
```

### فایل app.asar قفل است

برنامه را ببندید، پوشه `release` را پاک کنید و دوباره `npm run dist:win` بزنید.

### خطای symbolic link / winCodeSign

**Developer Mode** را در ویندوز فعال کنید یا PowerShell را **Run as administrator** اجرا کنید.

## مجوز

MIT — جزئیات در [LICENSE](LICENSE).
