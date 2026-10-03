'use client';

import { Document, Font, Image, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import { formatNumber, formatPersianNumber, rialInWords, toPersianDigits } from '@dastmozd/core';
import type { CompanyProfile, Employee, Payslip } from '@dastmozd/types';
import type { LegalProfile } from '@dastmozd/legal';
import QRCode from 'qrcode';
import { exportToExcel, type ExportColumn } from './excel';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

let fontsRegistered = false;

/** ثبت قلم وزیرمتن برای PDF؛ قلم‌ها خودمیزبان و بدون CDN هستند. */
function registerFonts(): void {
  if (fontsRegistered) return;
  Font.register({
    family: 'Vazirmatn',
    fonts: [
      { src: `${basePath}/fonts/Vazirmatn-Regular.ttf`, fontWeight: 'normal' },
      { src: `${basePath}/fonts/Vazirmatn-Bold.ttf`, fontWeight: 'bold' },
    ],
  });
  // شکستن کلمات فارسی با نیم‌فاصله/خط تیره پیاده‌سازی می‌شود، نه با hyphenation لاتین.
  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
}

const styles = StyleSheet.create({
  page: {
    direction: 'rtl',
    fontFamily: 'Vazirmatn',
    fontSize: 9,
    paddingTop: 28,
    paddingBottom: 34,
    paddingHorizontal: 28,
    color: '#10212b',
    backgroundColor: '#ffffff',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  companyBlock: { maxWidth: '58%' },
  companyName: { fontSize: 13, fontWeight: 'bold', marginBottom: 3 },
  muted: { color: '#5b6b73' },
  title: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  box: { borderWidth: 0.6, borderColor: '#c9d6db', borderRadius: 4, padding: 7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  rowBox: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '48%', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#e6f4f3', paddingVertical: 4, paddingHorizontal: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.4, borderBottomColor: '#dde7ea', paddingVertical: 3, paddingHorizontal: 4 },
  colTitle: { width: '46%' },
  colQty: { width: '20%', textAlign: 'center' },
  colAmount: { width: '34%', textAlign: 'left' },
  tableTitle: { fontSize: 9.5, fontWeight: 'bold', marginTop: 8, marginBottom: 4 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  summaryLabel: { color: '#3c4c54' },
  summaryValue: { fontWeight: 'bold' },
  netBox: { marginTop: 8, borderWidth: 0.8, borderColor: '#0d9488', borderRadius: 4, padding: 8, backgroundColor: '#f1faf9' },
  netLabel: { fontSize: 10, fontWeight: 'bold', color: '#0f766e' },
  netValue: { fontSize: 12, fontWeight: 'bold', color: '#0f766e' },
  words: { marginTop: 3, fontSize: 8, color: '#3c4c54' },
  qr: { width: 74, height: 74 },
  footer: { position: 'absolute', bottom: 18, left: 28, right: 28, fontSize: 7.5, color: '#5b6b73' },
  signatureRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  signature: { width: '30%', borderTopWidth: 0.5, borderTopColor: '#9fb2b9', paddingTop: 3, textAlign: 'center', fontSize: 7.5 },
  badge: { fontSize: 8, color: '#0f766e' },
});

export interface PayslipDocumentInput {
  payslip: Payslip;
  employee: Employee;
  company: CompanyProfile;
  profile: LegalProfile;
}

function jalaliText(date: { jy: number; jm: number; jd: number }): string {
  return `${toPersianDigits(date.jy)}/${toPersianDigits(String(date.jm).padStart(2, '0'))}/${toPersianDigits(
    String(date.jd).padStart(2, '0'),
  )}`;
}

/** یک صفحه فیش حقوقی؛ شامل اقلام، جمع‌ها، موضوع مالیات و کد رهگیری با QR. */
function PayslipPage({
  payslip,
  employee,
  company,
  profile,
  qrDataUrl,
}: PayslipDocumentInput & { qrDataUrl: string }) {
  const periodLabel = `${jalaliText({ jy: payslip.period.jy, jm: payslip.period.jm, jd: 1 })} تا ${jalaliText({
    jy: payslip.period.jy,
    jm: payslip.period.jm,
    jd: payslip.period.jm <= 6
      ? 31
      : payslip.period.jm <= 11
        ? 30
        : 29,
  })}`;

  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View style={styles.companyBlock}>
          <Text style={styles.companyName}>{company.name}</Text>
          {company.registrationNumber ? (
            <Text style={styles.muted}>شماره ثبت: {toPersianDigits(company.registrationNumber)}</Text>
          ) : null}
          {company.economicCode ? (
            <Text style={styles.muted}>کد اقتصادی: {toPersianDigits(company.economicCode)}</Text>
          ) : null}
          {company.address ? (
            <Text style={styles.muted}>
              {company.address.city} — {company.address.line}
            </Text>
          ) : null}
          {company.phone ? <Text style={styles.muted}>تلفن: {toPersianDigits(company.phone)}</Text> : null}
        </View>
        <View style={{ alignItems: 'center' }}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Text style={styles.badge}>فیش حقوق و دستمزد</Text>
          <Text style={styles.muted}>دوره: {periodLabel}</Text>
          <Text style={styles.muted}>نسخه: {toPersianDigits(payslip.period.jm)}/{toPersianDigits(payslip.period.jy)}</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Image src={qrDataUrl} style={styles.qr} />
          <Text style={styles.muted}>{payslip.verificationCode}</Text>
        </View>
      </View>

      <View style={styles.box}>
        <View style={styles.rowBox}>
          <View style={styles.cell}>
            <Text style={styles.muted}>نام و نام خانوادگی</Text>
            <Text style={{ fontWeight: 'bold' }}>
              {employee.firstName} {employee.lastName}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.muted}>شماره پرسنلی</Text>
            <Text>{toPersianDigits(employee.personnelCode)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.muted}>کد ملی</Text>
            <Text>{toPersianDigits(employee.nationalId)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.muted}>شماره بیمه</Text>
            <Text>{employee.insuranceNumber ? toPersianDigits(employee.insuranceNumber) : '—'}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.muted}>سمت</Text>
            <Text>{employee.position}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.muted}>تاریخ استخدام</Text>
            <Text>{jalaliText(employee.hireDate)}</Text>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <View style={{ width: '50%' }}>
          <Text style={styles.tableTitle}>مزایا و دریافتی‌ها</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colTitle}>عنوان</Text>
            <Text style={styles.colQty}>مقدار</Text>
            <Text style={styles.colAmount}>مبلغ (ریال)</Text>
          </View>
          {payslip.earnings.map((line, index) => (
            <View key={`${line.key}-${index}`} style={styles.tableRow} wrap={false}>
              <Text style={styles.colTitle}>{line.title}</Text>
              <Text style={styles.colQty}>
                {line.quantity !== undefined ? formatNumber(Math.round(line.quantity * 100) / 100) : '—'}
              </Text>
              <Text style={styles.colAmount}>{formatNumber(line.amount)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { backgroundColor: '#f1faf9' }]} wrap={false}>
            <Text style={styles.colTitle}>جمع مزایا</Text>
            <Text style={styles.colQty}>—</Text>
            <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>
              {formatNumber(payslip.totals.grossEarnings)}
            </Text>
          </View>
        </View>

        <View style={{ width: '50%' }}>
          <Text style={styles.tableTitle}>کسورات</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.colTitle}>عنوان</Text>
            <Text style={styles.colQty}>مبنای محاسبه</Text>
            <Text style={styles.colAmount}>مبلغ (ریال)</Text>
          </View>
          {payslip.deductions.map((line, index) => (
            <View key={`${line.key}-${index}`} style={styles.tableRow} wrap={false}>
              <Text style={styles.colTitle}>{line.title}</Text>
              <Text style={styles.colQty}>
                {line.quantity !== undefined ? formatNumber(line.quantity) : '—'}
              </Text>
              <Text style={styles.colAmount}>{formatNumber(line.amount)}</Text>
            </View>
          ))}
          <View style={[styles.tableRow, { backgroundColor: '#fdf0ec' }]} wrap={false}>
            <Text style={styles.colTitle}>جمع کسورات</Text>
            <Text style={styles.colQty}>—</Text>
            <Text style={[styles.colAmount, { fontWeight: 'bold' }]}>
              {formatNumber(payslip.totals.totalDeductions)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.netBox}>
        <View style={styles.row}>
          <Text style={styles.netLabel}>خالص پرداختی</Text>
          <Text style={styles.netValue}>{formatNumber(payslip.totals.netPay)} ریال</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.summaryLabel}>مبلغ قابل پرداخت (گرد شده)</Text>
          <Text style={styles.summaryValue}>{formatNumber(payslip.totals.payableAmount)} ریال</Text>
        </View>
        <Text style={styles.words}>{rialInWords(payslip.totals.payableAmount)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <View style={[styles.box, { width: '50%' }]}>
          <Text style={styles.tableTitle}>محاسبه بیمه تأمین اجتماعی</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>پایه بیمه</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.insurance.base)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سهم کارمند (۷٪)</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.insurance.employeeShare)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>سهم کارفرما (۲۳٪)</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.insurance.employerShare)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>جمع پرداختی به سازمان</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.insurance.totalShare)} ریال</Text>
          </View>
          <Text style={[styles.muted, { fontSize: 7.5, marginTop: 3 }]}>
            سقف بیمه این دوره: {formatNumber(payslip.insurance.ceiling)} ریال
          </Text>
        </View>

        <View style={[styles.box, { width: '50%' }]}>
          <Text style={styles.tableTitle}>مالیات بر درآمد حقوق</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>مشمول مالیات</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.tax.taxableIncome)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>معافیت ماهانه</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.tax.exemption)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>درآمد مشمول پس از معافیت</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.tax.afterExemption)} ریال</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>مالیات</Text>
            <Text style={styles.summaryValue}>{formatNumber(payslip.tax.total)} ریال</Text>
          </View>
          <Text style={[styles.muted, { fontSize: 7.5, marginTop: 3 }]}>
            نرخ مؤثر: {toPersianDigits(Math.round(payslip.tax.effectiveRate * 1000) / 10)}٪ — پروفایل حقوقی{' '}
            {profile.label}
          </Text>
        </View>
      </View>

      <View style={styles.signatureRow}>
        <Text style={styles.signature}>مهر و امضای کارفرما</Text>
        <Text style={styles.signature}>امضای کارمند</Text>
        <Text style={styles.signature}>امور مالی</Text>
      </View>

      <Text style={styles.footer} fixed>
        این فیش بر پایه پروفایل حقوقی {profile.label} ({profile.description}) صادر شده است. کد رهگیری:{' '}
        {payslip.verificationCode} — بازبینی گام‌به‌گام اقلام از طریق گزارش محاسبه در سامانه ممکن است.
      </Text>
    </Page>
  );
}

/** ساخت فایل PDF فیش‌های حقوقی (یک صفحه برای هر کارمند). */
export async function buildPayslipsPdf(inputs: PayslipDocumentInput[]): Promise<Blob> {
  registerFonts();
  const qrCodes = await Promise.all(
    inputs.map((input) =>
      QRCode.toDataURL(
        [
          `dastmozd:${input.payslip.verificationCode}`,
          `id:${input.payslip.employeeId}`,
          `period:${input.payslip.period.jy}-${input.payslip.period.jm}`,
        ].join('|'),
        { width: 150, margin: 1, errorCorrectionLevel: 'M' },
      ),
    ),
  );

  return pdf(
    <Document
      title={`فیش حقوقی ${inputs[0]?.company.name ?? ''}`}
      author={inputs[0]?.company.name ?? 'دستمزد آرمانی'}
      creator="دستمزد آرمانی ۱۴۰۵"
      producer="Dastmozd-e Armani"
    >
      {inputs.map((input, index) => (
        <PayslipPage key={input.payslip.id} {...input} qrDataUrl={qrCodes[index] ?? ''} />
      ))}
    </Document>,
  ).toBlob();
}

/** بارگیری PDF فیش‌های انتخابی. */
export async function downloadPayslipsPdf(inputs: PayslipDocumentInput[], fileName: string): Promise<void> {
  const blob = await buildPayslipsPdf(inputs);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** نمایش فیش در پنجره چاپ مرورگر (چاپ کاغذی یا ذخیره به‌عنوان PDF). */
export async function printPayslips(inputs: PayslipDocumentInput[]): Promise<void> {
  const blob = await buildPayslipsPdf(inputs);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ------------------------------------------------------- لیست بیمه (فایل DSK) */

export interface InsuranceFileInput {
  payslips: Payslip[];
  employees: Employee[];
  company: CompanyProfile;
  jy: number;
  jm: number;
}

export interface InsuranceFileResult {
  fileName: string;
  content: string;
  /** تعداد رکوردهای بیمه‌شده در فایل. */
  recordCount: number;
  /** جمع مبلغ حق بیمه سهم کارکنان و کارفرما. */
  totalInsurance: number;
  warnings: string[];
}

/**
 * ساخت «دیسکت بیمه» تأمین اجتماعی.
 *
 * ساختار فایل ثابت‌عرض است: یک رکورد سرآیند (H)، سپس یک رکورد برای هر کارمند
 * بیمه‌شده (D) و در پایان رکورد جمع (T). طول هر فیلد ثابت و بر پایه شماره
 * کارگاه، شماره بیمه، کد ملی، روزهای کارکرد، مبلغ کل دستمزد و مزد روزانه است.
 * پیش از ارسال به سازمان، ساختار فایل را با نسخه روز سامانه «تأمین اجتماعی من»
 * تطبیق دهید (جزئیات در docs/LEGAL.md).
 */
export function buildInsuranceDiskette(input: InsuranceFileInput): InsuranceFileResult {
  const { payslips, employees, company, jy, jm } = input;
  const pad = (value: string | number, length: number): string => String(value).padStart(length, ' ').slice(-length);
  const zero = (value: number, length: number): string => String(Math.round(value)).padStart(length, '0').slice(-length);
  const period = `${jy}${String(jm).padStart(2, '0')}`;
  const lines: string[] = [];
  const insured = payslips.filter((slip) => slip.insurance.base > 0);
  const warnings: string[] = [];

  lines.push(
    [
      'H',
      zero(Number((company.workshopCode ?? '').replace(/\D/g, '') || 0), 10),
      pad(company.name, 30),
      period,
      zero(insured.length, 5),
      zero(insured.reduce((total, slip) => total + slip.insurance.base, 0), 12),
      zero(
        insured.reduce((total, slip) => total + slip.insurance.employeeShare + slip.insurance.employerShare, 0),
        12,
      ),
    ].join(''),
  );

  for (const [index, slip] of insured.entries()) {
    const employee = employees.find((item) => item.id === slip.employeeId);
    if (!employee) {
      warnings.push(`کارمند متناظر فیش ${slip.verificationCode} یافت نشد و در فایل درج نشد.`);
      continue;
    }
    if (!employee.insuranceNumber) {
      warnings.push(`${employee.firstName} ${employee.lastName}: شماره بیمه ثبت نشده است.`);
    }
    if (!employee.nationalId) {
      warnings.push(`${employee.firstName} ${employee.lastName}: کد ملی ثبت نشده است.`);
    }
    const baseLine = slip.earnings.find((line) => line.key === 'base-wage');
    const workedDays = Math.min(31, Math.max(0, Math.round(baseLine?.quantity ?? 30)));
    lines.push(
      [
        'D',
        zero(index + 1, 4),
        zero(employee.insuranceNumber ? Number(employee.insuranceNumber.replace(/\D/g, '')) : 0, 12),
        zero(Number(employee.nationalId.replace(/\D/g, '') || 0), 10),
        pad(employee.lastName, 25),
        pad(employee.firstName, 20),
        zero(employee.hireDate.jy * 10000 + employee.hireDate.jm * 100 + employee.hireDate.jd, 8),
        zero(workedDays, 2),
        zero(slip.insurance.base, 12),
        zero(Math.round(slip.insurance.base / Math.max(workedDays, 1)), 10),
        zero(slip.insurance.employeeShare, 10),
        zero(slip.insurance.employerShare, 10),
      ].join(''),
    );
  }

  const totalEmployee = insured.reduce((total, slip) => total + slip.insurance.employeeShare, 0);
  const totalEmployer = insured.reduce((total, slip) => total + slip.insurance.employerShare, 0);
  lines.push(
    [
      'T',
      zero(insured.length, 5),
      zero(totalEmployee, 12),
      zero(totalEmployer, 12),
      zero(totalEmployee + totalEmployer, 12),
    ].join(''),
  );

  return {
    fileName: `DSK-${period}.txt`,
    content: lines.join('\r\n'),
    recordCount: insured.length,
    totalInsurance: totalEmployee + totalEmployer,
    warnings,
  };
}

/** بارگیری فایل دیسکت بیمه. */
export function downloadInsuranceDiskette(result: InsuranceFileResult): void {
  const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------ فایل مالیات (سازمان امور مالیاتی) */

export interface TaxFileInput {
  payslips: Payslip[];
  employees: Employee[];
  jy: number;
  jm: number;
  companyName: string;
}

/** خروجی اکسل لیست مالیات حقوق برای بارگذاری در سامانه سازمان امور مالیاتی. */
export function downloadTaxExcel(input: TaxFileInput): void {
  const rows = input.payslips.map((slip) => ({
    slip,
    employee: input.employees.find((item) => item.id === slip.employeeId),
  }));

  const columns: Array<ExportColumn<{ slip: Payslip; employee?: Employee; index: number }>> = [
    { header: 'ردیف', value: (row) => row.index, width: 6 },
    { header: 'شماره پرسنلی', value: (row) => row.employee?.personnelCode ?? '', width: 14 },
    { header: 'نام و نام خانوادگی', value: (row) => `${row.employee?.firstName ?? ''} ${row.employee?.lastName ?? ''}`, width: 26 },
    { header: 'کد ملی', value: (row) => `="${row.employee?.nationalId ?? ''}"`, width: 16 },
    { header: 'شماره بیمه', value: (row) => row.employee?.insuranceNumber ?? '', width: 16 },
    { header: 'جمع حقوق و مزایا (ریال)', value: (row) => row.slip.totals.grossEarnings, width: 20 },
    { header: 'مزایای معاف (ریال)', value: (row) => Math.max(0, row.slip.totals.grossEarnings - row.slip.tax.taxableIncome), width: 20 },
    { header: 'مشمول مالیات (ریال)', value: (row) => row.slip.tax.taxableIncome, width: 20 },
    { header: 'معافیت ماهانه (ریال)', value: (row) => row.slip.tax.exemption, width: 20 },
    { header: 'درآمد مشمول پس از معافیت (ریال)', value: (row) => row.slip.tax.afterExemption, width: 24 },
    { header: 'مالیات (ریال)', value: (row) => row.slip.tax.total, width: 18 },
    { header: 'پایه بیمه (ریال)', value: (row) => row.slip.insurance.base, width: 18 },
  ];

  const enriched = rows.map((row, index) => ({ ...row, index: index + 1 }));
  exportToExcel({
    fileName: `dastmozd-tax-${input.jy}-${String(input.jm).padStart(2, '0')}.xlsx`,
    sheetName: 'لیست مالیات حقوق',
    columns,
    rows: enriched,
    title: `لیست مالیات بر درآمد حقوق — ${input.companyName} — دوره ${toPersianDigits(input.jm)}/${toPersianDigits(input.jy)}`,
  });
}

/* ------------------------------------------------------------ گزارش‌های خلاصه */

export interface SummaryFileInput {
  payslips: Payslip[];
  employees: Employee[];
  companyName: string;
  jy: number;
  jm: number;
}

/** خروجی اکسل خلاصه ماهانه حقوق و هزینه کارفرما. */
export function downloadMonthlySummaryExcel(input: SummaryFileInput): void {
  interface Row {
    section: string;
    title: string;
    value: number;
    note: string;
  }

  const totals = input.payslips.reduce(
    (acc, slip) => ({
      gross: acc.gross + slip.totals.grossEarnings,
      tax: acc.tax + slip.tax.total,
      employeeInsurance: acc.employeeInsurance + slip.insurance.employeeShare,
      employerInsurance: acc.employerInsurance + slip.insurance.employerShare,
      net: acc.net + slip.totals.netPay,
      employerCost: acc.employerCost + slip.employerCost.total,
      otherDeductions: acc.otherDeductions + slip.totals.otherDeductions,
    }),
    {
      gross: 0,
      tax: 0,
      employeeInsurance: 0,
      employerInsurance: 0,
      net: 0,
      employerCost: 0,
      otherDeductions: 0,
    },
  );

  const rows: Row[] = [
    { section: 'جمع‌ها', title: 'کارکنان مشمول', value: input.payslips.length, note: 'نفر' },
    { section: 'جمع‌ها', title: 'جمع حقوق و مزایا', value: totals.gross, note: 'ریال' },
    { section: 'جمع‌ها', title: 'بیمه سهم کارکنان (۷٪)', value: totals.employeeInsurance, note: 'ریال' },
    { section: 'جمع‌ها', title: 'بیمه سهم کارفرما (۲۳٪)', value: totals.employerInsurance, note: 'ریال' },
    { section: 'جمع‌ها', title: 'مالیات بر درآمد', value: totals.tax, note: 'ریال' },
    { section: 'جمع‌ها', title: 'سایر کسورات', value: totals.otherDeductions, note: 'ریال' },
    { section: 'جمع‌ها', title: 'خالص پرداختی', value: totals.net, note: 'ریال' },
    { section: 'جمع‌ها', title: 'هزینه تمام‌شده کارفرما', value: totals.employerCost, note: 'ریال' },
  ];

  exportToExcel({
    fileName: `dastmozd-summary-${input.jy}-${String(input.jm).padStart(2, '0')}.xlsx`,
    sheetName: 'خلاصه ماهانه',
    columns: [
      { header: 'بخش', value: (row: Row) => row.section, width: 14 },
      { header: 'عنوان', value: (row: Row) => row.title, width: 34 },
      { header: 'مقدار', value: (row: Row) => row.value, width: 20 },
      { header: 'توضیح', value: (row: Row) => row.note, width: 12 },
    ],
    rows,
    title: `خلاصه حقوق و دستمزد — ${input.companyName} — ${toPersianDigits(input.jm)}/${toPersianDigits(input.jy)}`,
  });
}
