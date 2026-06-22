# Image Map Builder

ابزار ساخت **Image Map**: یک عکس آپلود کن، روی آن نواحی قابل کلیک (مستطیل، دایره، چندضلعی) بکش، تنظیمات هر ناحیه (نام، لینک، alt، target) را بده و در نهایت کد کامل `<img usemap>` + `<map>` را کپی یا به‌صورت فایل HTML دانلود کن.

این پروژه هم به‌صورت یک وب‌سایت ساده اجرا می‌شود و هم به‌صورت اپلیکیشن دسکتاپ ویندوز (خروجی `.exe`) با **Electron**.

**کاملاً آفلاین:** تمام منابع جانبی (فونت Vazirmatn و آیکن‌های Font Awesome) به‌صورت محلی در پوشه‌ی `src/vendor/` قرار دارند و برنامه برای اجرا به هیچ اتصال اینترنتی نیاز ندارد.

## ساختار پروژه

```
ImageMap/
├── electron/
│   └── main.js          # فرایند اصلی Electron
├── src/
│   ├── index.html       # رابط کاربری
│   ├── css/
│   │   └── styles.css    # تمام استایل‌ها
│   ├── js/
│   │   └── app.js        # تمام منطق برنامه
│   └── vendor/          # منابع محلی (آفلاین)
│       ├── fontawesome/  # CSS و فونت‌های آیکن
│       └── vazirmatn/    # فونت فارسی Vazirmatn
├── package.json
└── README.md
```

## اجرای نسخه وب (بدون Electron)

کافی است فایل `src/index.html` را در مرورگر باز کنی. همه چیز آفلاین کار می‌کند.

## اجرای نسخه دسکتاپ (حالت توسعه)

```bash
npm install
npm start
```

## ساخت خروجی exe برای ویندوز

```bash
npm install
npm run dist:win
```

خروجی‌ها در پوشه `release/` ساخته می‌شوند:

- **نصب‌کننده (Installer)**: `Image Map Builder Setup x.x.x.exe`
- **نسخه قابل حمل (Portable)**: `ImageMapBuilder-Portable-x.x.x.exe` (بدون نیاز به نصب)

برای ساخت فقط نسخه‌ی portable:

```bash
npm run dist:portable
```

## آیکن برنامه (اختیاری)

برای آیکن اختصاصی، یک فایل `build/icon.ico` (حداقل 256×256) قرار بده. در غیر این صورت از آیکن پیش‌فرض Electron استفاده می‌شود.

## رفع اشکال: خطای دانلود Electron

اگر هنگام `npm install` یا اجرای برنامه، Electron دانلود نشد و خطایی مثل
`Client network socket disconnected before secure TLS connection was established`
یا `connect ETIMEDOUT` گرفتی، یعنی دسترسی به `github.com` (محل دانلود باینری Electron) محدود است.

راه‌حل: استفاده از آینه‌ی (mirror) دانلود. در PowerShell:

```powershell
$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
npm install
npm start
```

یا به‌صورت دائمی در فایل `.npmrc` کنار پروژه:

```
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
```

سپس دوباره `npm install` و بعد `npm run dist:win` را اجرا کن.

## امکانات

- آپلود با کشیدن‌ورها‌کردن (drag & drop)، انتخاب فایل، یا وارد کردن لینک عکس
- رسم نواحی مستطیل / دایره / چندضلعی روی عکس
- ویرایش و حذف هر ناحیه
- تنظیم نام نقشه، مسیر عکس در خروجی، متن جایگزین و استایل واکنش‌گرا
- خروجی «فقط img + map» یا «صفحه کامل HTML»
- کپی کد و دانلود فایل HTML
- پیش‌نمایش زنده و قابل کلیک از نواحی
