import type { AppSettings, AppUser, UserRole } from '@dastmozd/types';
import { DEFAULT_PROFILE_YEAR } from '@dastmozd/legal';
import { db } from '../schema';
import { auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

/** تنظیمات پیش‌فرض برنامه — فارسی، راست‌چین، ریال و بدون ارسال داده به بیرون. */
export function defaultSettings(): AppSettings {
  return {
    id: 'app',
    theme: 'system',
    locale: 'fa-IR',
    currencyUnit: 'IRR',
    persianDigits: true,
    activeCompanyId: null,
    fiscalYear: DEFAULT_PROFILE_YEAR,
    encryptionEnabled: false,
    autoBackupHours: 24,
    backupRetention: { daily: 30, monthly: 12, yearly: 5 },
    analyticsEnabled: false,
    cloudSync: { enabled: false },
    sidebarCollapsed: false,
    updatedAt: new Date().toISOString(),
  };
}

export async function getSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app');
  if (existing) return existing;
  const settings = defaultSettings();
  await db.settings.put(settings);
  return settings;
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const updated: AppSettings = {
    ...current,
    ...patch,
    id: 'app',
    updatedAt: new Date().toISOString(),
  };
  await db.settings.put(updated);
  return updated;
}

/* --------------------------------------------------------------------- کاربران */

/** رمزنگاری گذرواژه کاربر با PBKDF2 — گذرواژه به‌صورت خام هرگز ذخیره نمی‌شود. */
export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  const salt =
    saltHex ??
    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 310_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );
  const hash = Array.from(new Uint8Array(bits))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return { hash, salt };
}

export async function listUsers(): Promise<AppUser[]> {
  return db.users.toArray();
}

export async function createUser(input: {
  fullName: string;
  username: string;
  role: UserRole;
  companyIds: string[];
  password: string;
}): Promise<AppUser> {
  const exists = await db.users.where('username').equals(input.username).first();
  if (exists) throw new Error('این نام کاربری قبلاً ثبت شده است.');
  const { hash, salt } = await hashPassword(input.password);
  const user: AppUser = {
    id: makeId('usr'),
    fullName: input.fullName,
    username: input.username,
    role: input.role,
    companyIds: input.companyIds,
    passwordHash: hash,
    passwordSalt: salt,
    isActive: true,
    ...auditStamp(),
  };
  await db.users.add(user);
  await recordAudit({
    action: 'create',
    entityType: 'user',
    entityId: user.id,
    summary: `کاربر «${input.fullName}» با نقش ${roleLabel(input.role)} ایجاد شد.`,
  });
  return user;
}

export async function verifyUserPassword(
  username: string,
  password: string,
): Promise<AppUser | null> {
  const user = await db.users.where('username').equals(username).first();
  if (!user?.passwordHash || !user.passwordSalt) return null;
  const { hash } = await hashPassword(password, user.passwordSalt);
  if (hash !== user.passwordHash) return null;
  await db.users.update(user.id, { lastLoginAt: new Date().toISOString() });
  await recordAudit({
    action: 'login',
    entityType: 'user',
    entityId: user.id,
    summary: `ورود کاربر «${user.fullName}» به سامانه.`,
    actorId: user.id,
    actorName: user.fullName,
  });
  return user;
}

export async function deleteUser(id: string): Promise<void> {
  const user = await db.users.get(id);
  if (!user) return;
  if (user.role === 'admin') {
    const admins = (await db.users.toArray()).filter(
      (item) => item.role === 'admin' && item.isActive,
    );
    if (admins.length <= 1) throw new Error('حذف آخرین مدیر سامانه مجاز نیست.');
  }
  await db.users.delete(id);
  await recordAudit({
    action: 'delete',
    entityType: 'user',
    entityId: id,
    summary: `کاربر «${user.fullName}» حذف شد.`,
  });
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case 'admin':
      return 'مدیر سامانه';
    case 'accountant':
      return 'حسابدار';
    default:
      return 'بازدیدکننده';
  }
}

/** قابلیت‌های هر نقش برای کنترل دسترسی در رابط کاربری. */
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: [
    'employee.manage',
    'attendance.manage',
    'payroll.run',
    'payroll.lock',
    'payroll.unlock',
    'report.export',
    'settings.manage',
    'user.manage',
    'backup.manage',
    'audit.view',
  ],
  accountant: [
    'employee.manage',
    'attendance.manage',
    'payroll.run',
    'report.export',
    'backup.manage',
    'audit.view',
  ],
  viewer: ['report.export'],
};

export function can(role: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
