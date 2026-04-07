# 2026-04 Zero-Copy Columnar Refactor and Benchmark History

## Background

- The previous pipeline transferred `ArrayBuffer` from the JS main thread to the worker, then converted data back to row-based JSON in the worker and parsed it with Python `json.loads`.
- This introduced extra serialization/deserialization and intermediate copy overhead, creating bottlenecks in response time and memory efficiency for larger datasets.

## Key Changes

- Introduced `Columnar TypedArray` serialization
  - Added `src/bridge/columnar-serializer.ts`
  - Serialized numeric and categorical columns primarily as `Float64Array`
  - Normalized `null`, `undefined`, and `''` to `NaN`
- Added categorical bridge (label encoding)
  - Encoded categorical labels to numeric codes in JS
  - Restored original labels in Python using `mappings` metadata
- Improved worker data path
  - Built DataFrame directly from columnar payload instead of JSON parsing
  - Kept the legacy `ArrayBuffer -> JSON` path as a backward-compatible fallback

## Version Definitions

- `v10` (pre-improvement baseline): `cb0b110`
- `v15` (post-improvement baseline): working tree state from this session

## Benchmark Methodology

- Target test: browser E2E benchmark scenario that executes all 16 analysis functions
- Internal command:
  - `npx vitest run --config vitest.benchmark.config.ts --reporter verbose`
- Repetitions:
  - 10-run comparison and 30-run comparison reports
- Metrics:
  - Wall time (Python `perf_counter`)
  - Max RSS (peak from process-tree sampling)
  - Vitest duration
  - Per-function execution time (`executionTimeMs` for each of 16 functions)

## Files Used

- Benchmark runner script: `history/2026-04-zero-copy-columnar-v10-v15-benchmark/benchmark-e2e-v10-v15.py`
- Benchmark test template: `history/2026-04-zero-copy-columnar-v10-v15-benchmark/config/e2e/inferential-stats.benchmark.test.ts`
- Benchmark Vitest config template: `history/2026-04-zero-copy-columnar-v10-v15-benchmark/config/vitest.benchmark.config.ts`

## Result Files

- 10-run comparison:
  - `history/2026-04-zero-copy-columnar-v10-v15-benchmark/benchmarks/e2e-v10-v15-benchmark.json`
  - `history/2026-04-zero-copy-columnar-v10-v15-benchmark/benchmarks/e2e-v10-v15-benchmark.md`
- 30-run comparison:
  - `history/2026-04-zero-copy-columnar-v10-v15-benchmark/benchmarks/e2e-v10-v15-benchmark-30runs.json`
  - `history/2026-04-zero-copy-columnar-v10-v15-benchmark/benchmarks/e2e-v10-v15-benchmark-30runs.md`

## Notes

- The script uses `/tmp/inferential-stats-js-v10` worktree for the `v10` baseline comparison.
- At runtime, the script copies benchmark config templates into each target worktree to ensure identical benchmark conditions.
