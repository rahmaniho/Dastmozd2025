'use client';

import { formatNumber, toPersianDigits } from '@dastmozd/core';
import {
  ROLE_PERMISSIONS,
  createBackup,
  createDefaultCompany,
  createUser,
  db,
  defaultSettings,
  deleteUser,
  enforceRetention,
  listBackups,
  listCompanies,
  listUsers,
  restoreBackup,
  saveCompany,
  saveSettings,
  seedDemoData,
  wipeDatabase,
  type BackupRecord,
} from '@dastmozd/db';
import type { AppSettings, AppUser, CompanyProfile, UserRole } from '@dastmozd/types';
import { LEGAL_PROFILES, resolveLegalProfile } from '@dastmozd/legal';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  ConfirmDialog,
  Dialog,
  DialogContent,
  FormField,
  Input,
  Money,
  PageHeader,
  Select,
  Separator,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  Textarea,
  useToast,
} from '@dastmozd/ui';
import { Building2, DatabaseZap, HardDriveDownload, Plus, ShieldCheck, Trash2, Upload, UserPlus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { JALALI_MONTH_LABELS, useDatabaseCounts } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0';

export default function SettingsPage() {
  const [tab, setTab] = useState('company');
  const companyId = useAppStore((state) => state.companyId);

  const companies = useLiveQuery(() => listCompanies(true), [], undefined);
  const backupList = useLiveQuery(() => listBackups(), [], undefined);
  const counts = useDatabaseCounts();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(companyId);
  const [draft, setDraft] = useState<CompanyProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!companies) return;
    const target =
      companies.find((company) => company.id === (selectedCompanyId ?? companyId)) ?? companies[0] ?? null;
    if (target) {
      setDraft(target);
      if (!selectedCompanyId) setSelectedCompanyId(target.id);
    }
  }, [companies, selectedCompanyId, companyId]);

  const patchDraft = (changes: Partial<CompanyProfile>): void => {
    setDraft((current) => (current ? { ...current, ...changes } : current));
  };

  const save = async (): Promise<void> => {
    if (!draft) return;
    setSaving(true);
    try {
      await saveCompany(draft);
      toast({ tone: 'success', title: 'تنظیمات شرکت ذخیره شد' });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ذخیره تنظیمات ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="تنظیمات سامانه"
        description="شرکت و کارگاه، پارامترهای حقوقی سال، پشتیبان‌گیری رمزنگاری‌شده، کاربران و ظاهر برنامه."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={<Badge tone="neutral">نسخه {toPersianDigits(APP_VERSION)}</Badge>}
      />

      <Tabs
        value={tab}
        onValueChange={setTab}
        ariaLabel="بخش‌های تنظیمات"
        tabs={[
          { value: 'company', label: 'شرکت و کارگاه' },
          { value: 'legal', label: 'پارامترهای سال' },
          { value: 'backup', label: 'پشتیبان‌گیری' },
          { value: 'users', label: 'کاربران و دسترسی' },
          { value: 'appearance', label: 'ظاهر و زبان' },
        ]}
      />

      {tab === 'company' ? (
        !draft ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>شرکت‌ها</CardTitle>
                <CardDescription>پشتیبانی از چند شرکت با پرونده‌های مستقل.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {(companies ?? []).map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => setSelectedCompanyId(company.id)}
                    className={`flex w-full items-center gap-2 rounded-[var(--dm-radius-md)] border px-3 py-2 text-right text-sm transition-colors ${
                      company.id === draft.id
                        ? 'border-[rgb(var(--dm-primary))] bg-[rgb(var(--dm-primary-subtle))]'
                        : 'border-[rgb(var(--dm-border))] hover:bg-[rgb(var(--dm-surface-sunken))]'
                    }`}
                  >
                    <Building2 className="size-4 shrink-0" aria-hidden />
                    <span className="flex-1">
                      {company.name}
                      {!company.isActive ? <Badge tone="neutral">بایگانی</Badge> : null}
                    </span>
                  </button>
                ))}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={async () => {
                    const fresh = createDefaultCompany();
                    await saveCompany({ ...fresh, name: 'شرکت تازه', isActive: true });
                    setSelectedCompanyId(fresh.id);
                    toast({
                      tone: 'success',
                      title: 'شرکت تازه ساخته شد',
                      description: 'نام، کد کارگاه و شناسه‌های رسمی را ویرایش و ذخیره کنید.',
                    });
                  }}
                >
                  <Plus className="size-4" />
                  افزودن شرکت
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>مشخصات شرکت</CardTitle>
                  <CardDescription>این اطلاعات در سرصفحه فیش حقوقی و فایل‌های رسمی درج می‌شود.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2">
                  <FormField label="نام شرکت" htmlFor="company-name" required>
                    <Input id="company-name" value={draft.name} onChange={(event) => patchDraft({ name: event.target.value })} />
                  </FormField>
                  <FormField label="شماره ثبت" htmlFor="company-registration">
                    <Input
                      id="company-registration"
                      numeric
                      value={draft.registrationNumber ?? ''}
                      onChange={(event) => patchDraft({ registrationNumber: event.target.value })}
                    />
                  </FormField>
                  <FormField label="کد اقتصادی" htmlFor="company-economic">
                    <Input
                      id="company-economic"
                      numeric
                      value={draft.economicCode ?? ''}
                      onChange={(event) => patchDraft({ economicCode: event.target.value })}
                    />
                  </FormField>
                  <FormField label="کد کارگاه تأمین اجتماعی" htmlFor="company-workshop" hint="در فایل دیسکت بیمه استفاده می‌شود.">
                    <Input
                      id="company-workshop"
                      numeric
                      value={draft.workshopCode ?? ''}
                      onChange={(event) => patchDraft({ workshopCode: event.target.value })}
                    />
                  </FormField>
                  <FormField label="کد اداره مالیات" htmlFor="company-tax-office">
                    <Input
                      id="company-tax-office"
                      numeric
                      value={draft.taxOfficeCode ?? ''}
                      onChange={(event) => patchDraft({ taxOfficeCode: event.target.value })}
                    />
                  </FormField>
                  <FormField label="شناسه ملی" htmlFor="company-national-id">
                    <Input
                      id="company-national-id"
                      numeric
                      value={draft.nationalId ?? ''}
                      onChange={(event) => patchDraft({ nationalId: event.target.value })}
                    />
                  </FormField>
                  <FormField label="تلفن" htmlFor="company-phone">
                    <Input
                      id="company-phone"
                      dir="ltr"
                      className="text-left"
                      value={draft.phone ?? ''}
                      onChange={(event) => patchDraft({ phone: event.target.value })}
                    />
                  </FormField>
                  <FormField label="رایانامه" htmlFor="company-email">
                    <Input
                      id="company-email"
                      dir="ltr"
                      className="text-left"
                      type="email"
                      value={draft.email ?? ''}
                      onChange={(event) => patchDraft({ email: event.target.value })}
                    />
                  </FormField>
                  <FormField label="استان" htmlFor="company-province">
                    <Input
                      id="company-province"
                      value={draft.address?.province ?? ''}
                      onChange={(event) =>
                        patchDraft({
                          address: {
                            province: event.target.value,
                            city: draft.address?.city ?? '',
                            postalCode: draft.address?.postalCode ?? '',
                            line: draft.address?.line ?? '',
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="شهر" htmlFor="company-city">
                    <Input
                      id="company-city"
                      value={draft.address?.city ?? ''}
                      onChange={(event) =>
                        patchDraft({
                          address: {
                            province: draft.address?.province ?? '',
                            city: event.target.value,
                            postalCode: draft.address?.postalCode ?? '',
                            line: draft.address?.line ?? '',
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="کد پستی" htmlFor="company-postal">
                    <Input
                      id="company-postal"
                      numeric
                      value={draft.address?.postalCode ?? ''}
                      onChange={(event) =>
                        patchDraft({
                          address: {
                            province: draft.address?.province ?? '',
                            city: draft.address?.city ?? '',
                            postalCode: event.target.value,
                            line: draft.address?.line ?? '',
                          },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="نام مدیرعامل" htmlFor="company-manager">
                    <Input
                      id="company-manager"
                      value={draft.managerName ?? ''}
                      onChange={(event) => patchDraft({ managerName: event.target.value })}
                    />
                  </FormField>
                  <FormField label="نشانی کامل" htmlFor="company-address" className="sm:col-span-2">
                    <Textarea
                      id="company-address"
                      value={draft.address?.line ?? ''}
                      onChange={(event) =>
                        patchDraft({
                          address: {
                            province: draft.address?.province ?? '',
                            city: draft.address?.city ?? '',
                            postalCode: draft.address?.postalCode ?? '',
                            line: event.target.value,
                          },
                        })
                      }
                    />
                  </FormField>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>ساعات کار و رویه‌های حقوقی</CardTitle>
                  <CardDescription>مبنای محاسبه کارکرد، کسر تأخیر و گِرد کردن مبلغ پرداختی.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <FormField label="ساعات کار هفتگی" htmlFor="company-weekly-hours" hint="قانون کار: ۴۴ ساعت">
                    <Input
                      id="company-weekly-hours"
                      numeric
                      value={String(draft.workSchedule.weeklyHours)}
                      onChange={(event) =>
                        patchDraft({
                          workSchedule: { ...draft.workSchedule, weeklyHours: Number(event.target.value) || 44 },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="شروع شیفت" htmlFor="company-shift-start">
                    <Input
                      id="company-shift-start"
                      type="time"
                      dir="ltr"
                      className="text-center"
                      value={draft.workSchedule.shiftStart}
                      onChange={(event) =>
                        patchDraft({ workSchedule: { ...draft.workSchedule, shiftStart: event.target.value } })
                      }
                    />
                  </FormField>
                  <FormField label="پایان شیفت" htmlFor="company-shift-end">
                    <Input
                      id="company-shift-end"
                      type="time"
                      dir="ltr"
                      className="text-center"
                      value={draft.workSchedule.shiftEnd}
                      onChange={(event) =>
                        patchDraft({ workSchedule: { ...draft.workSchedule, shiftEnd: event.target.value } })
                      }
                    />
                  </FormField>
                  <FormField label="استراحت (دقیقه)" htmlFor="company-break">
                    <Input
                      id="company-break"
                      numeric
                      value={String(draft.workSchedule.breakMinutes)}
                      onChange={(event) =>
                        patchDraft({
                          workSchedule: { ...draft.workSchedule, breakMinutes: Number(event.target.value) || 0 },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="گِرد کردن مبلغ پرداختی" htmlFor="company-rounding">
                    <Select
                      id="company-rounding"
                      value={String(draft.workSchedule.roundingStep)}
                      options={[
                        { value: '1', label: 'بدون گِرد کردن' },
                        { value: '1000', label: 'نزدیک‌ترین ۱٫۰۰۰ ریال' },
                        { value: '10000', label: 'نزدیک‌ترین ۱۰٫۰۰۰ ریال' },
                        { value: '100000', label: 'نزدیک‌ترین ۱۰۰٫۰۰۰ ریال' },
                      ]}
                      onChange={(event) =>
                        patchDraft({
                          workSchedule: { ...draft.workSchedule, roundingStep: Number(event.target.value) },
                        })
                      }
                    />
                  </FormField>
                  <FormField label="مرخصی استحقاقی سالانه (روز)" htmlFor="company-leave">
                    <Input
                      id="company-leave"
                      numeric
                      value={String(draft.payroll.annualLeaveDays)}
                      onChange={(event) =>
                        patchDraft({
                          payroll: { ...draft.payroll, annualLeaveDays: Number(event.target.value) || 26 },
                        })
                      }
                    />
                  </FormField>
                  <div className="space-y-3 sm:col-span-2 lg:col-span-3">
                    <Switch
                      label="کسر بیمه پیش از محاسبه مالیات"
                      checked={draft.payroll.insuranceBeforeTax}
                      onCheckedChange={(checked) =>
                        patchDraft({ payroll: { ...draft.payroll, insuranceBeforeTax: checked } })
                      }
                    />
                    <Switch
                      label="تقسیم مزایای ثابت بر روزهای کارکرد"
                      checked={draft.payroll.prorateBenefits}
                      onCheckedChange={(checked) => patchDraft({ payroll: { ...draft.payroll, prorateBenefits: checked } })}
                    />
                    <Switch
                      label="فعال‌سازی کسر تأخیر و تعجیل"
                      checked={draft.payroll.latePenaltyEnabled}
                      onCheckedChange={(checked) =>
                        patchDraft({ payroll: { ...draft.payroll, latePenaltyEnabled: checked } })
                      }
                    />
                    {draft.payroll.latePenaltyEnabled ? (
                      <FormField label="جریمه هر دقیقه تأخیر (ریال)" htmlFor="company-late-penalty">
                        <Input
                          id="company-late-penalty"
                          numeric
                          value={String(draft.payroll.latePenaltyPerMinute ?? 0)}
                          onChange={(event) =>
                            patchDraft({
                              payroll: { ...draft.payroll, latePenaltyPerMinute: Number(event.target.value) || 0 },
                            })
                          }
                        />
                      </FormField>
                    ) : null}
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving}>
                  {saving ? 'در حال ذخیره…' : 'ذخیره تنظیمات شرکت'}
                </Button>
              </div>
            </div>
          </div>
        )
      ) : null}

      {tab === 'legal' ? <LegalPanel /> : null}

      {tab === 'backup' ? (
        <BackupPanel
          companyId={draft?.id ?? companyId ?? ''}
          companyName={draft?.name ?? 'شرکت'}
          backups={backupList ?? []}
          counts={counts}
        />
      ) : null}

      {tab === 'users' ? <UsersPanel companyId={companyId ?? ''} /> : null}

      {tab === 'appearance' ? <AppearancePanel /> : null}
    </div>
  );
}

function LegalPanel() {
  const fiscalYear = useAppStore((state) => state.fiscalYear);
  const setPeriod = useAppStore((state) => state.setPeriod);
  const currentMonth = useAppStore((state) => state.currentMonth);
  const { profile } = resolveLegalProfile(fiscalYear);
  const years = Object.values(LEGAL_PROFILES).sort((a, b) => a.year - b.year);

  const rows: Array<{ label: string; value: (item: (typeof years)[number]) => string; hint?: string }> = [
    { label: 'حداقل مزد روزانه', value: (item) => formatNumber(item.minDailyWage) },
    { label: 'حداقل مزد ماهانه', value: (item) => formatNumber(item.minMonthlyWage) },
    { label: 'حق مسکن', value: (item) => formatNumber(item.housingAllowanceMonthly) },
    { label: 'بن کارگری', value: (item) => formatNumber(item.groceryAllowanceMonthly) },
    { label: 'حق تأهل', value: (item) => formatNumber(item.marriageAllowanceMonthly) },
    { label: 'حق اولاد (ماهانه هر فرزند)', value: (item) => formatNumber(item.childAllowanceDaily * 30) },
    { label: 'پایه سنوات ماهانه', value: (item) => formatNumber(item.seniorityMonthly) },
    { label: 'سقف بیمه', value: (item) => formatNumber(item.insurance.ceiling) },
    { label: 'نرخ بیمه کارکنان', value: (item) => `${toPersianDigits(Math.round(item.insurance.employeeRate * 100))}٪` },
    { label: 'نرخ بیمه کارفرما (با بیکاری)', value: (item) => `${toPersianDigits(Math.round(item.insurance.employerRate * 100))}٪` },
    { label: 'معافیت مالیاتی ماهانه', value: (item) => formatNumber(item.tax.monthlyExemption) },
    { label: 'ضریب اضافه‌کاری', value: (item) => toPersianDigits(item.overtimeCoefficient) },
    { label: 'ضریب شب‌کاری', value: (item) => `+${toPersianDigits(Math.round(item.nightWorkAllowanceRate * 100))}٪` },
    { label: 'حداکثر اضافه‌کار ماهانه', value: (item) => `${toPersianDigits(item.maxOvertimeHoursPerMonth)} ساعت` },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>دوره مالی فعال</CardTitle>
          <CardDescription>
            پروفایل حقوقی بر پایه سال دوره انتخاب می‌شود؛ برای سال‌های بدون بخشنامه، ارقام نزدیک‌ترین سال اعمال و
            هشدار نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <FormField label="سال مالی" htmlFor="settings-year">
            <Select
              id="settings-year"
              value={String(fiscalYear)}
              options={[1403, 1404, 1405].map((year) => ({ value: String(year), label: toPersianDigits(year) }))}
              onChange={(event) => setPeriod(Number(event.target.value), currentMonth)}
            />
          </FormField>
          <FormField label="ماه جاری" htmlFor="settings-month">
            <Select
              id="settings-month"
              value={String(currentMonth)}
              options={JALALI_MONTH_LABELS.map((label, index) => ({ value: String(index + 1), label }))}
              onChange={(event) => setPeriod(fiscalYear, Number(event.target.value))}
            />
          </FormField>
          <div className="flex items-end">
            <Badge tone={profile.verified ? 'success' : 'warning'}>
              {profile.verified ? 'پروفایل تأییدشده' : 'در انتظار تأیید بخشنامه'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>مقایسه پارامترهای حقوقی سال‌های ۱۴۰۳ تا ۱۴۰۵</CardTitle>
          <CardDescription>همه ارقام به ریال؛ ارقام ۱۴۰۳ و ۱۴۰۴ برای محاسبه مجدد دوره‌های گذشته نگه داشته شده‌اند.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="dm-scroll overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>پارامتر</TableHead>
                  {years.map((item) => (
                    <TableHead key={item.year} className={item.year === fiscalYear ? 'text-[rgb(var(--dm-primary))]' : ''}>
                      {item.label}
                      {item.verified ? '' : ' *'}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    {years.map((item) => (
                      <TableCell key={item.year} className="dm-numeric text-xs">
                        {row.value(item)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-[rgb(var(--dm-text-subtle))]">
            * پروفایل‌های بدون علامت تأیید، بر پایه منابع عمومی تنظیم شده‌اند و باید با بخشنامه رسمی همان سال تطبیق
            داده شوند (جدول منابع در docs/LEGAL.md). بازنویسی پارامترها برای هر سال در جدول legalOverrides ثبت
            می‌شود و در پشتیبان‌گیری لحاظ می‌گردد.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>گام‌های تعیین مالیات سال {profile.label}</CardTitle>
          <CardDescription>
            پس از کسر معافیت ماهانه {formatNumber(profile.tax.monthlyExemption)} ریال، درآمد مشمول به‌صورت پلکانی
            مشمول مالیات می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>پله</TableHead>
                <TableHead>بازه درآمد مشمول</TableHead>
                <TableHead>سقف پله (ریال)</TableHead>
                <TableHead>نرخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profile.tax.brackets.map((bracket, index) => (
                <TableRow key={`${bracket.upTo ?? 'inf'}-${index}`}>
                  <TableCell className="dm-numeric">{toPersianDigits(index + 1)}</TableCell>
                  <TableCell className="text-xs">{bracket.label}</TableCell>
                  <TableCell>
                    {bracket.upTo === null ? 'بدون سقف' : <Money value={bracket.upTo} size="sm" />}
                  </TableCell>
                  <TableCell className="dm-numeric">
                    {toPersianDigits(Math.round(bracket.rate * 1000) / 10)}٪
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function BackupPanel({
  companyId,
  companyName,
  backups,
  counts,
}: {
  companyId: string;
  companyName: string;
  backups: BackupRecord[];
  counts: { employees: number; attendance: number; runs: number; slips: number; audit: number } | null;
}) {
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restorePassphrase, setRestorePassphrase] = useState('');
  const [restoreContent, setRestoreContent] = useState('');
  const [restoreFileName, setRestoreFileName] = useState('');
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [wipeOpen, setWipeOpen] = useState(false);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    void navigator.storage?.estimate?.().then((estimate) => {
      setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 });
    });
  }, []);

  const create = async (): Promise<void> => {
    if (passphrase && passphrase.length < 8) {
      toast({
        tone: 'error',
        title: 'گذرواژه پشتیبان کوتاه است',
        description: 'برای رمزنگاری AES-GCM، گذرواژه‌ای با دست‌کم ۸ نویسه لازم است.',
      });
      return;
    }
    setBusy(true);
    try {
      const { content, fileName } = await createBackup({
        companyId,
        companyName,
        appVersion: APP_VERSION,
        keepLocalCopy: true,
        kind: 'manual',
        ...(passphrase ? { passphrase } : {}),
      });
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast({
        tone: 'success',
        title: 'پشتیبان ساخته شد',
        description: `فایل ${fileName} بارگیری شد${passphrase ? ' و با گذرواژه شما رمزنگاری شده است.' : ' (بدون رمزنگاری).'}`,
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'ساخت پشتیبان ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>ساخت پشتیبان</CardTitle>
            <CardDescription>
              فایل `.dastmozd` شامل همه داده‌های شرکت است؛ با گذرواژه، رمزنگاری AES-GCM انجام می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField
              label="گذرواژه پشتیبان (اختیاری)"
              htmlFor="backup-passphrase"
              hint="کلید با PBKDF2-SHA256 و ۳۱۰٫۰۰۰ تکرار مشتق می‌شود. گذرواژه را گم نکنید؛ بازیابی بدون آن ممکن نیست."
            >
              <Input
                id="backup-passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </FormField>
            <div className="flex flex-wrap gap-2">
              <Button onClick={create} disabled={busy}>
                <HardDriveDownload className="size-4" />
                {busy ? 'در حال ساخت…' : 'ساخت و بارگیری پشتیبان'}
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await enforceRetention();
                  toast({ tone: 'info', title: 'سیاست نگهداری اعمال شد', description: '۳۰ روزانه، ۱۲ ماهانه و ۵ سالانه.' });
                }}
              >
                اعمال سیاست نگهداری
              </Button>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              <Fact label="کارمندان" value={counts?.employees ?? 0} />
              <Fact label="رکورد کارکرد" value={counts?.attendance ?? 0} />
              <Fact label="دوره حقوقی" value={counts?.runs ?? 0} />
              <Fact label="فیش حقوقی" value={counts?.slips ?? 0} />
              <Fact label="رکورد رهگیری" value={counts?.audit ?? 0} />
              <Fact label="فضای مصرفی" value={storage ? Math.round(storage.usage / 1024) : 0} unit="کیلوبایت" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>بازیابی از فایل پشتیبان</CardTitle>
            <CardDescription>
              پیش از بازیابی، یکپارچگی فایل با SHA-256 بررسی می‌شود؛ در حالت جایگزینی، داده‌های فعلی پاک می‌شوند.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="فایل پشتیبان" htmlFor="restore-file">
              <input
                id="restore-file"
                type="file"
                accept=".dastmozd,.json"
                className="block w-full text-sm file:mr-3 file:rounded-[var(--dm-radius-md)] file:border file:border-[rgb(var(--dm-border))] file:bg-[rgb(var(--dm-surface-sunken))] file:px-3 file:py-2 file:text-sm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const text = await file.text();
                  setRestoreContent(text);
                  setRestoreFileName(file.name);
                }}
              />
            </FormField>
            <FormField label="گذرواژه فایل (در صورت رمزنگاری)" htmlFor="restore-passphrase">
              <Input
                id="restore-passphrase"
                type="password"
                autoComplete="off"
                value={restorePassphrase}
                onChange={(event) => setRestorePassphrase(event.target.value)}
              />
            </FormField>
            <FormField label="حالت بازیابی" htmlFor="restore-mode">
              <Select
                id="restore-mode"
                value={restoreMode}
                options={[
                  { value: 'replace', label: 'جایگزینی کامل داده‌های این شرکت' },
                  { value: 'merge', label: 'ادغام با داده‌های موجود' },
                ]}
                onChange={(event) => setRestoreMode(event.target.value as 'replace' | 'merge')}
              />
            </FormField>
            <Button
              variant="secondary"
              disabled={!restoreContent}
              onClick={() => setRestoreOpen(true)}
            >
              <Upload className="size-4" />
              بازیابی {restoreFileName ? `از ${restoreFileName}` : ''}
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>پشتیبان‌های ذخیره‌شده در مرورگر</CardTitle>
          <CardDescription>کپی‌های سبک برای بازیابی سریع؛ بر پایه سیاست نگهداری پاک‌سازی می‌شوند.</CardDescription>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <p className="text-sm text-[rgb(var(--dm-text-subtle))]">پشتیبانی ذخیره نشده است.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>برچسب</TableHead>
                  <TableHead>تاریخ</TableHead>
                  <TableHead>نوع</TableHead>
                  <TableHead>حجم</TableHead>
                  <TableHead>رمزنگاری</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id}>
                    <TableCell className="text-xs">{backup.label}</TableCell>
                    <TableCell className="dm-numeric text-xs">
                      {toPersianDigits(backup.createdAt.slice(0, 10))}
                    </TableCell>
                    <TableCell className="text-xs">{backup.kind}</TableCell>
                    <TableCell className="dm-numeric text-xs">
                      {toPersianDigits(Math.round(backup.sizeBytes / 1024))} کیلوبایت
                    </TableCell>
                    <TableCell>
                      <Badge tone={backup.encrypted ? 'success' : 'warning'}>
                        {backup.encrypted ? 'رمزنگاری‌شده' : 'ساده'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>عملیات پرخطر</CardTitle>
          <CardDescription>این عملیات بازگشت‌ناپذیر است؛ پیش از اجرا پشتیبان بگیرید.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await seedDemoData({ reset: true });
              toast({ tone: 'success', title: 'داده نمونه بارگذاری شد', description: 'برای آزمون و آموزش مناسب است.' });
            }}
          >
            بارگذاری داده نمونه
          </Button>
          <Button variant="outline" onClick={() => setWipeOpen(true)}>
            پاک‌کردن کامل داده‌ها
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="بازیابی پشتیبان"
        description={
          restoreMode === 'replace'
            ? 'با بازیابی در حالت جایگزینی، داده‌های کنونی این شرکت حذف و محتوای فایل بازنویسی می‌شود. ادامه می‌دهید؟'
            : 'داده‌های فایل با داده‌های موجود ادغام می‌شود؛ رکوردهای هم‌شناسه بازنویسی می‌شوند.'
        }
        confirmLabel="بازیابی کن"
        onConfirm={async () => {
          try {
            const outcome = await restoreBackup({
              content: restoreContent,
              mode: restoreMode,
              ...(restorePassphrase ? { passphrase: restorePassphrase } : {}),
            });
            if (!outcome.integrity.valid) {
              toast({ tone: 'error', title: 'یکپارچگی فایل تأیید نشد', description: outcome.integrity.message });
              return;
            }
            toast({
              tone: 'success',
              title: 'بازیابی انجام شد',
              description: Object.entries(outcome.restored)
                .map(([table, count]) => `${table}: ${toPersianDigits(count)}`)
                .join(' · '),
            });
          } catch (error) {
            toast({
              tone: 'error',
              title: 'بازیابی ناموفق بود',
              description: error instanceof Error ? error.message : 'خطای نامشخص',
            });
          } finally {
            setRestoreOpen(false);
            setRestoreContent('');
            setRestorePassphrase('');
          }
        }}
      />

      <ConfirmDialog
        open={wipeOpen}
        onOpenChange={setWipeOpen}
        title="پاک‌کردن کامل داده‌ها"
        description="همه کارکنان، کارکرد، دوره‌ها و فیش‌ها حذف می‌شوند. گزارش رهگیری برای شفافیت باقی می‌ماند. این عملیات بازگشت‌پذیر نیست."
        confirmLabel="همه را پاک کن"
        onConfirm={async () => {
          try {
            await wipeDatabase();
            toast({ tone: 'warning', title: 'داده‌ها پاک شد', description: 'سامانه به وضعیت آغازین بازگشت.' });
          } catch (error) {
            toast({
              tone: 'error',
              title: 'پاک‌سازی ناموفق بود',
              description: error instanceof Error ? error.message : 'خطای نامشخص',
            });
          } finally {
            setWipeOpen(false);
          }
        }}
      />
    </div>
  );
}

function Fact({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div className="rounded-[var(--dm-radius-md)] border border-[rgb(var(--dm-border))] bg-[rgb(var(--dm-surface-sunken))] p-2">
      <p className="text-[0.65rem] text-[rgb(var(--dm-text-muted))]">{label}</p>
      <p className="dm-numeric text-sm font-bold">
        {toPersianDigits(formatNumber(value))} {unit ? <span className="text-xs font-normal opacity-70">{unit}</span> : null}
      </p>
    </div>
  );
}

function UsersPanel({ companyId }: { companyId: string }) {
  const users = useLiveQuery(() => listUsers(), [], undefined);
  const role = useAppStore((state) => state.role);
  const setRole = useAppStore((state) => state.setRole);
  const displayName = useAppStore((state) => state.displayName);
  const setDisplayName = useAppStore((state) => state.setDisplayName);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', username: '', password: '', role: 'accountant' as UserRole });
  const [pendingDelete, setPendingDelete] = useState<AppUser | null>(null);
  const { toast } = useToast();

  const permissions = useMemo(() => {
    const labels: Record<string, string> = {
      'employees:read': 'مشاهده کارکنان',
      'employees:write': 'ویرایش کارکنان',
      'attendance:write': 'ثبت کارکرد',
      'payroll:run': 'اجرای محاسبه حقوق',
      'payroll:lock': 'قفل و باز کردن دوره',
      'reports:export': 'خروجی‌های رسمی',
      'settings:write': 'تغییر تنظیمات',
      'backup:manage': 'پشتیبان‌گیری و بازیابی',
      'users:manage': 'مدیریت کاربران',
    };
    return Object.entries(ROLE_PERMISSIONS).map(([roleKey, list]) => ({
      roleKey,
      list,
      labels: list.map((permission) => labels[permission] ?? permission),
    }));
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle>کاربران سامانه</CardTitle>
            <CardDescription>
              نقش‌ها: مدیر سامانه، حسابدار و بازدیدکننده. گذرواژه‌ها با PBKDF2 (۳۱۰٫۰۰۰ تکرار) ذخیره می‌شوند.
            </CardDescription>
          </div>
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="size-4" />
            کاربر جدید
          </Button>
        </CardHeader>
        <CardContent>
          {!users ? (
            <Skeleton className="h-40 w-full" />
          ) : users.length === 0 ? (
            <p className="text-sm text-[rgb(var(--dm-text-subtle))]">
              کاربری ثبت نشده است؛ سامانه در حالت تک‌کاربره با نقش انتخابی زیر کار می‌کند.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>نام</TableHead>
                  <TableHead>نام کاربری</TableHead>
                  <TableHead>نقش</TableHead>
                  <TableHead>آخرین ورود</TableHead>
                  <TableHead className="w-16">حذف</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-semibold">{user.fullName}</TableCell>
                    <TableCell className="dm-numeric text-xs">{user.username}</TableCell>
                    <TableCell>
                      <Badge tone={user.role === 'admin' ? 'primary' : user.role === 'accountant' ? 'info' : 'neutral'}>
                        {user.role === 'admin' ? 'مدیر سامانه' : user.role === 'accountant' ? 'حسابدار' : 'بازدیدکننده'}
                      </Badge>
                    </TableCell>
                    <TableCell className="dm-numeric text-xs">
                      {user.lastLoginAt ? toPersianDigits(user.lastLoginAt.slice(0, 10)) : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`حذف کاربر ${user.fullName}`}
                        onClick={() => setPendingDelete(user)}
                      >
                        <Trash2 className="size-4 text-[rgb(var(--dm-danger))]" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>نقش فعال این دستگاه</CardTitle>
            <CardDescription>
              در نسخه آفلاین، سطح دسترسی از اینجا تعیین می‌شود؛ پس از اتصال به همگام‌سازی، نقش هر کاربر از سرور
              خوانده می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="نقش" htmlFor="active-role">
              <Select
                id="active-role"
                value={role}
                options={[
                  { value: 'admin', label: 'مدیر سامانه (دسترسی کامل)' },
                  { value: 'accountant', label: 'حسابدار (بدون مدیریت کاربران)' },
                  { value: 'viewer', label: 'بازدیدکننده (فقط مشاهده)' },
                ]}
                onChange={(event) => setRole(event.target.value as UserRole)}
              />
            </FormField>
            <FormField label="نام نمایشی در هدر" htmlFor="display-name">
              <Input
                id="display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </FormField>
            <Alert tone="info" title="محیط آزمایشی">
              برای آزمون دسترسی‌ها، نقش را تغییر دهید؛ همه عملیات نوشتن در گزارش رهگیری ثبت می‌شود.
            </Alert>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ماتریس دسترسی نقش‌ها</CardTitle>
            <CardDescription>بر پایه قانون «کمترین دسترسی لازم» و ثبت اجباری همه تغییرات.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {permissions.map((item) => (
              <div key={item.roleKey} className="rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold">
                  <ShieldCheck className="size-4 text-[rgb(var(--dm-primary))]" aria-hidden />
                  {item.roleKey === 'admin' ? 'مدیر سامانه' : item.roleKey === 'accountant' ? 'حسابدار' : 'بازدیدکننده'}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {item.labels.map((label) => (
                    <li key={label}>
                      <Badge tone="neutral">{label}</Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title="کاربر جدید"
          description="گذرواژه با PBKDF2-SHA256 و ۳۱۰٫۰۰۰ تکرار مشتق و ذخیره می‌شود."
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                انصراف
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await createUser({
                      fullName: form.fullName,
                      username: form.username,
                      role: form.role,
                      companyIds: companyId ? [companyId] : [],
                      password: form.password,
                    });
                    toast({ tone: 'success', title: 'کاربر ایجاد شد', description: `${form.fullName} اکنون می‌تواند وارد شود.` });
                    setForm({ fullName: '', username: '', password: '', role: 'accountant' });
                    setOpen(false);
                  } catch (error) {
                    toast({
                      tone: 'error',
                      title: 'ایجاد کاربر ناموفق بود',
                      description: error instanceof Error ? error.message : 'خطای نامشخص',
                    });
                  }
                }}
                disabled={!form.fullName || !form.username || form.password.length < 8}
              >
                ایجاد کاربر
              </Button>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="نام و نام خانوادگی" htmlFor="user-name" required>
              <Input
                id="user-name"
                value={form.fullName}
                onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              />
            </FormField>
            <FormField label="نام کاربری" htmlFor="user-username" required hint="حروف لاتین، بدون فاصله.">
              <Input
                id="user-username"
                dir="ltr"
                className="text-left"
                value={form.username}
                onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              />
            </FormField>
            <FormField label="گذرواژه" htmlFor="user-password" required hint="حداقل ۸ نویسه.">
              <Input
                id="user-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </FormField>
            <FormField label="نقش" htmlFor="user-role">
              <Select
                id="user-role"
                value={form.role}
                options={[
                  { value: 'admin', label: 'مدیر سامانه' },
                  { value: 'accountant', label: 'حسابدار' },
                  { value: 'viewer', label: 'بازدیدکننده' },
                ]}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}
              />
            </FormField>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(next) => {
          if (!next) setPendingDelete(null);
        }}
        title="حذف کاربر"
        description={`کاربر «${pendingDelete?.fullName ?? ''}» حذف می‌شود. حذف آخرین مدیر سامانه مجاز نیست.`}
        confirmLabel="حذف کن"
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteUser(pendingDelete.id);
            toast({ tone: 'success', title: 'کاربر حذف شد' });
          } catch (error) {
            toast({
              tone: 'error',
              title: 'حذف کاربر ناموفق بود',
              description: error instanceof Error ? error.message : 'خطای نامشخص',
            });
          } finally {
            setPendingDelete(null);
          }
        }}
      />
    </div>
  );
}

function AppearancePanel() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const currencyUnit = useAppStore((state) => state.currencyUnit);
  const setCurrencyUnit = useAppStore((state) => state.setCurrencyUnit);
  const persianDigits = useAppStore((state) => state.persianDigits);
  const setPersianDigits = useAppStore((state) => state.setPersianDigits);
  const { toast } = useToast();
  const settings = useLiveQuery(() => db.settings.get('app'), [], undefined) as AppSettings | undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>ظاهر برنامه</CardTitle>
          <CardDescription>تم روشن، تیره یا هم‌گام با تنظیم سیستم‌عامل؛ همه عناصر رنگ از نشان برند مشتق می‌شوند.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold text-[rgb(var(--dm-text-muted))]">تم نمایش</legend>
            {(
              [
                { value: 'light', label: 'روشن' },
                { value: 'dark', label: 'تیره' },
                { value: 'system', label: 'هم‌گام با سیستم' },
              ] as const
            ).map((option) => (
              <label key={option.value} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="theme"
                  value={option.value}
                  checked={theme === option.value}
                  onChange={() => setTheme(option.value)}
                  className="size-4 accent-[rgb(var(--dm-primary))]"
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <Separator />

          <FormField label="واحد نمایش مبالغ" htmlFor="currency-unit" hint="ذخیره‌سازی همیشه به ریال است؛ این گزینه فقط نمایش را تغییر می‌دهد.">
            <Select
              id="currency-unit"
              value={currencyUnit}
              options={[
                { value: 'IRR', label: 'ریال' },
                { value: 'IRT', label: 'تومان (نمایشی)' },
              ]}
              onChange={(event) => setCurrencyUnit(event.target.value as 'IRR' | 'IRT')}
            />
          </FormField>

          <Checkbox
            label="نمایش ارقام فارسی در رابط کاربری"
            checked={persianDigits}
            onChange={(event) => {
              setPersianDigits(event.target.checked);
              void saveSettings({ persianDigits: event.target.checked });
            }}
          />

          <Alert tone="info" title="خروجی‌های رسمی">
            در فایل‌های اکسل و دیسکت بیمه، ارقام همیشه لاتین و بدون جداکننده صادر می‌شوند تا در سامانه‌های رسمی
            قابل بارگذاری باشند.
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>زبان و منطقه</CardTitle>
          <CardDescription>زبان پیش‌فرض فارسی (fa-IR) با تقویم شمسی و راست‌چین کامل است.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))] p-3">
            <div>
              <p className="text-sm font-bold">فارسی (fa-IR)</p>
              <p className="text-xs text-[rgb(var(--dm-text-muted))]">زبان فعال، تقویم هجری شمسی، جهت راست‌به‌چپ</p>
            </div>
            <Badge tone="success">فعال</Badge>
          </div>
          <div className="flex items-center justify-between rounded-[var(--dm-radius-lg)] border border-dashed border-[rgb(var(--dm-border))] p-3">
            <div>
              <p className="text-sm font-bold">English (en-US)</p>
              <p className="text-xs text-[rgb(var(--dm-text-muted))]">
                ترجمه رابط در دست آماده‌سازی است؛ ساختار پیام‌ها (next-intl) از پیش تعبیه شده و افزودن زبان، بدون
                تغییر منطق محاسبات انجام می‌شود.
              </p>
            </div>
            <Badge tone="neutral">در دست توسعه</Badge>
          </div>

          <Separator />

          <div className="space-y-2 text-sm">
            <p className="font-bold">پیکربندی فعلی سامانه</p>
            <ul className="space-y-1 text-xs text-[rgb(var(--dm-text-muted))]">
              <li>
                حالت ذخیره‌سازی: {settings?.encryptionEnabled ? 'رمزنگاری‌شده' : 'عادی (IndexedDB روی همین دستگاه)'}
              </li>
              <li>
                پشتیبان خودکار: {' '}
                {settings && settings.autoBackupHours > 0
                  ? `هر ${toPersianDigits(settings.autoBackupHours)} ساعت`
                  : 'غیرفعال'}
              </li>
              <li>اعتبارسنجی خودکار فرم‌ها: فعال (React Hook Form + Zod + موتور اعتبارسنجی دامنه)</li>
              <li>هیچ داده‌ای بدون درخواست صریح شما به اینترنت ارسال نمی‌شود.</li>
            </ul>
          </div>

          <Button
            variant="outline"
            onClick={async () => {
              await saveSettings({ ...defaultSettings(), persianDigits, currencyUnit, theme });
              toast({ tone: 'success', title: 'تنظیمات پیش‌فرض بازنشانی شد' });
            }}
          >
            بازنشانی تنظیمات پیش‌فرض
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
