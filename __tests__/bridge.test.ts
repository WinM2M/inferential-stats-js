/**
 * Tests for the binary bridge serializer and deserializer.
 *
 * The README describes the architecture:
 *   "Data is serialized into a columnar binary format (Float64Array, Int32Array,
 *    dictionary-encoded strings) and transferred to the worker using the
 *    Transferable Objects API for near-zero-copy performance."
 *
 * These tests verify that the JSON ↔ ArrayBuffer round-trip works correctly.
 */

import { serializeToBuffer, getTransferables } from '../src/bridge/serializer';
import { deserializeFromBuffer, deserializeToColumns } from '../src/bridge/deserializer';

describe('Bridge: Serializer', () => {
  it('should serialize empty data to a minimal buffer', () => {
    const buffer = serializeToBuffer([]);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should serialize numeric data', () => {
    const data = [
      { score: 85, grade: 90 },
      { score: 78, grade: 82 },
    ];
    const buffer = serializeToBuffer(data);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    // Float64 = 8 bytes per value, 2 columns × 2 rows = 32 bytes + header
    expect(buffer.byteLength).toBeGreaterThan(32);
  });

  it('should serialize string data with dictionary encoding', () => {
    const data = [
      { group: 'A', label: 'alpha' },
      { group: 'B', label: 'beta' },
      { group: 'A', label: 'alpha' },
    ];
    const buffer = serializeToBuffer(data);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('should serialize mixed types (string + numeric)', () => {
    const data = [
      { group: 'A', score: 85 },
      { group: 'B', score: 78 },
    ];
    const buffer = serializeToBuffer(data);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should handle null and undefined values', () => {
    const data = [
      { a: 1, b: null },
      { a: undefined, b: 2 },
    ];
    const buffer = serializeToBuffer(data);
    expect(buffer).toBeInstanceOf(ArrayBuffer);
  });

  it('should return transferables array', () => {
    const buffer = serializeToBuffer([{ a: 1 }]);
    const transferables = getTransferables(buffer);
    expect(transferables).toEqual([buffer]);
  });
});

describe('Bridge: Deserializer', () => {
  it('should deserialize empty data', () => {
    const buffer = serializeToBuffer([]);
    const result = deserializeFromBuffer(buffer);
    expect(result).toEqual([]);
  });

  it('should round-trip numeric data', () => {
    const original = [
      { score: 85, grade: 90 },
      { score: 78, grade: 82 },
    ];
    const buffer = serializeToBuffer(original);
    const result = deserializeFromBuffer(buffer);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ score: 85, grade: 90 });
    expect(result[1]).toEqual({ score: 78, grade: 82 });
  });

  it('should round-trip string data', () => {
    const original = [
      { group: 'A', label: 'alpha' },
      { group: 'B', label: 'beta' },
    ];
    const buffer = serializeToBuffer(original);
    const result = deserializeFromBuffer(buffer);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ group: 'A', label: 'alpha' });
    expect(result[1]).toEqual({ group: 'B', label: 'beta' });
  });

  it('should round-trip mixed data (matching README survey data schema)', () => {
    // This matches the sample data format described in the README:
    // gender (string), age_group (string), music_satisfaction (integer), etc.
    const original = [
      {
        gender: 'Male',
        age_group: '20s',
        favorite_music: 'Rock',
        music_satisfaction: 4,
        weekly_hours_music: 12.5,
      },
      {
        gender: 'Female',
        age_group: '30s',
        favorite_music: 'Jazz',
        music_satisfaction: 5,
        weekly_hours_music: 8.3,
      },
    ];
    const buffer = serializeToBuffer(original);
    const result = deserializeFromBuffer(buffer);
    expect(result).toHaveLength(2);
    expect(result[0].gender).toBe('Male');
    expect(result[0].age_group).toBe('20s');
    expect(result[0].favorite_music).toBe('Rock');
    expect(result[0].music_satisfaction).toBe(4);
    expect(result[0].weekly_hours_music).toBe(12.5);
    expect(result[1].gender).toBe('Female');
    expect(result[1].music_satisfaction).toBe(5);
  });

  it('should round-trip large datasets efficiently (2000 rows)', () => {
    // README says the sample dataset has 2000 rows
    const data = Array.from({ length: 2000 }, (_, i) => ({
      id: i + 1,
      group: i % 3 === 0 ? 'A' : i % 3 === 1 ? 'B' : 'C',
      score: Math.round(Math.random() * 100),
      value: Math.random() * 50,
    }));
    const buffer = serializeToBuffer(data);
    const result = deserializeFromBuffer(buffer);
    expect(result).toHaveLength(2000);
    expect(result[0].id).toBe(1);
    expect(result[1999].id).toBe(2000);
  });
});

describe('Bridge: deserializeToColumns', () => {
  it('should return column-oriented data', () => {
    const original = [
      { group: 'A', score: 85 },
      { group: 'B', score: 78 },
      { group: 'C', score: 92 },
    ];
    const buffer = serializeToBuffer(original);
    const result = deserializeToColumns(buffer);

    expect(result.rowCount).toBe(3);
    expect(result.columns).toHaveProperty('group');
    expect(result.columns).toHaveProperty('score');
    expect(result.columns.group.dtype).toBe('string');
    expect(result.columns.group.values).toEqual(['A', 'B', 'C']);
    expect(result.columns.score.dtype).toBe('float64');
    expect(result.columns.score.values).toEqual([85, 78, 92]);
  });

  it('should return empty columns for empty data', () => {
    const buffer = serializeToBuffer([]);
    const result = deserializeToColumns(buffer);
    expect(result.rowCount).toBe(0);
    expect(result.columns).toEqual({});
  });
});
