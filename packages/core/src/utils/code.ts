/**
 * Deterministic short codes used for payslip verification (QR code content) and
 * for integrity checks of exported files. FNV-1a 32-bit is used because it is
 * dependency free, stable across runtimes and fast enough for batch payrolls.
 */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0').toUpperCase();
}

/**
 * Builds the verification code printed on a payslip, e.g. `DM-1405-07-3F2A1B9C`.
 * The code is a pure function of the payslip content, so any later edit of the
 * numbers invalidates it — an easy integrity check for HR and auditors.
 */
export function makeVerificationCode(parts: Array<string | number>, prefix = 'DM'): string {
  const payload = parts.join('|');
  const year = typeof parts[2] === 'number' ? parts[2] : '';
  const month = typeof parts[3] === 'number' ? String(parts[3]).padStart(2, '0') : '';
  return [prefix, year, month, fnv1a(payload)].filter(Boolean).join('-');
}

/** Stable code for a payroll run of a whole period, e.g. `RUN-1405-07-B41C9A02`. */
export function makeRunCode(jy: number, jm: number, version: number, payload: string): string {
  return `RUN-${jy}-${String(jm).padStart(2, '0')}-${fnv1a(`${payload}|v${version}`)}`;
}
