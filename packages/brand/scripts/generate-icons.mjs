#!/usr/bin/env node
/**
 * تولید همه فایل‌های تصویری برند از روی فایل‌های SVG.
 *
 *   node packages/brand/scripts/generate-icons.mjs
 *
 * خروجی‌ها:
 *   logo/png/            آیکون‌های ۱۶ تا ۱۰۲۴ پیکسل (سالم، شفاف)
 *   logo/ico/            آیکون ویندوز (چند اندازه در یک فایل ICO)
 *   logo/icns/           آیکون مک (ICNS)
 *   logo/favicon/        favicon.ico و favicon SVG و آیکون لمسی اپل
 *   logo/android/        لایه‌های پیش‌زمینه/پس‌زمینه آیکون تطبیقی اندروید
 *   logo/splash/         صفحه راه‌انداز PWA در دو تم روشن و تیره
 *   logo/social/         تصویر پیش‌نمایش شبکه‌های اجتماعی (OpenGraph 1200×630)
 *
 * هیچ وابستگی اجرایی در برنامه ایجاد نمی‌کند؛ فقط ابزار ساخت است.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import png2icons from 'png2icons';

const here = dirname(fileURLToPath(import.meta.url));
const brandRoot = resolve(here, '..');
const logoDir = join(brandRoot, 'logo');
const fontsDir = join(brandRoot, 'fonts');

const ICON_SIZES = [16, 32, 48, 64, 128, 192, 256, 384, 512, 1024];

function render(svg, width, { background } = {}) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    font: { fontDirs: [fontsDir], loadSystemFonts: false, defaultFontFamily: 'Vazirmatn' },
    background,
  });
  return resvg.render().asPng();
}

async function svgFile(name) {
  return readFile(join(logoDir, name), 'utf8');
}

async function ensureDirs() {
  const dirs = ['png', 'ico', 'icns', 'favicon', 'android', 'splash', 'social'];
  for (const dir of dirs) {
    await mkdir(join(logoDir, dir), { recursive: true });
  }
}

async function main() {
  await ensureDirs();
  const icon = await svgFile('dastmozd-icon.svg');
  const iconMono = await svgFile('dastmozd-icon-mono.svg');
  const iconMaskable = await svgFile('dastmozd-icon-maskable.svg');
  const iconForeground = await svgFile('dastmozd-icon-foreground.svg');
  const fullLogo = await svgFile('dastmozd-logo.svg');
  const splashLight = await svgFile('splash-light.svg');
  const splashDark = await svgFile('splash-dark.svg');
  const og = await svgFile('og-image.svg');

  // ۱) آیکون‌های PNG در همه اندازه‌ها
  for (const size of ICON_SIZES) {
    await writeFile(join(logoDir, 'png', `dastmozd-icon-${size}.png`), render(icon, size));
  }
  await writeFile(join(logoDir, 'png', 'dastmozd-icon-mono-512.png'), render(iconMono, 512));
  await writeFile(
    join(logoDir, 'png', 'dastmozd-icon-maskable-512.png'),
    render(iconMaskable, 512),
  );
  await writeFile(join(logoDir, 'png', 'android-foreground-432.png'), render(iconForeground, 432));
  await writeFile(
    join(logoDir, 'png', 'android-background-432.png'),
    render(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0d9488"/></svg>',
      432,
    ),
  );

  // ۲) آیکون ویندوز (ICO) و مک (ICNS)
  const base256 = render(icon, 256);
  const base512 = render(icon, 512);
  const ico = png2icons.createICO(base256, png2icons.BICUBIC, 0, false);
  if (ico) await writeFile(join(logoDir, 'ico', 'dastmozd.ico'), ico);
  const icns = png2icons.createICNS(base512, png2icons.BICUBIC, 0);
  if (icns) await writeFile(join(logoDir, 'icns', 'dastmozd.icns'), icns);

  // ۳) بسته فاوآیکون + آیکون لمسی اپل
  const favicon32 = render(icon, 32);
  const faviconIco = png2icons.createICO(favicon32, png2icons.BICUBIC, 0, false);
  if (faviconIco) await writeFile(join(logoDir, 'favicon', 'favicon.ico'), faviconIco);
  await writeFile(join(logoDir, 'favicon', 'favicon-16.png'), render(icon, 16));
  await writeFile(join(logoDir, 'favicon', 'favicon-32.png'), favicon32);
  await writeFile(join(logoDir, 'favicon', 'favicon-48.png'), render(icon, 48));
  await writeFile(join(logoDir, 'favicon', 'apple-touch-icon-180.png'), render(icon, 180));
  await writeFile(join(logoDir, 'favicon', 'favicon.svg'), icon);

  // ۴) آیکون تطبیقی اندروید (پیش‌زمینه شفاف + پس‌زمینه تک‌رنگ)
  await writeFile(
    join(logoDir, 'android', 'ic_launcher_foreground.png'),
    render(iconForeground, 432),
  );
  await writeFile(
    join(logoDir, 'android', 'ic_launcher_background.png'),
    render(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#0d9488"/></svg>',
      432,
    ),
  );
  await writeFile(join(logoDir, 'android', 'ic_launcher_round.png'), render(icon, 192));
  await writeFile(join(logoDir, 'android', 'play-store-512.png'), render(icon, 512));

  // ۵) صفحه‌های راه‌انداز PWA
  await writeFile(join(logoDir, 'splash', 'splash-1170x2532-light.png'), render(splashLight, 1170));
  await writeFile(join(logoDir, 'splash', 'splash-1170x2532-dark.png'), render(splashDark, 1170));
  await writeFile(join(logoDir, 'splash', 'splash-2048x2048-light.png'), render(splashLight, 2048));
  await writeFile(join(logoDir, 'splash', 'splash-2048x2048-dark.png'), render(splashDark, 2048));

  // ۶) تصویر پیش‌نمایش شبکه‌های اجتماعی
  await writeFile(join(logoDir, 'social', 'og-image-1200x630.png'), render(og, 1200));

  // ۷) نشان کامل با متن (برای مستندات و صفحه درباره ما)
  await writeFile(join(logoDir, 'png', 'dastmozd-logo-1200.png'), render(fullLogo, 1200));

  console.log('✅ همه فایل‌های برند ساخته شد:', logoDir);
}

main().catch((error) => {
  console.error('❌ خطا در ساخت فایل‌های برند:', error);
  process.exit(1);
});
