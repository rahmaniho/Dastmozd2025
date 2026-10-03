'use client';

import { toPersianDigits } from '@dastmozd/core';
import { createBackup, enforceRetention, listBackups, restoreBackup, type BackupRecord } from '@dastmozd/db';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@dastmozd/ui';
import { FolderOpen, HardDriveDownload, Printer, RefreshCw, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
  checkForUpdate,
  installUpdate,
  isAutostartEnabled,
  isDesktop,
  nativeAppPaths,
  nativeDeleteBackup,
  nativeListBackups,
  nativeOpenPath,
  nativePendingOpenFile,
  nativePickFile,
  nativePruneBackups,
  nativeReadBackup,
  nativeReadTextFile,
  nativeRevealInDir,
  nativeSaveBackup,
  printCurrentPage,
  setAutostart,
  type NativeAppPaths,
  type NativeBackupEntry,
  type UpdateInfo,
} from '@/lib/native';
const APP_VERSION = '1.0.0';

/**
 * بخش «نسخه دسکتاپ» در تنظیمات: پشتیبان بومی روی `%APPDATA%\Dastmozd\backups`،
 * اجرای خودکار در ویندوز، چاپ بومی و به‌روزرسانی امضاشده.
 */
export function DesktopPanel({ companyId, companyName }: { companyId: string; companyName: string }) {
  const desktop = isDesktop();
  const { toast } = useToast();
  const [paths, setPaths] = useState<NativeAppPaths | null>(null);
  const [files, setFiles] = useState<NativeBackupEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [autostart, setAutostartState] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  const localBackups = useLiveQuery(() => listBackups(), [], [] as BackupRecord[]);

  const refreshNative = useCallback(async () => {
    if (!desktop) return;
    try {
      const [appPaths, entries, autoStart] = await Promise.all([
        nativeAppPaths(),
        nativeListBackups(),
        isAutostartEnabled().catch(() => false),
      ]);
      setPaths(appPaths);
      setFiles(entries);
      setAutostartState(autoStart);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ارتباط با پوسته دسکتاپ ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    }
  }, [desktop, toast]);

  useEffect(() => {
    void refreshNative();
  }, [refreshNative]);

  const run = async (key: string, action: () => Promise<void>): Promise<void> => {
    setBusy(key);
    try {
      await action();
    } catch (error) {
      toast({
        tone: 'error',
        title: 'عملیات ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(null);
    }
  };

  if (!desktop) {
    return (
      <div className="space-y-4">
        <Alert tone="info" title="این بخش در نسخه دسکتاپ فعال است">
          در نسخه وب، پشتیبان‌گیری در مرورگر ذخیره می‌شود. برای پشتیبان بومی روی
          <span className="dm-ltr-inline mx-1 font-medium">%APPDATA%\Dastmozd\backups</span>
          و اجرای خودکار همراه ویندوز، برنامه ویندوزی «دستمزد آرمانی» را از بخش «تنظیمات ← درباره» یا صفحه
          انتشار همین سامانه نصب کنید.
        </Alert>
        <Card>
          <CardHeader>
            <CardTitle>تفاوت نسخه وب و دسکتاپ</CardTitle>
            <CardDescription>
              هر دو نسخه از یک پایگاه‌داده و یک موتور محاسبه استفاده می‌کنند؛ نسخه دسکتاپ افزون بر آن، فایل‌های فیزیکی
              پشتیبان، انجمن پرونده <span className="dm-ltr-inline">.dastmozd</span>، چاپ بومی و به‌روزرسانی خودکار دارد.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-[rgb(var(--dm-primary))]" aria-hidden />
            پشتیبان بومی روی رایانه
          </CardTitle>
          <CardDescription>
            نسخه‌ها در پوشه‌ای مستقل ذخیره می‌شوند و سیاست نگهداری ۳۰ نسخه روزانه، ۱۲ ماهانه و ۵ سالانه به‌طور خودکار
            اجرا می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-[var(--dm-radius-md)] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs">
            <p className="font-medium text-[rgb(var(--dm-text-muted))]">پوشه پشتیبان</p>
            <p className="dm-ltr-inline mt-1 break-all text-[rgb(var(--dm-text))]">
              {paths?.backupDir ?? 'در حال خواندن…'}
            </p>
            <p className="mt-2 font-medium text-[rgb(var(--dm-text-muted))]">نسخه برنامه</p>
            <p className="dm-ltr-inline mt-1 text-[rgb(var(--dm-text))]">{paths?.version ?? APP_VERSION}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() =>
                run('backup', async () => {
                  const { content, fileName } = await createBackup({
                    companyId,
                    companyName,
                    appVersion: APP_VERSION,
                    keepLocalCopy: false,
                    kind: 'manual',
                  });
                  const saved = await nativeSaveBackup(fileName, content);
                  toast({
                    tone: 'success',
                    title: 'پشتیبان بومی ساخته شد',
                    description: `${saved.name} — ${toPersianDigits(Math.round(saved.sizeBytes / 1024))} کیلوبایت`,
                  });
                  await refreshNative();
                })
              }
              disabled={busy !== null}
            >
              <HardDriveDownload className="size-4" />
              {busy === 'backup' ? 'در حال ساخت…' : 'ساخت پشتیبان بومی'}
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                run('prune', async () => {
                  const report = await nativePruneBackups();
                  toast({
                    tone: 'success',
                    title: 'سیاست نگهداری اجرا شد',
                    description: `${toPersianDigits(report.removed)} نسخه حذف و ${toPersianDigits(report.kept)} نسخه نگه داشته شد.`,
                  });
                  await refreshNative();
                })
              }
              disabled={busy !== null || !paths}
            >
              <Trash2 className="size-4" />
              پاک‌سازی نسخه‌های قدیمی
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                run('open', async () => {
                  if (paths) await nativeOpenPath(paths.backupDir);
                })
              }
              disabled={!paths}
            >
              <FolderOpen className="size-4" />
              بازکردن پوشه
            </Button>
            <Button
              variant="ghost"
              onClick={() =>
                run('restore', async () => {
                  const picked = await nativePickFile(['dastmozd']);
                  if (!picked) return;
                  const content = await nativeReadTextFile(picked);
                  const result = await restoreBackup({ content, mode: 'replace' });
                  toast({
                    tone: result.integrity.valid ? 'success' : 'warning',
                    title: result.integrity.valid ? 'بازگردانی انجام شد' : 'بازگردانی با هشدار صحت',
                    description: result.integrity.message,
                  });
                })
              }
              disabled={busy !== null}
            >
              <Upload className="size-4" />
              بازگردانی از پرونده
            </Button>
            <Button variant="ghost" onClick={printCurrentPage}>
              <Printer className="size-4" />
              چاپ بومی
            </Button>
          </div>

          {files.length === 0 ? (
            <EmptyState
              title="نسخه بومی ثبت نشده است"
              description="با دکمه «ساخت پشتیبان بومی» نخستین نسخه را در پوشه برنامه ذخیره کنید."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پرونده</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>حجم</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead className="text-left">عملیات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.name}>
                    <TableCell className="dm-ltr-inline max-w-[280px] truncate text-xs">{file.name}</TableCell>
                    <TableCell>
                      <Badge tone={file.kind === 'manual' ? 'info' : 'neutral'}>{kindLabel(file.kind)}</Badge>
                    </TableCell>
                    <TableCell className="dm-numeric">{toPersianDigits(Math.round(file.sizeBytes / 1024))} کیلوبایت</TableCell>
                    <TableCell className="dm-numeric text-xs">{formatStamp(file.modifiedAt)}</TableCell>
                    <TableCell className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(`restore-${file.name}`, async () => {
                            const content = await nativeReadBackup(file.name);
                            const result = await restoreBackup({ content, mode: 'replace' });
                            const restoredCount = Object.values(result.restored).reduce(
                              (total, value) => total + value,
                              0,
                            );
                            toast({
                              tone: result.integrity.valid ? 'success' : 'warning',
                              title: 'بازگردانی انجام شد',
                              description: `${result.integrity.message} ${toPersianDigits(restoredCount)} رکورد بازیابی شد.`,
                            });
                          })
                        }
                      >
                        بازگردانی
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => nativeRevealInDir(file.path)}>
                        نمایش
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          run(`delete-${file.name}`, async () => {
                            await nativeDeleteBackup(file.name);
                            await refreshNative();
                          })
                        }
                      >
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>رفتار برنامه در ویندوز</CardTitle>
            <CardDescription>اجرای خودکار همراه ویندوز و ارسال به سینی سیستم هنگام بستن پنجره.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Switch
              label="اجرای خودکار در هنگام روشن‌شدن ویندوز"
              description="برنامه در سینی سیستم اجرا می‌شود و پنجره اصلی بسته می‌ماند."
              checked={autostart}
              onCheckedChange={(checked) =>
                run('autostart', async () => {
                  await setAutostart(checked);
                  setAutostartState(checked);
                  toast({ tone: 'success', title: checked ? 'اجرای خودکار فعال شد' : 'اجرای خودکار غیرفعال شد' });
                })
              }
            />
            <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
              بستن پنجره، برنامه را می‌بندد اما پیش از آن یک پشتیبان خودکار ساخته می‌شود؛ برای خروج کامل از منوی
              «پرونده ← خروج» استفاده کنید.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="size-5 text-[rgb(var(--dm-info))]" aria-hidden />
              به‌روزرسانی امضاشده
            </CardTitle>
            <CardDescription>
              نسخه‌های جدید از صفحه انتشار GitHub با امضای دیجیتال دریافت و نصب می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  run('update', async () => {
                    const info = await checkForUpdate();
                    setUpdate(info);
                    toast(
                      info
                        ? { tone: 'info', title: `نسخه ${toPersianDigits(info.version)} آماده است` }
                        : { tone: 'success', title: 'برنامه به‌روز است' },
                    );
                  })
                }
                disabled={busy !== null}
              >
                بررسی به‌روزرسانی
              </Button>
              {update ? (
                <Button
                  onClick={() =>
                    run('install', async () => {
                      await installUpdate();
                    })
                  }
                  disabled={busy !== null}
                >
                  دریافت و نصب نسخه {toPersianDigits(update.version)}
                </Button>
              ) : null}
            </div>
            {update?.body ? (
              <div className="rounded-[var(--dm-radius-md)] bg-[rgb(var(--dm-surface-sunken))] p-3 text-xs whitespace-pre-line">
                {update.body}
              </div>
            ) : null}
            <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
              تا زمانی که نسخه جدید نصب نشده است، پایگاه‌داده شما دست‌نخورده می‌ماند؛ پیش از نصب، پشتیبان بومی بگیرید.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>پشتیبان‌های مرورگر</CardTitle>
          <CardDescription>
            نسخه‌های ذخیره‌شده در پایگاه‌داده داخلی: {toPersianDigits((localBackups ?? []).length)} نسخه.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() =>
              run('retention', async () => {
                await enforceRetention();
                toast({
                  tone: 'success',
                  title: 'سیاست نگهداری اجرا شد',
                  description: '۳۰ نسخه روزانه، ۱۲ ماهانه و ۵ سالانه نگه داشته شد.',
                });
              })
            }
          >
            اجرای سیاست نگهداری مرورگر
          </Button>
          <span className="text-xs text-[rgb(var(--dm-text-subtle))]">
            فایل بازشده با دوبار کلیک{' '}
            <span className="dm-ltr-inline">.dastmozd</span> نیز در همین بخش قابل بازگردانی است.
          </span>
        </CardContent>
      </Card>
    </div>
  );
}

/** برچسب فارسی نوع نسخه پشتیبان. */
function kindLabel(kind: string): string {
  switch (kind) {
    case 'manual':
      return 'دستی';
    case 'on-close':
      return 'هنگام بستن';
    case 'daily':
      return 'روزانه';
    default:
      return 'خودکار';
  }
}

/** قالب‌بندی تاریخ و ساعت نسخه پشتیبان. */
function formatStamp(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return toPersianDigits(
    `${date.toLocaleDateString('fa-IR')} ${date.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}`,
  );
}

/** مسیر پرونده‌ای که برنامه با آن باز شده است (برای بازگردانی خودکار). */
export async function takePendingOpenFile(): Promise<string | null> {
  if (!isDesktop()) return null;
  try {
    return await nativePendingOpenFile();
  } catch {
    return null;
  }
}

export { nativeReadBackup };
