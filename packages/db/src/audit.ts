import { fnv1a } from '@dastmozd/core';
import type { AuditAction, AuditEntityType, AuditLogEntry } from '@dastmozd/types';
import { db } from './schema';
import { makeId, nowIso } from './helpers';

export interface AuditInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
  actorId?: string;
  actorName?: string;
  deviceInfo?: string;
}

/**
 * ثبت رویداد در گزارش حسابرسی تغییرناپذیر.
 *
 * هر رکورد با هش زنجیره‌ای (هش رکورد قبلی + محتوای این رکورد) ذخیره می‌شود؛ در
 * نتیجه هرگونه دست‌کاری در سابقه، زنجیره را می‌شکند و در بازبینی شناسایی می‌شود.
 */
export async function recordAudit(input: AuditInput): Promise<AuditLogEntry> {
  const previous = await db.auditLog.orderBy('createdAt').last();
  const previousHash = previous?.hash ?? null;
  const createdAt = nowIso();
  const payload = JSON.stringify({
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    diff: input.diff ?? null,
    createdAt,
    previousHash,
  });

  const entry: AuditLogEntry = {
    id: makeId('log'),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    summary: input.summary,
    ...(input.diff ? { diff: input.diff } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
    ...(input.actorName ? { actorName: input.actorName } : {}),
    ...(input.deviceInfo ? { deviceInfo: input.deviceInfo } : {}),
    hash: fnv1a(payload),
    previousHash,
    createdAt,
  };
  await db.auditLog.add(entry);
  return entry;
}

export interface AuditIntegrityResult {
  valid: boolean;
  checked: number;
  /** شناسه اولین رکوردی که زنجیره را شکسته است. */
  brokenAt?: string;
}

/** بررسی صحت زنجیره هش گزارش حسابرسی. */
export async function verifyAuditChain(): Promise<AuditIntegrityResult> {
  const entries = await db.auditLog.orderBy('createdAt').toArray();
  let previousHash: string | null = null;
  for (const entry of entries) {
    const expectedPayload = JSON.stringify({
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      summary: entry.summary,
      diff: entry.diff ?? null,
      createdAt: entry.createdAt,
      previousHash,
    });
    if (fnv1a(expectedPayload) !== entry.hash || entry.previousHash !== previousHash) {
      return { valid: false, checked: entries.length, brokenAt: entry.id };
    }
    previousHash = entry.hash;
  }
  return { valid: true, checked: entries.length };
}

/** آخرین رویدادهای حسابرسی برای نمایش در صفحه گزارش. */
export async function latestAuditEntries(limit = 100): Promise<AuditLogEntry[]> {
  const entries = await db.auditLog.orderBy('createdAt').reverse().limit(limit).toArray();
  return entries;
}

/** خروجی ماشین‌خوان گزارش حسابرسی برای بازرسی بیرونی. */
export async function exportAuditJson(): Promise<string> {
  const entries = await db.auditLog.orderBy('createdAt').toArray();
  return JSON.stringify(
    {
      format: 'dastmozd-audit',
      formatVersion: 1,
      exportedAt: nowIso(),
      count: entries.length,
      integrity: await verifyAuditChain(),
      entries,
    },
    null,
    2,
  );
}
