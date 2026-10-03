# برنامه دسکتاپ دستمزد آرمانی ۱۴۰۵

پوسته دسکتاپ بر پایه **Tauri 2** که همان خروجی ایستای `apps/web` را در WebView2 (ویندوز) یا WKWebView (مک) اجرا می‌کند و امکانات بومی را در اختیار آن می‌گذارد.

## پیش‌نیازها

| مورد           | نسخه                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------- |
| Node.js و pnpm | 20.11+ و 10                                                                              |
| Rust           | stable (به‌همراه `cargo`)                                                                |
| ویندوز         | WebView2 Runtime (در ویندوز ۱۱ و به‌روزرسانی‌های ۱۰ نصب است) و Microsoft C++ Build Tools |
| مک             | Xcode Command Line Tools                                                                 |

## اجرا و ساخت

```bash
# نصب وابستگی‌ها از ریشه مخزن
pnpm install

# اجرای برنامه در حالت توسعه (سرور Next را خودش بالا می‌آورد)
pnpm --filter @dastmozd/desktop dev

# ساخت بسته نهایی برای سیستم جاری
pnpm --filter @dastmozd/desktop build

# ساخت هدف مشخص
pnpm --filter @dastmozd/desktop build:windows
pnpm --filter @dastmozd/desktop build:macos
```

خروجی‌ها:

| بستر                    | مسیر                                                                    |
| ----------------------- | ----------------------------------------------------------------------- |
| ویندوز — نصب‌کننده NSIS | `src-tauri/target/release/bundle/nsis/Dastmozd_<version>_x64-setup.exe` |
| ویندوز — نسخه همراه     | `src-tauri/target/release/Dastmozd.exe`                                 |
| مک — دیسک نصب           | `src-tauri/target/release/bundle/dmg/Dastmozd_<version>_<arch>.dmg`     |
| مک — بسته برنامه        | `src-tauri/target/release/bundle/macos/Dastmozd.app`                    |

جریان `Release desktop app` این فایل‌ها را با نام‌های `Dastmozd-Setup-<version>.exe`، `Dastmozd-Portable-<version>-x64.exe` و `Dastmozd-<version>-arm64.dmg` منتشر می‌کند.

> نسخه همراه تنها به WebView2 نیاز دارد که در ویندوز ۱۱ پیش‌نصب است؛ روی ویندوز ۱۰ ممکن است لازم باشد یک‌بار WebView2 Runtime نصب شود.

## امکانات بومی

- **منوی فارسی**: پرونده (کارمند جدید `Ctrl+N`، دوره جدید `Ctrl+P`، پشتیبان سریع `Ctrl+B`، بازگردانی)، ویرایش، نمایش (زوم، تمام‌صفحه، بازخوانی)، گزارش‌ها (فیش، دیسکت بیمه، لیست مالیات، گزارش ماهانه) و راهنما (`F1`).
- **سینی سیستم**: نمایش پنجره، پشتیبان‌گیری سریع، خروج. بستن پنجره ابتدا یک پشتیبان خودکار می‌سازد و سپس پنجره را پنهان می‌کند.
- **پشتیبان بومی**: پوشه `%APPDATA%\Dastmozd\backups` (در مک: `~/Library/Application Support/Dastmozd/backups`) با سیاست نگهداری **۳۰ نسخه روزانه، ۱۲ ماهانه و ۵ سالانه**؛ اجرای سیاست در هر بار راه‌اندازی و به‌صورت دستی از تنظیمات.
- **انجمن پرونده**: پسوند `.dastmozd`؛ با دوبار کلیک روی فایل پشتیبان، برنامه باز می‌شود و از کاربر برای بازگردانی تأیید می‌گیرد.
- **اجرای خودکار در ویندوز**: از «تنظیمات ← نسخه دسکتاپ».
- **چاپ بومی**: چاپ فیش و گزارش‌ها با دیالوگ چاپ سیستم.
- **به‌روزرسانی امضاشده**: از صفحه انتشار GitHub با `latest.json` و امضای Tauri.

## به‌روزرسانی خودکار و اسرار امضا

فایل پیکربندی امضا‌شده در مخزن نگه‌داری نمی‌شود و جریان CI آن را از اسرار مخزن می‌سازد:

| نام راز                              | کاربرد                                |
| ------------------------------------ | ------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | کلید خصوصی امضای بسته‌ها              |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | گذرواژه کلید                          |
| `TAURI_SIGNING_PUBLIC_KEY`           | کلید عمومی تزریق‌شده در پیکربندی ساخت |

ساخت محلی با قابلیت به‌روزرسانی (در صورت وجود کلید محلی):

```bash
cat > src-tauri/tauri.updater.conf.json <<'JSON'
{
  "bundle": { "createUpdaterArtifacts": true },
  "plugins": {
    "updater": {
      "endpoints": ["https://github.com/rahmaniho/Dastmozd2025/releases/latest/download/latest.json"],
      "pubkey": "<کلید عمومی minisign>",
      "windows": { "installMode": "passive" }
    }
  }
}
JSON

pnpm --filter @dastmozd/desktop build:updater
```

فایل‌های `tauri.updater.conf.json` و `capabilities/updater.json` در `.gitignore` هستند. ساخت بدون قابلیت `updater` (پیش‌فرض) نیازی به کلید ندارد.

## ساختار کد

```
apps/desktop/
  package.json                 فرمان‌های tauri
  scripts/build-updater-manifest.mjs   ساخت latest.json از امضاها
  src-tauri/
    Cargo.toml                 وابستگی‌ها (tauri، افزاره‌های رسمی)
    tauri.conf.json            شناسه ir.armani.dastmozd، پنجره، NSIS/DMG، انجمن پرونده
    capabilities/default.json  مجوزهای بومی پنجره اصلی
    icons/                     آیکون‌های ویندوز/مک (ساخته‌شده از نشان برد)
    src/
      main.rs                  نقطه ورود
      lib.rs                   ساخت Builder، افزاره‌ها، رویدادها
      menu.rs                  منوی فارسی و سینی سیستم
      commands.rs              فرمان‌های بومی (پشتیبان، مسیرها، پرونده بازشده)
      backup.rs                مسیرها، نوشتن/خواندن/حذف و سیاست نگهداری
```

پل میان وب و پوسته در `apps/web/src/lib/native.ts` و مؤلفه‌های `desktop-panel.tsx` و `desktop-bridge.tsx` قرار دارد؛ همه فراخوانی‌ها پیش از اجرا وجود محیط Tauri را بررسی می‌کنند تا نسخه وب دست‌نخورده بماند.

## آزمون دستی پیش از انتشار

1. نصب‌کننده را روی یک ویندوز تازه اجرا کنید و مطمئن شوید برنامه بدون اینترنت بالا می‌آید (زیر ۲ ثانیه).
2. یک کارمند بسازید، کارکرد ثبت کنید، دوره را اجرا کنید و فیش PDF بگیرید.
3. پشتیبان بومی بگیرید، برنامه را ببندید، پرونده `.dastmozd` را دوبار کلیک کنید و بازگردانی را تأیید کنید.
4. «اجرای خودکار در ویندوز» را فعال و پس از راه‌اندازی دوباره بررسی کنید.
5. از منوی «راهنما ← بررسی به‌روزرسانی» نسخه تازه را نصب کنید و مطمئن شوید داده‌ها باقی می‌مانند.
