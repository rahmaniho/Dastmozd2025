import type { CompanyProfile } from '@dastmozd/types';
import { db } from '../schema';
import { DataError, auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

/** کارگاه پیش‌فرض سامانه — با مقادیر واقعی شرکت صنعت بسته‌بندی نقش آرمانی. */
export function createDefaultCompany(): CompanyProfile {
  const stamp = auditStamp();
  return {
    id: makeId('cmp'),
    name: 'شرکت صنعت بسته‌بندی نقش آرمانی',
    registrationNumber: '548712',
    economicCode: '411384567890',
    workshopCode: '8412345678',
    taxOfficeCode: '2301',
    nationalId: '10320456789',
    phone: '021-55987654',
    email: 'hr@naqsharmani.ir',
    website: 'https://naqsharmani.ir',
    address: {
      province: 'تهران',
      city: 'تهران',
      postalCode: '1394736511',
      line: 'خیابان شهید بهشتی، کوچه صنعت، پلاک ۱۴، واحد ۳',
    },
    managerName: 'مهندس حسین رحمانی',
    workSchedule: {
      weeklyHours: 44,
      shiftStart: '08:00',
      shiftEnd: '17:00',
      breakMinutes: 60,
      weeklyRestDays: [6],
      roundingStep: 1_000,
    },
    payroll: {
      insuranceBeforeTax: true,
      prorateBenefits: false,
      latePenaltyEnabled: false,
      annualLeaveDays: 26,
      roundPayout: true,
    },
    isActive: true,
    ...stamp,
  };
}

export async function listCompanies(includeInactive = false): Promise<CompanyProfile[]> {
  const all = await db.companies.orderBy('name').toArray();
  return includeInactive ? all : all.filter((company) => company.isActive && !company.deletedAt);
}

export async function getCompany(id: string): Promise<CompanyProfile | undefined> {
  return db.companies.get(id);
}

/** نخستین شرکت فعال؛ در صورت نبود، شرکت پیش‌فرض ساخته می‌شود. */
export async function ensureActiveCompany(): Promise<CompanyProfile> {
  const existing = await listCompanies();
  const first = existing[0];
  if (first) return first;
  const company = createDefaultCompany();
  await db.companies.add(company);
  await recordAudit({
    action: 'create',
    entityType: 'company',
    entityId: company.id,
    summary: `شرکت «${company.name}» به‌صورت پیش‌فرض ایجاد شد.`,
  });
  return company;
}

export async function saveCompany(
  input: Omit<CompanyProfile, 'createdAt' | 'updatedAt'> &
    Partial<Pick<CompanyProfile, 'createdAt'>>,
  actorId?: string,
): Promise<CompanyProfile> {
  if (!input.name?.trim()) throw new DataError('نام شرکت الزامی است.', 'COMPANY_NAME_REQUIRED');
  const now = new Date().toISOString();
  const existing = await db.companies.get(input.id);
  const record: CompanyProfile = {
    ...input,
    createdAt: existing?.createdAt ?? input.createdAt ?? now,
    updatedAt: now,
    ...(actorId ? { updatedBy: actorId } : {}),
  } as CompanyProfile;
  await db.companies.put(record);
  await recordAudit({
    action: existing ? 'update' : 'create',
    entityType: 'company',
    entityId: record.id,
    summary: existing
      ? `اطلاعات شرکت «${record.name}» ویرایش شد.`
      : `شرکت «${record.name}» ایجاد شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return record;
}

/** حذف نرم شرکت — داده‌ها برای حسابرسی حفظ می‌شود. */
export async function archiveCompany(id: string, actorId?: string): Promise<void> {
  const company = await db.companies.get(id);
  if (!company) throw new DataError('شرکت یافت نشد.', 'COMPANY_NOT_FOUND');
  await db.companies.update(id, {
    isActive: false,
    deletedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await recordAudit({
    action: 'delete',
    entityType: 'company',
    entityId: id,
    summary: `شرکت «${company.name}» بایگانی شد.`,
    ...(actorId ? { actorId } : {}),
  });
}
