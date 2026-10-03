'use client';

import { useEffect } from 'react';

/**
 * ثبت سرویس‌ورکر برنامه.
 * پس از نخستین بازدید، پوسته برنامه و قلم‌ها در حافظه پنهان ذخیره می‌شوند تا
 * سامانه بدون اینترنت و به‌صورت کامل آفلاین کار کند.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
    const register = async (): Promise<void> => {
      try {
        await navigator.serviceWorker.register(`${basePath}/sw.js`, { scope: `${basePath}/` });
      } catch (error) {
        // ثبت سرویس‌ورکر نباید تجربه کاربر را مختل کند.
        console.warn('ثبت سرویس‌ورکر ناموفق بود:', error);
      }
    };
    void register();
  }, []);

  return null;
}
