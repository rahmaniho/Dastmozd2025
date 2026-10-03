'use client';

import { toPersianDigits } from '@dastmozd/core';
import { deleteEmployee, restoreEmployee, getEmployee } from '@dastmozd/db';
import type { Employee } from '@dastmozd/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  EmptyState,
  IllustrationEmployees,
  Input,
  Money,
  PageHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
  useToast,
} from '@dastmozd/ui';
import { Download, FileSpreadsheet, Pencil, Plus, Search, Trash2, UserCircle2 } from 'lucide-react';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { EmployeeForm } from '@/components/employee-form';
import { EmployeeImportDialog } from '@/components/employee-import-dialog';
import { EmployeeProfileDialog } from '@/components/employee-profile-dialog';
import { EMPLOYEE_EXPORT_COLUMNS, exportToExcel } from '@/lib/excel';
import { useDepartments, useEmployees } from '@/lib/hooks';
import { useAppStore } from '@/lib/store';

const STATUS_OPTIONS = [
  { value: '', label: 'همه وضعیت‌ها' },
  { value: 'active', label: 'شاغل' },
  { value: 'inactive', label: 'غیرفعال' },
  { value: 'unpaid-leave', label: 'مرخصی بدون حقوق' },
  { value: 'terminated', label: 'تسویه‌شده' },
];

const STATUS_LABELS: Record<
  Employee['status'],
  { label: string; tone: 'success' | 'warning' | 'neutral' | 'danger' }
> = {
  active: { label: 'شاغل', tone: 'success' },
  inactive: { label: 'غیرفعال', tone: 'neutral' },
  'unpaid-leave': { label: 'مرخصی بدون حقوق', tone: 'warning' },
  terminated: { label: 'تسویه‌شده', tone: 'danger' },
};

function EmployeesPageInner() {
  const companyId = useAppStore((state) => state.companyId);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sort, setSort] = useState<{ field: keyof Employee; direction: 'asc' | 'desc' }>({
    field: 'lastName',
    direction: 'asc',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [profile, setProfile] = useState<Employee | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const { departments } = useDepartments();
  const result = useEmployees({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status ? { status: status as Employee['status'] } : {}),
    ...(departmentId ? { departmentId } : {}),
    sort,
    page,
    pageSize,
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditing(null);
      setFormOpen(true);
    }
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));
  const departmentName = useMemo(() => {
    const map = new Map(departments.map((department) => [department.id, department.title]));
    return (id: string) => map.get(id) ?? '—';
  }, [departments]);

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      const outcome = await deleteEmployee(target.id);
      toast({
        tone: outcome.soft ? 'warning' : 'success',
        title: outcome.soft ? 'کارمند غیرفعال شد' : 'کارمند حذف شد',
        description: outcome.soft
          ? 'به دلیل وجود فیش حقوقی، پرونده به‌صورت غیرفعال نگه داشته شد تا سابقه مالی حفظ شود.'
          : `${target.firstName} ${target.lastName} حذف شد.`,
        undoLabel: 'بازگردانی',
        onUndo: async () => {
          await restoreEmployee(target.id, { status: target.status });
          toast({
            tone: 'success',
            title: 'پرونده بازگردانی شد',
            description: 'وضعیت کارمند به حالت پیشین بازگشت.',
          });
        },
      });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'حذف ناموفق بود',
        description: error instanceof Error ? error.message : 'خطای نامشخص',
      });
    }
  };

  const openProfile = async (employee: Employee): Promise<void> => {
    const fresh = (await getEmployee(employee.id)) ?? employee;
    setProfile(fresh);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="کارکنان"
        description="ثبت، ویرایش، جست‌وجو و ورود گروهی پرونده‌های کارکنان؛ همه اطلاعات روی همین دستگاه ذخیره می‌شود."
        breadcrumb="دستمزد آرمانی ۱۴۰۵"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <FileSpreadsheet className="size-4" />
              ورود از اکسل
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                exportToExcel({
                  fileName: 'dastmozd-employees.xlsx',
                  sheetName: 'کارکنان',
                  columns: EMPLOYEE_EXPORT_COLUMNS,
                  rows: result.rows,
                  title: `فهرست کارکنان — ${toPersianDigits(result.total)} نفر`,
                });
                toast({ tone: 'success', title: 'خروجی اکسل آماده شد' });
              }}
              disabled={result.rows.length === 0}
            >
              <Download className="size-4" />
              خروجی اکسل
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" />
              کارمند جدید
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="pt-5">
          <div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr_auto]">
            <div className="relative">
              <Search
                className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[rgb(var(--dm-text-subtle))]"
                aria-hidden
              />
              <label className="sr-only" htmlFor="employee-search">
                جست‌وجوی کارکنان
              </label>
              <Input
                id="employee-search"
                className="pr-9"
                placeholder="جست‌وجو بر پایه نام، شماره پرسنلی یا کد ملی…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="employee-department">
                پالایش دپارتمان
              </label>
              <Select
                id="employee-department"
                value={departmentId}
                placeholder="همه دپارتمان‌ها"
                options={departments.map((department) => ({
                  value: department.id,
                  label: department.title,
                }))}
                onChange={(event) => {
                  setDepartmentId(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="sr-only" htmlFor="employee-status">
                پالایش وضعیت
              </label>
              <Select
                id="employee-status"
                value={status}
                options={STATUS_OPTIONS}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label
                className="text-xs text-[rgb(var(--dm-text-muted))]"
                htmlFor="employee-page-size"
              >
                نمایش
              </label>
              <Select
                id="employee-page-size"
                className="w-24"
                value={String(pageSize)}
                options={[10, 20, 50, 100].map((size) => ({
                  value: String(size),
                  label: `${toPersianDigits(size)} نفر`,
                }))}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          {result.total === 0 && !debouncedSearch ? (
            <EmptyState
              title="هنوز کارمندی ثبت نشده است"
              description="نخستین پرونده را دستی ثبت کنید یا فهرست کارکنان را از فایل اکسل وارد کنید."
              illustration={<IllustrationEmployees />}
              action={
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                  >
                    <Plus className="size-4" />
                    ثبت کارمند
                  </Button>
                  <Button variant="outline" onClick={() => setImportOpen(true)}>
                    ورود از اکسل
                  </Button>
                </div>
              }
            />
          ) : result.total === 0 ? (
            <EmptyState
              title="نتیجه‌ای یافت نشد"
              description="عبارت جست‌وجو یا پالایه‌ها را تغییر دهید."
              action={
                <Button
                  variant="outline"
                  onClick={() => {
                    setSearch('');
                    setStatus('');
                    setDepartmentId('');
                  }}
                >
                  پاک‌کردن پالایه‌ها
                </Button>
              }
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      label="نام و نام خانوادگی"
                      field="lastName"
                      sort={sort}
                      onSort={setSort}
                    />
                    <TableHead>شماره پرسنلی</TableHead>
                    <TableHead>کد ملی</TableHead>
                    <TableHead>دپارتمان</TableHead>
                    <TableHead>سمت</TableHead>
                    <SortableHead label="پایه حقوق" field="salary" sort={sort} onSort={setSort} />
                    <TableHead>وضعیت</TableHead>
                    <TableHead className="w-32">عملیات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.rows.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-right font-semibold hover:text-[rgb(var(--dm-primary))]"
                          onClick={() => void openProfile(employee)}
                        >
                          <UserCircle2
                            className="size-5 text-[rgb(var(--dm-text-subtle))]"
                            aria-hidden
                          />
                          {employee.firstName} {employee.lastName}
                        </button>
                      </TableCell>
                      <TableCell className="dm-numeric">
                        {toPersianDigits(employee.personnelCode)}
                      </TableCell>
                      <TableCell className="dm-numeric">
                        {toPersianDigits(employee.nationalId)}
                      </TableCell>
                      <TableCell>{departmentName(employee.departmentId)}</TableCell>
                      <TableCell>{employee.position}</TableCell>
                      <TableCell>
                        <Money value={employee.salary.baseMonthly} size="sm" />
                      </TableCell>
                      <TableCell>
                        <Badge tone={STATUS_LABELS[employee.status].tone}>
                          {STATUS_LABELS[employee.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`ویرایش پرونده ${employee.firstName} ${employee.lastName}`}
                            onClick={() => {
                              setEditing(employee);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`حذف پرونده ${employee.firstName} ${employee.lastName}`}
                            onClick={() => setPendingDelete(employee)}
                          >
                            <Trash2 className="size-4 text-[rgb(var(--dm-danger))]" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-[rgb(var(--dm-text-muted))]">
                  نمایش {toPersianDigits((page - 1) * pageSize + 1)} تا{' '}
                  {toPersianDigits(Math.min(page * pageSize, result.total))} از{' '}
                  {toPersianDigits(result.total)} نفر
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    قبلی
                  </Button>
                  <span className="dm-numeric px-3 text-xs">
                    صفحه {toPersianDigits(page)} از {toPersianDigits(totalPages)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  >
                    بعدی
                  </Button>
                </div>
              </div>
            </>
          )}

          {result.total === 0 && debouncedSearch ? <TableSkeleton rows={3} /> : null}
        </CardContent>
      </Card>

      {companyId ? (
        <EmployeeForm
          open={formOpen}
          onOpenChange={setFormOpen}
          companyId={companyId}
          departments={departments}
          editing={editing}
          onSaved={() => setPage(1)}
        />
      ) : null}

      <EmployeeProfileDialog
        employee={profile}
        onOpenChange={(open) => {
          if (!open) setProfile(null);
        }}
        onEdit={(employee) => {
          setProfile(null);
          setEditing(employee);
          setFormOpen(true);
        }}
      />

      <EmployeeImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        companyId={companyId ?? ''}
        departments={departments}
        onImported={() => setPage(1)}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="حذف پرونده کارمند"
        description={
          pendingDelete
            ? `آیا از حذف «${pendingDelete.firstName} ${pendingDelete.lastName}» اطمینان دارید؟ در صورت وجود فیش حقوقی، پرونده فقط غیرفعال می‌شود.`
            : ''
        }
        confirmLabel="حذف کن"
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SortableHead({
  label,
  field,
  sort,
  onSort,
}: {
  label: string;
  field: keyof Employee;
  sort: { field: keyof Employee; direction: 'asc' | 'desc' };
  onSort: (next: { field: keyof Employee; direction: 'asc' | 'desc' }) => void;
}) {
  const active = sort.field === field;
  return (
    <TableHead
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 font-semibold hover:text-[rgb(var(--dm-primary))]"
        onClick={() =>
          onSort({ field, direction: active && sort.direction === 'asc' ? 'desc' : 'asc' })
        }
      >
        {label}
        <span aria-hidden className="text-xs opacity-70">
          {active ? (sort.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </button>
    </TableHead>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} />}>
      <EmployeesPageInner />
    </Suspense>
  );
}
