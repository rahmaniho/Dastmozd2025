import type { IsoDateTime } from './common';

/** Actions recorded in the immutable audit log. */
export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'restore'
  | 'lock'
  | 'unlock'
  | 'calculate'
  | 'approve'
  | 'export'
  | 'login'
  | 'logout'
  | 'backup'
  | 'restore-backup'
  | 'import';

export type AuditEntityType =
  | 'employee'
  | 'attendance'
  | 'payroll-run'
  | 'payslip'
  | 'company'
  | 'loan'
  | 'settings'
  | 'user'
  | 'backup';

export interface AuditLogEntry {
  id: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  /** Human readable Persian description of the change. */
  summary: string;
  /** Field-level diff for update actions. */
  diff?: Array<{ field: string; before: unknown; after: unknown }>;
  actorId?: string;
  actorName?: string;
  /** Chained hash (previous entry hash + this entry) for tamper evidence. */
  hash: string;
  previousHash: string | null;
  createdAt: IsoDateTime;
  deviceInfo?: string;
  /** Sandbox marker for records created by demo seed data. */
  seed?: boolean;
}

export interface BackupManifest {
  format: 'dastmozd-backup';
  formatVersion: 1;
  appVersion: string;
  companyId: string;
  companyName: string;
  createdAt: IsoDateTime;
  /** SHA-256 of the encrypted payload (integrity check). */
  payloadSha256: string;
  /** PBKDF2 parameters used to derive the encryption key. */
  kdf: {
    algorithm: 'PBKDF2-SHA256';
    iterations: number;
    saltBase64: string;
  };
  cipher: {
    algorithm: 'AES-GCM';
    ivBase64: string;
  };
  /** Number of records per table for a quick sanity check on restore. */
  counts: Record<string, number>;
  encrypted: boolean;
}
