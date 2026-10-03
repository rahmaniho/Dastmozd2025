import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold leading-5',
  {
    variants: {
      tone: {
        neutral: 'bg-[rgb(var(--dm-surface-sunken))] text-[rgb(var(--dm-text-muted))]',
        primary: 'bg-[rgb(var(--dm-primary-subtle))] text-[rgb(var(--dm-primary-active))]',
        success: 'bg-[rgb(var(--dm-success-soft))] text-[rgb(var(--dm-success))]',
        warning: 'bg-[rgb(var(--dm-warning-soft))] text-[rgb(var(--dm-warning))]',
        danger: 'bg-[rgb(var(--dm-danger-soft))] text-[rgb(var(--dm-danger))]',
        info: 'bg-[rgb(var(--dm-info-soft))] text-[rgb(var(--dm-info))]',
        accent: 'bg-[rgb(var(--dm-accent-soft))] text-[rgb(var(--dm-accent))]',
        outline: 'border border-[rgb(var(--dm-border))] text-[rgb(var(--dm-text-muted))]',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

/* ------------------------------------------------------------------- Alert */

const alertVariants = cva('flex gap-3 rounded-[var(--dm-radius-lg)] border p-4 text-sm', {
  variants: {
    tone: {
      info: 'border-[rgb(var(--dm-info))]/30 bg-[rgb(var(--dm-info-soft))] text-[rgb(var(--dm-info))]',
      success: 'border-[rgb(var(--dm-success))]/30 bg-[rgb(var(--dm-success-soft))] text-[rgb(var(--dm-success))]',
      warning: 'border-[rgb(var(--dm-warning))]/30 bg-[rgb(var(--dm-warning-soft))] text-[rgb(var(--dm-warning))]',
      danger: 'border-[rgb(var(--dm-danger))]/30 bg-[rgb(var(--dm-danger-soft))] text-[rgb(var(--dm-danger))]',
    },
  },
  defaultVariants: { tone: 'info' },
});

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  title?: string;
}

/** پیام وضعیت با نقش alert تا صفحه‌خوان آن را اعلام کند. */
export function Alert({ className, tone, title, children, ...props }: AlertProps) {
  return (
    <div role="alert" className={cn(alertVariants({ tone }), className)} {...props}>
      <div className="flex-1 space-y-1">
        {title ? <p className="font-bold">{title}</p> : null}
        {children ? <div className="leading-relaxed">{children}</div> : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** تصویر تزئینی SVG (از کتابخانه تصاویر حالت خالی). */
  illustration?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, action, illustration, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-[var(--dm-radius-xl)] border border-dashed border-[rgb(var(--dm-border-strong))] bg-[rgb(var(--dm-surface))] p-10 text-center',
        className,
      )}
    >
      {illustration ? <div className="mb-1">{illustration}</div> : null}
      <p className="text-base font-bold text-[rgb(var(--dm-text))]">{title}</p>
      {description ? (
        <p className="max-w-md text-sm text-[rgb(var(--dm-text-muted))]">{description}</p>
      ) : null}
      {action ? <div className="mt-2 flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'animate-pulse rounded-[var(--dm-radius-md)] bg-[rgb(var(--dm-surface-sunken))]',
        className,
      )}
      {...props}
    />
  );
}

/** اسکلت بارگذاری جدول — جایگزین چرخنده برای محتوای اصلی. */
export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="در حال بارگذاری">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <Skeleton key={columnIndex} className="h-9 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------- Progress */

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}

export function Progress({ value, max = 100, label, className }: ProgressProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn('w-full space-y-1.5', className)}>
      {label ? (
        <div className="flex items-center justify-between text-xs text-[rgb(var(--dm-text-muted))]">
          <span>{label}</span>
          <span className="dm-numeric">{Math.round(percent)}%</span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--dm-surface-sunken))]"
      >
        <div
          className="h-full rounded-full bg-[rgb(var(--dm-primary))] transition-[width] duration-[var(--dm-duration-base)]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Separator */

export function Separator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="separator" className={cn('h-px w-full bg-[rgb(var(--dm-border))]', className)} {...props} />;
}
