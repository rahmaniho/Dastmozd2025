import type { BaseEntity, IranIban, JalaliPeriod, UserRole } from './common';

export interface CompanyAddress {
  province: string;
  city: string;
  postalCode: string;
  /** Full street address. */
  line: string;
}

export interface CompanyProfile extends BaseEntity {
  name: string;
  /** National identification / registration number (شماره ثبت). */
  registrationNumber?: string;
  /** Economic code (کد اقتصادی). */
  economicCode?: string;
  /** Social-security workshop code (کد کارگاه). */
  workshopCode?: string;
  /** Tax office code (کد اداره مالیات). */
  taxOfficeCode?: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: CompanyAddress;
  logoPath?: string;
  /** Base64 PNG signature of the managing director, used on payslips. */
  managerSignature?: string;
  managerName?: string;
  /** Default working settings for this company. */
  workSchedule: {
    /** Weekly working hours — 44 by law, 40 for some sectors. */
    weeklyHours: number;
    /** Shift start in HH:mm. */
    shiftStart: string;
    shiftEnd: string;
    /** Unpaid break in minutes. */
    breakMinutes: number;
    /** Days of the week that are the weekly rest (Jalali day indexes 0..6). */
    weeklyRestDays: number[];
    /** Rounding rule for the payable amount. */
    roundingStep: number;
  };
  /** Payroll preferences. */
  payroll: {
    /** Withhold insurance before income tax (default true). */
    insuranceBeforeTax: boolean;
    /** Pro-rate fixed benefits by working days. */
    prorateBenefits: boolean;
    /** Enable late/early-leave penalties. */
    latePenaltyEnabled: boolean;
    latePenaltyPerMinute?: number;
    /** Number of paid leave days granted per year (26 by law). */
    annualLeaveDays: number;
    /** Round final payable amount. */
    roundPayout: boolean;
  };
  isActive: boolean;
}

export interface AppUser extends BaseEntity {
  fullName: string;
  username: string;
  role: UserRole;
  /** Company the user has access to (multi-tenant ready). */
  companyIds: string[];
  /** Never store a plain password — only a PBKDF2 hash + salt. */
  passwordHash?: string;
  passwordSalt?: string;
  pinHash?: string;
  pinSalt?: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface AppSettings {
  id: 'app';
  theme: 'light' | 'dark' | 'system';
  locale: 'fa-IR' | 'en-US';
  currencyUnit: 'IRR' | 'IRT';
  /** Display Persian digits in the UI. */
  persianDigits: boolean;
  activeCompanyId: string | null;
  /** Active fiscal year (Jalali) — drives the default legal profile. */
  fiscalYear: number;
  /** Automatically encrypt local data at rest. */
  encryptionEnabled: boolean;
  /** Auto backup cadence in hours; 0 disables automatic backups. */
  autoBackupHours: number;
  /** Keep up to N daily backups. */
  backupRetention: { daily: number; monthly: number; yearly: number };
  /** Send anonymous crash reports — always false for PII safety. */
  analyticsEnabled: false;
  cloudSync: {
    enabled: boolean;
    supabaseUrl?: string;
    /** Publishable key only. End-to-end encryption is applied client-side. */
    supabaseAnonKey?: string;
    lastSyncedAt?: string;
    deviceId?: string;
  };
  sidebarCollapsed: boolean;
  updatedAt: string;
}

export interface FiscalYear {
  id: string;
  companyId: string;
  year: number;
  /** Period when the fiscal year was closed (locked for edits). */
  closedAt?: string;
  closedBy?: string;
  openingBalances?: Array<{ employeeId: string; leaveDays: number; loanBalance: number }>;
}

export interface LoanContract extends BaseEntity {
  employeeId: string;
  companyId: string;
  title: string;
  principal: number;
  installmentCount: number;
  /** First installment period. */
  startPeriod: JalaliPeriod;
  /** Installment amount in Rial (may include admin fee). */
  installmentAmount: number;
  paidInstallments: number;
  remainingBalance: number;
  status: 'active' | 'settled' | 'cancelled';
  guarantor?: string;
  notes?: string;
}

export interface BankAccountInfo {
  iban: IranIban;
  bankName: string;
  title: string;
}
