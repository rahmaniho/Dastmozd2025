/**
 * رمزنگاری داده‌های محلی و فایل‌های پشتیبان.
 *
 *  - استخراج کلید با PBKDF2-SHA256 و حداقل ۳۱۰٬۰۰۰ تکرار (OWASP 2023)
 *  - رمزنگاری محتوا با AES-GCM 256 بیتی و بردار مقدار اولیه تصادفی ۱۲ بایتی
 *  - فایل پشتیبان `.dastmozd` شامل فراداده غیررمز (manifest) و بخش رمزنگاری‌شده است
 *
 * این ماژول هیچ کلید یا گذرواژه‌ای را ذخیره نمی‌کند؛ کلید فقط در حافظه نگه داشته
 * می‌شود و با بستن برنامه از بین می‌رود.
 */
import type { BackupManifest } from '@dastmozd/types';

export const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedPayload {
  /** AES-GCM ciphertext (including the auth tag). */
  cipher: Uint8Array;
  /** Random initialization vector. */
  iv: Uint8Array;
  /** Salt used by PBKDF2. */
  salt: Uint8Array;
  iterations: number;
}

function subtle(): SubtleCrypto {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) {
    throw new Error('این مرورگر از Web Crypto پشتیبانی نمی‌کند؛ برای رمزنگاری داده‌ها از مرورگر جدیدتر استفاده کنید.');
  }
  return cryptoImpl.subtle;
}

function randomBytes(length: number): Uint8Array {
  const buffer = new Uint8Array(length);
  globalThis.crypto.getRandomValues(buffer);
  return buffer;
}

/** استخراج کلید AES-GCM از گذرواژه کاربر با PBKDF2. */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<CryptoKey> {
  if (passphrase.length < 8) {
    throw new Error('گذرواژه باید حداقل ۸ کاراکتر باشد.');
  }
  const encoder = new TextEncoder();
  const baseKey = await subtle().importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle().deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** رمزنگاری یک رشته متنی (مثلاً JSON پشتیبان) با AES-GCM. */
export async function encryptText(text: string, passphrase: string): Promise<EncryptedPayload> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveKey(passphrase, salt);
  const cipher = await subtle().encrypt(
    { name: 'AES-GCM', iv: iv as unknown as BufferSource },
    key,
    new TextEncoder().encode(text),
  );
  return { cipher: new Uint8Array(cipher), iv, salt, iterations: PBKDF2_ITERATIONS };
}

/** رمزگشایی محتوای رمزنگاری‌شده. در صورت دست‌کاری داده، خطا پرتاب می‌شود. */
export async function decryptText(payload: EncryptedPayload, passphrase: string): Promise<string> {
  const key = await deriveKey(passphrase, payload.salt, payload.iterations);
  const plain = await subtle().decrypt(
    { name: 'AES-GCM', iv: payload.iv as unknown as BufferSource },
    key,
    payload.cipher as unknown as BufferSource,
  );
  return new TextDecoder().decode(plain);
}

/** SHA-256 به‌صورت رشته هگز — برای کنترل یکپارچگی فایل پشتیبان. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const digest = await subtle().digest('SHA-256', bytes as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/* ------------------------------------------------------------ Base64 helpers */

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

/* ------------------------------------------------------------- Backup format */

export interface BackupFile {
  manifest: BackupManifest;
  /** محتوای رمزنگاری‌شده به‌صورت base64 (یا متن ساده وقتی رمزنگاری غیرفعال است). */
  payload: string;
}

export const BACKUP_EXTENSION = '.dastmozd';
export const BACKUP_FORMAT_VERSION = 1 as const;

/** ساخت فایل پشتیبان (JSON) از داده‌ها و گذرواژه اختیاری. */
export async function buildBackupFile(
  data: unknown,
  meta: { companyId: string; companyName: string; appVersion: string; passphrase?: string },
): Promise<{ content: string; manifest: BackupManifest }> {
  const plain = JSON.stringify(data);
  const counts = countRecords(data);

  if (meta.passphrase && meta.passphrase.length >= 8) {
    const encrypted = await encryptText(plain, meta.passphrase);
    const payloadBase64 = toBase64(encrypted.cipher);
    const manifest: BackupManifest = {
      format: 'dastmozd-backup',
      formatVersion: BACKUP_FORMAT_VERSION,
      appVersion: meta.appVersion,
      companyId: meta.companyId,
      companyName: meta.companyName,
      createdAt: new Date().toISOString(),
      payloadSha256: await sha256Hex(encrypted.cipher),
      kdf: {
        algorithm: 'PBKDF2-SHA256',
        iterations: encrypted.iterations,
        saltBase64: toBase64(encrypted.salt),
      },
      cipher: { algorithm: 'AES-GCM', ivBase64: toBase64(encrypted.iv) },
      counts,
      encrypted: true,
    };
    return {
      manifest,
      content: JSON.stringify({ manifest, payload: payloadBase64 }, null, 2),
    };
  }

  const manifest: BackupManifest = {
    format: 'dastmozd-backup',
    formatVersion: BACKUP_FORMAT_VERSION,
    appVersion: meta.appVersion,
    companyId: meta.companyId,
    companyName: meta.companyName,
    createdAt: new Date().toISOString(),
    payloadSha256: await sha256Hex(plain),
    kdf: { algorithm: 'PBKDF2-SHA256', iterations: 0, saltBase64: '' },
    cipher: { algorithm: 'AES-GCM', ivBase64: '' },
    counts,
    encrypted: false,
  };
  return { manifest, content: JSON.stringify({ manifest, payload: plain }, null, 2) };
}

export interface ParsedBackup<T = unknown> {
  manifest: BackupManifest;
  data: T;
  /** نتیجه بررسی یکپارچگی فایل. */
  integrity: { valid: boolean; message: string };
}

/** خواندن فایل پشتیبان و بررسی یکپارچگی آن. */
export async function parseBackupFile<T = unknown>(
  content: string,
  passphrase?: string,
): Promise<ParsedBackup<T>> {
  let parsed: BackupFile;
  try {
    parsed = JSON.parse(content) as BackupFile;
  } catch {
    throw new Error('فایل انتخاب‌شده یک پشتیبان معتبر دستمزد آرمانی نیست.');
  }
  const { manifest, payload } = parsed;
  if (manifest?.format !== 'dastmozd-backup') {
    throw new Error('ساختار فایل پشتیبان شناسایی نشد.');
  }

  if (manifest.encrypted) {
    if (!passphrase) throw new Error('این فایل رمزنگاری شده است؛ گذرواژه پشتیبان را وارد کنید.');
    const decryptPayload: EncryptedPayload = {
      cipher: fromBase64(payload),
      iv: fromBase64(manifest.cipher.ivBase64),
      salt: fromBase64(manifest.kdf.saltBase64),
      iterations: manifest.kdf.iterations || PBKDF2_ITERATIONS,
    };
    const checksum = await sha256Hex(decryptPayload.cipher);
    if (checksum !== manifest.payloadSha256) {
      return {
        manifest,
        data: {} as T,
        integrity: { valid: false, message: 'مجموع کنترلی فایل با محتوا مطابقت ندارد؛ فایل آسیب دیده است.' },
      };
    }
    const plain = await decryptText(decryptPayload, passphrase);
    return {
      manifest,
      data: JSON.parse(plain) as T,
      integrity: { valid: true, message: 'رمزگشایی و بررسی یکپارچگی با موفقیت انجام شد.' },
    };
  }

  const checksum = await sha256Hex(payload);
  if (checksum !== manifest.payloadSha256) {
    return {
      manifest,
      data: {} as T,
      integrity: { valid: false, message: 'مجموع کنترلی فایل با محتوا مطابقت ندارد؛ فایل آسیب دیده است.' },
    };
  }
  return {
    manifest,
    data: JSON.parse(payload) as T,
    integrity: { valid: true, message: 'بررسی یکپارچگی با موفقیت انجام شد.' },
  };
}

function countRecords(data: unknown): Record<string, number> {
  if (!data || typeof data !== 'object') return {};
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (Array.isArray(value)) result[key] = value.length;
  }
  return result;
}
