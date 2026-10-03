import { PROFILE_1403 } from './profiles/1403';
import { PROFILE_1404 } from './profiles/1404';
import { PROFILE_1405 } from './profiles/1405';
import type { LegalProfile, LegalProfiles } from './types';

/** All legal profiles bundled with the application, keyed by Jalali year. */
export const LEGAL_PROFILES: LegalProfiles = {
  1403: PROFILE_1403,
  1404: PROFILE_1404,
  1405: PROFILE_1405,
};

/** Years that have a bundled profile, newest last. */
export const SUPPORTED_YEARS: number[] = Object.keys(LEGAL_PROFILES)
  .map(Number)
  .sort((a, b) => a - b);

/** The profile used for new payroll runs by default. */
export const DEFAULT_PROFILE_YEAR = 1405;

/**
 * Returns the legal profile of a given Jalali year, falling back to the newest
 * available profile when the year is not bundled (the caller receives a warning
 * through the returned `fallback` flag).
 */
export function getLegalProfile(year: number): LegalProfile {
  const direct = LEGAL_PROFILES[year];
  if (direct) return direct;
  const newest = LEGAL_PROFILES[DEFAULT_PROFILE_YEAR];
  if (newest) return newest;
  throw new Error(`پروفایل حقوقی سال ${year} یافت نشد.`);
}

export interface ResolvedProfile {
  profile: LegalProfile;
  /** True when the requested year had to be substituted. */
  fallback: boolean;
  /** Persian warning suitable for the UI. */
  warning?: string;
}

/** Same as {@link getLegalProfile} but reports whether a fallback was used. */
export function resolveLegalProfile(year: number): ResolvedProfile {
  const profile = LEGAL_PROFILES[year];
  if (profile) return { profile, fallback: false };
  const fallbackProfile = LEGAL_PROFILES[DEFAULT_PROFILE_YEAR];
  if (!fallbackProfile) throw new Error(`پروفایل حقوقی سال ${year} یافت نشد.`);
  return {
    profile: fallbackProfile,
    fallback: true,
    warning: `پروفایل حقوقی سال ${year} در سامانه موجود نیست؛ ارقام پروفایل ${fallbackProfile.label} به کار گرفته شد. لطفاً پیش از تأیید نهایی، پارامترها را با بخشنامه همان سال تطبیق دهید.`,
  };
}

/**
 * A short deterministic fingerprint of a profile. It is stored on every payroll
 * run so that a run can be reproduced even after the profile is edited.
 */
export function legalProfileHash(profile: LegalProfile): string {
  const payload = JSON.stringify({
    year: profile.year,
    minDailyWage: profile.minDailyWage,
    housing: profile.housingAllowanceMonthly,
    grocery: profile.groceryAllowanceMonthly,
    marriage: profile.marriageAllowanceMonthly,
    child: profile.childAllowanceDaily,
    seniority: profile.seniorityDaily,
    overtime: profile.overtimeCoefficient,
    night: profile.nightWorkAllowanceRate,
    holiday: profile.holidayCoefficient,
    insurance: profile.insurance,
    tax: {
      monthlyExemption: profile.tax.monthlyExemption,
      brackets: profile.tax.brackets,
      flatSegments: profile.tax.flatSegments,
    },
  });
  // FNV-1a 32-bit, stable across runtimes (no crypto dependency in the packages).
  let hash = 0x811c9dc5;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `p${profile.year}-${hash.toString(16).padStart(8, '0')}`;
}
