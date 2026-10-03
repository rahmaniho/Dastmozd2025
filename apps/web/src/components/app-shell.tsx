'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  IllustrationWelcome,
  Skeleton,
  useToast,
} from '@dastmozd/ui';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Download,
  LayoutDashboard,
  Lock,
  Menu,
  Moon,
  Settings,
  Sun,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@dastmozd/ui';
import { seedDemoData, db, saveDepartment, ensureActiveCompany, makeId } from '@dastmozd/db';
import { useAppStore } from '@/lib/store';
import { useBootstrap, usePeriodNavigator, useDatabaseCounts } from '@/lib/hooks';
import { JALALI_MONTH_LABELS } from '@/lib/hooks';
import { DesktopBridge } from '@/components/desktop-bridge';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  /** توضیح کوتاه برای راهنمای صفحه‌خوان. */
  hint: string;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/',
    label: 'داشبورد',
    icon: <LayoutDashboard className="size-4" />,
    hint: 'تصویر کلی حقوق و دستمزد',
  },
  {
    href: '/employees',
    label: 'کارکنان',
    icon: <Users className="size-4" />,
    hint: 'مدیریت پرونده کارکنان',
  },
  {
    href: '/attendance',
    label: 'حضور و غیاب',
    icon: <CalendarDays className="size-4" />,
    hint: 'کارکرد ماهانه',
  },
  {
    href: '/payroll',
    label: 'محاسبه حقوق',
    icon: <Wallet className="size-4" />,
    hint: 'اجرای دوره حقوقی',
  },
  {
    href: '/reports',
    label: 'گزارش‌ها',
    icon: <BarChart3 className="size-4" />,
    hint: 'فیش، بیمه، مالیات و خروجی‌ها',
  },
  {
    href: '/settings',
    label: 'تنظیمات',
    icon: <Settings className="size-4" />,
    hint: 'شرکت، مقررات، پشتیبان و کاربران',
  },
  {
    href: '/help',
    label: 'راهنما',
    icon: <BookOpen className="size-4" />,
    hint: 'راهنمای گام‌به‌گام و پرسش‌های متداول',
  },
];

/** راهنمای نصب PWA — پس از دو بازدید نمایش داده می‌شود و کاربر می‌تواند آن را ببندد. */
function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const visits = Number(window.localStorage.getItem('dastmozd-visits') ?? '0') + 1;
    window.localStorage.setItem('dastmozd-visits', String(visits));
    const dismissed = window.localStorage.getItem('dastmozd-install-dismissed') === 'true';
    if (visits >= 2 && !dismissed && !window.matchMedia('(display-mode: standalone)').matches) {
      setVisible(true);
    }
  }, []);

  const install = useCallback(async () => {
    const promptEvent = (
      window as unknown as {
        __dastmozdInstallPrompt?: Event & {
          prompt?: () => Promise<void>;
          userChoice?: Promise<{ outcome: string }>;
        };
      }
    ).__dastmozdInstallPrompt;
    if (!promptEvent?.prompt) {
      toast({
        tone: 'info',
        title: 'نصب دستی برنامه',
        description:
          'در مرورگر خود از منوی «افزودن به صفحه اصلی» یا «نصب برنامه» استفاده کنید؛ پس از نصب، سامانه آفلاین کار می‌کند.',
      });
      setVisible(false);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === 'accepted') {
      toast({
        tone: 'success',
        title: 'برنامه نصب شد',
        description: 'دستمزد آرمانی اکنون روی دستگاه شما نصب است.',
      });
    }
    setVisible(false);
  }, [toast]);

  if (!visible) return null;

  return (
    <div className="mx-4 mb-3 flex items-start gap-3 rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-primary))]/30 bg-[rgb(var(--dm-primary-subtle))] p-3.5">
      <Download className="mt-0.5 size-5 text-[rgb(var(--dm-primary))]" aria-hidden />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-bold text-[rgb(var(--dm-text))]">نصب برنامه روی دستگاه</p>
        <p className="text-xs text-[rgb(var(--dm-text-muted))]">
          با نصب نسخه وب، دستمزد آرمانی بدون اینترنت و با سرعت بالا اجرا می‌شود.
        </p>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={install}>
            نصب کن
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              window.localStorage.setItem('dastmozd-install-dismissed', 'true');
              setVisible(false);
            }}
          >
            بعداً
          </Button>
        </div>
      </div>
    </div>
  );
}

/** انتخاب دوره (سال و ماه شمسی) که در همه صفحه‌ها مشترک است. */
function PeriodSelector() {
  const { jy, jm, next, previous } = usePeriodNavigator();
  const years = [jy - 1, jy, jy + 1];
  const setPeriod = useAppStore((state) => state.setPeriod);
  const { toast } = useToast();

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))]">
        <button
          type="button"
          onClick={previous}
          aria-label="دوره قبلی"
          className="px-2.5 py-2 text-[rgb(var(--dm-text-muted))] transition-colors hover:bg-[rgb(var(--dm-surface-sunken))]"
        >
          ›
        </button>
        <label className="sr-only" htmlFor="period-month">
          ماه دوره
        </label>
        <select
          id="period-month"
          value={jm}
          onChange={(event) => {
            const month = Number(event.target.value);
            setPeriod(jy, month);
          }}
          className="border-x border-[rgb(var(--dm-border))] bg-transparent px-2 py-2 text-sm font-semibold"
        >
          {JALALI_MONTH_LABELS.map((label, index) => (
            <option key={label} value={index + 1}>
              {label}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor="period-year">
          سال دوره
        </label>
        <select
          id="period-year"
          value={jy}
          onChange={(event) => {
            const year = Number(event.target.value);
            setPeriod(year, jm);
            if (![1403, 1404, 1405].includes(year)) {
              toast({
                tone: 'warning',
                title: 'پروفایل حقوقی سال انتخابی موجود نیست',
                description:
                  'ارقام پروفایل ۱۴۰۵ به کار گرفته می‌شود؛ پیش از تأیید نهایی، مقررات سال را بررسی کنید.',
              });
            }
          }}
          className="bg-transparent px-2 py-2 text-sm font-semibold"
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={next}
          aria-label="دوره بعدی"
          className="px-2.5 py-2 text-[rgb(var(--dm-text-muted))] transition-colors hover:bg-[rgb(var(--dm-surface-sunken))]"
        >
          ‹
        </button>
      </div>
    </div>
  );
}

function ThemeToggle() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  return (
    <Button
      variant="outline"
      size="icon"
      aria-label={isDark ? 'تغییر به تم روشن' : 'تغییر به تم تیره'}
      title={isDark ? 'تم روشن' : 'تم تیره'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}

/** راه‌اندازی اولیه: انتخاب میان شروع خالی و بارگذاری داده نمونه. */
function OnboardingGate({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState<'seed' | 'empty' | null>(null);
  const { toast } = useToast();

  const loadDemo = async (): Promise<void> => {
    setBusy('seed');
    try {
      const result = await seedDemoData({ reset: true });
      toast({
        tone: 'success',
        title: 'داده نمونه بارگذاری شد',
        description: `${result.employees} کارمند در ${result.departments} دپارتمان با کارکرد ماه مهر ۱۴۰۵ آماده است.`,
      });
      const settings = await db.settings.get('app');
      if (settings) await db.settings.put({ ...settings, activeCompanyId: result.companyId });
      onDone();
    } catch (error) {
      toast({
        tone: 'error',
        title: 'بارگذاری داده نمونه ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(null);
    }
  };

  const startEmpty = async (): Promise<void> => {
    setBusy('empty');
    try {
      const company = await ensureActiveCompany();
      const defaults: Array<{ title: string; costCenter: string }> = [
        { title: 'امور مالی و حسابداری', costCenter: 'CC-100' },
        { title: 'منابع انسانی', costCenter: 'CC-500' },
        { title: 'خط تولید', costCenter: 'CC-200' },
      ];
      for (const item of defaults) {
        await saveDepartment({
          id: makeId('dep'),
          companyId: company.id,
          title: item.title,
          costCenter: item.costCenter,
          createdAt: new Date().toISOString(),
        });
      }
      toast({
        tone: 'success',
        title: 'سامانه آماده است',
        description: 'از صفحه کارکنان، نخستین پرونده را ثبت کنید.',
      });
      onDone();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-4 sm:p-8">
      <Card>
        <CardHeader className="items-center text-center">
          <div className="mx-auto mb-2">
            <IllustrationWelcome />
          </div>
          <CardTitle className="text-2xl">به دستمزد آرمانی ۱۴۰۵ خوش آمدید</CardTitle>
          <CardDescription className="max-w-xl text-center leading-relaxed">
            این سامانه کاملاً روی دستگاه شما اجرا می‌شود؛ هیچ اطلاعاتی به اینترنت ارسال نمی‌شود.
            برای آغاز، می‌توانید داده نمونه را بارگذاری کنید یا با پرونده‌های واقعی شرکت شروع کنید.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-4">
            <p className="mb-1 font-bold">بارگذاری داده نمونه</p>
            <p className="mb-3 text-sm text-[var(--dm-text-muted)] text-[rgb(var(--dm-text-muted))]">
              ۵ کارمند نمونه با کد ملی معتبر، ۵ دپارتمان و کارکرد ماه مهر ۱۴۰۵؛ مناسب آشنایی سریع و
              آزمون سامانه.
            </p>
            <Button onClick={loadDemo} disabled={busy !== null} className="w-full">
              {busy === 'seed' ? 'در حال بارگذاری…' : 'بارگذاری داده نمونه'}
            </Button>
          </div>
          <div className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3.5">
            <p className="mb-1 font-bold">شروع با داده واقعی شرکت</p>
            <p className="mb-3 text-sm text-[rgb(var(--dm-text-muted))]">
              شرکت و دپارتمان‌های پیش‌فرض ساخته می‌شود و پرونده کارکنان را خودتان ثبت می‌کنید.
            </p>
            <Button
              variant="outline"
              onClick={startEmpty}
              disabled={busy !== null}
              className="w-full"
            >
              {busy === 'empty' ? 'در حال آماده‌سازی…' : 'شروع خالی'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const displayName = useAppStore((state) => state.displayName);
  const { ready, error } = useBootstrap();
  const counts = useDatabaseCounts();
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const employees = await db.employees.count();
      const departments = await db.departments.count();
      if (!cancelled) setNeedsOnboarding(employees === 0 && departments === 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, counts?.employees]);

  const navItems = NAV_ITEMS.map((item) => ({
    ...item,
    active: item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  }));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="dm-print-hide sticky top-0 z-[1100] border-b border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="lg:hidden"
              aria-label="نمایش منو"
              onClick={toggleSidebar}
            >
              {collapsed ? <Menu className="size-4" /> : <X className="size-4" />}
            </Button>
            <Link href="/" className="flex items-center gap-3">
              {/* نشان برند: سکه + چرخ‌دنده + برگ */}
              <span className="grid size-11 place-items-center rounded-[var(--dm-radius-md)] bg-[rgb(var(--dm-primary))] text-white">
                <svg viewBox="0 0 64 64" className="size-7" aria-hidden focusable="false">
                  {Array.from({ length: 8 }, (_, index) => (
                    <rect
                      key={index}
                      x="30.3"
                      y="7.6"
                      width="3.4"
                      height="7.2"
                      rx="1.7"
                      fill="currentColor"
                      transform={index === 0 ? undefined : `rotate(${index * 45} 32 32)`}
                    />
                  ))}
                  <circle cx="32" cy="32" r="16.6" fill="#ffffff" />
                  <path
                    d="M40.6 23.4c-8.6 1.2-13.8 5.9-14.9 13.3 8-1 13-5.8 14.9-13.3z"
                    fill="#0d9488"
                  />
                  <path
                    d="M24.4 37.8c-.8 1.2-1.4 2.5-1.8 3.9"
                    fill="none"
                    stroke="#0b6f77"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <span className="hidden flex-col sm:flex">
                <strong className="text-base leading-tight">دستمزد آرمانی ۱۴۰۵</strong>
                <span className="text-xs text-[rgb(var(--dm-text-subtle))]">
                  شرکت صنعت بسته‌بندی نقش آرمانی
                </span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">
              <PeriodSelector />
            </div>
            <ThemeToggle />
            <Badge tone="primary" className="hidden lg:inline-flex">
              {displayName}
            </Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-4 px-4 py-4">
        <aside
          className={cn('dm-print-hide hidden w-64 shrink-0 lg:block', collapsed && 'lg:w-16')}
          aria-label="منوی اصلی"
        >
          <nav className="sticky top-20 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                title={item.hint}
                className={cn(
                  'flex items-center gap-3 rounded-[var(--dm-radius-md)] px-3 py-2.5 text-sm font-semibold transition-colors',
                  item.active
                    ? 'bg-[rgb(var(--dm-primary))] text-white shadow-[var(--dm-shadow-xs)]'
                    : 'text-[rgb(var(--dm-text-muted))] hover:bg-[rgb(var(--dm-surface-sunken))] hover:text-[rgb(var(--dm-text))]',
                )}
              >
                {item.icon}
                <span className={cn(collapsed && 'lg:hidden')}>{item.label}</span>
              </Link>
            ))}
            <div
              className={cn(
                'pt-4 text-xs text-[rgb(var(--dm-text-subtle))]',
                collapsed && 'lg:hidden',
              )}
            >
              <p className="flex items-center gap-1.5 pb-1">
                <Lock className="size-3.5" aria-hidden /> داده‌ها فقط روی این دستگاه ذخیره می‌شود
              </p>
              {counts ? (
                <p className="dm-numeric">
                  {counts.employees} کارمند · {counts.slips} فیش حقوقی
                </p>
              ) : null}
            </div>
          </nav>
          <InstallPrompt />
        </aside>

        <main id="main-content" className="min-w-0 flex-1 space-y-5 pb-24 lg:pb-6">
          <div className="md:hidden">
            <PeriodSelector />
          </div>
          {error ? (
            <Card>
              <CardContent className="pt-5">
                <p className="font-bold text-[rgb(var(--dm-danger))]">
                  خطا در آماده‌سازی پایگاه داده
                </p>
                <p className="mt-1 text-sm text-[rgb(var(--dm-text-muted))]">{error}</p>
              </CardContent>
            </Card>
          ) : !ready || needsOnboarding === null ? (
            <div className="space-y-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : needsOnboarding ? (
            <OnboardingGate onDone={() => setNeedsOnboarding(false)} />
          ) : (
            children
          )}
        </main>
      </div>

      {/* ناوبری پایین برای موبایل — مطابق راهنمای طراحی موبایل */}
      <nav
        className="dm-print-hide fixed bottom-0 left-0 right-0 z-[1100] border-t border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))]/97 backdrop-blur lg:hidden"
        aria-label="ناوبری موبایل"
      >
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
          {navItems.slice(0, 5).map((item) => (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-[var(--dm-radius-md)] px-2 py-1.5 text-[0.68rem] font-semibold transition-colors',
                  item.active
                    ? 'text-[rgb(var(--dm-primary))]'
                    : 'text-[rgb(var(--dm-text-subtle))]',
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* پل رویدادهای نسخه دسکتاپ: منوی بومی، پشتیبان پیش از بستن و پرونده بازشده */}
      <DesktopBridge />
    </div>
  );
}
