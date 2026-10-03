/**
 * تولید آیکون‌های بسته دسکتاپ (Tauri) از نشان برد.
 *
 * خروجی‌ها در `apps/desktop/src-tauri/icons` نوشته می‌شوند: اندازه‌های استاندارد
 * ویندوز (۳۲ و ۱۲۸ و ۲۵۶)، لوگوهای فروشگاه ویندوز (Square*) و نگاره‌های
 * ICO/ICNS که از پیش در `packages/brand/logo` ساخته شده‌اند.
 *
 * اجرا: `pnpm --filter @dastmozd/brand tauri:icons`
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const logoDir = join(here, '..', 'logo');
const target = join(here, '..', '..', '..', 'apps', 'desktop', 'src-tauri', 'icons');

mkdirSync(target, { recursive: true });
const iconSvg = readFileSync(join(logoDir, 'dastmozd-icon.svg'), 'utf8');

/** رندر SVG به PNG با عرض مشخص. */
function render(svg, size) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

// ۱) اندازه‌های استاندارد پنجره و نصب‌کننده
writeFileSync(join(target, '32x32.png'), render(iconSvg, 32));
writeFileSync(join(target, '128x128.png'), render(iconSvg, 128));
writeFileSync(join(target, '128x128@2x.png'), render(iconSvg, 256));
writeFileSync(join(target, 'icon.png'), render(iconSvg, 512));

// ۲) نگاره‌های فروشگاه مایکروسافت (بسته MSIX)
for (const size of [30, 44, 71, 89, 107, 142, 150, 284, 310]) {
  writeFileSync(join(target, `Square${size}x${size}Logo.png`), render(iconSvg, size));
}
writeFileSync(join(target, 'StoreLogo.png'), render(iconSvg, 50));

// ۳) نگاره‌های ویندوز و مک از بسته برد
const copies = [
  [join(logoDir, 'ico', 'dastmozd.ico'), join(target, 'icon.ico')],
  [join(logoDir, 'icns', 'dastmozd.icns'), join(target, 'icon.icns')],
];
for (const [source, destination] of copies) {
  if (existsSync(source)) copyFileSync(source, destination);
}

console.log(`✅ آیکون‌های دسکتاپ ساخته شد: ${target}`);
