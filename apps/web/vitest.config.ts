import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * پیکربندی آزمون‌های واحد بستر وب.
 * محیط jsdom برای آزمون ماژول‌های وابسته به مرورگر و fake-indexeddb برای Dexie.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
