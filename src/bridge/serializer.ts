import { ColumnMeta, BinaryFrameHeader } from '../types/common';

/**
 * Encode a UTF-8 string to Uint8Array
 */
function encodeString(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Infer column type from values
 */
function inferColumnType(values: unknown[]): 'float64' | 'int32' | 'string' {
  for (const v of values) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string') return 'string';
    if (typeof v === 'number') {
      if (Number.isInteger(v)) continue;
      return 'float64';
    }
  }
  // Default numeric columns to float64 for compatibility
  return 'float64';
}

/**
 * Serialize an array of JSON objects into an ArrayBuffer for efficient Worker transfer.
 * Uses columnar storage with dictionary encoding for strings.
 * 
 * Format:
 * [4 bytes: header length][header JSON bytes][column data bytes...]
 * 
 * Column data layout per column:
 * - float64/int32: raw typed array bytes
 * - string: Int32Array of indices into stringTable in header
 */
export function serializeToBuffer(data: Record<string, unknown>[]): ArrayBuffer {
  if (!data || data.length === 0) {
    // Return minimal buffer for empty data
    const header: BinaryFrameHeader = { rowCount: 0, columns: [] };
    const headerBytes = encodeString(JSON.stringify(header));
    const buffer = new ArrayBuffer(4 + headerBytes.byteLength);
    const view = new DataView(buffer);
    view.setUint32(0, headerBytes.byteLength, true);
    new Uint8Array(buffer, 4).set(headerBytes);
    return buffer;
  }

  const rowCount = data.length;
  const columnNames = Object.keys(data[0]);
  const columns: ColumnMeta[] = [];
  const columnBuffers: ArrayBuffer[] = [];

  for (const name of columnNames) {
    const values = data.map(row => row[name]);
    const dtype = inferColumnType(values);

    if (dtype === 'string') {
      // Dictionary encoding
      const uniqueValues = [...new Set(values.map(v => String(v ?? '')))];
      const lookupMap = new Map<string, number>();
      uniqueValues.forEach((v, i) => lookupMap.set(v, i));

      const indices = new Int32Array(rowCount);
      for (let i = 0; i < rowCount; i++) {
        indices[i] = lookupMap.get(String(values[i] ?? '')) ?? 0;
      }

      columns.push({ name, dtype: 'string', stringTable: uniqueValues });
      columnBuffers.push(indices.buffer.slice(0));
    } else {
      // Numeric column
      const arr = new Float64Array(rowCount);
      for (let i = 0; i < rowCount; i++) {
        const v = values[i];
        arr[i] = (v === null || v === undefined) ? NaN : Number(v);
      }
      columns.push({ name, dtype: 'float64' });
      columnBuffers.push(arr.buffer.slice(0));
    }
  }

  const header: BinaryFrameHeader = { rowCount, columns };
  const headerBytes = encodeString(JSON.stringify(header));

  // Calculate total size
  let totalDataSize = 0;
  for (const buf of columnBuffers) {
    totalDataSize += buf.byteLength;
  }

  const totalSize = 4 + headerBytes.byteLength + totalDataSize;
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Write header length (4 bytes, little-endian)
  view.setUint32(0, headerBytes.byteLength, true);

  // Write header
  new Uint8Array(buffer, 4, headerBytes.byteLength).set(headerBytes);

  // Write column data
  let offset = 4 + headerBytes.byteLength;
  for (const colBuf of columnBuffers) {
    new Uint8Array(buffer, offset, colBuf.byteLength).set(new Uint8Array(colBuf));
    offset += colBuf.byteLength;
  }

  return buffer;
}

/**
 * Get a list of transferable ArrayBuffers from the serialized buffer.
 * Useful for postMessage with Transferable Objects.
 */
export function getTransferables(buffer: ArrayBuffer): ArrayBuffer[] {
  return [buffer];
}
