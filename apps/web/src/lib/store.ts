'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserRole } from '@dastmozd/types';

export type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  /** شناسه شرکت فعال (چند شرکتی). */
  companyId: string | null;
  /** سال مالی شمسی جاری که پروفایل حقوقی از آن انتخاب می‌شود. */
  fiscalYear: number;
  /** ماه جاری برای محاسبه حقوق. */
  currentMonth: number;
  theme: ThemeMode;
  currencyUnit: 'IRR' | 'IRT';
  persianDigits: boolean;
  sidebarCollapsed: boolean;
  /** نقش کاربر جاری؛ پیش‌فرض مدیر سامانه (نسخه آفلاین بدون ورود). */
  role: UserRole;
  displayName: string;
  setCompany: (companyId: string) => void;
  setPeriod: (fiscalYear: number, currentMonth: number) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setCurrencyUnit: (unit: 'IRR' | 'IRT') => void;
  setPersianDigits: (enabled: boolean) => void;
  toggleSidebar: () => void;
  setRole: (role: UserRole) => void;
  setDisplayName: (name: string) => void;
}

/** تاریخ شمسی امروز برای مقدارگذاری اولیه دوره جاری. */
function todayJalali(): { jy: number; jm: number } {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    timeZone: 'Asia/Tehran',
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
  return {
    jy: Number((parts.year ?? '1405').replace(/\D/g, '')),
    jm: Number(parts.month ?? '1'),
  };
}

const today = todayJalali();

/**
 * وضعیت سمت کاربر (Zustand).
 * فقط ترجیحات ظاهری و انتخاب‌های جاری در اینجا نگه داشته می‌شود؛ همه داده‌های
 * دامنه در IndexedDB (بسته @dastmozd/db) ذخیره می‌شوند.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      companyId: null,
      fiscalYear: today.jy,
      currentMonth: today.jm,
      theme: 'system',
      currencyUnit: 'IRR',
      persianDigits: true,
      sidebarCollapsed: false,
      role: 'admin',
      displayName: 'حسابدار ارشد',
      setCompany: (companyId) => set({ companyId }),
      setPeriod: (fiscalYear, currentMonth) => set({ fiscalYear, currentMonth }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => {
        const current = get().theme;
        const isDark =
          current === 'dark' ||
          (current === 'system' &&
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-color-scheme: dark)').matches);
        set({ theme: isDark ? 'light' : 'dark' });
      },
      setCurrencyUnit: (currencyUnit) => set({ currencyUnit }),
      setPersianDigits: (persianDigits) => set({ persianDigits }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      setRole: (role) => set({ role }),
      setDisplayName: (displayName) => set({ displayName }),
    }),
    {
      name: 'dastmozd-app-state',
      version: 1,
    },
  ),
);

/** اعمال تم روی سند — با احترام به تنظیم سیستم عامل. */
export function applyTheme(theme: ThemeMode): void {
  if (typeof document === 'undefined') return;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
}

/** اشتراک تغییرات تنظیم سیستم‌عامل در حالت «سیستم». */
export function watchSystemTheme(theme: ThemeMode, onChange: (resolved: 'light' | 'dark') => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (event: MediaQueryListEvent): void => {
    if (theme === 'system') onChange(event.matches ? 'dark' : 'light');
  };
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}
