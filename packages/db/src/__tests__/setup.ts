import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// شبیه‌ساز Web Crypto برای اجرای آزمون‌های رمزنگاری در محیط Node.
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
