import * as React from 'react';
import { cn } from '../lib/cn';
import { formatPersianNumber, rialInWords, toPersianDigits } from '@dastmozd/core';

/* ------------------------------------------------------------------ Money */

export interface MoneyProps {
  value: number;
  /** نمایش واحد پول در انتهای عدد. */
  showUnit?: boolean;
  /** نمایش معادل حروفی مبلغ (برای فیش و اسناد چاپی). */
  withWords?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  tone?: 'default' | 'muted' | 'positive' | 'negative' | 'accent';
  className?: string;
}

const SIZES = { sm: 'text-sm', md: 'text-base', lg: 'text-lg', xl: 'text-2xl' } as const;
const TONES = {
  default: 'text-[rgb(var(--dm-text))]',
  muted: 'text-[rgb(var(--dm-text-muted))]',
  positive: 'text-[rgb(var(--dm-success))]',
  negative: 'text-[rgb(var(--dm-danger))]',
  accent: 'text-[rgb(var(--dm-accent))]',
} as const;

/**
 * نمایش مبلغ ریالی با ارقام فارسی و جداکننده هزارگان.
 * برای خوانایی صفحه‌خوان، متن کامل مبلغ در aria-label قرار می‌گیرد.
 */
export function Money({
  value,
  showUnit = true,
  withWords = false,
  size = 'md',
  tone,
  className,
}: MoneyProps) {
  const resolvedTone = tone ?? (value < 0 ? 'negative' : 'default');
  return (
    <span className={cn('inline-flex flex-col', className)}>
      <span
        aria-label={`${formatPersianNumber(Math.abs(value))} ریال`}
        className={cn('dm-numeric font-semibold', SIZES[size], TONES[resolvedTone])}
        dir="rtl"
      >
        {value < 0 ? '−' : ''}
        {formatPersianNumber(Math.abs(value))}
        {showUnit ? <span className="mr-1 text-xs font-normal opacity-70">ریال</span> : null}
      </span>
      {withWords ? (
        <span className="mt-0.5 text-[0.7rem] text-[rgb(var(--dm-text-subtle))]">
          {rialInWords(value)}
        </span>
      ) : null}
    </span>
  );
}

/** مبلغ کوتاه‌شده برای کارت‌های KPI: «۲۱۸٫۳ میلیون ریال». */
export function MoneyShort({ value, className }: { value: number; className?: string }) {
  const units: Array<{ limit: number; label: string }> = [
    { limit: 1_000_000_000_000, label: 'هزار میلیارد' },
    { limit: 1_000_000_000, label: 'میلیارد' },
    { limit: 1_000_000, label: 'میلیون' },
    { limit: 1_000, label: 'هزار' },
  ];
  const unit = units.find((item) => Math.abs(value) >= item.limit);
  if (!unit) return <Money value={value} className={className} />;
  const scaled = value / unit.limit;
  const text = formatPersianNumber(Math.round(scaled * 10) / 10);
  return (
    <span className={cn('dm-numeric font-bold', className)} dir="rtl">
      {text}
      <span className="mr-1 text-xs font-normal opacity-70">{unit.label} ریال</span>
    </span>
  );
}

/* ------------------------------------------------------------------- Date */

/** تاریخ شمسی با ارقام فارسی، مثلاً «۱۴۰۵/۰۷/۰۳». */
export function JalaliDateText({
  jy,
  jm,
  jd,
  className,
}: {
  jy: number;
  jm: number;
  jd: number;
  className?: string;
}) {
  return (
    <span className={cn('dm-numeric', className)} dir="rtl">
      {toPersianDigits(`${jy}/${String(jm).padStart(2, '0')}/${String(jd).padStart(2, '0')}`)}
    </span>
  );
}

/* -------------------------------------------------------------- Stat card */

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  /** درصد تغییر نسبت به دوره پیش. */
  delta?: number;
  icon?: React.ReactNode;
  tone?: 'primary' | 'accent' | 'success' | 'info' | 'warning';
  className?: string;
}

/** کارت شاخص کلیدی داشبورد. */
export function StatCard({
  label,
  value,
  hint,
  delta,
  icon,
  tone = 'primary',
  className,
}: StatCardProps) {
  const toneClass = {
    primary: 'text-[rgb(var(--dm-primary))] bg-[rgb(var(--dm-primary-subtle))]',
    accent: 'text-[rgb(var(--dm-accent))] bg-[rgb(var(--dm-accent-soft))]',
    success: 'text-[rgb(var(--dm-success))] bg-[rgb(var(--dm-success-soft))]',
    info: 'text-[rgb(var(--dm-info))] bg-[rgb(var(--dm-info-soft))]',
    warning: 'text-[rgb(var(--dm-warning))] bg-[rgb(var(--dm-warning-soft))]',
  }[tone];

  return (
    <div
      className={cn(
        'rounded-[var(--dm-radius-xl)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-5 shadow-[var(--dm-shadow-sm)]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-[rgb(var(--dm-text-muted))]">{label}</p>
        {icon ? (
          <span
            className={cn(
              'grid size-9 place-items-center rounded-[var(--dm-radius-md)]',
              toneClass,
            )}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
      </div>
      <div className="mt-3 text-2xl font-black tracking-tight text-[rgb(var(--dm-text))]">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta !== undefined ? (
          <span
            className={cn(
              'dm-numeric rounded-full px-2 py-0.5 font-bold',
              delta >= 0
                ? 'bg-[rgb(var(--dm-success-soft))] text-[rgb(var(--dm-success))]'
                : 'bg-[rgb(var(--dm-danger-soft))] text-[rgb(var(--dm-danger))]',
            )}
          >
            {delta >= 0 ? '▲' : '▼'} {toPersianDigits(Math.abs(delta).toFixed(1))}٪
          </span>
        ) : null}
        {hint ? <span className="text-[rgb(var(--dm-text-subtle))]">{hint}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Page header */

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  breadcrumb?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="space-y-1">
        {breadcrumb ? (
          <p className="text-xs font-medium text-[rgb(var(--dm-text-subtle))]">{breadcrumb}</p>
        ) : null}
        <h1 className="text-2xl font-black tracking-tight text-[rgb(var(--dm-text))]">{title}</h1>
        {description ? (
          <p className="text-sm text-[rgb(var(--dm-text-muted))]">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
