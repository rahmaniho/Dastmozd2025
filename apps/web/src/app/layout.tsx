import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProviders } from './providers';
import { AppShell } from '@/components/app-shell';
import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export const metadata: Metadata = {
  metadataBase: new URL('https://rahmaniho.github.io/Dastmozd2025/'),
  title: {
    default: 'دستمزد آرمانی ۱۴۰۵ | سامانه جامع حقوق و دستمزد',
    template: '%s | دستمزد آرمانی ۱۴۰۵',
  },
  description:
    'سامانه جامع حقوق و دستمزد ایران: محاسبه شفاف مزد، اضافه‌کار، شب‌کاری، بیمه تأمین اجتماعی و مالیات پلکانی؛ فیش حقوقی، لیست بیمه و گزارش‌های رسمی.',
  applicationName: 'دستمزد آرمانی ۱۴۰۵',
  authors: [{ name: 'شرکت صنعت بسته‌بندی نقش آرمانی' }],
  keywords: [
    'حقوق و دستمزد',
    'قانون کار',
    'بیمه تأمین اجتماعی',
    'مالیات حقوق',
    'فیش حقوقی',
    'لیست بیمه',
    'دستمزد ۱۴۰۵',
  ],
  manifest: `${basePath}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${basePath}/icons/favicon-32.png`, sizes: '32x32', type: 'image/png' },
      { url: `${basePath}/icons/favicon.svg`, type: 'image/svg+xml' },
    ],
    apple: [{ url: `${basePath}/icons/apple-touch-icon-180.png`, sizes: '180x180' }],
  },
  appleWebApp: {
    capable: true,
    title: 'دستمزد آرمانی',
    statusBarStyle: 'default',
  },
  openGraph: {
    type: 'website',
    locale: 'fa_IR',
    title: 'دستمزد آرمانی ۱۴۰۵ — سامانه جامع حقوق و دستمزد',
    description:
      'محاسبه دقیق حقوق، بیمه و مالیات بر پایه قانون کار ایران؛ کاملاً آفلاین، امن و راست‌چین.',
    images: [{ url: `${basePath}/icons/og-image-1200x630.png`, width: 1200, height: 630 }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0d9488' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1418' },
  ],
};

/**
 * چیدمان ریشه: زبان فارسی، جهت راست‌به‌چپ و اعمال تم پیش از رندر برای پرهیز از
 * پرش رنگ (flash) هنگام بارگذاری.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  const themeScript = `
    (function () {
      try {
        var stored = localStorage.getItem('dastmozd-app-state');
        var theme = 'system';
        if (stored) {
          var parsed = JSON.parse(stored);
          theme = (parsed && parsed.state && parsed.state.theme) || 'system';
        }
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
        document.documentElement.setAttribute('data-theme', resolved);
        document.documentElement.style.colorScheme = resolved;
      } catch (error) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  `;

  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <link
          rel="preload"
          href={`${basePath}/fonts/Vazirmatn-Regular.woff2`}
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:right-4 focus:top-4 focus:z-[2000] focus:rounded-[var(--dm-radius-md)] focus:bg-[rgb(var(--dm-primary))] focus:px-4 focus:py-2 focus:text-white"
        >
          پرش به محتوای اصلی
        </a>
        <AppProviders>
          <AppShell>{children}</AppShell>
        </AppProviders>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
