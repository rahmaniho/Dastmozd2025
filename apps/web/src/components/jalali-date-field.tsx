'use client';

import { jalaliMonthLength, toPersianDigits } from '@dastmozd/core';
import { cn } from '@dastmozd/ui';
import { useMemo } from 'react';

const MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export interface JalaliDateValue {
  jy: number;
  jm: number;
  jd: number;
}

export interface JalaliDateFieldProps {
  id?: string;
  value: JalaliDateValue;
  onChange: (value: JalaliDateValue) => void;
  /** نخستین سال قابل انتخاب. */
  fromYear?: number;
  /** آخرین سال قابل انتخاب. */
  toYear?: number;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  /** نام بخش‌ها برای صفحه‌خوان، مثلاً «تاریخ استخدام». */
  ariaLabel?: string;
}

/**
 * ورودی تاریخ شمسی بر پایه سه گزینشگر سال/ماه/روز.
 * تعداد روزهای ماه به‌صورت خودکار با طول واقعی ماه شمسی هم‌ساز می‌شود.
 */
export function JalaliDateField({
  id,
  value,
  onChange,
  fromYear = 1320,
  toYear = 1420,
  disabled,
  invalid,
  describedBy,
  className,
  ariaLabel = 'تاریخ شمسی',
}: JalaliDateFieldProps) {
  const years = useMemo(() => {
    const list: number[] = [];
    for (let year = fromYear; year <= toYear; year += 1) list.push(year);
    return list;
  }, [fromYear, toYear]);

  const monthLength = useMemo(() => jalaliMonthLength(value.jy, value.jm), [value.jy, value.jm]);
  const days = useMemo(() => Array.from({ length: monthLength }, (_, index) => index + 1), [monthLength]);

  const selectClass = cn(
    'h-9 rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] px-2 text-sm',
    invalid && 'border-[rgb(var(--dm-danger))]',
  );

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)} role="group" aria-label={ariaLabel}>
      <label className="sr-only" htmlFor={id ? `${id}-day` : undefined}>
        روز
      </label>
      <select
        id={id ? `${id}-day` : undefined}
        className={selectClass}
        value={value.jd}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange({ ...value, jd: Number(event.target.value) })}
      >
        {days.map((day) => (
          <option key={day} value={day}>
            {toPersianDigits(day)}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={id ? `${id}-month` : undefined}>
        ماه
      </label>
      <select
        id={id ? `${id}-month` : undefined}
        className={selectClass}
        value={value.jm}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const jm = Number(event.target.value);
          const maxDay = jalaliMonthLength(value.jy, jm);
          onChange({ ...value, jm, jd: Math.min(value.jd, maxDay) });
        }}
      >
        {MONTHS.map((month, index) => (
          <option key={month} value={index + 1}>
            {month}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={id ? `${id}-year` : undefined}>
        سال
      </label>
      <select
        id={id ? `${id}-year` : undefined}
        className={selectClass}
        value={value.jy}
        disabled={disabled}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => {
          const jy = Number(event.target.value);
          const maxDay = jalaliMonthLength(jy, value.jm);
          onChange({ ...value, jy, jd: Math.min(value.jd, maxDay) });
        }}
      >
        {years.map((year) => (
          <option key={year} value={year}>
            {toPersianDigits(year)}
          </option>
        ))}
      </select>
    </div>
  );
}
