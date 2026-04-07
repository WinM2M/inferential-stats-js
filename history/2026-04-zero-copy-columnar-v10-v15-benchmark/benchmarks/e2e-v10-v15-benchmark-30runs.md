# E2E Benchmark: v10 vs v15 (30 runs)

- Timestamp (UTC): 2026-04-07T03:49:24.370900+00:00
- Runs per version: 30
- Test command: `npx vitest run --config vitest.benchmark.config.ts --reporter verbose`
- Metrics: wall time (Python timer), max RSS (process-tree sampling), vitest duration, per-function execution time

## Overall

| Metric | v10 | v15 | Delta % (v15 vs v10) |
|---|---:|---:|---:|
| Total wall time (30 runs, s) | 750.917 | 726.065 | -3.31 |
| Mean wall time (s) | 25.031 | 24.202 | -3.312 |
| Mean max RSS (MB) | 1783.338 | 1769.371 | -0.783 |
| Mean vitest duration (s) | 23.243 | 22.407 | -3.597 |
| Mean total 16-function execution (ms) | 14379.8 | 13475.067 | -6.292 |

## Distribution Stats (95% CI)

| Metric | Version | Mean | StdDev | 95% CI Low | 95% CI High | Min | Max |
|---|---|---:|---:|---:|---:|---:|---:|
| Wall Time (s) | v10 | 25.031 | 0.222 | 24.951 | 25.11 | 24.412 | 25.496 |
| Wall Time (s) | v15 | 24.202 | 0.55 | 24.005 | 24.399 | 22.75 | 26.526 |
| Max RSS (MB) | v10 | 1783.338 | 10.251 | 1779.67 | 1787.006 | 1767.633 | 1805.734 |
| Max RSS (MB) | v15 | 1769.371 | 8.932 | 1766.175 | 1772.567 | 1758.156 | 1789.828 |
| Vitest Duration (s) | v10 | 23.243 | 0.171 | 23.181 | 23.304 | 22.94 | 23.76 |
| Vitest Duration (s) | v15 | 22.407 | 0.495 | 22.23 | 22.584 | 21.85 | 24.8 |
| Total 16-Function Execution (ms) | v10 | 14379.8 | 103.293 | 14342.837 | 14416.763 | 14207.0 | 14614.0 |
| Total 16-Function Execution (ms) | v15 | 13475.067 | 118.447 | 13432.681 | 13517.452 | 13222.0 | 13739.0 |

## Per-Function Mean Execution Time (ms)

| Function | v10 mean | v15 mean | Delta % (v15 vs v10) | v10 stddev | v15 stddev |
|---|---:|---:|---:|---:|---:|
| anovaOneway | 144.4 | 80.867 | -43.998 | 5.315 | 4.869 |
| cronbachAlpha | 185.067 | 124.267 | -32.853 | 3.321 | 3.503 |
| crosstabs | 188.133 | 128.0 | -31.963 | 9.153 | 15.496 |
| descriptives | 3146.4 | 3067.033 | -2.522 | 37.549 | 33.982 |
| efa | 281.567 | 217.867 | -22.623 | 5.399 | 5.993 |
| frequencies | 3418.3 | 3342.733 | -2.211 | 30.599 | 33.807 |
| hierarchicalCluster | 155.8 | 154.5 | -0.834 | 2.578 | 3.579 |
| kmeans | 669.433 | 606.3 | -9.431 | 6.279 | 7.927 |
| linearRegression | 2279.967 | 2215.267 | -2.838 | 23.688 | 24.832 |
| logisticBinary | 216.433 | 152.933 | -29.339 | 6.877 | 7.978 |
| logisticMultinomial | 992.1 | 927.467 | -6.515 | 11.391 | 11.503 |
| mds | 921.833 | 923.5 | 0.181 | 7.168 | 12.337 |
| pca | 193.033 | 129.467 | -32.93 | 3.285 | 3.371 |
| posthocTukey | 1289.433 | 1230.433 | -4.576 | 19.057 | 23.619 |
| ttestIndependent | 157.067 | 95.333 | -39.304 | 4.234 | 5.604 |
| ttestPaired | 140.833 | 79.1 | -43.834 | 3.824 | 2.721 |
