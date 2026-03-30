import { BinaryFrameHeader } from '../types/common';

/**
 * Decode UTF-8 bytes to string
 */
function decodeString(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/**
 * Deserialize an ArrayBuffer (created by serializeToBuffer) back to JSON objects.
 */
export function deserializeFromBuffer(buffer: ArrayBuffer): Record<string, unknown>[] {
  const view = new DataView(buffer);

  // Read header length
  const headerLength = view.getUint32(0, true);

  // Read header
  const headerBytes = new Uint8Array(buffer, 4, headerLength);
  const header: BinaryFrameHeader = JSON.parse(decodeString(headerBytes));

  if (header.rowCount === 0) return [];

  const { rowCount, columns } = header;
  let offset = 4 + headerLength;

  // Read column data
  const columnData: Map<string, (string | number)[]> = new Map();

  for (const col of columns) {
    if (col.dtype === 'string') {
      const indices = new Int32Array(buffer, offset, rowCount);
      const values: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        values.push(col.stringTable![indices[i]]);
      }
      columnData.set(col.name, values);
      offset += rowCount * 4; // Int32 = 4 bytes
    } else {
      const arr = new Float64Array(buffer, offset, rowCount);
      const values: number[] = [];
      for (let i = 0; i < rowCount; i++) {
        values.push(arr[i]);
      }
      columnData.set(col.name, values);
      offset += rowCount * 8; // Float64 = 8 bytes
    }
  }

  // Reconstruct row-oriented JSON
  const result: Record<string, unknown>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.name] = columnData.get(col.name)![i];
    }
    result.push(row);
  }

  return result;
}

/**
 * Deserialize buffer and convert to column-oriented format.
 * More efficient for statistical computations.
 */
export function deserializeToColumns(buffer: ArrayBuffer): {
  rowCount: number;
  columns: Record<string, { dtype: string; values: (string | number)[] }>;
} {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const headerBytes = new Uint8Array(buffer, 4, headerLength);
  const header: BinaryFrameHeader = JSON.parse(decodeString(headerBytes));

  if (header.rowCount === 0) return { rowCount: 0, columns: {} };

  const { rowCount, columns: colMeta } = header;
  let offset = 4 + headerLength;
  const columns: Record<string, { dtype: string; values: (string | number)[] }> = {};

  for (const col of colMeta) {
    if (col.dtype === 'string') {
      const indices = new Int32Array(buffer, offset, rowCount);
      const values: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        values.push(col.stringTable![indices[i]]);
      }
      columns[col.name] = { dtype: 'string', values };
      offset += rowCount * 4;
    } else {
      const arr = new Float64Array(buffer, offset, rowCount);
      const values: number[] = Array.from(arr);
      columns[col.name] = { dtype: 'float64', values };
      offset += rowCount * 8;
    }
  }

  return { rowCount, columns };
}
