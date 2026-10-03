'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export interface DialogContentProps extends DialogPrimitive.DialogContentProps {
  title: string;
  description?: string;
  /** عرض پنل؛ برای فرم‌های بزرگ «wide» را انتخاب کنید. */
  size?: 'sm' | 'md' | 'lg' | 'wide';
  footer?: React.ReactNode;
}

/**
 * پنل گفت‌وگو با تمرکز مدیریت‌شده، بستن با Escape و برچسب‌های دسترس‌پذیری.
 */
export function DialogContent({
  title,
  description,
  size = 'md',
  footer,
  className,
  children,
  ...props
}: DialogContentProps) {
  const width = {
    sm: 'max-w-md',
    md: 'max-w-xl',
    lg: 'max-w-3xl',
    wide: 'max-w-5xl',
  }[size];

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--dm-z-overlay,1200)] bg-[rgb(9_30_38/0.55)] backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        dir="rtl"
        className={cn(
          'dm-scroll fixed left-1/2 top-1/2 z-[1300] max-h-[92vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[var(--dm-radius-2xl)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface))] p-6 shadow-[var(--dm-shadow-lg)]',
          width,
          className,
        )}
        {...props}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <DialogPrimitive.Title className="text-lg font-bold text-[rgb(var(--dm-text))]">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-[rgb(var(--dm-text-muted))]">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="بستن"
            className="rounded-[var(--dm-radius-md)] p-1.5 text-[rgb(var(--dm-text-muted))] transition-colors hover:bg-[rgb(var(--dm-surface-sunken))]"
          >
            <X className="size-5" />
          </DialogPrimitive.Close>
        </div>
        <div className="space-y-4">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void | Promise<void>;
}

/** گفت‌وگوی تأیید برای عملیات بازگشت‌ناپذیر. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  tone = 'danger',
  onConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] px-4 text-sm font-semibold text-[rgb(var(--dm-text-muted))] hover:bg-[rgb(var(--dm-surface-sunken))]"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onConfirm();
                  onOpenChange(false);
                } finally {
                  setBusy(false);
                }
              }}
              className={cn(
                'h-10 rounded-[var(--dm-radius-md)] px-4 text-sm font-semibold text-white disabled:opacity-60',
                tone === 'danger' ? 'bg-[rgb(var(--dm-danger))]' : 'bg-[rgb(var(--dm-primary))]',
              )}
            >
              {busy ? 'در حال انجام…' : confirmLabel}
            </button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-[rgb(var(--dm-text-muted))]">{description}</p>
      </DialogContent>
    </Dialog>
  );
}
