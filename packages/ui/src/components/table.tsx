import * as React from 'react';
import { cn } from '../lib/cn';

/** جدول داده با پشتیبانی راست‌چین، پیمایش افقی و سطرهای راه‌راه. */
export const Table = React.forwardRef<
  HTMLTableElement,
  React.TableHTMLAttributes<HTMLTableElement>
>(function Table({ className, ...props }, ref) {
  return (
    <div className="dm-scroll w-full overflow-x-auto">
      <table
        ref={ref}
        className={cn('w-full min-w-[640px] border-collapse text-sm', className)}
        {...props}
      />
    </div>
  );
});

export function TableHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-[rgb(var(--dm-surface-sunken))]', className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-[rgb(var(--dm-border))]', className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'transition-colors hover:bg-[rgb(var(--dm-surface-sunken))]',
        'even:bg-[rgb(var(--dm-surface))]/60',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'whitespace-nowrap px-4 py-3 text-right text-xs font-bold text-[rgb(var(--dm-text-muted))]',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('px-4 py-3 align-middle text-[rgb(var(--dm-text))]', className)} {...props} />
  );
}

export function TableCaption({
  className,
  ...props
}: React.HTMLAttributes<HTMLTableCaptionElement>) {
  return (
    <caption
      className={cn('mt-3 text-xs text-[rgb(var(--dm-text-subtle))]', className)}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------- Tabs */

export interface TabsProps {
  tabs: Array<{ value: string; label: string; badge?: string | number; disabled?: boolean }>;
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  ariaLabel?: string;
}

/** نوار زبانه‌ها با پیمایش کلیدهای جهت‌دار (RTL: چپ/راست). */
export function Tabs({ tabs, value, onValueChange, className, ariaLabel = 'زبانه‌ها' }: TabsProps) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const index = tabs.findIndex((tab) => tab.value === value);
    if (index < 0) return;
    let next = index;
    if (event.key === 'ArrowLeft') next = Math.min(tabs.length - 1, index + 1);
    else if (event.key === 'ArrowRight') next = Math.max(0, index - 1);
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    const target = tabs[next];
    if (target && !target.disabled) {
      onValueChange(target.value);
      const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
      buttons?.[next]?.focus();
    }
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        'dm-scroll flex gap-1 overflow-x-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={tab.disabled}
            onClick={() => onValueChange(tab.value)}
            className={cn(
              'flex items-center gap-2 whitespace-nowrap rounded-[var(--dm-radius-md)] px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50',
              selected
                ? 'bg-[rgb(var(--dm-primary))] text-white shadow-[var(--dm-shadow-xs)]'
                : 'text-[rgb(var(--dm-text-muted))] hover:bg-[rgb(var(--dm-surface-sunken))]',
            )}
          >
            {tab.label}
            {tab.badge !== undefined ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-xs',
                  selected ? 'bg-white/20' : 'bg-[rgb(var(--dm-surface-sunken))]',
                )}
              >
                {tab.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
