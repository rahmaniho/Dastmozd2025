/**
 * Rounding helpers. All payroll figures are stored in Rial and rounded with
 * `Math.round` (banker-style rounding is deliberately avoided to stay
 * predictable and reproducible against hand calculations).
 */

/** Rounds a monetary value to the nearest Rial. */
export function roundRial(value: number): number {
  return Math.round(value);
}

/** Rounds a monetary value to a configurable step (e.g. 1,000 Rial). */
export function roundToStep(value: number, step: number): number {
  if (step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

/** Multiplies and rounds in one step, guaranteeing integer Rial output. */
export function amountOf(rate: number, quantity: number, coefficient = 1): number {
  return Math.round(rate * quantity * coefficient);
}

/** Safe sum of a list of numeric values. */
export function sum(values: readonly number[]): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

/** Clamps a value into the inclusive range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Divides, guarding against division by zero. */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}
