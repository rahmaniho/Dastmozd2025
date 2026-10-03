import 'fake-indexeddb/auto';

/**
 * پیش‌نیازهای آزمون واحد: پیاده‌سازی IndexedDB در حافظه تا لایه Dexie بدون مرورگر
 * قابل آزمون باشد.
 */
if (!globalThis.crypto?.subtle) {
  // در محیط آزمون، Web Crypto از Node فراهم می‌شود؛ این شاخه فقط برای اطمینان است.
  throw new Error('Web Crypto در محیط آزمون در دسترس نیست.');
}
