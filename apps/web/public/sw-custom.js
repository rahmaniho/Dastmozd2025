/* eslint-disable */
/**
 * افزونه سرویس‌ورکر دستمزد آرمانی.
 *
 * با `importScripts` در سرویس‌ورکر ساخته‌شده Workbox بارگذاری می‌شود و دو وظیفه دارد:
 *  ۱) مدیریت «اشتراک‌گذاری» فایل اکسل از اندروید/دسکتاپ (Share Target).
 *  ۲) نگهداری آخرین فایل اشتراک‌گذاری‌شده برای صفحه ورود داده.
 */
const DASTMOZD_SHARE_CACHE = 'dastmozd-share-v1';
const DASTMOZD_SHARE_URL = '/share-target/payload';

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'POST') return;
  const url = new URL(request.url);
  if (!url.pathname.endsWith('/share-target/') && !url.pathname.endsWith('/share-target')) return;

  event.respondWith(
    (async () => {
      try {
        const formData = await request.formData();
        const file = formData.get('workbook');
        const cache = await caches.open(DASTMOZD_SHARE_CACHE);
        if (file && typeof file === 'object' && 'arrayBuffer' in file) {
          const buffer = await file.arrayBuffer();
          await cache.put(
            new Request(DASTMOZD_SHARE_URL),
            new Response(buffer, {
              headers: {
                'content-type': file.type || 'application/octet-stream',
                'x-file-name': encodeURIComponent(file.name || 'shared.xlsx'),
                'x-received-at': new Date().toISOString(),
              },
            }),
          );
        }
        return Response.redirect('./received/', 303);
      } catch (error) {
        return Response.redirect('./?error=1', 303);
      }
    })(),
  );
});

// پیام از صفحه برنامه: پاک‌کردن فایل اشتراک‌گذاری‌شده پس از ورود موفق داده.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'dastmozd:clear-share') {
    event.waitUntil(caches.delete(DASTMOZD_SHARE_CACHE));
  }
});

// همگام‌سازی پس‌زمینه: در نسخه آفلاین، درخواست‌ها در صف می‌مانند تا اتصال بازگردد.
self.addEventListener('sync', (event) => {
  if (event.tag === 'dastmozd-sync') {
    event.waitUntil(Promise.resolve());
  }
});
