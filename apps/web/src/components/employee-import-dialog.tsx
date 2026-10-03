'use client';

import { saveEmployee, type EmployeeInput } from '@dastmozd/db';
import type { Department } from '@dastmozd/types';
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  useToast,
} from '@dastmozd/ui';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import {
  downloadEmployeeTemplate,
  downloadImportIssues,
  previewEmployeeImport,
  type ImportIssue,
} from '@/lib/excel';

export interface EmployeeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  departments: Department[];
  onImported: () => void;
}

interface PreviewState {
  fileName: string;
  totalRows: number;
  issues: ImportIssue[];
  valid: Array<{ row: number; input: EmployeeInput; fullName: string }>;
}

/** ورود گروهی کارکنان از فایل اکسل همراه با گزارش اعتبارسنجی پیش از ثبت. */
export function EmployeeImportDialog({
  open,
  onOpenChange,
  companyId,
  departments,
  onImported,
}: EmployeeImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const reset = (): void => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = async (file: File): Promise<void> => {
    try {
      const buffer = await file.arrayBuffer();
      const result = previewEmployeeImport(buffer, {
        companyId,
        departments,
        defaults: { departmentId: departments[0]?.id ?? '' },
      });
      setPreview({
        fileName: file.name,
        totalRows: result.totalRows,
        issues: result.issues,
        valid: result.rows,
      });
      if (result.rows.length === 0 && result.issues.length === 0) {
        toast({
          tone: 'warning',
          title: 'فایل خالی است',
          description: 'هیچ سطر داده‌ای در فایل یافت نشد؛ قالب نمونه را بارگیری و تکمیل کنید.',
        });
      }
    } catch (error) {
      toast({
        tone: 'error',
        title: 'خواندن فایل ناموفق بود',
        description: error instanceof Error ? error.message : 'ساختار فایل پشتیبانی نمی‌شود.',
      });
    }
  };

  const importRows = async (): Promise<void> => {
    if (!preview) return;
    setBusy(true);
    let saved = 0;
    const failures: ImportIssue[] = [];
    for (const row of preview.valid) {
      try {
        await saveEmployee(row.input);
        saved += 1;
      } catch (error) {
        failures.push({
          row: row.row,
          field: 'ذخیره',
          message: error instanceof Error ? error.message : 'خطای نامشخص',
        });
      }
    }
    setBusy(false);
    setPreview({ ...preview, valid: [], issues: [...preview.issues, ...failures] });
    if (saved > 0) {
      toast({
        tone: 'success',
        title: `${saved} پرونده ثبت شد`,
        description:
          failures.length > 0
            ? `${failures.length} سطر ثبت نشد؛ گزارش خطاها را ببینید.`
            : 'همه سطرهای معتبر ثبت شدند.',
      });
      onImported();
      onOpenChange(false);
      reset();
    } else {
      toast({
        tone: 'error',
        title: 'هیچ سطری ثبت نشد',
        description: 'خطاهای گزارش‌شده را برطرف و فایل را دوباره بارگذاری کنید.',
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent
        size="wide"
        title="ورود گروهی کارکنان از اکسل"
        description="فایل اکسل یا CSV با سرواژه‌های استاندارد را بارگذاری کنید؛ پیش از ثبت، اعتبار همه سطرها بررسی می‌شود."
        footer={
          <>
            <Button variant="outline" onClick={downloadEmployeeTemplate}>
              <Download className="size-4" />
              قالب نمونه
            </Button>
            {preview && preview.issues.length > 0 ? (
              <Button variant="outline" onClick={() => downloadImportIssues(preview.issues)}>
                <Download className="size-4" />
                گزارش خطاها
              </Button>
            ) : null}
            <Button onClick={importRows} disabled={busy || !preview || preview.valid.length === 0}>
              {busy ? 'در حال ثبت…' : `ثبت ${preview ? preview.valid.length : 0} سطر معتبر`}
            </Button>
          </>
        }
      >
        <div className="rounded-[var(--dm-radius-lg)] border border-dashed border-[rgb(var(--dm-border-strong))] p-5 text-center">
          <FileSpreadsheet
            className="mx-auto mb-2 size-8 text-[rgb(var(--dm-primary))]"
            aria-hidden
          />
          <p className="mb-3 text-sm text-[rgb(var(--dm-text-muted))]">
            سطر اول فایل باید سرواژه داشته باشد؛ ستون‌های الزامی: شماره پرسنلی، نام، نام خانوادگی،
            نام پدر، کد ملی، شماره شناسنامه، سمت، دپارتمان، تاریخ استخدام.
          </p>
          <input
            ref={inputRef}
            id="employee-import-file"
            type="file"
            accept=".xlsx,.xls,.csv"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button asChild variant="secondary">
            <label htmlFor="employee-import-file" className="cursor-pointer">
              <Upload className="size-4" />
              انتخاب فایل
            </label>
          </Button>
        </div>

        {preview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="neutral">فایل: {preview.fileName}</Badge>
              <Badge tone="info">{preview.totalRows} سطر</Badge>
              <Badge tone="success">{preview.valid.length} سطر معتبر</Badge>
              <Badge tone={preview.issues.length > 0 ? 'danger' : 'neutral'}>
                {preview.issues.length} خطا
              </Badge>
            </div>

            {preview.issues.length > 0 ? (
              <Alert tone="warning" title="گزارش اعتبارسنجی">
                سطرهای دارای خطا ثبت نمی‌شوند. برای اصلاح، گزارش خطاها را بارگیری کنید یا مقدار
                ستون‌ها را مطابق قالب نمونه تنظیم کنید.
              </Alert>
            ) : null}

            {preview.issues.length > 0 ? (
              <div className="dm-scroll max-h-72 overflow-y-auto rounded-[var(--dm-radius-lg)] border border-[rgb(var(--dm-border))]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">سطر</TableHead>
                      <TableHead className="w-40">فیلد</TableHead>
                      <TableHead>پیام</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.issues.slice(0, 200).map((issue, index) => (
                      <TableRow key={`${issue.row}-${issue.field}-${index}`}>
                        <TableCell className="dm-numeric">{issue.row}</TableCell>
                        <TableCell>{issue.field}</TableCell>
                        <TableCell>{issue.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
