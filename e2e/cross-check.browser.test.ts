/**
 * Cross-check against R and IBM SPSS Statistics.
 *
 * `nist-strd.browser.test.ts` covers the two procedures NIST certifies. This
 * file covers the rest, against the two packages researchers actually compare
 * their results to. Both reference fixtures carry the same schema, so one body
 * reads either; see `docs/validation/cross-check-r-spss.md` for the design and
 * `scripts/generate-r-reference.R` for how the R side is produced.
 *
 * Every case declares a `status`, and the status decides how it runs:
 *
 *   check               R/SPSS and this SDK must agree. A failure is a defect.
 *   known-defect        A filed issue already explains the disagreement.
 *   convention-pending  Both are right for their own definition of the statistic;
 *                       which one this SDK should follow is not yet decided.
 *
 * The last two run as `it.fails`, the same device Longley uses in the NIST file:
 * the suite is green while a divergence is open and documented, and turns red the
 * moment that divergence is silently fixed or silently worsened. Resolving one
 * means changing its status and moving the decision into README "Numerical
 * Accuracy" — not loosening a tolerance.
 *
 * `expected` keys are this SDK's own output field names, and only the keys a case
 * names are compared, so a reference fixture never has to mirror a whole result.
 */

import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { InferentialStats } from '../src/index';
import {
  expectCloseTo,
  expectNotFlattenedToZero,
  type Tolerance,
} from './support/numeric-assertions';
import rReference from './fixtures/cross-check/r-reference.json';

const workerUrl = new URL('../dist/stats-worker.js', import.meta.url).href;

/**
 * The CSVs are loaded as text and parsed here rather than committed as JSON, so
 * that this SDK, R and SPSS all read the identical bytes. A copy converted to
 * JSON for the browser would no longer be the file the other two saw.
 */
const csvFiles = import.meta.glob('./fixtures/cross-check/data/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

type Row = Record<string, unknown>;

/**
 * Enough CSV for `write.csv`'s output: quoted fields, doubled quotes inside them,
 * no embedded newlines. Fields that parse as numbers become numbers, because the
 * group values in `input` are typed (issue #8) and a group of `0` must not be
 * matched against a string `"0"`.
 */
function parseCsv(text: string): Row[] {
  const splitLine = (line: string): string[] => {
    const fields: string[] = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (quoted) {
        if (char === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            quoted = false;
          }
        } else {
          field += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ',') {
        fields.push(field);
        field = '';
      } else {
        field += char;
      }
    }
    fields.push(field);
    return fields;
  };

  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  const header = splitLine(lines[0]);
  return lines.slice(1).map((line) => {
    const fields = splitLine(line);
    const row: Row = {};
    header.forEach((name, index) => {
      const raw = fields[index] ?? '';
      // `na = ""` on the R side writes a missing value as an empty field.
      if (raw === '') {
        row[name] = null;
        return;
      }
      const asNumber = Number(raw);
      row[name] = Number.isNaN(asNumber) ? raw : asNumber;
    });
    return row;
  });
}

const datasets: Record<string, Row[]> = Object.fromEntries(
  Object.entries(csvFiles).map(([path, text]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.csv'.length),
    parseCsv(text),
  ]),
);

interface ReferenceCase {
  id: string;
  dataset: string;
  procedure: string;
  input: Record<string, unknown>;
  status: 'check' | 'known-defect' | 'convention-pending';
  note: string | null;
  /**
   * Overrides the fixture default. The default bounds floating-point
   * association order, which is the only thing separating two closed-form
   * implementations; a model fitted iteratively is separated instead by the two
   * packages' convergence criteria, which is a looser and differently-derived
   * number. Each override says in the generator why it is what it is.
   */
  tolerance: Tolerance | null;
  expected: unknown;
}

interface ReferenceFixture {
  source: string;
  generatedAt: string;
  tolerance: Tolerance;
  cases: ReferenceCase[];
}

/** Separator for a composite identity. Not a character any label can contain. */
const ID_SEPARATOR = ' :: ';

/**
 * Which field identifies an element of a result array. Comparing by position
 * would make the suite depend on an ordering neither package promises — R labels
 * a Tukey contrast "virginica-setosa" while statsmodels orders the pair the other
 * way round, and both are correct.
 */
const IDENTITY_KEYS = [
  ['group1', 'group2'],
  ['category', 'variable'],
  ['variable'],
  ['group'],
  ['item'],
  ['source'],
] as const;

const identityOf = (value: Record<string, unknown>): string | null => {
  for (const keys of IDENTITY_KEYS) {
    if (keys.every((key) => key in value)) {
      return keys.map((key) => String(value[key])).join(ID_SEPARATOR);
    }
  }
  return null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Compares the reference tree against the result, descending only into the keys
 * the reference names. Numbers go through the tolerance; arrays of objects are
 * matched by identity where one exists and by position otherwise (a confidence
 * interval is a pair, not a set).
 */
function compareTo(actual: unknown, reference: unknown, tolerance: Tolerance, path: string): void {
  if (typeof reference === 'number') {
    expectNotFlattenedToZero(actual, reference, path);
    expectCloseTo(actual, reference, tolerance, path);
    return;
  }

  if (reference === null || typeof reference === 'string' || typeof reference === 'boolean') {
    expect(actual, `${path}: expected ${JSON.stringify(reference)}`).toEqual(reference);
    return;
  }

  if (Array.isArray(reference)) {
    expect(Array.isArray(actual), `${path} should be an array, got ${typeof actual}`).toBe(true);
    const actualItems = actual as unknown[];

    const identities = reference.map((item) => (isPlainObject(item) ? identityOf(item) : null));
    if (identities.length > 0 && identities.every((identity) => identity !== null)) {
      const byIdentity = new Map<string, Record<string, unknown>>();
      for (const item of actualItems) {
        if (!isPlainObject(item)) continue;
        const identity = identityOf(item);
        if (identity !== null) byIdentity.set(identity, item);
      }
      reference.forEach((item, index) => {
        const identity = identities[index] as string;
        const match = byIdentity.get(identity);
        expect(match, `${path}: no result element identified by "${identity}"`).toBeDefined();
        compareTo(match, item, tolerance, `${path}[${identity}]`);
      });
      return;
    }

    expect(actualItems.length, `${path} length`).toBe(reference.length);
    reference.forEach((item, index) =>
      compareTo(actualItems[index], item, tolerance, `${path}[${index}]`),
    );
    return;
  }

  expect(isPlainObject(actual), `${path} should be an object, got ${typeof actual}`).toBe(true);
  for (const [key, value] of Object.entries(reference as Record<string, unknown>)) {
    compareTo((actual as Record<string, unknown>)[key], value, tolerance, `${path}.${key}`);
  }
}

type AnalysisCall = (input: unknown) => Promise<{ success: boolean; data?: unknown; error?: unknown }>;

describe.each([['R', rReference as unknown as ReferenceFixture]])(
  'cross-check against %s',
  (label, fixture) => {
    let stats: InferentialStats;

    beforeAll(async () => {
      stats = new InferentialStats({ workerUrl });
      await stats.init();
    });

    afterAll(() => {
      stats.destroy();
    });

    it('is generated from a recorded version of the reference package', () => {
      expect(fixture.source).toBeTruthy();
      expect(fixture.cases.length).toBeGreaterThan(0);
    });

    describe.each(fixture.cases.map((item) => [item.id, item] as const))('%s', (_id, testCase) => {
      const run = testCase.status === 'check' ? it : it.fails;
      const title =
        testCase.status === 'check'
          ? `agrees with ${label}`
          : `does NOT agree — ${testCase.status}: ${testCase.note ?? 'see design doc'}`;

      run(title, async () => {
        const data = datasets[testCase.dataset];
        expect(data, `dataset ${testCase.dataset} not exported`).toBeDefined();

        const method = (stats as unknown as Record<string, unknown>)[testCase.procedure];
        expect(
          typeof method,
          `${testCase.procedure} is not a method of InferentialStats`,
        ).toBe('function');

        const result = await (method as AnalysisCall).call(stats, { data, ...testCase.input });

        expect(
          result.success,
          `${testCase.procedure} failed: ${JSON.stringify(result.error)}`,
        ).toBe(true);
        compareTo(
          result.data,
          testCase.expected,
          testCase.tolerance ?? fixture.tolerance,
          testCase.procedure,
        );
      });
    });
  },
);
