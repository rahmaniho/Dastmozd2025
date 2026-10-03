#!/usr/bin/env node
/**
 * ساخت سرویس‌ورکر با Workbox (generateSW).
 *
 * پس از `next build` اجرا می‌شود، فایل‌های خروجی در پوشه `out` را فهرست می‌کند و
 * `out/sw.js` را می‌سازد تا کل برنامه — شامل قلم‌ها و چیدمان صفحات — به‌صورت کامل
 * آفلاین کار کند. هیچ منبعی از CDN گرفته نمی‌شود.
 */
import { generateSW } from 'workbox-build';
import { copyFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, '..');
const outDir = join(appRoot, 'out');
const basePath =
  process.env.GITHUB_PAGES === 'true'
    ? `/${process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''}`
    : '';

if (!existsSync(outDir)) {
  console.error('پوشه out پیدا نشد؛ ابتدا «next build» را اجرا کنید.');
  process.exit(1);
}

const swPath = join(outDir, 'sw.js');
if (existsSync(swPath)) rmSync(swPath);

// افزونه سفارشی سرویس‌ورکر (Share Target و پیام‌ها) باید کنار sw.js قرار گیرد.
const customSrc = join(appRoot, 'public', 'sw-custom.js');
if (existsSync(customSrc)) copyFileSync(customSrc, join(outDir, 'sw-custom.js'));

const { count, size, warnings } = await generateSW({
  swDest: swPath,
  globDirectory: outDir,
  globPatterns: ['**/*.{html,js,css,woff2,ttf,png,svg,ico,webmanifest,json}'],
  // فایل‌های بزرگ تصویری و باینری از پیش‌بارگذاری حذف می‌شوند تا نصب سبک بماند.
  globIgnores: [
    'icons/splash-*.png',
    'icons/og-image-*.png',
    'icons/dastmozd-icon-1024.png',
    'icons/dastmozd.icns',
    'icons/dastmozd.ico',
    'sw.js',
    'workbox-*.js',
  ],
  modifyURLPrefix: basePath ? { '': `${basePath}/` } : {},
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  navigateFallback: `${basePath}/index.html`,
  navigateFallbackDenylist: [/\/sw\.js$/, /\/workbox-.*\.js$/],
  cleanupOutdatedCaches: true,
  importScripts: ['sw-custom.js'],
  clientsClaim: true,
  skipWaiting: true,
  runtimeCaching: [
    {
      // فایل‌های ساخته‌شده Next.js دارای هش در نام هستند؛ می‌توان با اطمینان cache-first رفتار کرد.
      urlPattern: ({ url }) => url.pathname.includes('/_next/static/'),
      handler: 'CacheFirst',
      options: {
        cacheName: 'dastmozd-next-static-v1',
        expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // قلم‌های وزیرمتن خودمیزبان.
      urlPattern: ({ url }) => /\/fonts\/.*\.(woff2|ttf)$/.test(url.pathname),
      handler: 'CacheFirst',
      options: {
        cacheName: 'dastmozd-fonts-v1',
        expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
      },
    },
    {
      // تصاویر برند و نشان‌ها.
      urlPattern: ({ request, url }) =>
        request.destination === 'image' || /\/icons\/.*\.png$/.test(url.pathname),
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'dastmozd-images-v1',
        expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 180 },
      },
    },
    {
      // پوسته برنامه: ابتدا شبکه، در نبود آن حافظه پنهان.
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'dastmozd-pages-v1',
        networkTimeoutSeconds: 4,
        expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 },
      },
    },
  ],
});

if (warnings.length > 0) {
  for (const warning of warnings) console.warn('هشدار Workbox:', warning);
}

console.log(
  `سرویس‌ورکر ساخته شد: ${count} فایل (${(size / 1024).toFixed(0)} کیلوبایت) → ${swPath}`,
);
