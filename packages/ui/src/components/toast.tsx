'use client';

import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';
import * as React from 'react';
import { cn } from '../lib/cn';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
  /** متن دکمه بازگردانی (اختیاری) برای عملیات قابل بازگشت. */
  undoLabel?: string;
  onUndo?: () => void | Promise<void>;
  duration?: number;
}

interface ToastContextValue {
  toast: (input: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** دسترسی به اعلان‌ها در سراسر برنامه. */
export function useToast(): ToastContextValue {
  const context = React.useContext(ToastContext);
  if (!context) throw new Error('useToast باید داخل ToastProvider استفاده شود.');
  return context;
}

const TONE_STYLES: Record<ToastTone, { wrapper: string; icon: React.ReactNode }> = {
  success: {
    wrapper:
      'border-[rgb(var(--dm-success))]/30 bg-[rgb(var(--dm-success-soft))] text-[rgb(var(--dm-success))]',
    icon: <CheckCircle2 className="size-5" aria-hidden />,
  },
  error: {
    wrapper:
      'border-[rgb(var(--dm-danger))]/30 bg-[rgb(var(--dm-danger-soft))] text-[rgb(var(--dm-danger))]',
    icon: <XCircle className="size-5" aria-hidden />,
  },
  info: {
    wrapper:
      'border-[rgb(var(--dm-info))]/30 bg-[rgb(var(--dm-info-soft))] text-[rgb(var(--dm-info))]',
    icon: <Info className="size-5" aria-hidden />,
  },
  warning: {
    wrapper:
      'border-[rgb(var(--dm-warning))]/30 bg-[rgb(var(--dm-warning-soft))] text-[rgb(var(--dm-warning))]',
    icon: <AlertTriangle className="size-5" aria-hidden />,
  },
};

/**
 * میزبان اعلان‌ها. پیام‌ها با نقش status اعلام می‌شوند و پس از پایان زمان
 * به‌صورت خودکار بسته می‌شوند؛ امکان بازگردانی عملیات نیز فراهم است.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = React.useCallback(
    (input: Omit<Toast, 'id'>) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const item: Toast = { id, duration: 5000, ...input };
      setToasts((current) => [...current.slice(-4), item]);
      if (item.duration && item.duration > 0) {
        const timer = setTimeout(() => dismiss(id), item.duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const value = React.useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="region"
        aria-label="اعلان‌ها"
        className="pointer-events-none fixed bottom-4 left-4 z-[1500] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((item) => {
          const style = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-[var(--dm-radius-lg)] border p-3.5 shadow-[var(--dm-shadow-md)]',
                style.wrapper,
              )}
            >
              <span className="mt-0.5">{style.icon}</span>
              <div className="flex-1 space-y-0.5">
                <p className="text-sm font-bold">{item.title}</p>
                {item.description ? (
                  <p className="text-xs leading-relaxed opacity-90">{item.description}</p>
                ) : null}
                {item.onUndo ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await item.onUndo?.();
                      dismiss(item.id);
                    }}
                    className="mt-1 text-xs font-bold underline underline-offset-4"
                  >
                    {item.undoLabel ?? 'بازگردانی'}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="بستن اعلان"
                onClick={() => dismiss(item.id)}
                className="rounded p-1 opacity-70 transition-opacity hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
