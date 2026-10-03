/**
 * پل ارتباطی با پوسته دسکتاپ (Tauri 2).
 *
 * همه توابع این ماژول در مرورگر بی‌اثر و بی‌خطر هستند: پیش از هر فراخوانی،
 * وجود محیط Tauri بررسی می‌شود. ماژول‌های Tauri به‌صورت پویا بارگذاری می‌شوند تا
 * حجم بسته وب برای کاربران PWA افزایش نیابد.
 */

export interface NativeAppPaths {
  backupDir: string;
  dataDir: string;
  version: string;
  identifier: string;
}

export interface NativeBackupEntry {
  name: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  kind: string;
}

export interface NativeSavedBackup {
  name: string;
  path: string;
  sizeBytes: number;
}

export interface NativePruneReport {
  removed: number;
  kept: number;
}

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date?: string;
  body?: string;
}

/** آیا برنامه در پوسته دسکتاپ Tauri اجرا می‌شود؟ */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isDesktop()) throw new Error('این عملیات فقط در نسخه دسکتاپ در دسترس است.');
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(command, args);
}

/** مسیرهای بومی برنامه (پوشه پشتیبان، نسخه، شناسه). */
export function nativeAppPaths(): Promise<NativeAppPaths> {
  return invoke<NativeAppPaths>('app_paths');
}

/** ذخیره پشتیبان در پوشه بومی `%APPDATA%\Dastmozd\backups`. */
export function nativeSaveBackup(fileName: string, contents: string): Promise<NativeSavedBackup> {
  return invoke<NativeSavedBackup>('save_backup_file', { fileName, contents });
}

export function nativeListBackups(): Promise<NativeBackupEntry[]> {
  return invoke<NativeBackupEntry[]>('list_backup_files');
}

export function nativeReadBackup(fileName: string): Promise<string> {
  return invoke<string>('read_backup_file', { fileName });
}

export function nativeDeleteBackup(fileName: string): Promise<boolean> {
  return invoke<boolean>('delete_backup_file', { fileName });
}

/** اجرای سیاست نگهداری: ۳۰ نسخه روزانه، ۱۲ ماهانه، ۵ سالانه. */
export function nativePruneBackups(): Promise<NativePruneReport> {
  return invoke<NativePruneReport>('prune_backup_files');
}

/** پرونده‌ای که برنامه با آن باز شده است (انجمن پرونده `.dastmozd`). */
export function nativePendingOpenFile(): Promise<string | null> {
  return invoke<string | null>('pending_open_file');
}

/** بازکردن پوشه یا پرونده با برنامه پیش‌فرض سیستم. */
export async function nativeOpenPath(path: string): Promise<void> {
  const { openPath } = await import('@tauri-apps/plugin-opener');
  await openPath(path);
}

/** نمایش پرونده در پنجره پوشه (ویندوز: انتخاب در Explorer). */
export async function nativeRevealInDir(path: string): Promise<void> {
  const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
  await revealItemInDir(path);
}

/** چاپ بومی صفحه جاری (دیالوگ چاپ WebView2/WKWebView). */
export function printCurrentPage(): void {
  if (typeof window !== 'undefined') window.print();
}

/** روشن‌شدن خودکار برنامه همراه با ویندوز. */
export async function setAutostart(enabled: boolean): Promise<void> {
  const autostart = await import('@tauri-apps/plugin-autostart');
  if (enabled) await autostart.enable();
  else await autostart.disable();
}

export async function isAutostartEnabled(): Promise<boolean> {
  const autostart = await import('@tauri-apps/plugin-autostart');
  return autostart.isEnabled();
}

/** بررسی وجود به‌روزرسانی امضاشده در GitHub Releases. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    currentVersion: update.currentVersion,
    ...(update.date ? { date: update.date } : {}),
    ...(update.body ? { body: update.body } : {}),
  };
}

/** دریافت و نصب به‌روزرسانی و راه‌اندازی دوباره برنامه. */
export async function installUpdate(): Promise<void> {
  const { check } = await import('@tauri-apps/plugin-updater');
  const { relaunch } = await import('@tauri-apps/plugin-process');
  const update = await check();
  if (!update) throw new Error('به‌روزرسانی جدیدی یافت نشد.');
  await update.downloadAndInstall();
  await relaunch();
}

/** ذخیره پرونده با دیالوگ بومی سیستم. */
export async function nativeSaveFile(options: {
  defaultPath: string;
  contents: string | Uint8Array;
}): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const { writeTextFile, writeFile } = await import('@tauri-apps/plugin-fs');
  const target = await save({ defaultPath: options.defaultPath });
  if (!target) return null;
  if (typeof options.contents === 'string') await writeTextFile(target, options.contents);
  else await writeFile(target, options.contents);
  return target;
}

/** بازکردن پرونده بومی برای بازگردانی. */
export async function nativePickFile(filters: string[]): Promise<string | null> {
  const { open } = await import('@tauri-apps/plugin-dialog');
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'پرونده‌های دستمزد آرمانی', extensions: filters }],
  });
  return typeof selected === 'string' ? selected : null;
}

/** خواندن متن پرونده انتخابی کاربر. */
export async function nativeReadTextFile(path: string): Promise<string> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  return readTextFile(path);
}

/** گوش‌دادن به فرمان‌های منوی بومی و رویدادهای عمر برنامه. */
export async function onNativeEvent(event: string, handler: (payload: unknown) => void): Promise<() => void> {
  if (!isDesktop()) return () => undefined;
  const { listen } = await import('@tauri-apps/api/event');
  return listen(event, (message) => handler(message.payload));
}
