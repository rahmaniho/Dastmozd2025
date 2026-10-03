/**
 * سرور ایستا برای پیش‌نمایش محلی خروجی `apps/web/out`.
 *
 * در آزمون‌های سرتاسری، نسخه ساخته‌شده (شامل سرویس‌ورکر و manifest) با این سرور
 * سرو می‌شود تا رفتار واقعی PWA سنجیده شود.
 *
 * اجرا: node scripts/serve-static.mjs [port]
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.argv[2] ?? process.env.E2E_STATIC_PORT ?? 3101);
const root = join(process.cwd(), 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.icns': 'image/x-icns',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.pdf': 'application/pdf',
};

if (!existsSync(root)) {
  console.error('خروجی ایستا یافت نشد. نخست `pnpm --filter web build` را اجرا کنید.');
  process.exit(1);
}

/** یافتن نخستین مسیر موجود برای یک نشانی. */
function resolvePath(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = [
    join(root, clean),
    join(root, clean, 'index.html'),
    `${join(root, clean)}.html`,
    join(root, '404.html'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

createServer((request, response) => {
  const file = resolvePath(request.url ?? '/');
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('یافت نشد');
    return;
  }
  const headers = {
    'content-type': MIME[extname(file)] ?? 'application/octet-stream',
    'cache-control': file.endsWith('sw.js') ? 'no-store' : 'public, max-age=0, must-revalidate',
    'service-worker-allowed': '/',
  };
  response.writeHead(200, headers);
  createReadStream(file).pipe(response);
}).listen(port, '0.0.0.0', () => {
  console.log(`پیش‌نمایش خروجی ایستا روی http://127.0.0.1:${port} آماده است.`);
});
