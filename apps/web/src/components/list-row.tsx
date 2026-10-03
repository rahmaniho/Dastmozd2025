'use client';

import { cn } from '@dastmozd/ui';

export interface ListRowProps {
  title: React.ReactNode;
  meta?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

/** سطر فهرست فشرده؛ در تقویم رویدادها، اقساط وام و خلاصه‌های دوره به کار می‌رود. */
export function ListRow({ title, meta, icon, action, className }: ListRowProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-3 transition-colors hover:bg-[rgb(var(--dm-surface-sunken))]',
        className,
      )}
    >
      {icon ? (
        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[var(--dm-radius-sm)] bg-[rgb(var(--dm-primary-subtle))] text-[rgb(var(--dm-primary))]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate text-sm font-semibold text-[rgb(var(--dm-text))]">{title}</p>
        {meta ? <div className="text-xs text-[rgb(var(--dm-text-muted))]">{meta}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
