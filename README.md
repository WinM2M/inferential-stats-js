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

> **Note on math rendering:** Equations are rendered as images via `latex.codecogs.com` so they display correctly on npm.

---

### ① Descriptive Statistics

#### Frequencies

Computes a frequency distribution for a categorical variable, including absolute counts, relative percentages, and cumulative percentages.

**Python implementation:** `pandas.Series.value_counts(normalize=True)`

**Relative frequency:**

![formula](https://latex.codecogs.com/svg.image?f_i=\frac{n_i}{N})

where $n_i$ is the count of category $i$ and $N$ is the total number of observations. Cumulative percentage is the running sum of $f_i \times 100$.

---

#### Descriptives

Produces summary statistics for one or more numeric variables: count, mean, standard deviation, min, max, quartiles (Q1, Q2, Q3), skewness, and kurtosis.

**Python implementation:** `pandas.DataFrame.describe()`, `scipy.stats.skew`, `scipy.stats.kurtosis`

**Arithmetic mean:**

![formula](https://latex.codecogs.com/svg.image?\bar{x}=\frac{1}{N}\sum_{i=1}^{N}x_i)

**Sample standard deviation (Bessel-corrected):**

![formula](https://latex.codecogs.com/svg.image?s=\sqrt{\frac{1}{N-1}\sum_{i=1}^{N}(x_i-\bar{x})^2})

**Skewness (Fisher):**

![formula](https://latex.codecogs.com/svg.image?g_1=\frac{m_3}{m_2^{3/2}},\quad m_k=\frac{1}{N}\sum_{i=1}^{N}(x_i-\bar{x})^k)

**Excess kurtosis (Fisher):**

![formula](https://latex.codecogs.com/svg.image?g_2=\frac{m_4}{m_2^2}-3)

---

#### Crosstabs

Cross-tabulates two categorical variables and tests for independence using Pearson's Chi-square test. Reports observed and expected counts, row/column/total percentages, and Cramér's V as an effect-size measure.

**Python implementation:** `pandas.crosstab`, `scipy.stats.chi2_contingency`

**Pearson's Chi-square statistic:**

![formula](https://latex.codecogs.com/svg.image?\chi^2=\sum\frac{(O_{ij}-E_{ij})^2}{E_{ij}})

where $O_{ij}$ is the observed frequency in cell $(i, j)$ and $E_{ij} = \frac{R_i \cdot C_j}{N}$ is the expected frequency under independence.

**Cramér's V:**

![formula](https://latex.codecogs.com/svg.image?V=\sqrt{\frac{\chi^2}{N\cdot(k-1)}})

where $k = \min(\text{rows}, \text{cols})$.

---

### ② Compare Means

#### Independent-Samples T-Test

Compares the means of a numeric variable between two independent groups. Automatically reports results for both equal-variance and unequal-variance (Welch's) assumptions. Includes Levene's test for equality of variances.

**Python implementation:** `scipy.stats.ttest_ind`, `scipy.stats.levene`

**T-statistic (equal variance assumed):**

![formula](https://latex.codecogs.com/svg.image?t=\frac{\bar{X}_1-\bar{X}_2}{S_p\sqrt{\frac{1}{n_1}+\frac{1}{n_2}}})

**Pooled standard deviation:**

![formula](https://latex.codecogs.com/svg.image?S_p=\sqrt{\frac{(n_1-1)s_1^2+(n_2-1)s_2^2}{n_1+n_2-2}})

**Degrees of freedom:** $df = n_1 + n_2 - 2$

When Levene's test is significant ($p < 0.05$), Welch's t-test is recommended, which uses the Welch–Satterthwaite approximation for degrees of freedom.

---

#### Paired-Samples T-Test

Tests whether the mean difference between two paired measurements is significantly different from zero.

**Python implementation:** `scipy.stats.ttest_rel`

**T-statistic:**

![formula](https://latex.codecogs.com/svg.image?t=\frac{\bar{D}}{S_D/\sqrt{n}})

where $\bar{D} = \frac{1}{n}\sum_{i=1}^{n}(X_{1i} - X_{2i})$ is the mean difference and $S_D$ is the standard deviation of the differences.

**Degrees of freedom:** $df = n - 1$

---

#### One-Way ANOVA

Tests whether the means of a numeric variable differ significantly across three or more groups.

**Python implementation:** `scipy.stats.f_oneway`

**F-statistic:**

![formula](https://latex.codecogs.com/svg.image?F=\frac{MS_{between}}{MS_{within}})

**Sum of Squares Between Groups:**

![formula](https://latex.codecogs.com/svg.image?SS_{between}=\sum_{j=1}^{k}n_j(\bar{X}_j-\bar{X})^2)

**Sum of Squares Within Groups:**

![formula](https://latex.codecogs.com/svg.image?SS_{within}=\sum_{j=1}^{k}\sum_{i=1}^{n_j}(X_{ij}-\bar{X}_j)^2)

**Mean Squares:**

![formula](https://latex.codecogs.com/svg.image?MS_{between}=\frac{SS_{between}}{k-1},\quad MS_{within}=\frac{SS_{within}}{N-k})

**Effect size (Eta-squared):**

![formula](https://latex.codecogs.com/svg.image?\eta^2=\frac{SS_{between}}{SS_{total}})

---

#### Post-hoc Tukey HSD

Performs pairwise comparisons of group means following a significant ANOVA result using the Studentized Range distribution.

**Python implementation:** `statsmodels.stats.multicomp.pairwise_tukeyhsd`

**Studentized range statistic:**

![formula](https://latex.codecogs.com/svg.image?q=\frac{\bar{X}_i-\bar{X}_j}{\sqrt{MS_W/n}})

where $MS_W$ is the within-group mean square from the ANOVA and $n$ is the harmonic mean of group sizes. The critical $q$ value is obtained from the Studentized Range distribution with $k$ groups and $N - k$ degrees of freedom.

---

### ③ Regression

#### Linear Regression (OLS)

Fits an Ordinary Least Squares regression model with one or more independent variables. Reports regression coefficients, standard errors, t-statistics, p-values, confidence intervals, $R^2$, adjusted $R^2$, F-test, and the Durbin-Watson statistic for autocorrelation detection.

**Python implementation:** `statsmodels.api.OLS`

**Model:**

![formula](https://latex.codecogs.com/svg.image?Y=\beta_0+\beta_1X_1+\cdots+\beta_pX_p+\epsilon)

where $\epsilon \sim N(0, \sigma^2)$.

**OLS estimator:**

![formula](https://latex.codecogs.com/svg.image?\hat{\beta}=(X^TX)^{-1}X^TY)

**Coefficient of determination:**

![formula](https://latex.codecogs.com/svg.image?R^2=1-\frac{SS_{res}}{SS_{tot}})

where $SS_{res} = \sum(Y_i - \hat{Y}_i)^2$ and $SS_{tot} = \sum(Y_i - \bar{Y})^2$.

---

#### Binary Logistic Regression

Models the probability of a binary outcome as a function of one or more independent variables. Reports coefficients (log-odds), odds ratios, z-statistics, p-values, pseudo-$R^2$, AIC, and BIC.

**Python implementation:** `statsmodels.discrete.discrete_model.Logit`

**Logit link function:**

![formula](https://latex.codecogs.com/svg.image?\ln\left(\frac{p}{1-p}\right)=\beta_0+\beta_1X_1+\cdots+\beta_pX_p)

**Predicted probability:**

![formula](https://latex.codecogs.com/svg.image?P(Y=1|X)=\frac{1}{1+e^{-(\beta_0+\beta_1X_1+\cdots+\beta_pX_p)}})

Coefficients are estimated by Maximum Likelihood Estimation (MLE). The odds ratio for predictor $j$ is $e^{\beta_j}$.

---

#### Multinomial Logistic Regression

Extends binary logistic regression to outcomes with more than two unordered categories. One category is designated as the reference; the model estimates log-odds of each other category relative to the reference.

**Python implementation:** `sklearn.linear_model.LogisticRegression(multi_class='multinomial')`

**Log-odds relative to reference category $K$:**

![formula](https://latex.codecogs.com/svg.image?\ln\left(\frac{P(Y=k)}{P(Y=K)}\right)=\beta_{k0}+\beta_{k1}X_1+\cdots+\beta_{kp}X_p)

for each category $k \neq K$.

**Predicted probability via softmax:**

![formula](https://latex.codecogs.com/svg.image?P(Y=k|X)=\frac{e^{\beta_{k0}+\beta_{k1}X_1+\cdots+\beta_{kp}X_p}}{\sum_{j=1}^{K}e^{\beta_{j0}+\beta_{j1}X_1+\cdots+\beta_{jp}X_p}})

---

### ④ Classify

#### K-Means Clustering

Partitions observations into $K$ clusters by iteratively assigning points to the nearest centroid and updating centroids until convergence.

**Python implementation:** `sklearn.cluster.KMeans`

**Objective function (inertia):**

![formula](https://latex.codecogs.com/svg.image?J=\sum_{j=1}^{K}\sum_{i\in C_j}\|x_i-\mu_j\|^2)

where $C_j$ is the set of observations in cluster $j$ and $\mu_j$ is the centroid. The algorithm minimizes $J$ using Lloyd's algorithm (Expectation-Maximization style).

---

#### Hierarchical (Agglomerative) Clustering

Builds a hierarchy of clusters using a bottom-up approach. Supports Ward, complete, average, and single linkage methods. Returns a full linkage matrix and dendrogram data for visualization.

**Python implementation:** `scipy.cluster.hierarchy.linkage`, `scipy.cluster.hierarchy.fcluster`

**Ward's minimum variance method** (default):

![formula](https://latex.codecogs.com/svg.image?\Delta(A,B)=\frac{n_A n_B}{n_A+n_B}\|\bar{x}_A-\bar{x}_B\|^2)

At each step, the pair of clusters $(A, B)$ that produces the smallest increase in total within-cluster variance is merged. Ward's method tends to produce compact, equally sized clusters.

---

### ⑤ Dimension Reduction

#### Exploratory Factor Analysis (EFA)

Discovers latent factors underlying a set of observed variables. Supports varimax, promax, oblimin, and no rotation. Reports factor loadings, communalities, eigenvalues, KMO measure of sampling adequacy, and Bartlett's test of sphericity.

**Python implementation:** `factor_analyzer.FactorAnalyzer(rotation='varimax')` — installed at runtime via `micropip`

**Factor model:**

![formula](https://latex.codecogs.com/svg.image?X=\Lambda F+\epsilon)

where $X$ is the observed variable vector, $\Lambda$ is the matrix of factor loadings, $F$ is the vector of latent factors, and $\epsilon$ is the unique variance.

**Kaiser-Meyer-Olkin (KMO) measure:**

![formula](https://latex.codecogs.com/svg.image?KMO=\frac{\sum\sum_{i\neq j} r_{ij}^2}{\sum\sum_{i\neq j} r_{ij}^2+\sum\sum_{i\neq j} u_{ij}^2})

where $r_{ij}$ are elements of the correlation matrix and $u_{ij}$ are elements of the partial correlation matrix. KMO values above 0.6 are generally considered acceptable for factor analysis.

---

#### Principal Component Analysis (PCA)

Finds orthogonal components that maximize variance in the data. Reports component loadings, explained variance, cumulative variance ratios, and singular values. Optionally standardizes the input.

**Python implementation:** `sklearn.decomposition.PCA`

**Objective:** Find the weight vector $w$ that maximizes projected variance:

![formula](https://latex.codecogs.com/svg.image?\text{Var}(Xw)\to\max\quad\text{subject to}\quad\|w\|=1)

This is equivalent to finding the eigenvectors of the covariance matrix $\Sigma = \frac{1}{N-1}X^TX$. The eigenvalues $\lambda_1 \geq \lambda_2 \geq \cdots$ represent the variance explained by each component.

**Explained variance ratio:**

![formula](https://latex.codecogs.com/svg.image?\text{EVR}_k=\frac{\lambda_k}{\sum_{i=1}^{p}\lambda_i})

---

#### Multidimensional Scaling (MDS)

Projects high-dimensional data into a lower-dimensional space (typically 2D) while preserving pairwise distances. Supports both metric and non-metric MDS.

**Python implementation:** `sklearn.manifold.MDS`

**Stress function (Kruskal's Stress-1):**

![formula](https://latex.codecogs.com/svg.image?\sigma=\sqrt{\frac{\sum_{i<j}(d_{ij}-\delta_{ij})^2}{\sum_{i<j}d_{ij}^2}})

where $d_{ij}$ is the distance in the reduced space and $\delta_{ij}$ is the original distance (or a monotonic transformation for non-metric MDS). A stress value below 0.1 is generally considered a good fit.

---

### ⑥ Scale

#### Cronbach's Alpha

Measures the internal consistency (reliability) of a set of scale items. Reports raw alpha, standardized alpha, item-total correlations, and alpha-if-item-deleted for diagnostic purposes.

**Python implementation:** Custom implementation using `pandas` covariance matrix operations

**Cronbach's alpha (raw):**

![formula](https://latex.codecogs.com/svg.image?\alpha=\frac{K}{K-1}\left(1-\frac{\sum_{i=1}^{K}\sigma_{Y_i}^2}{\sigma_X^2}\right))

where $K$ is the number of items, $\sigma_{Y_i}^2$ is the variance of item $i$, and $\sigma_X^2$ is the variance of the total score.

**Standardized alpha (based on mean inter-item correlation):**

![formula](https://latex.codecogs.com/svg.image?\alpha_{std}=\frac{K\bar{r}}{1+(K-1)\bar{r}})

where $\bar{r}$ is the mean of all pairwise Pearson correlations among items.

| $\alpha$ Range | Interpretation |
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
