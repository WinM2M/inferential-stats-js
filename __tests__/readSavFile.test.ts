import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readSavFile } from '../src/index';

type SurveyRow = Record<string, string | number | null>;

const toSurveyRows = (value: unknown): SurveyRow[] => value as SurveyRow[];

const expectRowsToMatch = (actual: SurveyRow[], expected: SurveyRow[]): void => {
  expect(actual.length).toBe(expected.length);

  const indicesToCheck = [0, 1, 2, Math.floor(expected.length / 2), expected.length - 1];

  for (const rowIndex of indicesToCheck) {
    const actualRow = actual[rowIndex];
    const expectedRow = expected[rowIndex];

    expect(actualRow).toBeDefined();
    expect(expectedRow).toBeDefined();

    const actualKeys = Object.keys(actualRow).sort();
    const expectedKeys = Object.keys(expectedRow).sort();
    expect(actualKeys).toEqual(expectedKeys);

    for (const key of expectedKeys) {
      const actualValue = actualRow[key];
      const expectedValue = expectedRow[key];

      if (typeof expectedValue === 'number') {
        expect(typeof actualValue).toBe('number');
        expect(actualValue as number).toBeCloseTo(expectedValue, 10);
      } else {
        expect(actualValue).toBe(expectedValue);
      }
    }
  }
};

describe('readSavFile', () => {
  it('reads docs/sample-survey-data.sav and converts to JSON rows', async () => {
    const testDir = fileURLToPath(new URL('.', import.meta.url));
    const savPath = resolve(testDir, '../docs/sample-survey-data.sav');
    const jsonPath = resolve(testDir, '../docs/sample-survey-data.json');

    const [savBuffer, jsonText] = await Promise.all([
      readFile(savPath),
      readFile(jsonPath, 'utf8'),
    ]);

    const actualRows = toSurveyRows(await readSavFile(savBuffer));
    const expectedRows = toSurveyRows(JSON.parse(jsonText));

    expectRowsToMatch(actualRows, expectedRows);
  });
});
