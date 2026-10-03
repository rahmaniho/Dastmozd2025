/** ابزارهای مشترک لایه داده: شناسه، مُهر زمانی و ساخت خطاهای فارسی. */

/** شناسه یکتا با پیشوند معنادار (مثلاً `emp-3f2a91`). */
export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}-${time}${random}`;
}

/** مُهر زمانی ISO برای ثبت در رکوردها. */
export function nowIso(): string {
  return new Date().toISOString();
}

/** مُهر زمانی رکورد جدید به‌همراه نویسنده تغییر. */
export function auditStamp(actorId?: string): {
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
} {
  const timestamp = nowIso();
  return {
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(actorId ? { createdBy: actorId, updatedBy: actorId } : {}),
  };
}

/** خطای دامنه‌ای با پیام فارسی برای نمایش در رابط کاربری. */
export class DataError extends Error {
  constructor(
    message: string,
    readonly code: string = 'DATA_ERROR',
  ) {
    super(message);
    this.name = 'DataError';
  }
}
