'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@dastmozd/ui';
import { useEffect, useState } from 'react';
import { applyTheme, useAppStore, watchSystemTheme } from '@/lib/store';

/**
 * فراهم‌کنندگان سراسری برنامه:
 *  - TanStack Query برای وضعیت سرور (همگام‌سازی اختیاری و عملیات همزمان‌نشدنی)
 *  - اعلان‌ها (Toast)
 *  - همگام‌سازی تم با تنظیم سیستم‌عامل
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    applyTheme(theme);
    return watchSystemTheme(theme, (resolved) => {
      document.documentElement.dataset.theme = resolved;
      document.documentElement.style.colorScheme = resolved;
    });
  }, [theme]);

  useEffect(() => {
    // ثبت رویداد نصب PWA برای نمایش راهنمای نصب در داشبورد.
    const handler = (event: Event): void => {
      event.preventDefault();
      (window as unknown as { __dastmozdInstallPrompt?: Event }).__dastmozdInstallPrompt = event;
      window.dispatchEvent(new CustomEvent('dastmozd:install-available'));
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
