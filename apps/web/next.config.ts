import path from 'node:path';
import type { NextConfig } from 'next';

/**
 * پیکربندی بستر وب.
 *
 * خروجی به‌صورت «صادرات ایستا» ساخته می‌شود تا علاوه بر میزبانی روی GitHub Pages،
 * همان فایل‌ها داخل پوسته دسکتاپ Tauri و نسخه PWA استفاده شوند. همه محاسبات و
 * داده‌ها روی دستگاه کاربر انجام می‌شود و هیچ درخواست شبکه‌ای برای داده وجود ندارد.
 */
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const repositoryName = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'Dastmozd2025';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  // در GitHub Pages سایت زیر مسیر مخزن سرو می‌شود.
  basePath: isGitHubPages ? `/${repositoryName}` : '',
  assetPrefix: isGitHubPages ? `/${repositoryName}/` : '',
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHubPages ? `/${repositoryName}` : '',
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? '1.0.0',
    NEXT_PUBLIC_GITHUB_PAGES: isGitHubPages ? 'true' : 'false',
  },
  transpilePackages: [
    '@dastmozd/ui',
    '@dastmozd/core',
    '@dastmozd/db',
    '@dastmozd/legal',
    '@dastmozd/brand',
  ],
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(process.cwd(), 'src'),
    };
    return config;
  },
};

export default nextConfig;
