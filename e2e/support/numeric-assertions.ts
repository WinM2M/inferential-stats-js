/**
 * Numeric assertions shared by the reference-value suites
 * (`nist-strd.browser.test.ts`, `cross-check.browser.test.ts`).
 *
 * Both compare this SDK's output against values produced elsewhere, and both
 * need the same two things: a relative bound, because the quantities at stake
 * span many orders of magnitude, and a separate guard against a nonzero
 * reference coming back as exactly 0.
 */

import { expect } from 'vitest';

/** How close two values have to be. `absolute` wins where it is the larger bound. */
export interface Tolerance {
  relative?: number;
  absolute?: number;
}

export const relativeError = (actual: number, reference: number): number =>
  reference === 0 ? Math.abs(actual) : Math.abs((actual - reference) / reference);

const describeTolerance = (tolerance: Tolerance): string =>
  [
    tolerance.relative === undefined ? null : `${tolerance.relative.toExponential(0)} relative`,
    tolerance.absolute === undefined ? null : `${tolerance.absolute.toExponential(0)} absolute`,
  ]
    .filter(Boolean)
    .join(' or ');

/**
 * Passes if the value is within *either* bound. A reference transcribed from an
 * SPSS pivot table carries a quantization of half its last printed digit, which
 * no relative bound expresses: at 1e-3 printed to three decimals the relative
 * error of the quantization alone is 0.5. The absolute bound covers that end,
 * the relative bound covers large quantities, and a case supplying only one gets
 * only that one.
 */
export function expectCloseTo(
  actual: unknown,
  reference: number,
  tolerance: Tolerance,
  label: string,
): void {
  expect(typeof actual, `${label} should be a number, got ${typeof actual}`).toBe('number');
  const value = actual as number;

  if (!Number.isFinite(reference)) {
    expect(value, `${label}: reference is ${reference}`).toBe(reference);
    return;
  }

  const absolute = Math.abs(value - reference);
  const relative = relativeError(value, reference);
  const withinAbsolute = tolerance.absolute !== undefined && absolute <= tolerance.absolute;
  const withinRelative = tolerance.relative !== undefined && relative <= tolerance.relative;

  expect(
    withinAbsolute || withinRelative,
    `${label}: got ${value}, reference ${reference} — ` +
      `absolute ${absolute.toExponential(3)}, relative ${relative.toExponential(3)}, ` +
      `allowed ${describeTolerance(tolerance)}`,
  ).toBe(true);
}

/**
 * Kept as a guard after #12: a nonzero reference quantity coming back as exactly
 * 0 is the failure mode an output-rounding regression would reintroduce, and a
 * relative tolerance alone reports it as merely "100% off".
 */
export function expectNotFlattenedToZero(actual: unknown, reference: number, label: string): void {
  if (reference === 0) return;
  expect(actual, `${label}: reference ${reference} but the library returned exactly 0`).not.toBe(0);
}
