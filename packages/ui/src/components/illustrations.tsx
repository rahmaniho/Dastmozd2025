/**
 * تصاویر حالت خالی (SVG درون‌خطی).
 * همه تصاویر تزئینی هستند (`aria-hidden`) و رنگ خود را از توکن‌های برند می‌گیرند،
 * بنابراین در تم روشن و تیره یکسان کار می‌کنند.
 */
import type { SVGProps } from 'react';

const BASE_PROPS: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 200 140',
  width: 200,
  height: 140,
  role: 'presentation',
  'aria-hidden': true,
  focusable: false,
};

const primary = 'rgb(var(--dm-primary))';
const primarySoft = 'rgb(var(--dm-primary-subtle))';
const accent = 'rgb(var(--dm-accent))';
const muted = 'rgb(var(--dm-border-strong))';
const surface = 'rgb(var(--dm-surface))';

/** کارکنان — پرونده خالی. */
export function IllustrationEmployees(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="24" y="18" width="152" height="104" rx="14" fill={primarySoft} />
      <rect x="48" y="34" width="104" height="72" rx="10" fill={surface} stroke={muted} />
      <circle cx="100" cy="60" r="14" fill={primary} opacity="0.85" />
      <path d="M78 96c4-12 12-18 22-18s18 6 22 18" fill="none" stroke={primary} strokeWidth="5" strokeLinecap="round" />
      <rect x="34" y="100" width="18" height="10" rx="5" fill={accent} />
    </svg>
  );
}

/** حضور و غیاب — تقویم خالی. */
export function IllustrationAttendance(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="30" y="26" width="140" height="94" rx="14" fill={surface} stroke={muted} />
      <rect x="30" y="26" width="140" height="26" rx="14" fill={primary} opacity="0.9" />
      <circle cx="54" cy="39" r="4" fill={surface} />
      <circle cx="146" cy="39" r="4" fill={surface} />
      {Array.from({ length: 12 }, (_, index) => (
        <rect
          key={index}
          x={44 + (index % 4) * 30}
          y={64 + Math.floor(index / 4) * 18}
          width="22"
          height="12"
          rx="4"
          fill={index % 5 === 0 ? accent : primarySoft}
          stroke={muted}
        />
      ))}
    </svg>
  );
}

/** محاسبه حقوق — برگه حقوق. */
export function IllustrationPayroll(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="46" y="18" width="108" height="112" rx="12" fill={surface} stroke={muted} />
      <rect x="60" y="34" width="80" height="8" rx="4" fill={primary} />
      {Array.from({ length: 6 }, (_, index) => (
        <rect key={index} x="60" y={54 + index * 12} width={index % 2 === 0 ? 80 : 56} height="6" rx="3" fill={primarySoft} />
      ))}
      <circle cx="148" cy="112" r="20" fill={accent} opacity="0.9" />
      <path d="M140 112l6 6 12-13" fill="none" stroke={surface} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** گزارش‌ها — نمودار. */
export function IllustrationReports(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <rect x="26" y="24" width="148" height="94" rx="14" fill={primarySoft} />
      <rect x="44" y="82" width="18" height="24" rx="6" fill={primary} />
      <rect x="72" y="64" width="18" height="42" rx="6" fill={primary} opacity="0.8" />
      <rect x="100" y="50" width="18" height="56" rx="6" fill={accent} />
      <rect x="128" y="70" width="18" height="36" rx="6" fill={primary} opacity="0.6" />
      <path d="M44 44h100" stroke={muted} strokeDasharray="6 6" strokeWidth="2" />
    </svg>
  );
}

/** جست‌وجوی بی‌نتیجه. */
export function IllustrationNoResults(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="88" cy="62" r="34" fill={surface} stroke={primary} strokeWidth="6" />
      <path d="M112 86l30 30" stroke={primary} strokeWidth="8" strokeLinecap="round" />
      <path d="M74 62h28" stroke={accent} strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}

/** خطا یا قطع ارتباط. */
export function IllustrationError(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <path d="M100 22l64 96H36z" fill={primarySoft} stroke={accent} strokeWidth="5" strokeLinejoin="round" />
      <path d="M100 58v28" stroke={accent} strokeWidth="7" strokeLinecap="round" />
      <circle cx="100" cy="98" r="5" fill={accent} />
    </svg>
  );
}

/** خوش‌آمدگویی داشبورد — سکه، چرخ‌دنده و برگ. */
export function IllustrationWelcome(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...BASE_PROPS} {...props}>
      <circle cx="88" cy="70" r="34" fill={primarySoft} />
      <circle cx="88" cy="70" r="34" fill="none" stroke={primary} strokeWidth="4" strokeDasharray="9 11" />
      <circle cx="88" cy="70" r="22" fill={surface} stroke={muted} />
      <path d="M104 52c-12 3-18 9-18 22 10-2 15-9 18-22z" fill={primary} />
      <circle cx="150" cy="96" r="16" fill={accent} opacity="0.9" />
    </svg>
  );
}

export const illustrations = {
  employees: IllustrationEmployees,
  attendance: IllustrationAttendance,
  payroll: IllustrationPayroll,
  reports: IllustrationReports,
  noResults: IllustrationNoResults,
  error: IllustrationError,
  welcome: IllustrationWelcome,
} as const;
