'use client';

import { toPersianDigits } from '@dastmozd/core';
import { createBackup, getSettings, listCompanies, restoreBackup } from '@dastmozd/db';
import {
  Button,
  ConfirmDialog,
  useToast,
} from '@dastmozd/ui';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  checkForUpdate,
  isDesktop,
  nativeReadTextFile,
  nativeSaveBackup,
  onNativeEvent,
  type UpdateInfo,
} from '@/lib/native';

const APP_VERSION = '1.0.0';

/**
 * پل رویدادهای پوسته دسکتاپ: فرمان‌های منوی بومی، پشتیبان‌گیری پیش از بستن
 * و بازکردن پرونده `.dastmozd` با دوبار کلیک.
 *
 * این مؤلفه در مرورگر هیچ کاری انجام نمی‌دهد.
 */
export function DesktopBridge() {
  const router = useRouter();
  const { toast } = useToast();
  const [pendingFile, setPendingFile] = useState<string | null>(null);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  /** ساخت و ذخیره یک نسخه پشتیبان بومی بدون دخالت کاربر. */
  const autoBackup = useCallback(
    async (kind: 'pre-operation' | 'manual' | 'auto'): Promise<void> => {
      try {
        const settings = await getSettings();
        const companies = await listCompanies(true);
        const company = companies.find((item) => item.id === settings.activeCompanyId) ?? companies[0];
        if (!company) return;
        const { content, fileName } = await createBackup({
          companyId: company.id,
          companyName: company.name,
          appVersion: APP_VERSION,
          keepLocalCopy: true,
          kind,
        });
        await nativeSaveBackup(fileName, content);
      } catch (error) {
        toast({
          tone: 'warning',
          title: 'پشتیبان خودکار انجام نشد',
          description: error instanceof Error ? error.message : 'خطای نامشخص',
        });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (!isDesktop()) return;
    let disposed = false;
    const unsubscribers: Array<() => void> = [];

    void (async () => {
      const offMenu = await onNativeEvent('dastmozd:menu', (payload) => {
        const id = String(payload ?? '');
        switch (id) {
          case 'new-employee':
            router.push('/employees?new=1');
            break;
          case 'new-payroll':
            router.push('/payroll');
            break;
          case 'quick-backup':
            void autoBackup('manual').then(() =>
              toast({ tone: 'success', title: 'پشتیبان‌گیری سریع انجام شد', description: 'نسخه جدید در پوشه بومی ذخیره شد.' }),
            );
            break;
          case 'restore-backup':
            router.push('/settings?tab=desktop');
            break;
          case 'report-payslips':
            router.push('/reports?tab=payslips');
            break;
          case 'report-insurance':
            router.push('/reports?tab=insurance');
            break;
          case 'report-tax':
            router.push('/reports?tab=tax');
            break;
          case 'report-monthly':
            router.push('/reports?tab=summary');
            break;
          case 'user-guide':
            router.push('/help');
            break;
          case 'check-update':
            void checkForUpdate()
              .then((info) => {
                setUpdate(info);
                toast(
                  info
                    ? { tone: 'info', title: `نسخه ${info.version} آماده نصب است`, description: 'از تنظیمات ← نسخه دسکتاپ نصب کنید.' }
                    : { tone: 'success', title: 'برنامه به‌روز است' },
                );
              })
              .catch((error: unknown) =>
                toast({
                  tone: 'warning',
                  title: 'بررسی به‌روزرسانی ناموفق بود',
                  description: error instanceof Error ? error.message : 'خطای نامشخص',
                }),
              );
            break;
          case 'reload':
            window.location.reload();
            break;
          case 'zoom-in':
          case 'zoom-out':
          case 'zoom-reset':
            void (async () => {
              if (id === 'zoom-in') document.documentElement.style.fontSize = '18px';
              else if (id === 'zoom-out') document.documentElement.style.fontSize = '14px';
              else document.documentElement.style.fontSize = '';
            })();
            break;
          default:
            break;
        }
      });
      if (!disposed) unsubscribers.push(offMenu);

      const offClose = await onNativeEvent('dastmozd:before-close', () => {
        void autoBackup('pre-operation');
      });
      if (!disposed) unsubscribers.push(offClose);

      const offOpen = await onNativeEvent('dastmozd:open-file', (payload) => {
        setPendingFile(String(payload ?? ''));
      });
      if (!disposed) unsubscribers.push(offOpen);

      // پرونده‌ای که برنامه با آن اجرا شده است (دوبار کلیک روی .dastmozd).
      const { nativePendingOpenFile } = await import('@/lib/native');
      const startupFile = await nativePendingOpenFile().catch(() => null);
      if (startupFile && !disposed) setPendingFile(startupFile);
    })();

    return () => {
      disposed = true;
      for (const off of unsubscribers) off();
    };
  }, [autoBackup, router, toast]);

  const restorePending = async (): Promise<void> => {
    if (!pendingFile) return;
    try {
      const content = await nativeReadTextFile(pendingFile);
      const result = await restoreBackup({ content, mode: 'replace' });
      const restoredCount = Object.values(result.restored).reduce((total, value) => total + value, 0);
      toast({
        tone: result.integrity.valid ? 'success' : 'warning',
        title: result.integrity.valid ? 'پشتیبان بازگردانی شد' : 'بازگردانی با هشدار صحت',
        description: `${result.integrity.message} ${toPersianDigits(restoredCount)} رکورد بازیابی شد.`,
      });
      router.refresh();
    } catch (error) {
      toast({
        tone: 'error',
        title: 'بازگردانی ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setPendingFile(null);
    }
  };

  if (!isDesktop()) return null;

  return (
    <>
      <ConfirmDialog
        open={pendingFile !== null}
        onOpenChange={(open) => {
          if (!open) setPendingFile(null);
        }}
        title="بازگردانی پرونده پشتیبان"
        description={`پرونده «${pendingFile ?? ''}» باز شده است. با تأیید، داده‌های فعلی جایگزین محتوای این پشتیبان می‌شود.`}
        confirmLabel="بازگردانی کن"
        cancelLabel="انصراف"
        onConfirm={() => void restorePending()}
      />
      {update ? (
        <div className="fixed bottom-4 left-4 z-50">
          <Button size="sm" onClick={() => router.push('/settings?tab=desktop')}>
            نسخه {update.version} آماده نصب است
          </Button>
        </div>
      ) : null}
    </>
  );
}
