import type {
  BaseEntity,
  ContractType,
  EducationLevel,
  EmploymentStatus,
  Gender,
  IranIban,
  InsuranceNumber,
  JalaliDate,
  MaritalStatus,
  NationalId,
} from './common';

/** A dependent child, used for حق اولاد (child allowance, max 4 children). */
export interface EmployeeChild {
  id: string;
  /** First name — optional but recommended for insurance files. */
  firstName?: string;
  /** Jalali date of birth; used to check the 18-year legal age limit. */
  birthDate: JalaliDate;
  /** Disabled children are covered regardless of age (قانون حمایت از معلولان). */
  isDisabled?: boolean;
  /** Still studying → allowance continues past 18 (requires certificate). */
  isStudent?: boolean;
}

export interface EmployeeBankAccount {
  iban: IranIban;
  bankName: string;
  accountHolder?: string;
  /** Branch code/national bank code optional. */
  branchCode?: string;
}

export interface EmployeeSalaryStructure {
  /** Base monthly wage (پایه حقوق ماهانه) in Rial. */
  baseMonthly: number;
  /** Monthly seniority pay (پایه سنوات) in Rial. */
  seniorityMonthly: number;
  /** Monthly housing allowance override — when omitted the legal minimum is used. */
  housingMonthly?: number;
  /** Monthly grocery allowance override (بن کارگری). */
  groceryMonthly?: number;
  /** Monthly marriage allowance override (حق تأهل). */
  marriageMonthly?: number;
  /** Extra fixed monthly allowances defined by the company (subject to profile rules). */
  extraFixedAllowances?: Array<{
    title: string;
    amount: number;
    /** Legal component key so tax/insurance rules can be looked up. */
    componentKey?: string;
  }>;
}

export interface Employee extends BaseEntity {
  companyId: string;
  /** Unique personnel code (شماره پرسنلی). */
  personnelCode: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  nationalId: NationalId;
  idCardNumber: string;
  birthDate: JalaliDate;
  birthPlace?: string;
  gender: Gender;
  maritalStatus: MaritalStatus;
  children: EmployeeChild[];
  education: EducationLevel;
  /** Job position (سمت). */
  position: string;
  departmentId: string;
  /** Jalali hiring date. */
  hireDate: JalaliDate;
  /** Jalali termination date (if any). */
  terminationDate?: JalaliDate;
  contractType: ContractType;
  status: EmploymentStatus;
  /** Mandatory insurance number when the employee is insured. */
  insuranceNumber?: InsuranceNumber;
  insuranceStartDate?: JalaliDate;
  bankAccount?: EmployeeBankAccount;
  salary: EmployeeSalaryStructure;
  /** Free-form notes. */
  notes?: string;
}

export interface Department extends BaseEntity {
  companyId: string;
  title: string;
  /** Optional parent for a tree of organisational units. */
  parentId?: string | null;
  costCenter?: string;
}

/** Attendance / leave record kinds. */
export type AttendanceKind =
  | 'present' // عادی
  | 'overtime' // اضافه‌کار
  | 'night' // شب‌کاری
  | 'holiday' // تعطیل‌کاری
  | 'paid-leave' // مرخصی استحقاقی
  | 'sick-leave' // مرخصی استعلاجی
  | 'unpaid-leave' // مرخصی بدون حقوق
  | 'absence' // غیبت
  | 'mission' // مأموریت
  | 'remote' // دورکاری
  | 'unpaid-holiday'; // تعطیل غیررسمی/تعطیلات هفتگی

export interface AttendanceRecord extends BaseEntity {
  employeeId: string;
  /** Gregorian ISO date of the day the record belongs to. */
  date: string;
  /** Jalali equivalent, denormalised for fast reporting. */
  jalali: JalaliDate;
  kind: AttendanceKind;
  /** Check-in time in HH:mm (24h, local time). */
  checkIn?: string;
  checkOut?: string;
  /** Unpaid break in minutes (استراحت). */
  breakMinutes?: number;
  /** Total worked hours for the day (computed if omitted). */
  workedHours?: number;
  /** Overtime hours for the day. */
  overtimeHours?: number;
  /** Hours worked inside the legal night window (22:00–06:00). */
  nightHours?: number;
  /** Hours worked on Friday / official holiday. */
  holidayHours?: number;
  /** Multiplier for shift work (نوبت‌کاری). */
  shiftKind?: 'none' | 'morning' | 'evening' | 'night' | 'rotating';
  /** Minutes late vs. the configured shift start. */
  lateMinutes?: number;
  /** Minutes left early vs. the configured shift end. */
  earlyLeaveMinutes?: number;
  /** Paid/unpaid leave consumed in days (fractions allowed). */
  leaveDays?: number;
  /** Mission hours (can be a fraction of a day). */
  missionHours?: number;
  note?: string;
  /** Payroll run that consumed this record (locks it). */
  payrollRunId?: string | null;
}
