import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** ادغام کلاس‌های Tailwind با اولویت آخرین مقدار. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
