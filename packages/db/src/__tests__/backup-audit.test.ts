import { describe, expect, it } from 'vitest';
import {
  buildBackupFile,
  decryptText,
  encryptText,
  parseBackupFile,
  sha256Hex,
  toBase64,
} from '../crypto';
import { db } from '../schema';
import { recordAudit, verifyAuditChain } from '../audit';
import { collectBackupData, createBackup, restoreBackup } from '../backup';
import { seedDemoData } from '../seed';

describe('رمزنگاری داده و فایل پشتیبان', () => {
  it('رمزنگاری و رمزگشایی متن با AES-GCM انجام می‌شود', async () => {
    const payload = await encryptText('اطلاعات محرمانه حقوق', 'passphrase-1234');
    expect(payload.cipher.length).toBeGreaterThan(16);
    expect(toBase64(payload.salt)).toBeTruthy();
    const plain = await decryptText(payload, 'passphrase-1234');
    expect(plain).toBe('اطلاعات محرمانه حقوق');
  });

  it('گذرواژه اشتباه، محتوا را رمزگشایی نمی‌کند', async () => {
    const payload = await encryptText('محرمانه', 'passphrase-1234');
    await expect(decryptText(payload, 'wrong-passphrase')).rejects.toBeTruthy();
  });

  it('گذرواژه کوتاه پذیرفته نمی‌شود', async () => {
    await expect(encryptText('داده', '123')).rejects.toThrow(/۸ کاراکتر/);
  });

  it('فایل پشتیبان رمزنگاری‌شده با گذرواژه صحیح بازیابی می‌شود', async () => {
    const data = { employees: [{ id: '1' }], attendance: [] };
    const { content, manifest } = await buildBackupFile(data, {
      companyId: 'cmp-1',
      companyName: 'شرکت نمونه',
      appVersion: '1.0.0',
      passphrase: 'secret-passphrase',
    });
    expect(manifest.encrypted).toBe(true);
    expect(manifest.kdf.iterations).toBeGreaterThanOrEqual(310_000);
    expect(manifest.counts.employees).toBe(1);

    const parsed = await parseBackupFile(content, 'secret-passphrase');
    expect(parsed.integrity.valid).toBe(true);
    expect(parsed.data).toEqual(data);
  });

  it('فایل پشتیبان بدون گذرواژه نیز پشتیبانی می‌شود', async () => {
    const { content, manifest } = await buildBackupFile(
      { employees: [] },
      { companyId: 'cmp-1', companyName: 'شرکت نمونه', appVersion: '1.0.0' },
    );
    expect(manifest.encrypted).toBe(false);
    const parsed = await parseBackupFile(content);
    expect(parsed.integrity.valid).toBe(true);
  });

  it('دست‌کاری محتوا توسط مجموع کنترلی شناسایی می‌شود', async () => {
    const { content } = await buildBackupFile(
      { employees: [{ id: '1' }] },
      { companyId: 'cmp-1', companyName: 'شرکت نمونه', appVersion: '1.0.0' },
    );
    // محتوای رمزنگاری‌نشده به‌صورت رشته JSON داخل فایل قرار دارد؛ تغییر آن باید شناسایی شود.
    const raw = JSON.parse(content) as { manifest: unknown; payload: string };
    const tampered = JSON.stringify({
      manifest: raw.manifest,
      payload: raw.payload.replace('"1"', '"2"'),
    });
    const parsed = await parseBackupFile(tampered);
    expect(parsed.integrity.valid).toBe(false);
    expect(parsed.integrity.message).toContain('آسیب');
  });

  it('فایل نامعتبر با پیام فارسی رد می‌شود', async () => {
    await expect(parseBackupFile('{ not json')).rejects.toThrow(/معتبر/);
    await expect(
      parseBackupFile(JSON.stringify({ manifest: { format: 'x' }, payload: '' })),
    ).rejects.toThrow(/شناسایی نشد/);
  });

  it('اثر انگشت SHA-256 پایدار است', async () => {
    expect(await sha256Hex('test')).toBe(
      '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    );
  });
});

describe('پشتیبان‌گیری و بازیابی کامل داده', () => {
  it('داده شرکت پشتیبان‌گیری و در پایگاه‌داده بازیابی می‌شود', async () => {
    await Promise.all([db.companies.clear(), db.employees.clear(), db.attendance.clear()]);
    const { companyId } = await seedDemoData();
    const before = await collectBackupData(companyId);
    expect(before.employees).toHaveLength(5);

    const { content } = await createBackup({
      companyId,
      companyName: 'شرکت صنعت بسته‌بندی نقش آرمانی',
      appVersion: '1.0.0',
      passphrase: 'backup-passphrase',
    });

    await db.employees.clear();
    expect(await db.employees.count()).toBe(0);

    const result = await restoreBackup({
      content,
      passphrase: 'backup-passphrase',
      mode: 'replace',
    });
    expect(result.integrity.valid).toBe(true);
    expect(result.restored.employees).toBe(5);
    expect(await db.employees.count()).toBe(5);
  });
});

describe('گزارش حسابرسی تغییرناپذیر', () => {
  it('زنجیره هش رویدادها معتبر می‌ماند', async () => {
    await db.auditLog.clear();
    await recordAudit({
      action: 'create',
      entityType: 'employee',
      entityId: 'emp-1',
      summary: 'ایجاد کارمند نمونه',
      actorName: 'حسابدار',
    });
    await recordAudit({
      action: 'update',
      entityType: 'employee',
      entityId: 'emp-1',
      summary: 'ویرایش پایه حقوق',
      diff: [{ field: 'baseMonthly', before: 100, after: 200 }],
    });
    const integrity = await verifyAuditChain();
    expect(integrity.valid).toBe(true);
    expect(integrity.checked).toBe(2);
  });

  it('دست‌کاری در سابقه، زنجیره را می‌شکند', async () => {
    await db.auditLog.clear();
    await recordAudit({
      action: 'create',
      entityType: 'employee',
      entityId: 'emp-1',
      summary: 'الف',
    });
    await recordAudit({
      action: 'update',
      entityType: 'employee',
      entityId: 'emp-1',
      summary: 'ب',
    });
    const entries = await db.auditLog.orderBy('createdAt').toArray();
    const first = entries[0];
    if (first) await db.auditLog.update(first.id, { summary: 'تغییر یافته' });
    const integrity = await verifyAuditChain();
    expect(integrity.valid).toBe(false);
    expect(integrity.brokenAt).toBe(first?.id);
  });
});
