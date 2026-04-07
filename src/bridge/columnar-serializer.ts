import type { ColumnarPayload } from '../types/common';

function isMissing(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function isCategoricalColumn(values: unknown[]): boolean {
  return values.some((value) => !isMissing(value) && typeof value === 'string');
}

function toNumericValue(value: unknown): number {
  if (isMissing(value)) return NaN;
  if (typeof value === 'boolean') return value ? 1 : 0;

  const coerced = Number(value);
  return Number.isFinite(coerced) ? coerced : NaN;
}

function buildCategoricalColumn(values: unknown[]): {
  data: Float64Array;
  mapping: Record<number, string>;
} {
  const labelToCode = new Map<string, number>();
  const codeToLabel: Record<number, string> = {};
  const encoded = new Float64Array(values.length);

  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    if (isMissing(value)) {
      encoded[i] = NaN;
      continue;
    }

    const label = String(value);
    let code = labelToCode.get(label);

    if (code === undefined) {
      code = labelToCode.size;
      labelToCode.set(label, code);
      codeToLabel[code] = label;
    }

    encoded[i] = code;
  }

  return { data: encoded, mapping: codeToLabel };
}

function buildNumericColumn(values: unknown[]): Float64Array {
  const array = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++) {
    array[i] = toNumericValue(values[i]);
  }
  return array;
}

export function serializeToColumnarPayload(data: Record<string, unknown>[]): ColumnarPayload {
  if (data.length === 0) {
    return {
      rowCount: 0,
      columns: {},
      mappings: {},
    };
  }

  const columnNames = Object.keys(data[0]);
  const columns: Record<string, Float64Array> = {};
  const mappings: Record<string, Record<number, string> | null> = {};

  for (const columnName of columnNames) {
    const values = data.map((row) => row[columnName]);
    if (isCategoricalColumn(values)) {
      const { data: encoded, mapping } = buildCategoricalColumn(values);
      columns[columnName] = encoded;
      mappings[columnName] = mapping;
    } else {
      columns[columnName] = buildNumericColumn(values);
      mappings[columnName] = null;
    }
  }

  return {
    rowCount: data.length,
    columns,
    mappings,
  };
}

export function getColumnarTransferables(payload: ColumnarPayload): ArrayBuffer[] {
  return Object.values(payload.columns).map((column) => column.buffer as ArrayBuffer);
}
