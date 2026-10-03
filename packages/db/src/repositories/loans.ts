import type { JalaliPeriod, LoanContract } from '@dastmozd/types';
import { db } from '../schema';
import { DataError, auditStamp, makeId } from '../helpers';
import { recordAudit } from '../audit';

/** شماره ترتیب ماه‌ها از مبدأ — برای مقایسه دوره‌های شمسی. */
function periodIndex(period: JalaliPeriod): number {
  return period.jy * 12 + (period.jm - 1);
}

export interface LoanInput {
  employeeId: string;
  companyId: string;
  title: string;
  principal: number;
  installmentCount: number;
  startPeriod: JalaliPeriod;
  /** مبلغ قسط؛ در صورت نبود، از تقسیم اصل بر تعداد قسط محاسبه می‌شود. */
  installmentAmount?: number;
  guarantor?: string;
  notes?: string;
}

/** ایجاد قرارداد وام با زمان‌بندی خودکار اقساط. */
export async function createLoan(input: LoanInput, actorId?: string): Promise<LoanContract> {
  if (input.principal <= 0) throw new DataError('مبلغ وام باید بزرگ‌تر از صفر باشد.', 'LOAN_AMOUNT');
  if (input.installmentCount <= 0) throw new DataError('تعداد اقساط باید حداقل یک باشد.', 'LOAN_INSTALLMENTS');
  const installmentAmount = input.installmentAmount ?? Math.round(input.principal / input.installmentCount);
  const loan: LoanContract = {
    id: makeId('loan'),
    employeeId: input.employeeId,
    companyId: input.companyId,
    title: input.title,
    principal: input.principal,
    installmentCount: input.installmentCount,
    startPeriod: input.startPeriod,
    installmentAmount,
    paidInstallments: 0,
    remainingBalance: input.principal,
    status: 'active',
    ...(input.guarantor ? { guarantor: input.guarantor } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...auditStamp(actorId),
  };
  await db.loans.add(loan);
  await recordAudit({
    action: 'create',
    entityType: 'loan',
    entityId: loan.id,
    summary: `وام «${loan.title}» با ${loan.installmentCount} قسط ${installmentAmount.toLocaleString('en-US')} ریالی ثبت شد.`,
    ...(actorId ? { actorId } : {}),
  });
  return loan;
}

export async function listLoans(companyId?: string, employeeId?: string): Promise<LoanContract[]> {
  let rows = await db.loans.toArray();
  if (companyId) rows = rows.filter((loan) => loan.companyId === companyId);
  if (employeeId) rows = rows.filter((loan) => loan.employeeId === employeeId);
  return rows.sort((a, b) => a.startPeriod.jy - b.startPeriod.jy || a.startPeriod.jm - b.startPeriod.jm);
}

/**
 * قسط وام مربوط به یک دوره مشخص.
 * اگر دوره پیش از شروع وام یا پس از پایان اقساط باشد، مبلغ صفر برمی‌گردد.
 */
export function installmentForPeriod(loan: LoanContract, period: JalaliPeriod): number {
  if (loan.status !== 'active') return 0;
  const index = periodIndex(period) - periodIndex(loan.startPeriod);
  if (index < 0 || index >= loan.installmentCount) return 0;
  if (loan.paidInstallments > index) return 0;
  return Math.min(loan.installmentAmount, loan.remainingBalance);
}

/** ثبت پرداخت قسط و به‌روزرسانی مانده وام. */
export async function registerInstallment(loanId: string, amount: number, actorId?: string): Promise<LoanContract> {
  const loan = await db.loans.get(loanId);
  if (!loan) throw new DataError('وام یافت نشد.', 'LOAN_NOT_FOUND');
  const paidInstallments = loan.paidInstallments + 1;
  const remainingBalance = Math.max(0, loan.remainingBalance - amount);
  const status: LoanContract['status'] = remainingBalance === 0 ? 'settled' : 'active';
  const updated: LoanContract = {
    ...loan,
    paidInstallments,
    remainingBalance,
    status,
    updatedAt: new Date().toISOString(),
    ...(actorId ? { updatedBy: actorId } : {}),
  };
  await db.loans.put(updated);
  await recordAudit({
    action: 'update',
    entityType: 'loan',
    entityId: loanId,
    summary: `قسط ${amount.toLocaleString('en-US')} ریالی وام «${loan.title}» ثبت شد؛ مانده ${remainingBalance.toLocaleString('en-US')} ریال.`,
    ...(actorId ? { actorId } : {}),
  });
  return updated;
}

/** جدول زمان‌بندی اقساط برای نمایش در پرونده کارمند. */
export function installmentSchedule(loan: LoanContract): Array<{ period: JalaliPeriod; amount: number; paid: boolean }> {
  const schedule: Array<{ period: JalaliPeriod; amount: number; paid: boolean }> = [];
  const startIndex = periodIndex(loan.startPeriod);
  for (let index = 0; index < loan.installmentCount; index += 1) {
    const total = startIndex + index;
    schedule.push({
      period: { jy: Math.floor(total / 12), jm: (total % 12) + 1 },
      amount: loan.installmentAmount,
      paid: index < loan.paidInstallments,
    });
  }
  return schedule;
}

/** سررسیدهای نزدیک (برای تقویم رویدادهای داشبورد). */
export async function upcomingInstallments(
  companyId: string,
  period: JalaliPeriod,
): Promise<Array<{ loan: LoanContract; amount: number }>> {
  const loans = await listLoans(companyId);
  return loans
    .map((loan) => ({ loan, amount: installmentForPeriod(loan, period) }))
    .filter((item) => item.amount > 0);
}
