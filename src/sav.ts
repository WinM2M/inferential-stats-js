type SavRecord = Record<string, unknown>;

type SavBufferReaderInstance = {
  open: () => Promise<void>;
  readAllRows: (includeNulls?: boolean) => Promise<SavRecord[]>;
};

type SavReaderModule = {
  SavBufferReader: new (buffer: unknown) => SavBufferReaderInstance;
};

const normalizeToUint8Array = (buffer: ArrayBuffer | Uint8Array): Uint8Array => {
  if (buffer instanceof Uint8Array) {
    return buffer;
  }
  if (buffer instanceof ArrayBuffer) {
    return new Uint8Array(buffer);
  }

  throw new TypeError('readSavFile(buffer) expects ArrayBuffer or Uint8Array.');
};

/**
 * Read an SPSS .sav file and return it as JSON records.
 *
 * This utility currently runs in Node.js only because it relies on
 * the `sav-reader` package.
 */
export const readSavFile = async (buffer: ArrayBuffer | Uint8Array): Promise<SavRecord[]> => {
  const bytes = normalizeToUint8Array(buffer);

  const NodeBuffer = (globalThis as { Buffer?: { from: (...args: unknown[]) => unknown } }).Buffer;
  if (!NodeBuffer) {
    throw new Error('readSavFile is currently supported in Node.js environments only.');
  }

  const moduleApi = await import('node:module');
  const require = moduleApi.createRequire(import.meta.url);
  const { SavBufferReader } = require('sav-reader') as SavReaderModule;

  const nodeBuffer = NodeBuffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const reader = new SavBufferReader(nodeBuffer);
  await reader.open();
  return reader.readAllRows();
};
