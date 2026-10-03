#!/usr/bin/env node
/**
 * سازنده فایل‌های برداری هویت بصری «دستمزد آرمانی ۱۴۰۵».
 *
 *   node packages/brand/scripts/build-marks.mjs
 *
 * مفاهیم نشان: سکه (حقوق) + چرخ‌دنده (صنعت) + برگ/پر (رشد و آرمان).
 * همه فایل‌ها از یک هندسه واحد ساخته می‌شوند تا نشان در همه اندازه‌ها و
 * پس‌زمینه‌ها یکسان بماند. فایل‌های خروجی در packages/brand/logo قرار می‌گیرند
 * و سپس با generate-icons.mjs به PNG/ICO/ICNS تبدیل می‌شوند.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const logoDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'logo');

/** دندانه‌های چرخ‌دنده: هشت دندانه گرد با فاصله مساوی. */
function gearTeeth({ color = '#ffffff', radius = 24.4, length = 7.6, width = 3.4, rotation = 0 } = {}) {
  const teeth = [];
  for (let index = 0; index < 8; index += 1) {
    const angle = rotation + index * 45;
    const y = 32 - radius;
    const transform = angle === 0 ? '' : ` transform="rotate(${angle} 32 32)"`;
    teeth.push(
      `  <rect x="${(32 - width / 2).toFixed(1)}" y="${y.toFixed(1)}" width="${width}" height="${length}" rx="${(width / 2).toFixed(1)}" fill="${color}"${transform}/>`,
    );
  }
  return teeth.join('\n');
}

/** بدنه سفید سکه. */
const coinBody = (indent = '  ') =>
  [
    `${indent}<circle cx="32" cy="32" r="16.6" fill="#ffffff"/>`,
    `${indent}<circle cx="32" cy="32" r="19.2" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="1.2"/>`,
  ].join('\n');

/** برگ/پر با رگه روشن و دُم. */
const leaf = (indent = '  ', { leafFill = '#0d9488', ribColor = '#ffffff', stemColor = '#0b6f77' } = {}) =>
  [
    `${indent}<path d="M40.6 23.4c-8.6 1.2-13.8 5.9-14.9 13.3 8-1 13-5.8 14.9-13.3z" fill="${leafFill}"/>`,
    `${indent}<path d="M27.2 35.2c2.2-3.9 5.2-7 9.5-9.5" fill="none" stroke="${ribColor}" stroke-opacity="0.85" stroke-width="1.5" stroke-linecap="round"/>`,
    `${indent}<path d="M24.4 37.8c-.8 1.2-1.4 2.5-1.8 3.9" fill="none" stroke="${stemColor}" stroke-width="1.7" stroke-linecap="round"/>`,
  ].join('\n');

const badgeDefs = (id, from = '#14b3a4', mid = '#0d9488', to = '#0d4f66') => `  <defs>
    <linearGradient id="${id}" x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="0.5" stop-color="${mid}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>`;

const header = (title, label, width, height, viewBox) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${width}" height="${height}" role="img" aria-label="${label}">
  <title>${title}</title>`;

// ------------------------------------------------------------------ 1) آیکون برنامه
const icon = `${header('نشان دستمزد آرمانی ۱۴۰۵', 'نشان دستمزد آرمانی', 64, 64, '0 0 64 64')}
${badgeDefs('dmBadge')}

  <rect width="64" height="64" rx="15" fill="url(#dmBadge)"/>
${gearTeeth()}
${coinBody()}
${leaf()}
</svg>
`;

// ------------------------------------------------------------------ 2) آیکون تک‌رنگ
const monoIcon = `${header('نشان تک‌رنگ دستمزد آرمانی ۱۴۰۵', 'نشان تک‌رنگ دستمزد آرمانی', 64, 64, '0 0 64 64')}
  <!-- نسخه تک‌رنگ برای چاپ، حکاکی، واترمارک و فکس؛ رنگ از متن ارث می‌برد -->
${gearTeeth({ color: 'currentColor' })}
  <circle cx="32" cy="32" r="16.6" fill="none" stroke="currentColor" stroke-width="2.2"/>
${leaf('  ', { leafFill: 'currentColor', ribColor: 'none', stemColor: 'currentColor' })
  .split('\n')
  .filter((line) => !line.includes('stroke-opacity'))
  .join('\n')}
</svg>
`;

// ------------------------------------------------------------------ 3) آیکون تطبیقی اندروید
const maskable = `${header('نشان تطبیقی اندروید — محدوده امن ۶۶٪', 'نشان دستمزد آرمانی — نسخه تطبیقی', 64, 64, '0 0 64 64')}
  <!-- نشان در محدوده امن مرکزی ۶۶٪ قرار می‌گیرد تا در برش‌های اندروید کامل بماند -->
  <g transform="translate(32 32) scale(0.7) translate(-32 -32)">
    <rect x="6" y="6" width="52" height="52" rx="14" fill="#0d9488"/>
${gearTeeth({ indent: '    ' })}
${coinBody('    ')}
${leaf('    ')}
  </g>
</svg>
`;

// ------------------------------------------------------------------ 4) نشان کامل (افقی، راست‌چین)
function fullLogo({ text, sub, dark = false }) {
  const badgeId = dark ? 'dmBadgeD' : 'dmBadgeL';
  const colors = dark
    ? { from: '#2dd4bf', mid: '#0d9488', to: '#0f3f5c', title: '#e8f1f4', sub: '#2dd4bf' }
    : { from: '#14b3a4', mid: '#0d9488', to: '#0f3f5c', title: '#10212b', sub: '#0d766e' };
  return `${header(`نشان کامل دستمزد آرمانی ۱۴۰۵${dark ? ' — تم تیره' : ''}`, text, 420, 76, '0 0 420 76')}
  <!-- نشان کامل: آیکون در سمت راست و مونوگرام در سمت چپ آن (چیدمان راست‌چین) -->
${badgeDefs(badgeId, colors.from, colors.mid, colors.to)}
  <g transform="translate(340 6)">
    <rect width="64" height="64" rx="15" fill="url(#${badgeId})"/>
${gearTeeth({ indent: '    ' })}
${coinBody('    ')}
${leaf('    ')}
  </g>
  <text x="324" y="34" text-anchor="end" font-family="Vazirmatn, IRANSansX, Tahoma, sans-serif" font-size="27" font-weight="700" fill="${colors.title}">دستمزد آرمانی</text>
  <text x="324" y="59" text-anchor="end" font-family="Vazirmatn, IRANSansX, Tahoma, sans-serif" font-size="15" font-weight="500" fill="${colors.sub}">۱۴۰۵ — حقوق و دستمزد حرفه‌ای ایران</text>
</svg>
`;
}

// ------------------------------------------------------------------ 5) مونوگرام حرف «آ»
const monogram = `${header('مونوگرام «آ» — دستمزد آرمانی', 'مونوگرام حرف آ', 64, 64, '0 0 64 64')}
  <defs>
    <linearGradient id="dmMono" x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#14b3a4"/>
      <stop offset="1" stop-color="#0d4f66"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="15" fill="url(#dmMono)"/>
  <!-- الف ایستاده -->
  <path d="M33.6 46.4V22.6" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/>
  <!-- مد «آ» که در ترکیب، شکل بال پر را می‌سازد -->
  <path d="M21.6 19.2c4.6-5.4 15-5.4 19.6 0-4.6 3-15 3-19.6 0z" fill="#ffffff"/>
  <!-- نشانه سکه: نقطه طلایی تعادل -->
  <circle cx="43.4" cy="45.4" r="3.4" fill="#f2b544"/>
</svg>
`;

// ------------------------------------------------------------------ 6) صفحه‌های راه‌انداز
function splash({ dark }) {
  const bg = dark
    ? `<linearGradient id="splashBg" x1="0" y1="0" x2="1170" y2="2532" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0b1418"/>
      <stop offset="0.55" stop-color="#0d1c21"/>
      <stop offset="1" stop-color="#123a3d"/>
    </linearGradient>
    <radialGradient id="splashGlow" cx="0.82" cy="0.12" r="0.6">
      <stop offset="0" stop-color="#2dd4bf" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#2dd4bf" stop-opacity="0"/>
    </radialGradient>`
    : `<linearGradient id="splashBg" x1="0" y1="0" x2="1170" y2="2532" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.55" stop-color="#eef7f6"/>
      <stop offset="1" stop-color="#d9eff0"/>
    </linearGradient>
    <radialGradient id="splashGlow" cx="0.82" cy="0.12" r="0.6">
      <stop offset="0" stop-color="#7dd3c7" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#7dd3c7" stop-opacity="0"/>
    </radialGradient>`;
  const title = dark ? '#e8f1f4' : '#10212b';
  const sub = dark ? '#adc2c9' : '#4c6470';
  const badgeId = dark ? 'splashBadgeD' : 'splashBadgeL';
  return `${header(`صفحه راه‌انداز دستمزد آرمانی${dark ? ' — تم تیره' : ''}`, 'صفحه راه‌انداز دستمزد آرمانی', 1170, 2532, '0 0 1170 2532')}
  <defs>
    ${bg}
    <linearGradient id="${badgeId}" x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${dark ? '#2dd4bf' : '#14b3a4'}"/>
      <stop offset="0.5" stop-color="#0d9488"/>
      <stop offset="1" stop-color="#0d4f66"/>
    </linearGradient>
  </defs>
  <rect width="1170" height="2532" fill="url(#splashBg)"/>
  <rect width="1170" height="2532" fill="url(#splashGlow)"/>
  <g transform="translate(345 1010) scale(7.5)">
    <rect width="64" height="64" rx="15" fill="url(#${badgeId})"/>
${gearTeeth({ indent: '    ' })}
${coinBody('    ')}
${leaf('    ')}
  </g>
  <text x="585" y="1620" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="86" font-weight="700" fill="${title}">دستمزد آرمانی ۱۴۰۵</text>
  <text x="585" y="1712" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="44" font-weight="500" fill="${sub}">حقوق و دستمزد، دقیق و آرمانی</text>
  <text x="585" y="2300" text-anchor="middle" font-family="Vazirmatn, Tahoma, sans-serif" font-size="30" font-weight="400" fill="${sub}">شرکت صنعت بسته‌بندی نقش آرمانی</text>
</svg>
`;
}

// ------------------------------------------------------------------ 7) تصویر شبکه‌های اجتماعی
const ogImage = `${header('تصویر پیش‌نمایش دستمزد آرمانی ۱۴۰۵', 'دستمزد آرمانی ۱۴۰۵', 1200, 630, '0 0 1200 630')}
  <defs>
    <linearGradient id="ogBg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0b3a4a"/>
      <stop offset="0.55" stop-color="#0d6d68"/>
      <stop offset="1" stop-color="#12a89a"/>
    </linearGradient>
    <linearGradient id="ogBadge" x1="4" y1="2" x2="60" y2="62" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0.08"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ogBg)"/>
  <circle cx="1050" cy="80" r="240" fill="#ffffff" fill-opacity="0.06"/>
  <circle cx="150" cy="580" r="190" fill="#e87532" fill-opacity="0.14"/>
  <g transform="translate(950 118) scale(2.5)">
    <rect width="64" height="64" rx="15" fill="url(#ogBadge)" stroke="#ffffff" stroke-opacity="0.35"/>
${gearTeeth({ indent: '    ' })}
${coinBody('    ')}
${leaf('    ')}
  </g>
  <text x="1030" y="430" text-anchor="end" font-family="Vazirmatn, Tahoma, sans-serif" font-size="82" font-weight="700" fill="#ffffff">دستمزد آرمانی ۱۴۰۵</text>
  <text x="1030" y="500" text-anchor="end" font-family="Vazirmatn, Tahoma, sans-serif" font-size="34" font-weight="500" fill="#cdeee9">سامانه جامع حقوق و دستمزد ایران</text>
  <text x="1030" y="556" text-anchor="end" font-family="Vazirmatn, Tahoma, sans-serif" font-size="26" font-weight="400" fill="#9fd8d2">موتور محاسباتی شفاف • گزارش‌های رسمی بیمه و مالیات • وب، ویندوز و موبایل</text>
</svg>
`;

const foreground = `${header('لایه پیش‌زمینه آیکون تطبیقی اندروید', 'پیش‌زمینه آیکون تطبیقی', 108, 108, '0 0 64 64')}
  <!-- لایه پیش‌زمینه آیکون تطبیقی: پس‌زمینه شفاف و نشان سفید در محدوده امن ۶۶٪ -->
  <g transform="translate(32 32) scale(0.66) translate(-32 -32)">
${gearTeeth({ indent: '    ' })}
    <circle cx="32" cy="32" r="16.6" fill="none" stroke="#ffffff" stroke-width="2.2"/>
    <path d="M40.6 23.4c-8.6 1.2-13.8 5.9-14.9 13.3 8-1 13-5.8 14.9-13.3z" fill="#ffffff"/>
    <path d="M24.4 37.8c-.8 1.2-1.4 2.5-1.8 3.9" fill="none" stroke="#ffffff" stroke-width="1.7" stroke-linecap="round"/>
  </g>
</svg>
`;

const files = {
  'dastmozd-icon.svg': icon,
  'dastmozd-icon-foreground.svg': foreground,
  'dastmozd-icon-mono.svg': monoIcon,
  'dastmozd-icon-maskable.svg': maskable,
  'dastmozd-logo.svg': fullLogo({ text: 'دستمزد آرمانی ۱۴۰۵', sub: '', dark: false }),
  'dastmozd-logo-dark.svg': fullLogo({ text: 'دستمزد آرمانی ۱۴۰۵ — تم تیره', sub: '', dark: true }),
  'dastmozd-monogram.svg': monogram,
  'splash-light.svg': splash({ dark: false }),
  'splash-dark.svg': splash({ dark: true }),
  'og-image.svg': ogImage,
};

for (const [name, content] of Object.entries(files)) {
  writeFileSync(join(logoDir, name), content.replace(/\n{3,}/g, '\n\n'), 'utf8');
  console.log('✓', name);
}
console.log('✅ فایل‌های برداری برند بازسازی شد.');
