# @winm2m/inferential-stats-js

[![npm version](https://img.shields.io/npm/v/@winm2m/inferential-stats-js.svg)](https://www.npmjs.com/package/@winm2m/inferential-stats-js)
[![license](https://img.shields.io/npm/l/@winm2m/inferential-stats-js.svg)](https://github.com/winm2m/inferential-stats-js/blob/main/LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![WebAssembly](https://img.shields.io/badge/WebAssembly-Pyodide-blueviolet.svg)](https://pyodide.org/)

**A headless JavaScript SDK for advanced statistical analysis in the browser using WebAssembly (Pyodide). Performs SPSS-level inferential statistics entirely client-side with no backend required.**

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Analysis Features — Mathematical & Technical Documentation](#core-analysis-features--mathematical--technical-documentation)
  - [① Descriptive Statistics](#-descriptive-statistics)
  - [② Compare Means](#-compare-means)
  - [③ Regression](#-regression)
  - [④ Classify](#-classify)
  - [⑤ Dimension Reduction](#-dimension-reduction)
  - [⑥ Scale](#-scale)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [CDN / CodePen Usage](#cdn--codepen-usage)
- [API Reference](#api-reference)
- [Sample Data](#sample-data)
- [Progress Event Handling](#progress-event-handling)
- [License](#license)

---

## Architecture Overview

`@winm2m/inferential-stats-js` runs **entirely in the browser** — no backend server, no API calls, no data ever leaves the client.

```
┌─────────────────────────────────────────────────────────┐
│  Main Thread                                            │
│  ┌───────────────────────┐     postMessage()            │
│  │  InferentialStats SDK │ ──── ArrayBuffer ──────┐     │
│  │  (ESM / CJS)          │     (Transferable)     │     │
│  └───────────────────────┘                        ▼     │
│                                 ┌─────────────────────┐ │
│                                 │  Web Worker         │ │
│                                 │  ┌────────────────┐ │ │
│                                 │  │  Pyodide WASM  │ │ │
│                                 │  │  ┌───────────┐ │ │ │
│                                 │  │  │  Python   │ │ │ │
│                                 │  │  │  Runtime  │ │ │ │
│                                 │  │  └───────────┘ │ │ │
│                                 │  └────────────────┘ │ │
│                                 └─────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

| Principle | Description |
|---|---|
| **100 % Client-Side** | Statistical computation runs entirely in-browser via WebAssembly. No network requests to any analytics server. |
| **Web Worker Isolation** | All heavy computation is offloaded to a dedicated Web Worker, keeping the main thread responsive and the UI jank-free. |
| **ArrayBuffer / TypedArray Transfer** | Data is serialized into a columnar binary format (Float64Array, Int32Array, dictionary-encoded strings) and transferred to the worker using the [Transferable Objects](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects) API for near-zero-copy performance. |
| **Pyodide WASM Runtime** | The worker loads [Pyodide](https://pyodide.org/) — a full CPython interpreter compiled to WebAssembly — along with pandas, SciPy, statsmodels, scikit-learn, and factor_analyzer. |
| **Progress Events** | Initialization and computation stages emit `CustomEvent` progress events on a configurable `EventTarget`, enabling real-time progress bars. |
| **Dual Module Format** | Ships as both ESM (`dist/index.js`) and CommonJS (`dist/index.cjs`) with full TypeScript declarations. |

---

## Core Analysis Features — Mathematical & Technical Documentation

This section documents the mathematical foundations and internal Python implementations of all 16 analyses.

> **Note on math rendering:** Equations are rendered as images so they display correctly on npm.

---

### ① Descriptive Statistics

#### Frequencies

Computes a frequency distribution for a categorical variable, including absolute counts, relative percentages, and cumulative percentages.

**Python implementation:** `pandas.Series.value_counts(normalize=True)`

**Relative frequency:**

![formula](<https://latex.codecogs.com/svg.image?f_i%3D%5Cfrac%7Bn_i%7D%7BN%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?n_i>) is the count of category ![formula](<https://latex.codecogs.com/svg.image?i>) and ![formula](<https://latex.codecogs.com/svg.image?N>) is the total number of observations. Cumulative percentage is the running sum of ![formula](<https://latex.codecogs.com/svg.image?f_i%5Ctimes%20100>).

---

#### Descriptives

Produces summary statistics for one or more numeric variables: count, mean, standard deviation, min, max, quartiles (Q1, Q2, Q3), skewness, and kurtosis.

**Python implementation:** `pandas.DataFrame.describe()`, `scipy.stats.skew`, `scipy.stats.kurtosis`

**Arithmetic mean:**

![formula](<https://latex.codecogs.com/svg.image?%5Cbar%7Bx%7D%3D%5Cfrac%7B1%7D%7BN%7D%5Csum_%7Bi%3D1%7D%5E%7BN%7Dx_i>)

**Sample standard deviation (Bessel-corrected):**

![formula](<https://latex.codecogs.com/svg.image?s%3D%5Csqrt%7B%5Cfrac%7B1%7D%7BN-1%7D%5Csum_%7Bi%3D1%7D%5E%7BN%7D(x_i-%5Cbar%7Bx%7D)%5E2%7D>)

**Skewness (Fisher):**

![formula](<https://latex.codecogs.com/svg.image?g_1%3D%5Cfrac%7Bm_3%7D%7Bm_2%5E%7B3%2F2%7D%7D%2C%5Cquad%20m_k%3D%5Cfrac%7B1%7D%7BN%7D%5Csum_%7Bi%3D1%7D%5E%7BN%7D(x_i-%5Cbar%7Bx%7D)%5Ek>)

**Excess kurtosis (Fisher):**

![formula](<https://latex.codecogs.com/svg.image?g_2%3D%5Cfrac%7Bm_4%7D%7Bm_2%5E2%7D-3>)

---

#### Crosstabs

Cross-tabulates two categorical variables and tests for independence using Pearson's Chi-square test. Reports observed and expected counts, row/column/total percentages, and Cramér's V as an effect-size measure.

**Python implementation:** `pandas.crosstab`, `scipy.stats.chi2_contingency`

**Pearson's Chi-square statistic:**

![formula](<https://latex.codecogs.com/svg.image?%5Cchi%5E2%3D%5Csum%5Cfrac%7B(O_%7Bij%7D-E_%7Bij%7D)%5E2%7D%7BE_%7Bij%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?O_%7Bij%7D>) is the observed frequency in cell (![formula](<https://latex.codecogs.com/svg.image?i%2C%20j>)) and ![formula](<https://latex.codecogs.com/svg.image?E_%7Bij%7D%3D%5Cfrac%7BR_i%5Ccdot%20C_j%7D%7BN%7D>) is the expected frequency under independence.

**Cramér's V:**

![formula](<https://latex.codecogs.com/svg.image?V%3D%5Csqrt%7B%5Cfrac%7B%5Cchi%5E2%7D%7BN%5Ccdot(k-1)%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?k%3D%5Cmin(%5Ctext%7Brows%7D%2C%5Ctext%7Bcols%7D)>).

---

### ② Compare Means

#### Independent-Samples T-Test

Compares the means of a numeric variable between two independent groups. Automatically reports results for both equal-variance and unequal-variance (Welch's) assumptions. Includes Levene's test for equality of variances.

**Python implementation:** `scipy.stats.ttest_ind`, `scipy.stats.levene`

**T-statistic (equal variance assumed):**

![formula](<https://latex.codecogs.com/svg.image?t%3D%5Cfrac%7B%5Cbar%7BX%7D_1-%5Cbar%7BX%7D_2%7D%7BS_p%5Csqrt%7B%5Cfrac%7B1%7D%7Bn_1%7D%2B%5Cfrac%7B1%7D%7Bn_2%7D%7D%7D>)

**Pooled standard deviation:**

![formula](<https://latex.codecogs.com/svg.image?S_p%3D%5Csqrt%7B%5Cfrac%7B(n_1-1)s_1%5E2%2B(n_2-1)s_2%5E2%7D%7Bn_1%2Bn_2-2%7D%7D>)

**Degrees of freedom:** ![formula](<https://latex.codecogs.com/svg.image?df%3Dn_1%2Bn_2-2>)

When Levene's test is significant (![formula](<https://latex.codecogs.com/svg.image?p%3C0.05>)), Welch's t-test is recommended, which uses the Welch–Satterthwaite approximation for degrees of freedom.

---

#### Paired-Samples T-Test

Tests whether the mean difference between two paired measurements is significantly different from zero.

**Python implementation:** `scipy.stats.ttest_rel`

**T-statistic:**

![formula](<https://latex.codecogs.com/svg.image?t%3D%5Cfrac%7B%5Cbar%7BD%7D%7D%7BS_D%2F%5Csqrt%7Bn%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?%5Cbar%7BD%7D%3D%5Cfrac%7B1%7D%7Bn%7D%5Csum_%7Bi%3D1%7D%5E%7Bn%7D(X_%7B1i%7D-X_%7B2i%7D)>) is the mean difference and ![formula](<https://latex.codecogs.com/svg.image?S_D>) is the standard deviation of the differences.

**Degrees of freedom:** ![formula](<https://latex.codecogs.com/svg.image?df%3Dn-1>)

---

#### One-Way ANOVA

Tests whether the means of a numeric variable differ significantly across three or more groups.

**Python implementation:** `scipy.stats.f_oneway`

**F-statistic:**

![formula](<https://latex.codecogs.com/svg.image?F%3D%5Cfrac%7BMS_%7Bbetween%7D%7D%7BMS_%7Bwithin%7D%7D>)

**Sum of Squares Between Groups:**

![formula](<https://latex.codecogs.com/svg.image?SS_%7Bbetween%7D%3D%5Csum_%7Bj%3D1%7D%5E%7Bk%7Dn_j(%5Cbar%7BX%7D_j-%5Cbar%7BX%7D)%5E2>)

**Sum of Squares Within Groups:**

![formula](<https://latex.codecogs.com/svg.image?SS_%7Bwithin%7D%3D%5Csum_%7Bj%3D1%7D%5E%7Bk%7D%5Csum_%7Bi%3D1%7D%5E%7Bn_j%7D(X_%7Bij%7D-%5Cbar%7BX%7D_j)%5E2>)

**Mean Squares:**

![formula](<https://latex.codecogs.com/svg.image?MS_%7Bbetween%7D%3D%5Cfrac%7BSS_%7Bbetween%7D%7D%7Bk-1%7D%2C%5Cquad%20MS_%7Bwithin%7D%3D%5Cfrac%7BSS_%7Bwithin%7D%7D%7BN-k%7D>)

**Effect size (Eta-squared):**

![formula](<https://latex.codecogs.com/svg.image?%5Ceta%5E2%3D%5Cfrac%7BSS_%7Bbetween%7D%7D%7BSS_%7Btotal%7D%7D>)

---

#### Post-hoc Tukey HSD

Performs pairwise comparisons of group means following a significant ANOVA result using the Studentized Range distribution.

**Python implementation:** `statsmodels.stats.multicomp.pairwise_tukeyhsd`

**Studentized range statistic:**

![formula](<https://latex.codecogs.com/svg.image?q%3D%5Cfrac%7B%5Cbar%7BX%7D_i-%5Cbar%7BX%7D_j%7D%7B%5Csqrt%7BMS_W%2Fn%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?MS_W>) is the within-group mean square from the ANOVA and ![formula](<https://latex.codecogs.com/svg.image?n>) is the harmonic mean of group sizes. The critical ![formula](<https://latex.codecogs.com/svg.image?q>) value is obtained from the Studentized Range distribution with ![formula](<https://latex.codecogs.com/svg.image?k>) groups and ![formula](<https://latex.codecogs.com/svg.image?N-k>) degrees of freedom.

---

### ③ Regression

#### Linear Regression (OLS)

Fits an Ordinary Least Squares regression model with one or more independent variables. Reports regression coefficients, standard errors, t-statistics, p-values, confidence intervals, ![formula](<https://latex.codecogs.com/svg.image?R%5E2>), adjusted ![formula](<https://latex.codecogs.com/svg.image?R%5E2>), F-test, and the Durbin-Watson statistic for autocorrelation detection.

**Python implementation:** `statsmodels.api.OLS`

**Model:**

![formula](<https://latex.codecogs.com/svg.image?Y%3D%5Cbeta_0%2B%5Cbeta_1X_1%2B%5Ccdots%2B%5Cbeta_pX_p%2B%5Cepsilon>)

where ![formula](<https://latex.codecogs.com/svg.image?%5Cepsilon%5Csim%20N(0%2C%5Csigma%5E2)>).

**OLS estimator:**

![formula](<https://latex.codecogs.com/svg.image?%5Chat%7B%5Cbeta%7D%3D(X%5ETX)%5E%7B-1%7DX%5ETY>)

**Coefficient of determination:**

![formula](<https://latex.codecogs.com/svg.image?R%5E2%3D1-%5Cfrac%7BSS_%7Bres%7D%7D%7BSS_%7Btot%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?SS_%7Bres%7D%3D%5Csum(Y_i-%5Chat%7BY%7D_i)%5E2>) and ![formula](<https://latex.codecogs.com/svg.image?SS_%7Btot%7D%3D%5Csum(Y_i-%5Cbar%7BY%7D)%5E2>).

---

#### Binary Logistic Regression

Models the probability of a binary outcome as a function of one or more independent variables. Reports coefficients (log-odds), odds ratios, z-statistics, p-values, pseudo-![formula](<https://latex.codecogs.com/svg.image?R%5E2>), AIC, and BIC.

**Python implementation:** `statsmodels.discrete.discrete_model.Logit`

**Logit link function:**

![formula](<https://latex.codecogs.com/svg.image?%5Cln%5Cleft(%5Cfrac%7Bp%7D%7B1-p%7D%5Cright)%3D%5Cbeta_0%2B%5Cbeta_1X_1%2B%5Ccdots%2B%5Cbeta_pX_p>)

**Predicted probability:**

![formula](<https://latex.codecogs.com/svg.image?P(Y%3D1%7CX)%3D%5Cfrac%7B1%7D%7B1%2Be%5E%7B-(%5Cbeta_0%2B%5Cbeta_1X_1%2B%5Ccdots%2B%5Cbeta_pX_p)%7D%7D>)

Coefficients are estimated by Maximum Likelihood Estimation (MLE). The odds ratio for predictor j is ![formula](<https://latex.codecogs.com/svg.image?e%5E%7B%5Cbeta_j%7D>).

---

#### Multinomial Logistic Regression

Extends binary logistic regression to outcomes with more than two unordered categories. One category is designated as the reference; the model estimates log-odds of each other category relative to the reference.

**Python implementation:** `sklearn.linear_model.LogisticRegression(multi_class='multinomial')`

**Log-odds relative to reference category ![formula](<https://latex.codecogs.com/svg.image?K>):**

![formula](<https://latex.codecogs.com/svg.image?%5Cln%5Cleft(%5Cfrac%7BP(Y%3Dk)%7D%7BP(Y%3DK)%7D%5Cright)%3D%5Cbeta_%7Bk0%7D%2B%5Cbeta_%7Bk1%7DX_1%2B%5Ccdots%2B%5Cbeta_%7Bkp%7DX_p>)

for each category ![formula](<https://latex.codecogs.com/svg.image?k%5Cneq%20K>).

**Predicted probability via softmax:**

![formula](<https://latex.codecogs.com/svg.image?P(Y%3Dk%7CX)%3D%5Cfrac%7Be%5E%7B%5Cbeta_%7Bk0%7D%2B%5Cbeta_%7Bk1%7DX_1%2B%5Ccdots%2B%5Cbeta_%7Bkp%7DX_p%7D%7D%7B%5Csum_%7Bj%3D1%7D%5E%7BK%7De%5E%7B%5Cbeta_%7Bj0%7D%2B%5Cbeta_%7Bj1%7DX_1%2B%5Ccdots%2B%5Cbeta_%7Bjp%7DX_p%7D%7D>)

---

### ④ Classify

#### K-Means Clustering

Partitions observations into ![formula](<https://latex.codecogs.com/svg.image?K>) clusters by iteratively assigning points to the nearest centroid and updating centroids until convergence.

**Python implementation:** `sklearn.cluster.KMeans`

**Objective function (inertia):**

![formula](<https://latex.codecogs.com/svg.image?J%3D%5Csum_%7Bj%3D1%7D%5E%7BK%7D%5Csum_%7Bi%5Cin%20C_j%7D%5C%7Cx_i-%5Cmu_j%5C%7C%5E2>)

where ![formula](<https://latex.codecogs.com/svg.image?C_j>) is the set of observations in cluster j and ![formula](<https://latex.codecogs.com/svg.image?%5Cmu_j>) is the centroid. The algorithm minimizes J using Lloyd's algorithm (Expectation-Maximization style).

---

#### Hierarchical (Agglomerative) Clustering

Builds a hierarchy of clusters using a bottom-up approach. Supports Ward, complete, average, and single linkage methods. Returns a full linkage matrix and dendrogram data for visualization.

**Python implementation:** `scipy.cluster.hierarchy.linkage`, `scipy.cluster.hierarchy.fcluster`

**Ward's minimum variance method** (default):

![formula](<https://latex.codecogs.com/svg.image?%5CDelta(A%2CB)%3D%5Cfrac%7Bn_A%20n_B%7D%7Bn_A%2Bn_B%7D%5C%7C%5Cbar%7Bx%7D_A-%5Cbar%7Bx%7D_B%5C%7C%5E2>)

At each step, the pair of clusters (A, B) that produces the smallest increase in total within-cluster variance is merged. Ward's method tends to produce compact, equally sized clusters.

---

### ⑤ Dimension Reduction

#### Exploratory Factor Analysis (EFA)

Discovers latent factors underlying a set of observed variables. Supports varimax, promax, oblimin, and no rotation. Reports factor loadings, communalities, eigenvalues, KMO measure of sampling adequacy, and Bartlett's test of sphericity.

**Python implementation:** `factor_analyzer.FactorAnalyzer(rotation='varimax')` — installed at runtime via `micropip`

**Factor model:**

![formula](<https://latex.codecogs.com/svg.image?X%3D%5CLambda%20F%2B%5Cepsilon>)

where ![formula](<https://latex.codecogs.com/svg.image?X>) is the observed variable vector, ![formula](<https://latex.codecogs.com/svg.image?%5CLambda>) is the matrix of factor loadings, ![formula](<https://latex.codecogs.com/svg.image?F>) is the vector of latent factors, and ![formula](<https://latex.codecogs.com/svg.image?%5Cepsilon>) is the unique variance.

**Kaiser-Meyer-Olkin (KMO) measure:**

![formula](<https://latex.codecogs.com/svg.image?KMO%3D%5Cfrac%7B%5Csum%5Csum_%7Bi%5Cneq%20j%7D%20r_%7Bij%7D%5E2%7D%7B%5Csum%5Csum_%7Bi%5Cneq%20j%7D%20r_%7Bij%7D%5E2%2B%5Csum%5Csum_%7Bi%5Cneq%20j%7D%20u_%7Bij%7D%5E2%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?r_%7Bij%7D>) are elements of the correlation matrix and ![formula](<https://latex.codecogs.com/svg.image?u_%7Bij%7D>) are elements of the partial correlation matrix. KMO values above 0.6 are generally considered acceptable for factor analysis.

---

#### Principal Component Analysis (PCA)

Finds orthogonal components that maximize variance in the data. Reports component loadings, explained variance, cumulative variance ratios, and singular values. Optionally standardizes the input.

**Python implementation:** `sklearn.decomposition.PCA`

**Objective:** Find the weight vector ![formula](<https://latex.codecogs.com/svg.image?w>) that maximizes projected variance:

![formula](<https://latex.codecogs.com/svg.image?%5Ctext%7BVar%7D(Xw)%5Cto%5Cmax%5Cquad%5Ctext%7Bsubject%20to%7D%5Cquad%5C%7Cw%5C%7C%3D1>)

This is equivalent to finding the eigenvectors of the covariance matrix ![formula](<https://latex.codecogs.com/svg.image?%5CSigma%3D%5Cfrac%7B1%7D%7BN-1%7DX%5ETX>). The eigenvalues ![formula](<https://latex.codecogs.com/svg.image?%5Clambda_1%5Cgeq%5Clambda_2%5Cgeq%5Ccdots>) represent the variance explained by each component.

**Explained variance ratio:**

![formula](<https://latex.codecogs.com/svg.image?%5Ctext%7BEVR%7D_k%3D%5Cfrac%7B%5Clambda_k%7D%7B%5Csum_%7Bi%3D1%7D%5E%7Bp%7D%5Clambda_i%7D>)

---

#### Multidimensional Scaling (MDS)

Projects high-dimensional data into a lower-dimensional space (typically 2D) while preserving pairwise distances. Supports both metric and non-metric MDS.

**Python implementation:** `sklearn.manifold.MDS`

**Stress function (Kruskal's Stress-1):**

![formula](<https://latex.codecogs.com/svg.image?%5Csigma%3D%5Csqrt%7B%5Cfrac%7B%5Csum_%7Bi%3Cj%7D(d_%7Bij%7D-%5Cdelta_%7Bij%7D)%5E2%7D%7B%5Csum_%7Bi%3Cj%7Dd_%7Bij%7D%5E2%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?d_%7Bij%7D>) is the distance in the reduced space and ![formula](<https://latex.codecogs.com/svg.image?%5Cdelta_%7Bij%7D>) is the original distance (or a monotonic transformation for non-metric MDS). A stress value below 0.1 is generally considered a good fit.

---

### ⑥ Scale

#### Cronbach's Alpha

Measures the internal consistency (reliability) of a set of scale items. Reports raw alpha, standardized alpha, item-total correlations, and alpha-if-item-deleted for diagnostic purposes.

**Python implementation:** Custom implementation using `pandas` covariance matrix operations

**Cronbach's alpha (raw):**

![formula](<https://latex.codecogs.com/svg.image?%5Calpha%3D%5Cfrac%7BK%7D%7BK-1%7D%5Cleft(1-%5Cfrac%7B%5Csum_%7Bi%3D1%7D%5E%7BK%7D%5Csigma_%7BY_i%7D%5E2%7D%7B%5Csigma_X%5E2%7D%5Cright)>)

where ![formula](<https://latex.codecogs.com/svg.image?K>) is the number of items, ![formula](<https://latex.codecogs.com/svg.image?%5Csigma_%7BY_i%7D%5E2>) is the variance of item i, and ![formula](<https://latex.codecogs.com/svg.image?%5Csigma_X%5E2>) is the variance of the total score.

**Standardized alpha (based on mean inter-item correlation):**

![formula](<https://latex.codecogs.com/svg.image?%5Calpha_%7Bstd%7D%3D%5Cfrac%7BK%5Cbar%7Br%7D%7D%7B1%2B(K-1)%5Cbar%7Br%7D%7D>)

where ![formula](<https://latex.codecogs.com/svg.image?%5Cbar%7Br%7D>) is the mean of all pairwise Pearson correlations among items.

| Alpha Range | Interpretation |
|---|---|
| ≥ 0.9 | Excellent |
| 0.8 – 0.9 | Good |
| 0.7 – 0.8 | Acceptable |
| 0.6 – 0.7 | Questionable |
| < 0.6 | Poor |

---

## Installation

```bash
npm install @winm2m/inferential-stats-js
```

> **Peer dependency (optional):** If you want explicit control over the Pyodide version, install `pyodide` (>= 0.26.0) as a peer dependency. Otherwise the SDK loads Pyodide from the jsDelivr CDN automatically.

---

## Quick Start

```typescript
import { InferentialStats, PROGRESS_EVENT_NAME } from '@winm2m/inferential-stats-js';

// 1. Listen for initialization progress
window.addEventListener(PROGRESS_EVENT_NAME, (e: Event) => {
  const { stage, progress, message } = (e as CustomEvent).detail;
  console.log(`[${stage}] ${progress}% — ${message}`);
});

// 2. Create an instance (pass the URL to the bundled worker)
const stats = new InferentialStats({
  workerUrl: new URL('@winm2m/inferential-stats-js/worker', import.meta.url).href,
});

// 3. Initialize (loads Pyodide + Python packages inside the worker)
await stats.init();

// 4. Prepare your data
const data = [
  { group: 'A', score: 85 },
  { group: 'A', score: 90 },
  { group: 'B', score: 78 },
  { group: 'B', score: 82 },
  // ... more rows
];

// 5. Run an analysis
const result = await stats.anovaOneway({
  data,
  variable: 'score',
  groupVariable: 'group',
});

console.log(result);
// {
//   success: true,
//   data: { fStatistic: ..., pValue: ..., groupStats: [...], ... },
//   executionTimeMs: 42
// }

// 6. Clean up when done
stats.destroy();
```

---

## CDN / CodePen Usage

You can use the SDK directly in a browser or CodePen with no build step. The full demo code is identical to the local page below (except for CDN import paths).

- **Local demo source:** `src/dev/demo.html`
- **CodePen live demo:** https://codepen.io/editor/YoungjuneKwon/pen/019d3c97-35c0-743c-ad43-78e02225b008

---

## API Reference

All analysis methods are async and return `Promise<AnalysisResult<T>>`:

```typescript
interface AnalysisResult<T> {
  success: boolean;
  data: T;
  error?: string;
  executionTimeMs: number;
}
```

### Lifecycle Methods

| Method | Description |
|---|---|
| `new InferentialStats(config)` | Create an instance. `config.workerUrl` is required. Optional: `config.pyodideUrl`, `config.eventTarget`. |
| `init(): Promise<void>` | Load Pyodide and install Python packages inside the Web Worker. |
| `isInitialized(): boolean` | Returns `true` if the worker is ready. |
| `destroy(): void` | Terminate the Web Worker and release resources. |

### Analysis Methods (16 total)

#### Descriptive Statistics

| # | Method | Input → Output | Description |
|---|---|---|---|
| 1 | `frequencies(input)` | `FrequenciesInput` → `FrequenciesOutput` | Frequency distribution and relative percentages for a categorical variable. |
| 2 | `descriptives(input)` | `DescriptivesInput` → `DescriptivesOutput` | Summary statistics (mean, std, min, max, quartiles, skewness, kurtosis) for numeric variables. |
| 3 | `crosstabs(input)` | `CrosstabsInput` → `CrosstabsOutput` | Cross-tabulation with observed/expected counts, Chi-square test, and Cramér's V. |

#### Compare Means

| # | Method | Input → Output | Description |
|---|---|---|---|
| 4 | `ttestIndependent(input)` | `TTestIndependentInput` → `TTestIndependentOutput` | Independent-samples t-test with Levene's equality-of-variances test. |
| 5 | `ttestPaired(input)` | `TTestPairedInput` → `TTestPairedOutput` | Paired-samples t-test for dependent observations. |
| 6 | `anovaOneway(input)` | `AnovaInput` → `AnovaOutput` | One-way ANOVA with group descriptives and eta-squared effect size. |
| 7 | `posthocTukey(input)` | `PostHocInput` → `PostHocOutput` | Post-hoc Tukey HSD pairwise comparisons following ANOVA. |

#### Regression

| # | Method | Input → Output | Description |
|---|---|---|---|
| 8 | `linearRegression(input)` | `LinearRegressionInput` → `LinearRegressionOutput` | OLS linear regression with coefficients, R², F-test, and Durbin-Watson statistic. |
| 9 | `logisticBinary(input)` | `LogisticBinaryInput` → `LogisticBinaryOutput` | Binary logistic regression with odds ratios, pseudo-R², and model fit statistics. |
| 10 | `logisticMultinomial(input)` | `MultinomialLogisticInput` → `MultinomialLogisticOutput` | Multinomial logistic regression with per-category coefficients and odds ratios. |

#### Classify

| # | Method | Input → Output | Description |
|---|---|---|---|
| 11 | `kmeans(input)` | `KMeansInput` → `KMeansOutput` | K-Means clustering with cluster centers, labels, and inertia. |
| 12 | `hierarchicalCluster(input)` | `HierarchicalClusterInput` → `HierarchicalClusterOutput` | Agglomerative hierarchical clustering with linkage matrix and dendrogram data. |

#### Dimension Reduction

| # | Method | Input → Output | Description |
|---|---|---|---|
| 13 | `efa(input)` | `EFAInput` → `EFAOutput` | Exploratory Factor Analysis with rotation, KMO, and Bartlett's test. |
| 14 | `pca(input)` | `PCAInput` → `PCAOutput` | Principal Component Analysis with loadings and explained variance. |
| 15 | `mds(input)` | `MDSInput` → `MDSOutput` | Multidimensional Scaling with stress value and coordinate output. |

#### Scale

| # | Method | Input → Output | Description |
|---|---|---|---|
| 16 | `cronbachAlpha(input)` | `CronbachAlphaInput` → `CronbachAlphaOutput` | Reliability analysis with Cronbach's alpha, item-total correlations, and alpha-if-deleted. |

---

## Sample Data

The repository includes a ready-to-use sample dataset at `docs/sample-survey-data.json`, also hosted on GitHub Pages at:

```
https://winm2m.github.io/inferential-stats-js/sample-survey-data.json
```

This dataset contains **2,000 rows** of simulated survey data generated with a seeded pseudo-random number generator for full reproducibility.

### Schema

| Column | Type | Description |
|---|---|---|
| `id` | integer | Unique respondent ID (1–2000) |
| `gender` | string | `"Male"`, `"Female"`, or `"Other"` |
| `age_group` | string | `"20s"`, `"30s"`, `"40s"`, `"50s"`, `"60s"` |
| `nationality` | string | One of several country labels |
| `favorite_music` | string | Preferred music genre |
| `favorite_movie` | string | Preferred movie genre |
| `favorite_art` | string | Preferred art form |
| `music_satisfaction` | integer (1–5) | Satisfaction with music offerings (Likert scale) |
| `movie_satisfaction` | integer (1–5) | Satisfaction with movie offerings (Likert scale) |
| `art_satisfaction` | integer (1–5) | Satisfaction with art offerings (Likert scale) |
| `weekly_hours_music` | float | Weekly hours spent on music |
| `weekly_hours_movie` | float | Weekly hours spent on movies |
| `monthly_art_visits` | integer | Number of art gallery visits per month |

This dataset is suitable for exercising every analysis method in the SDK.

---

## Progress Event Handling

During `init()`, the SDK dispatches `CustomEvent`s to report progress through multiple stages (loading Pyodide, installing Python packages, etc.). You can use these events to drive a progress bar or loading indicator.

### Event Name

The event name is exported as the constant `PROGRESS_EVENT_NAME` (value: `'inferential-stats-progress'`).

### Event Detail

```typescript
interface ProgressDetail {
  stage: string;       // Current stage identifier (e.g. "pyodide", "packages")
  progress: number;    // Percentage complete (0–100)
  message: string;     // Human-readable status message
}
```

### Example: Full Progress Listener

```typescript
import { InferentialStats, PROGRESS_EVENT_NAME } from '@winm2m/inferential-stats-js';

// You can target any EventTarget — window, document, or a custom one.
const eventTarget = window;

const stats = new InferentialStats({
  workerUrl: '/dist/stats-worker.js',
  eventTarget, // Progress events will be dispatched here
});

// Register the listener BEFORE calling init()
eventTarget.addEventListener(PROGRESS_EVENT_NAME, ((event: CustomEvent) => {
  const { stage, progress, message } = event.detail as {
    stage: string;
    progress: number;
    message: string;
  };

  // Update a progress bar
  const progressBar = document.getElementById('progress-bar') as HTMLProgressElement;
  progressBar.value = progress;
  progressBar.max = 100;

  // Update a status label
  const statusLabel = document.getElementById('status');
  if (statusLabel) {
    statusLabel.textContent = `[${stage}] ${message} (${progress}%)`;
  }

  console.log(`[${stage}] ${progress}% — ${message}`);
}) as EventListener);

// Start initialization — progress events will fire throughout
await stats.init();
console.log('Ready!');
```

### Typical Progress Sequence

| Stage | Progress | Message |
|---|---|---|
| `pyodide` | 0 | Loading Pyodide runtime… |
| `pyodide` | 30 | Pyodide runtime loaded |
| `packages` | 40 | Installing pandas… |
| `packages` | 55 | Installing scipy… |
| `packages` | 70 | Installing statsmodels… |
| `packages` | 80 | Installing scikit-learn… |
| `packages` | 90 | Installing factor_analyzer… |
| `ready` | 100 | All packages installed. Ready. |

---

## License

[MIT](./LICENSE) © 2026 WinM2M
