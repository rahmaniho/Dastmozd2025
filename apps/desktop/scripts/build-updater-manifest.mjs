/**
 * ساخت پرونده `latest.json` برای به‌روزرسانی خودکار Tauri.
 *
 * در جریان انتشار روی GitHub، نام و امضای هر بسته در پوشه ورودی جمع می‌شود و این
 * اسکریپت مانیفست نهایی را با نشانی‌های همان انتشار می‌سازد.
 *
 * نمونه اجرا:
 *   node scripts/build-updater-manifest.mjs \
 *     --input ./artifacts --out ./artifacts/latest.json \
 *     --version 1.0.0 --repo rahmaniho/Dastmozd2025 --tag v1.0.0 \
 *     --notes "نسخه نخست پایدار"
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);

/** خواندن مقدار یک کلید از آرگومان‌های خط فرمان. */
function arg(name, fallback = '') {
  const index = args.indexOf(`--${name}`);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

const inputDir = arg('input', './artifacts');
const outFile = arg('out', join(inputDir, 'latest.json'));
const version = arg('version');
const repo = arg('repo');
const tag = arg('tag', `v${version}`);
const notes = arg('notes', `نسخه ${version} دستمزد آرمانی ۱۴۰۵`);

if (!version || !repo) {
  console.error(
    'استفاده: node build-updater-manifest.mjs --version <x.y.z> --repo <owner/name> [--input dir] [--tag vX.Y.Z]',
  );
  process.exit(1);
}

/** پیمایش بازگشتی پوشه و یافتن همه پرونده‌ها. */
function walk(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const files = walk(inputDir);

/** یافتن نخستین پرونده‌ای که الگو را برآورده می‌کند. */
function pick(pattern) {
  return files.find((file) => pattern.test(file));
}

const platforms = {};

const windowsInstaller = pick(/_x64-setup\.exe$/i);
const windowsSignature = pick(/_x64-setup\.exe\.sig$/i);
if (windowsInstaller && windowsSignature) {
  platforms['windows-x86_64'] = {
    signature: readFileSync(windowsSignature, 'utf8').trim(),
    url: `https://github.com/${repo}/releases/download/${tag}/${windowsInstaller.split(/[\\/]/).pop()}`,
  };
}

for (const [arch, suffix] of [
  ['darwin-aarch64', 'aarch64'],
  ['darwin-x86_64', 'x64'],
]) {
  const bundle = pick(new RegExp(`_${suffix}\\.app\\.tar\\.gz$`, 'i'));
  const signature = pick(new RegExp(`_${suffix}\\.app\\.tar\\.gz\\.sig$`, 'i'));
  if (bundle && signature) {
    platforms[arch] = {
      signature: readFileSync(signature, 'utf8').trim(),
      url: `https://github.com/${repo}/releases/download/${tag}/${bundle.split(/[\\/]/).pop()}`,
    };
  }
}

if (Object.keys(platforms).length === 0) {
  console.error('هیچ بسته امضاشده‌ای برای مانیفست به‌روزرسانی یافت نشد.');
  process.exit(2);
}

const manifest = {
  version,
  notes,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`✅ مانیفست به‌روزرسانی ساخته شد: ${outFile}`);
console.log(Object.keys(platforms).join(' | '));
