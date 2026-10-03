'use client';

import { validateEmployee } from '@dastmozd/core';
import { emptyEmployee, saveEmployee, type EmployeeInput } from '@dastmozd/db';
import type { Department, Employee, EmployeeChild, UserRole } from '@dastmozd/types';
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  FormField,
  Input,
  Select,
  Separator,
  Textarea,
  useToast,
} from '@dastmozd/ui';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { JalaliDateField } from './jalali-date-field';
import { MoneyInput } from './money-input';
import { useAppStore } from '@/lib/store';

const CONTRACT_TYPES: Array<{ value: EmployeeInput['contractType']; label: string }> = [
  { value: 'labour', label: 'کارگری (مشمول قانون کار)' },
  { value: 'part-time', label: 'پاره‌وقت' },
  { value: 'temporary', label: 'موقت' },
  { value: 'contractual', label: 'پیمانی' },
  { value: 'official', label: 'رسمی' },
  { value: 'internship', label: 'کارآموزی' },
];

const STATUSES: Array<{ value: EmployeeInput['status']; label: string }> = [
  { value: 'active', label: 'شاغل' },
  { value: 'inactive', label: 'غیرفعال' },
  { value: 'unpaid-leave', label: 'مرخصی بدون حقوق' },
  { value: 'terminated', label: 'تسویه‌شده' },
];

const EDUCATIONS: Array<{ value: EmployeeInput['education']; label: string }> = [
  { value: 'below-diploma', label: 'زیر دیپلم' },
  { value: 'diploma', label: 'دیپلم' },
  { value: 'associate', label: 'کاردانی' },
  { value: 'bachelor', label: 'کارشناسی' },
  { value: 'master', label: 'کارشناسی ارشد' },
  { value: 'phd', label: 'دکتری' },
];

const DEFAULT_BANK = 'بانک ملی ایران';

const BANKS = [
  'بانک ملی ایران',
  'بانک ملت',
  'بانک صادرات ایران',
  'بانک تجارت',
  'بانک سپه',
  'بانک کشاورزی',
  'بانک مسکن',
  'بانک پاسارگاد',
  'بانک پارسیان',
  'بانک سامان',
  'بانک اقتصاد نوین',
  'بانک رفاه کارگران',
  'بانک شهر',
  'بانک آینده',
  'بانک دی',
  'بانک صنعت و معدن',
  'بانک توسعه صادرات ایران',
  'بانک قرض‌الحسنه رسالت',
];

export interface EmployeeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  departments: Department[];
  /** کارمند در حال ویرایش؛ برای ثبت جدید مقدار null بدهید. */
  editing?: Employee | null;
  onSaved?: (employee: Employee) => void;
}

/** فرم کامل پرونده کارمند با اعتبارسنجی کد ملی، شماره بیمه و شبا. */
export function EmployeeForm({
  open,
  onOpenChange,
  companyId,
  departments,
  editing = null,
  onSaved,
}: EmployeeFormProps) {
  const role = useAppStore((state) => state.role);
  const { toast } = useToast();
  const [form, setForm] = useState<EmployeeInput>(() =>
    editing
      ? ({ ...editing } as EmployeeInput)
      : emptyEmployee(companyId, departments[0]?.id ?? ''),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setForm(
      editing
        ? ({ ...editing } as EmployeeInput)
        : emptyEmployee(companyId, departments[0]?.id ?? ''),
    );
  }, [open, editing, companyId, departments]);

  const patch = (changes: Partial<EmployeeInput>): void =>
    setForm((current) => ({ ...current, ...changes }));

  const departmentOptions = useMemo(
    () => departments.map((department) => ({ value: department.id, label: department.title })),
    [departments],
  );

  const submit = async (): Promise<void> => {
    // اعتبارسنجی کامل پیش از ذخیره؛ نخستین خطای هر فیلد نمایش داده می‌شود.
    const issues = validateEmployee(form);
    const nextErrors: Record<string, string> = {};
    for (const issue of issues) {
      if (!nextErrors[issue.field]) nextErrors[issue.field] = issue.message;
    }
    setErrors(nextErrors);
    if (issues.length > 0) {
      toast({
        tone: 'error',
        title: 'اطلاعات پرونده کامل نیست',
        description: issues[0]?.message ?? 'لطفاً خطاهای فرم را برطرف کنید.',
      });
      return;
    }

    setSaving(true);
    try {
      const saved = await saveEmployee(form);
      toast({
        tone: 'success',
        title: editing ? 'پرونده ویرایش شد' : 'کارمند ثبت شد',
        description: `${saved.firstName} ${saved.lastName} با شماره پرسنلی ${saved.personnelCode} ذخیره شد.`,
      });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ذخیره پرونده ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setSaving(false);
    }
  };

  const readOnly = role === 'viewer';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="wide"
        title={
          editing ? `ویرایش پرونده ${editing.firstName} ${editing.lastName}` : 'ثبت کارمند جدید'
        }
        description="فیلدهای ستاره‌دار الزامی‌اند. شماره پرسنلی و کد ملی باید یکتا باشند."
        footer={
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              انصراف
            </Button>
            <Button onClick={submit} disabled={saving || readOnly}>
              {saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت کارمند'}
            </Button>
          </>
        }
      >
        <section className="space-y-3" aria-label="اطلاعات هویتی">
          <h3 className="text-sm font-bold text-[rgb(var(--dm-text))]">اطلاعات هویتی</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="شماره پرسنلی"
              htmlFor="emp-personnel"
              required
              error={errors.personnelCode}
            >
              <Input
                id="emp-personnel"
                numeric
                value={form.personnelCode}
                aria-invalid={errors.personnelCode ? true : undefined}
                onChange={(event) => patch({ personnelCode: event.target.value })}
              />
            </FormField>
            <FormField label="نام" htmlFor="emp-first" required error={errors.firstName}>
              <Input
                id="emp-first"
                value={form.firstName}
                aria-invalid={errors.firstName ? true : undefined}
                onChange={(event) => patch({ firstName: event.target.value })}
              />
            </FormField>
            <FormField label="نام خانوادگی" htmlFor="emp-last" required error={errors.lastName}>
              <Input
                id="emp-last"
                value={form.lastName}
                aria-invalid={errors.lastName ? true : undefined}
                onChange={(event) => patch({ lastName: event.target.value })}
              />
            </FormField>
            <FormField label="نام پدر" htmlFor="emp-father" required error={errors.fatherName}>
              <Input
                id="emp-father"
                value={form.fatherName}
                aria-invalid={errors.fatherName ? true : undefined}
                onChange={(event) => patch({ fatherName: event.target.value })}
              />
            </FormField>
            <FormField
              label="کد ملی"
              htmlFor="emp-national"
              required
              error={errors.nationalId}
              hint="۱۰ رقم؛ رقم کنترل به‌صورت خودکار بررسی می‌شود."
            >
              <Input
                id="emp-national"
                numeric
                inputMode="numeric"
                value={form.nationalId}
                aria-invalid={errors.nationalId ? true : undefined}
                onChange={(event) => patch({ nationalId: event.target.value })}
              />
            </FormField>
            <FormField
              label="شماره شناسنامه"
              htmlFor="emp-idcard"
              required
              error={errors.idCardNumber}
            >
              <Input
                id="emp-idcard"
                numeric
                inputMode="numeric"
                value={form.idCardNumber}
                aria-invalid={errors.idCardNumber ? true : undefined}
                onChange={(event) => patch({ idCardNumber: event.target.value })}
              />
            </FormField>
            <FormField label="تاریخ تولد" required error={errors.birthDate}>
              <JalaliDateField
                id="emp-birth"
                ariaLabel="تاریخ تولد"
                value={form.birthDate}
                invalid={Boolean(errors.birthDate)}
                fromYear={1310}
                toYear={1405}
                onChange={(value) => patch({ birthDate: value })}
              />
            </FormField>
            <FormField label="محل تولد" htmlFor="emp-birthplace">
              <Input
                id="emp-birthplace"
                value={form.birthPlace ?? ''}
                onChange={(event) => patch({ birthPlace: event.target.value })}
              />
            </FormField>
            <FormField label="جنسیت" htmlFor="emp-gender">
              <Select
                id="emp-gender"
                value={form.gender}
                options={[
                  { value: 'male', label: 'مرد' },
                  { value: 'female', label: 'زن' },
                ]}
                onChange={(event) =>
                  patch({ gender: event.target.value as EmployeeInput['gender'] })
                }
              />
            </FormField>
            <FormField label="وضعیت تأهل" htmlFor="emp-marital">
              <Select
                id="emp-marital"
                value={form.maritalStatus}
                options={[
                  { value: 'single', label: 'مجرد' },
                  { value: 'married', label: 'متأهل' },
                ]}
                onChange={(event) =>
                  patch({ maritalStatus: event.target.value as EmployeeInput['maritalStatus'] })
                }
              />
            </FormField>
            <FormField label="مدرک تحصیلی" htmlFor="emp-education">
              <Select
                id="emp-education"
                value={form.education}
                options={EDUCATIONS.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(event) =>
                  patch({ education: event.target.value as EmployeeInput['education'] })
                }
              />
            </FormField>
          </div>
        </section>

        <Separator />

        <section className="space-y-3" aria-label="اطلاعات شغلی">
          <h3 className="text-sm font-bold text-[rgb(var(--dm-text))]">اطلاعات شغلی و بیمه</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              label="دپارتمان"
              htmlFor="emp-department"
              required
              error={errors.departmentId}
            >
              <Select
                id="emp-department"
                value={form.departmentId}
                placeholder="انتخاب دپارتمان"
                options={departmentOptions}
                aria-invalid={errors.departmentId ? true : undefined}
                onChange={(event) => patch({ departmentId: event.target.value })}
              />
            </FormField>
            <FormField label="سمت" htmlFor="emp-position" required error={errors.position}>
              <Input
                id="emp-position"
                value={form.position}
                aria-invalid={errors.position ? true : undefined}
                onChange={(event) => patch({ position: event.target.value })}
              />
            </FormField>
            <FormField label="نوع قرارداد" htmlFor="emp-contract">
              <Select
                id="emp-contract"
                value={form.contractType}
                options={CONTRACT_TYPES.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(event) =>
                  patch({ contractType: event.target.value as EmployeeInput['contractType'] })
                }
              />
            </FormField>
            <FormField label="وضعیت اشتغال" htmlFor="emp-status">
              <Select
                id="emp-status"
                value={form.status}
                options={STATUSES.map((item) => ({ value: item.value, label: item.label }))}
                onChange={(event) =>
                  patch({ status: event.target.value as EmployeeInput['status'] })
                }
              />
            </FormField>
            <FormField label="تاریخ استخدام" required error={errors.hireDate}>
              <JalaliDateField
                id="emp-hire"
                ariaLabel="تاریخ استخدام"
                value={form.hireDate}
                invalid={Boolean(errors.hireDate)}
                fromYear={1370}
                toYear={1405}
                onChange={(value) => patch({ hireDate: value })}
              />
            </FormField>
            <FormField
              label="شماره بیمه تأمین اجتماعی"
              htmlFor="emp-insurance"
              error={errors.insuranceNumber}
            >
              <Input
                id="emp-insurance"
                numeric
                inputMode="numeric"
                value={form.insuranceNumber ?? ''}
                aria-invalid={errors.insuranceNumber ? true : undefined}
                onChange={(event) => patch({ insuranceNumber: event.target.value })}
              />
            </FormField>
            <FormField label="تاریخ شروع بیمه" htmlFor="emp-insurance-start">
              <JalaliDateField
                id="emp-insurance-start"
                ariaLabel="تاریخ شروع بیمه"
                value={form.insuranceStartDate ?? form.hireDate}
                fromYear={1370}
                toYear={1405}
                onChange={(value) => patch({ insuranceStartDate: value })}
              />
            </FormField>
            <FormField label="تاریخ تسویه (در صورت وجود)">
              <JalaliDateField
                ariaLabel="تاریخ تسویه"
                value={form.terminationDate ?? { jy: 1405, jm: 1, jd: 1 }}
                fromYear={1400}
                toYear={1420}
                onChange={(value) => patch({ terminationDate: value })}
              />
            </FormField>
          </div>
        </section>

        <Separator />

        <section className="space-y-3" aria-label="حقوق و مزایا">
          <h3 className="text-sm font-bold text-[rgb(var(--dm-text))]">حقوق و مزایای ماهانه</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="پایه حقوق ماهانه" required hint="حداقل حقوق ۱۴۰۵: ۱۶۶٬۲۵۵٬۵۰۰ ریال">
              <MoneyInput
                value={form.salary.baseMonthly}
                onChange={(value) => patch({ salary: { ...form.salary, baseMonthly: value } })}
              />
            </FormField>
            <FormField label="پایه سنوات ماهانه">
              <MoneyInput
                value={form.salary.seniorityMonthly}
                onChange={(value) => patch({ salary: { ...form.salary, seniorityMonthly: value } })}
              />
            </FormField>
            <FormField
              label="حق مسکن (بازنویسی اختیاری)"
              hint="در صورت خالی بودن، مبلغ قانونی اعمال می‌شود."
            >
              <MoneyInput
                value={form.salary.housingMonthly ?? 0}
                onChange={(value) =>
                  patch({ salary: { ...form.salary, housingMonthly: value || undefined } })
                }
              />
            </FormField>
            <FormField label="بن کارگری (بازنویسی اختیاری)">
              <MoneyInput
                value={form.salary.groceryMonthly ?? 0}
                onChange={(value) =>
                  patch({ salary: { ...form.salary, groceryMonthly: value || undefined } })
                }
              />
            </FormField>
            <FormField label="حق تأهل (بازنویسی اختیاری)">
              <MoneyInput
                value={form.salary.marriageMonthly ?? 0}
                onChange={(value) =>
                  patch({ salary: { ...form.salary, marriageMonthly: value || undefined } })
                }
              />
            </FormField>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-[rgb(var(--dm-text-muted))]">
                مزایای ثابت اختصاصی
              </h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  patch({
                    salary: {
                      ...form.salary,
                      extraFixedAllowances: [
                        ...(form.salary.extraFixedAllowances ?? []),
                        { title: '', amount: 0, componentKey: 'other-benefit' },
                      ],
                    },
                  })
                }
              >
                <Plus className="size-4" />
                افزودن مزیت
              </Button>
            </div>
            {(form.salary.extraFixedAllowances ?? []).length === 0 ? (
              <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
                مزیت ثابتی ثبت نشده است؛ مانند حق ایاب‌وذهاب یا کمک‌هزینه غذا.
              </p>
            ) : (
              (form.salary.extraFixedAllowances ?? []).map((item, index) => (
                <div key={index} className="flex flex-wrap items-end gap-2">
                  <FormField label="عنوان" className="min-w-40 flex-1">
                    <Input
                      value={item.title}
                      onChange={(event) => {
                        const list = [...(form.salary.extraFixedAllowances ?? [])];
                        list[index] = { ...item, title: event.target.value };
                        patch({ salary: { ...form.salary, extraFixedAllowances: list } });
                      }}
                    />
                  </FormField>
                  <FormField label="مبلغ ماهانه" className="min-w-40 flex-1">
                    <MoneyInput
                      value={item.amount}
                      onChange={(value) => {
                        const list = [...(form.salary.extraFixedAllowances ?? [])];
                        list[index] = { ...item, amount: value };
                        patch({ salary: { ...form.salary, extraFixedAllowances: list } });
                      }}
                    />
                  </FormField>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`حذف مزیت ${item.title || index + 1}`}
                    onClick={() =>
                      patch({
                        salary: {
                          ...form.salary,
                          extraFixedAllowances: (form.salary.extraFixedAllowances ?? []).filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        },
                      })
                    }
                  >
                    <Trash2 className="size-4 text-[rgb(var(--dm-danger))]" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </section>

        <Separator />

        <section className="space-y-3" aria-label="فرزندان">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[rgb(var(--dm-text))]">فرزندان (حق اولاد)</h3>
              <p className="text-xs text-[rgb(var(--dm-text-subtle))]">
                حق اولاد برای حداکثر چهار فرزند واجد شرایط پرداخت می‌شود.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                patch({
                  children: [
                    ...form.children,
                    { id: `child-${Date.now()}`, birthDate: { jy: 1395, jm: 1, jd: 1 } },
                  ],
                })
              }
            >
              <Plus className="size-4" />
              افزودن فرزند
            </Button>
          </div>
          {form.children.length === 0 ? (
            <p className="text-xs text-[rgb(var(--dm-text-subtle))]">فرزندی ثبت نشده است.</p>
          ) : (
            form.children.map((child, index) => (
              <div
                key={child.id}
                className="grid items-end gap-2 rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3 sm:grid-cols-[1.2fr_1.4fr_auto_auto_auto]"
              >
                <FormField label="نام فرزند" className="min-w-32">
                  <Input
                    value={child.firstName ?? ''}
                    onChange={(event) => {
                      const list: EmployeeChild[] = [...form.children];
                      list[index] = { ...child, firstName: event.target.value };
                      patch({ children: list });
                    }}
                  />
                </FormField>
                <FormField label="تاریخ تولد" className="min-w-40">
                  <JalaliDateField
                    ariaLabel={`تاریخ تولد فرزند ${index + 1}`}
                    value={child.birthDate}
                    fromYear={1370}
                    toYear={1420}
                    onChange={(value) => {
                      const list: EmployeeChild[] = [...form.children];
                      list[index] = { ...child, birthDate: value };
                      patch({ children: list });
                    }}
                  />
                </FormField>
                <Checkbox
                  label="تحت تحصیل"
                  checked={child.isStudent ?? false}
                  onChange={(event) => {
                    const list: EmployeeChild[] = [...form.children];
                    list[index] = { ...child, isStudent: event.target.checked };
                    patch({ children: list });
                  }}
                />
                <Checkbox
                  label="دارای معلولیت"
                  checked={child.isDisabled ?? false}
                  onChange={(event) => {
                    const list: EmployeeChild[] = [...form.children];
                    list[index] = { ...child, isDisabled: event.target.checked };
                    patch({ children: list });
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`حذف فرزند ${index + 1}`}
                  onClick={() =>
                    patch({ children: form.children.filter((item) => item.id !== child.id) })
                  }
                >
                  <Trash2 className="size-4 text-[rgb(var(--dm-danger))]" />
                </Button>
              </div>
            ))
          )}
        </section>

        <Separator />

        <section className="space-y-3" aria-label="اطلاعات بانکی">
          <h3 className="text-sm font-bold text-[rgb(var(--dm-text))]">اطلاعات بانکی</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="شماره شبا"
              htmlFor="emp-iban"
              error={errors.bankAccount}
              hint="با یا بدون IR — ۲۴ رقم"
            >
              <Input
                id="emp-iban"
                dir="ltr"
                className="text-left"
                numeric
                value={form.bankAccount?.iban ?? ''}
                aria-invalid={errors.bankAccount ? true : undefined}
                onChange={(event) =>
                  patch({
                    bankAccount: {
                      iban: event.target.value,
                      bankName: form.bankAccount?.bankName ?? DEFAULT_BANK,
                      ...(form.bankAccount?.accountHolder
                        ? { accountHolder: form.bankAccount.accountHolder }
                        : {}),
                    },
                  })
                }
              />
            </FormField>
            <FormField label="بانک" htmlFor="emp-bank">
              <Select
                id="emp-bank"
                value={form.bankAccount?.bankName ?? DEFAULT_BANK}
                options={BANKS.map((bank) => ({ value: bank, label: bank }))}
                onChange={(event) =>
                  patch({
                    bankAccount: {
                      iban: form.bankAccount?.iban ?? '',
                      bankName: event.target.value,
                      ...(form.bankAccount?.accountHolder
                        ? { accountHolder: form.bankAccount.accountHolder }
                        : {}),
                    },
                  })
                }
              />
            </FormField>
          </div>
        </section>

        <Separator />

        <FormField label="یادداشت پرونده" htmlFor="emp-notes">
          <Textarea
            id="emp-notes"
            value={form.notes ?? ''}
            placeholder="توضیحات تکمیلی درباره پرونده، مدارک یا توافق‌های خاص."
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </FormField>

        {readOnly ? (
          <p className="text-xs font-semibold text-[rgb(var(--dm-warning))]">
            نقش فعلی شما «بازدیدکننده» است؛ امکان ثبت یا ویرایش وجود ندارد.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'مدیر سامانه',
  accountant: 'حسابدار',
  viewer: 'بازدیدکننده',
};

/** تبدیل نقش کاربر به برچسب فارسی. */
export function roleName(role: UserRole): string {
  return ROLE_LABELS[role];
}
