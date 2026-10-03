export type {
  ComponentRule,
  EidiRules,
  FlatTaxSegment,
  InsuranceRules,
  LeaveRules,
  LegalProfile,
  LegalProfiles,
  LegalSource,
  SeveranceRules,
  ShiftWorkRule,
  TaxBracket,
  TaxCategory,
  TaxRules,
} from './types';
export { DEFAULT_COMPONENTS, buildComponents } from './components';
export { PROFILE_1403 } from './profiles/1403';
export { PROFILE_1404 } from './profiles/1404';
export { PROFILE_1405 } from './profiles/1405';
export {
  DEFAULT_PROFILE_YEAR,
  LEGAL_PROFILES,
  SUPPORTED_YEARS,
  getLegalProfile,
  legalProfileHash,
  resolveLegalProfile,
} from './registry';
export type { ResolvedProfile } from './registry';
