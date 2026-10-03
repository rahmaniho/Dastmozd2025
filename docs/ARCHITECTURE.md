# معماری دستمزد آرمانی ۱۴۰۵

این سند ساختار فنی، تصمیم‌های معماری و مسیر داده را در سه بستهٔ اجرایی (وب نصب‌شدنی، دسکتاپ ویندوز/مک) توضیح می‌دهد.

## تصویر کلی

```mermaid
flowchart TB
    subgraph Clients["لایه اجرا"]
        PWA["PWA مرورگر<br/>Chrome / Edge / Firefox / Safari"]
        WIN["برنامه دسکتاپ ویندوز<br/>Tauri 2 + WebView2"]
        MAC["برنامه دسکتاپ مک<br/>Tauri 2 + WKWebView"]
    end

    subgraph Web["apps/web — Next.js 15 App Router (static export)"]
        UI["صفحه‌ها و مؤلفه‌ها<br/>RTL، فارسی، حالت تیره"]
        Books["حالت برنامه<br/>Zustand + TanStack Query"]
        Docs["سند و خروجی<br/>@react-pdf/renderer، SheetJS، exceljs"]
    end

    subgraph Domain["دامنه مشترک"]
        Core["packages/core<br/>موتور محاسبه خالص + ردیابی"]
        Legal["packages/legal<br/>پروفایل سال ۱۴۰۳/۱۴۰۴/۱۴۰۵"]
        Types["packages/types<br/>انواع دامنه"]
        UIkit["packages/ui<br/>کتابخانه مؤلفه"]
        Brand["packages/brand<br/>نشان و توکن‌های طراحی"]
    end

    DB["packages/db<br/>Dexie / IndexedDB<br/>منبع حقیقت"]
    Native["پوسته بومی Tauri<br/>فرمان‌های Rust، منو، سینی، پشتیبان"]
    Cloud["همگام‌سازی اختیاری<br/>Supabase + RLS (E2E رمزنگاری‌شده)"]

    PWA --> Web
    WIN --> Web
    MAC --> Web
    Web --> Domain
    Web --> DB
    Core --> Legal
    Web --> Native
    DB -.->|اختیاری| Cloud
```

## ساختار مخزن

```mermaid
flowchart LR
    core["packages/core"] --> legal["packages/legal"]
    types["packages/types"] --> core
    types --> legal
    core --> db["packages/db"]
    legal --> db
    types --> db
    db --> web["apps/web"]
    core --> web
    legal --> web
    ui["packages/ui"] --> web
    brand["packages/brand"] --> ui
    web --> desktop["apps/desktop (Tauri)"]
```

- **`packages/core`** هیچ وابستگی به React، مرورگر یا Dexie ندارد؛ توابع خالص و قطعی با پوشش آزمون ≥۹۵٪. همه محاسبات یک `calculationTrace[]` برمی‌گردانند که در رابط کاربری قابل مشاهده است.
- **`packages/legal`** پارامترهای سالانه را در `src/profiles/{1403,1404,1405}.ts` نگه می‌دارد و با `resolveLegalProfile(year)` نزدیک‌ترین پروفایل را با هشدار جانشینی برمی‌گرداند.
- **`packages/db`** تنها لایه‌ای است که با IndexedDB کار می‌کند: مخازن (employees, attendance, payroll, loans, companies, settings, events), سیاهه بازبینی زنجیره‌ای، رمزنگاری AES-GCM و پشتیبان.

## مسیر محاسبه حقوق

```mermaid
sequenceDiagram
    participant U as حسابدار
    participant W as ویزارد وب
    participant DB as Dexie
    participant E as موتور core
    participant L as پروفایل legal

    U->>W: انتخاب دوره (سال/ماه) و کارکنان
    W->>DB: خواندن کارکرد ماه، وام‌ها و تنظیمات شرکت
    W->>E: calculatePayrollBatch(کارکنان، کارکرد، گزینه‌ها)
    E->>L: resolveLegalProfile(jy)
    L-->>E: حداقل مزد، مزایا، سقف بیمه، پلکان مالیات
    E->>E: مزد پایه ← مزایا ← اضافه‌کار/شب‌کاری ← بیمه ← مالیات ← کسورات
    E-->>W: PayrollResult + calculationTrace + warnings
    U->>W: تأیید و اجرای دوره
    W->>DB: ذخیره PayrollRun نسخه‌دار و Payslip هر کارمند
    W->>DB: قفل دوره (status = locked)
```

ترتیب محاسبه در `packages/core/src/engine/payroll.ts` ثابت است تا نتیجه، تکرارپذیر و قابل حسابرسی بماند:

1. محاسبه نرخ‌ها (روزانه، ساعتی، اضافه‌کار ۱٫۴، شب‌کاری ۱٫۳۵، جمعه/تعطیل ۱٫۴ + اضافه‌کار).
2. مزد پایه متناسب با روزهای کارکرد و پایه سنوات (در صورت احراز شرط یک سال سابقه).
3. مزایای ثابت (حق مسکن، بن، حق تأهل، حق اولاد برای هر فرزند واجد شرایط).
4. اضافه‌کار، شب‌کاری، کار در تعطیل، کسر تأخیر و غیبت.
5. بیمه تأمین اجتماعی سهم کارگر ۷٪، کارفرما ۲۳٪ و بیمه بیکاری ۳٪ با سقف هفت برابر حداقل مزد.
6. مالیات بر درآمد حقوق با پلکان ترقیقی و معافیت‌های ماده ۹۱.
7. کسورات قانونی و اختیاری (وام، مساعده، کسورات سفارشی) و مبلغ قابل پرداخت گردشده.

## مدل داده

```mermaid
erDiagram
    COMPANIES ||--o{ DEPARTMENTS : دارد
    COMPANIES ||--o{ EMPLOYEES : دارد
    EMPLOYEES ||--o{ ATTENDANCE : ثبت
    EMPLOYEES ||--o{ PAYSLIPS : دریافت
    EMPLOYEES ||--o{ LOANS : وام
    COMPANIES ||--o{ PAYROLL_RUNS : دوره
    PAYROLL_RUNS ||--o{ PAYSLIPS : تولید
    COMPANIES ||--o{ EVENTS : تقویم
    COMPANIES ||--o{ BACKUPS : پشتیبان
```

- `PayrollRun` نسخه‌دار است: هر اجرای دوباره همان دوره، نسخه تازه می‌سازد و `meta.legalProfileHash` و `meta.engineVersion` را ثبت می‌کند تا نتیجه سال‌ها بعد قابل بازتولید باشد.
- سیاهه بازبینی (`audit`) با زنجیره درهم‌سازی فقط افزودنی است و `verifyAuditChain` سلامت آن را بررسی می‌کند.

## تصمیم‌های معماری

| تصمیم                                 | دلیل                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| Dexie/IndexedDB به‌عنوان منبع حقیقت   | کارکرد کامل آفلاین، سرعت بالا، عدم ارسال داده شخصی به سرور          |
| خروجی ایستا (`output: 'export'`)      | انتشار ساده روی GitHub Pages و بارگذاری مستقیم در WebView بدون سرور |
| یک کدبیس برای وب و دسکتاپ             | جلوگیری از دوپیاده‌سازی محاسبه و اختلاف عددی بین نسخه‌ها            |
| موتور محاسبه بدون وابستگی             | آزمون‌پذیری، استفاده در آینده در سرور یا اسکریپت‌های دسته‌ای        |
| ثبت `calculationTrace` برای هر محاسبه | پاسخ به «چرا این عدد؟» برای حسابدار و حسابرس                        |
| پروفایل قانونی سالانه جدا             | تغییر مقررات بدون دست‌زدن به کد و بدون بازنویسی سابقه               |
| پشتیبان رمزنگاری‌شده `.dastmozd`      | انتقال امن بین دستگاه‌ها و آرشیو بلندمدت                            |

## امنیت و حریم خصوصی

- رمزنگاری در حالت سکون: AES-GCM با کلید مشتق‌شده از گذرواژه/PIN به روش PBKDF2-SHA256 با ۳۱۰٬۰۰۰ تکرار.
- بررسی یکپارچگی پشتیبان با SHA-256 پیش از بازگردانی.
- همگام‌سازی ابری اختیاری و سرتاسری رمزنگاری‌شده؛ داده شخصی هرگز به سرویس تحلیل نمی‌رود.
- در دسکتاپ، CSP سخت‌گیرانه اعمال می‌شود و دسترسی پرونده‌ای به پوشه پشتیبان محدود است.
- نشست‌ها با WebAuthn (اثر انگشت/چهره) و رمزنگاری محلی قابل قفل‌شدن هستند.

## آزمون و تضمین کیفیت

| لایه           | ابزار                                        | معیار پذیرش                                     |
| -------------- | -------------------------------------------- | ----------------------------------------------- |
| موتور و قوانین | Vitest                                       | پوشش خطوط ≥۹۵٪، عددهای مرجع ریالی               |
| لایه داده      | Vitest + fake-indexeddb                      | پوشش ≥۷۰٪، سناریوهای پشتیبان و بازبینی          |
| رابط کاربری    | Vitest + Testing Library                     | تبدیل‌ها، اعتبارسنجی و پیام‌های فارسی           |
| سرتاسری        | Playwright (کروم، فایرفاکس، وبی‌کیت، موبایل) | جریان کامل کارمند ← کارکرد ← حقوق ← فیش ← خروجی |
| دسترس‌پذیری    | @axe-core/playwright                         | صفر خطای WCAG 2.1 A/AA                          |
| کارایی         | Lighthouse (CI دستی)                         | ≥۹۵ در چهار دسته                                |

## استقرار

```mermaid
flowchart LR
    Dev["توسعه‌دهنده"] -->|push| GH["GitHub"]
    GH --> CI["CI: lint، typecheck، test، build"]
    GH -->|main| Pages["GitHub Pages<br/>PWA نصب‌شدنی"]
    GH -->|tag vX.Y.Z| Rel["Release workflow"]
    Rel --> NSIS["Dastmozd-Setup-X.Y.Z.exe"]
    Rel --> Port["Dastmozd-Portable-X.Y.Z-x64.exe"]
    Rel --> DMG["Dastmozd-X.Y.Z-arm64.dmg"]
    Rel --> LAT["latest.json + امضاهای Tauri"]
    LAT -->|به‌روزرسانی خودکار| WinApp["برنامه نصب‌شده روی ویندوز/مک"]
```

اسرار لازم برای انتشار (در تنظیمات مخزن تعریف شوند):

| نام                                  | کاربرد                                      |
| ------------------------------------ | ------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | کلید خصوصی امضای بسته‌ها و به‌روزرسانی      |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | گذرواژه کلید امضا                           |
| `TAURI_SIGNING_PUBLIC_KEY`           | کلید عمومی که در پیکربندی ساخت تزریق می‌شود |

> کلیدها هرگز در مخزن نگه‌داری نمی‌شوند؛ فایل `apps/desktop/src-tauri/tauri.updater.conf.json` و قابلیت `updater` در زمان ساخت توسط جریان CI ساخته می‌شوند و در `.gitignore` هستند.

## توسعه محلی

```bash
pnpm install
pnpm --filter web dev                  # وب روی http://localhost:3000
pnpm --filter @dastmozd/desktop dev    # دسکتاپ با Rust نصب‌شده
pnpm lint && pnpm typecheck && pnpm test
GITHUB_PAGES=false pnpm --filter web build && pnpm --filter web serve:static
pnpm --filter web screenshots          # تصاویر مستندات در docs/screenshots
```
