# E2E Benchmark: v10 vs v15

- Timestamp (UTC): 2026-04-07T02:07:03.808509+00:00
- Runs per version: 10
- Test command: `npx vitest run --config vitest.config.ts`
- Metrics: wall time (Python timer), max RSS (process-tree sampling), Vitest-reported duration

| Metric | v10 | v15 |
|---|---:|---:|
| Total wall time (s) | 251.041 | 244.107 |
| Average wall time (s) | 25.104 | 24.411 |
| Min wall time (s) | 24.792 | 24.05 |
| Max wall time (s) | 25.558 | 24.684 |
| Average max RSS (MB) | 1786.831 | 1770.838 |
| Peak max RSS (MB) | 1828.254 | 1789.426 |
| Avg Vitest duration (s) | 23.388 | 22.592 |

## Raw Runs

### v10

| Run | Wall Time (s) | Max RSS (MB) | Vitest Duration (s) |
|---:|---:|---:|---:|
| 1 | 25.228 | 1828.254 | 23.44 |
| 2 | 25.067 | 1796.816 | 23.22 |
| 3 | 25.023 | 1797.887 | 23.31 |
| 4 | 24.922 | 1801.469 | 23.2 |
| 5 | 25.133 | 1780.387 | 23.34 |
| 6 | 25.102 | 1774.395 | 23.21 |
| 7 | 24.792 | 1769.547 | 23.89 |
| 8 | 25.337 | 1778.293 | 23.45 |
| 9 | 24.879 | 1767.008 | 23.1 |
| 10 | 25.558 | 1774.258 | 23.72 |

### v15

| Run | Wall Time (s) | Max RSS (MB) | Vitest Duration (s) |
|---:|---:|---:|---:|
| 1 | 24.194 | 1781.855 | 22.41 |
| 2 | 24.275 | 1779.25 | 22.45 |
| 3 | 24.624 | 1765.832 | 22.65 |
| 4 | 24.367 | 1760.871 | 22.53 |
| 5 | 24.624 | 1759.523 | 22.88 |
| 6 | 24.684 | 1766.516 | 22.96 |
| 7 | 24.442 | 1789.426 | 22.64 |
| 8 | 24.05 | 1769.094 | 22.2 |
| 9 | 24.554 | 1772.441 | 22.78 |
| 10 | 24.293 | 1763.574 | 22.42 |
