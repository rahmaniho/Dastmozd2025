# دستمزد آرمانی ۱۴۰۵ · Dastmozd-e Armani 1405

<div dir="rtl">

سامانه جامع **حقوق و دستمزد** برای کارگاه‌ها و شرکت‌های ایرانی: ثبت کارکرد، محاسبه مزایا و کسورات، بیمه تأمین اجتماعی، مالیات بر درآمد حقوق، فیش حقوقی، دیسکت بیمه، لیست مالیات و گزارش‌های مدیریتی — **کاملاً آفلاین، روی دستگاه خودتان**.

نسخه وب نصب‌شدنی (PWA) و برنامه دسکتاپ ویندوز/مک از **یک کدبیس و یک مدل داده** ساخته می‌شوند.

|               |                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------ |
| نشانی نسخه وب | <https://rahmaniho.github.io/Dastmozd2025/>                                                |
| نسخه دسکتاپ   | `Dastmozd-Setup-<version>.exe` (نصب‌کننده) و `Dastmozd-Portable-<version>-x64.exe` (همراه) |
| مالک محصول    | شرکت صنعت بسته‌بندی نقش آرمانی                                                             |
| توسعه         | [karen-soft.ir](https://karen-soft.ir)                                                     |

## قابلیت‌ها

- **کارکنان**: ثبت و ویرایش پرونده، اعتبارسنجی کد ملی (چک‌سام)، یکتایی شماره پرسنلی و شماره بیمه، دپارتمان‌ها، ورود گروهی از اکسل با گزارش اعتبارسنجی، جست‌وجو، پالایش و صفحه‌بندی.
- **حضور و غیاب**: ثبت روزانه، شبکه ماهانه قابل ویرایش، آداپتورهای ورود فایل پرسپولیس/سپیدار/راهکاران، مانده مرخصی، جریمه تأخیر و تعجیل.
- **محاسبه حقوق**: ویزارد چهارگامی (اطلاعات پایه ← کارکرد ← مزایا ← کسورات)، پیش‌نمایش هر کارمند، اجرای گروهی با نوار پیشرفت، نسخه‌بندی دوره‌ها و قفل دوره.
- **کسورات**: کسورات قانونی و اختیاری، وام و اقساط، کسورات سفارشی.
- **گزارش‌ها**: فیش حقوقی PDF فارسی با کد QR، دیسکت بیمه، فایل مالیات اکسل، خلاصه ماهانه، هزینه کارفرما، عیدی و سنوات، گزارش سالانه و سازنده گزارش با کشیدن ستون‌ها؛ خروجی PDF/Excel/CSV.
- **تنظیمات**: پرونده شرکت و چند شرکت، سال مالی، پارامترهای قانونی هر سال، پشتیبان رمزنگاری‌شده `.dastmozd`، بازگردانی با بررسی SHA-256 و کنترل نقش‌ها (مدیر/حسابدار/بیننده).
- **داشبورد**: شاخص‌های کلیدی، نمودار روند دوازده‌ماهه، توزیع دپارتمان‌ها، تقویم رویدادها (پایان قرارداد، سررسید وام، مهلت بیمه و مالیات).
- **ردگیری**: سیاهه بازبینی تغییرناپذیر با زنجیره درهم‌سازی و خروجی JSON برای حسابرسی.
- **آفلاین‌محور**: سرویس‌ورکر Workbox، پیش‌بارگذاری کامل برنامه، همگام‌سازی پس‌زمینه و اشتراک‌گذاری فایل اکسل از موبایل.

## پشته فنی

| لایه             | فناوری                                                                                  |
| ---------------- | --------------------------------------------------------------------------------------- |
| تکنولوژی پایه    | pnpm workspaces + Turborepo، TypeScript 5.9 (strict، بدون `any`)                        |
| وب               | Next.js 15 (App Router, static export) + React 19                                       |
| رابط کاربری      | Tailwind v4 + shadcn/ui + توکن‌های CSS، Vazirmatn خودمیزبان، RTL-first با فارسی/انگلیسی |
| حالت و داده      | Zustand، Dexie (IndexedDB) به‌عنوان منبع حقیقت، TanStack Query                          |
| فرم و اعتبارسنجی | React Hook Form + Zod                                                                   |
| نمودار و سند     | Recharts (RTL) و @react-pdf/renderer با فونت جاسازی‌شده                                 |
| اکسل             | SheetJS + exceljs                                                                       |
| تاریخ            | dayjs + jalaliday (تقویم جلالی)                                                         |
| دسکتاپ           | Tauri 2.x (WebView2 روی ویندوز)                                                         |
| آزمون            | Vitest (واحد)، Playwright + @axe-core/playwright (سرتاسری و دسترس‌پذیری)                |
| کیفیت کد         | ESLint (شامل jsx-a11y)، Prettier، Husky + lint-staged، GitHub Actions                   |

## ساختار مخزن

```
apps/
  web/                برنامه وب نصب‌شدنی (PWA) + خروجی ایستا
  desktop/            پوسته دسکتاپ Tauri 2 (ویندوز و مک)
packages/
  core/               موتور محاسبه خالص، بدون وابستگی به فریم‌ورک (پوشش آزمون ≥۹۵٪)
  legal/              پروفایل‌های قانونی سال‌های ۱۴۰۳، ۱۴۰۴ و ۱۴۰۵
  db/                 لایه Dexie، مخازن، رمزنگاری، پشتیبان و سیاهه بازبینی
  types/              انواع مشترک دامنه
  ui/                 کتابخانه مؤلفه‌های راست‌چین
  brand/              نشان، توکن‌های طراحی و دارایی‌های بصری
docs/                 معماری، مقررات، راهنمای کاربر، برند و تغییرات
assets/               دارایی‌های انتشار و رسانه
index.html            نسخه قدیمی تک‌فایلی (مرجع بصری)
```

## راه‌اندازی توسعه

پیش‌نیازها: Node.js 20.11 یا بالاتر، pnpm 10، و برای ساخت دسکتاپ Rust پایدار.

```bash
pnpm install

# اجرای برنامه وب روی http://localhost:3000
pnpm --filter web dev

# کیفیت کد
pnpm lint
pnpm typecheck
pnpm test           # آزمون‌های واحد
pnpm test:e2e       # آزمون‌های سرتاسری (نیازمند نصب مرورگرهای Playwright)

# ساخت خروجی ایستا برای انتشار روی GitHub Pages
GITHUB_PAGES=true pnpm --filter web build

# ساخت برنامه دسکتاپ
pnpm --filter @dastmozd/desktop build
```

## مستندات

- [معماری و تصمیم‌های فنی](docs/ARCHITECTURE.md)
- [مبنای قانونی و پارامترهای سالانه](docs/LEGAL.md)
- [راهنمای کاربر](docs/USER_GUIDE.md)
- [راهنمای مشارکت](docs/CONTRIBUTING.md)
- [تاریخچه تغییرات](docs/CHANGELOG.md)
- [راهنمای برند](docs/BRAND.md)
- [برنامه دسکتاپ](apps/desktop/README.md)

## حریم خصوصی

هیچ داده‌ای از کارکنان به سرور فرستاده نمی‌شود. همه اطلاعات در IndexedDB همان مرورگر یا در حافظه دستگاه ذخیره می‌شود و پشتیبان‌ها به‌صورت فایل رمزنگاری‌شده در اختیار شماست. همگام‌سازی ابری اختیاری است و در صورت فعال‌سازی، به‌صورت رمزنگاری‌شده و با سیاست‌های RLS انجام می‌شود.

> **نکته حقوقی:** این نرم‌افزار ابزار محاسباتی است، نه جایگزین بخشنامه، قرارداد یا تأیید حسابدار رسمی. پیش از ارسال لیست بیمه یا مالیات، ارقام را با مصوبات همان ماه تطبیق دهید (جزئیات در `docs/LEGAL.md`).

</div>

---

## English

**Dastmozd-e Armani 1405** is a complete Iranian payroll platform built for packaging manufacturer _Armani_. It ships as an installable PWA and a Windows/macOS desktop application generated from a single codebase and data model.

- **Offline-first**: all data lives in IndexedDB (Dexie); optional end-to-end encrypted cloud sync.
- **Legally versioned**: year-based legal profiles (1403–1405) covering minimum wage, housing/grocery/marriage/child allowances, progressive income tax, 7% employee / 23% employer insurance plus 3% unemployment, overtime, night-shift and holiday multipliers. Every calculation returns a deterministic `calculationTrace`.
- **Accountant workflow**: employees → attendance → four-step payroll wizard → PDF payslips with QR, social-security diskette file, tax Excel export, employer-cost and annual reports.
- **Quality gates**: Vitest unit tests (core ≥95% coverage), Playwright end-to-end tests, axe accessibility checks, Lighthouse ≥95 targets, ESLint/Prettier/Husky.
- **Desktop**: Tauri 2 with Persian native menus, system tray, `%APPDATA%\Dastmozd\backups`, `.dastmozd` file association, autostart and signed auto-updates from GitHub Releases.

Quick start: `pnpm install && pnpm --filter web dev`. Full documentation lives in [`docs/`](docs/).

## License

Proprietary — see [LICENSE](LICENSE). Third-party dependencies keep their own licenses (all permissive; no paid or closed components are required at build or run time).
