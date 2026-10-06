# Cross-checking results against R and SPSS

## Why this exists

`e2e/nist-strd.browser.test.ts` checks two procedures — `linearRegression` and
`anovaOneway` — against values certified by NIST in extended precision. That is the
strongest evidence available, but NIST only certifies four procedure families, so
fourteen of the sixteen analysis methods are currently covered by tests that assert
an analysis *runs* and returns plausible numbers, not that the numbers are *right*.

This document specifies how those fifteen get a reference value, using the two
packages researchers actually compare against: R and IBM SPSS Statistics.

## What a disagreement means

A difference between this SDK and SPSS is one of three things, and the suite must
tell them apart rather than reporting a single "mismatch":

1. **A defect.** We compute the quantity incorrectly. Fix it.
2. **A convention difference.** Both results are correct for their own definition
   of the statistic. Every statistics package makes such choices, and they are not
   interchangeable — `scipy.stats.levene` centres on the median (Brown–Forsythe)
   while SPSS centres on the mean. Neither is wrong; silently matching whichever
   one the test happened to encode *is* wrong.
3. **An indeterminacy.** The quantity is only defined up to a sign, a rotation, or
   a permutation — factor loadings, MDS coordinates, cluster labels. Comparing the
   raw numbers is meaningless here; see "Comparing indeterminate output" below.

For every procedure, this suite declares which of the three applies before the
tolerance is chosen. Case 2 produces a documented contract in the README, not a
loosened tolerance.

## Three tiers of reference value

| Tier | Source | Regenerable | Role |
| :--- | :--- | :--- | :--- |
| 1 | NIST StRD certified values | `node scripts/fetch-nist-strd.mjs` | Absolute truth where it exists. Already in place. |
| 2 | R | `Rscript scripts/generate-r-reference.R` | Broad coverage, fully automatable, open source. |
| 3 | IBM SPSS Statistics | Manual, once, by a licence holder | Matches the convention our users report in papers. |

Tier 3 cannot be automated: SPSS is proprietary and has no redistributable runtime.
The procedure is therefore inverted — we generate the input data and a `.sps`
syntax file, a human runs it once on a licensed installation, and the output is
frozen into a committed fixture together with the version string that produced it.

Tiers 2 and 3 both write the *same* fixture schema, so one test body checks both.

**The committed fixtures are the test input.** Neither R nor SPSS is needed to run
the suite — only to regenerate a fixture. This is the pattern `nist-strd.json`
already uses, and it keeps CI free of a statistics toolchain.

## Datasets

Reference data has to satisfy three things: it must be **retrievable from the
archive that publishes it**, so that a reader can verify the committed copy
rather than take our word for it; it must be **identical for all three packages**,
so that a disagreement cannot be an artefact of the input; and it must be small
enough to read in a diff.

The first of those rules out a package's bundled copy, even a familiar one, and
the reason is concrete. UCI's `iris.data` carries two transcription errors
against Fisher's 1936 table — UCI's own `iris.names` documents them: the 35th
sample should be `4.9,3.1,1.5,0.2` and the 38th `4.9,3.6,1.4,0.1` — while R's
built-in `iris` follows the paper. Neither copy is corrupt; they are different
tables. A reference generated from `datasets::iris` and compared against a
downloaded `iris.data` would be comparing two datasets and calling the difference
a numerical error.

So `scripts/fetch-cross-check-data.mjs` downloads each file from its publisher,
pins its SHA-256, normalises it to a CSV with a header row, and records the URL,
digest, retrieval date and citation in
`e2e/fixtures/cross-check/data/provenance.json`. All three of this SDK, R and
SPSS then read those CSVs.

| Dataset | Publisher | Shape | Used for |
| :--- | :--- | :--- | :--- |
| Iris | UCI 53 — Fisher (1936) | 150 × 5 | `descriptives`, `anovaOneway`, `posthocTukey` |
| Auto MPG | UCI 9 — Quinlan (1993), StatLib/CMU | 398 × 9 | `linearRegression`, `crosstabs` (3 × 5) |
| Wine | UCI 109 — Aeberhard et al. (1992) | 178 × 14 | `ttestIndependent` |
| Haberman's Survival | UCI 43 — Haberman (1976) | 306 × 4 | `ttestIndependent`, `logisticBinary` |
| Breast Cancer Wisconsin (Original) | UCI 15 — Wolberg & Mangasarian (1990) | 699 × 11 | `cronbachAlpha`, `ttestPaired` |
| SPECT Heart (training split) | UCI 95 — Kurgan et al. (2001) | 80 × 23 | `crosstabs` (2 × 2) |

Each is carried for a property no substitute had:

- **Auto MPG** has 6 missing `horsepower` values. Keeping them means listwise
  deletion is compared rather than hidden: `lm`, SPSS `/MISSING=LISTWISE` and the
  Python layer must all arrive at n = 392.
- **Wine** is the only one of the six where the mean-centred and median-centred
  Levene tests fall on opposite sides of .05 (`proline`, cultivars 2 vs 3). That
  is what makes the Levene convention observable in a result rather than only in
  an auxiliary statistic.
- **Haberman** codes its outcome 1/2, which is how survey and registry data
  normally arrive, and exercises what `logisticBinary` does with an outcome that
  is binary but not 0/1.
- **Breast Cancer Wisconsin** grades nine cytological attributes 1–10 on one
  scale, which is what makes them a commensurable item set for a reliability
  coefficient; its 16 missing `bare_nuclei` values exercise `caseProcessing`.
- **SPECT Heart** is binary in all 23 attributes, which supplies a 2 × 2
  contingency table — and so the continuity-correction question — without binning
  or filtering anything. The published training split is used as published rather
  than recombined with the test split.

NIST StRD remains the tier-1 source and keeps its own pipeline
(`scripts/fetch-nist-strd.mjs`, `e2e/fixtures/nist-strd.json`); it is not fetched
here. It publishes no categorical data and certifies only linear least squares,
ANOVA, univariate summary statistics and nonlinear regression, so it cannot cover
the procedures in this file.

SPSS's own sample files (`Employee data.sav` and the rest) are deliberately *not*
used: they are licensed to SPSS installations and cannot be committed here.

## Procedure map

`Risk` is the prior probability of a disagreement, and what kind.

| SDK method | R reference | SPSS procedure | Risk |
| :--- | :--- | :--- | :--- |
| `frequencies` | `table`, `cumsum` | `FREQUENCIES` | low |
| `descriptives` | `e1071::skewness(type=2)`, `kurtosis(type=2)`, `quantile(type=7)` | `DESCRIPTIVES`, `EXAMINE` | **convention** — see below |
| `crosstabs` | `chisq.test(correct=FALSE)` | `CROSSTABS /STATISTICS=CHISQ PHI` | **convention** — Yates |
| `ttestIndependent` | `t.test`, `car::leveneTest(center=mean)` | `T-TEST GROUPS` | **convention** — Levene centre |
| `ttestPaired` | `t.test(paired=TRUE)` | `T-TEST PAIRS` | low |
| `anovaOneway` | `aov` + `summary` | `ONEWAY /STATISTICS` | low (NIST-covered) |
| `posthocTukey` | `TukeyHSD` | `ONEWAY /POSTHOC=TUKEY` | medium — unequal n uses Tukey–Kramer |
| `linearRegression` | `lm` | `REGRESSION /METHOD=ENTER` | **defect** — issue #13 |
| `logisticBinary` | `glm(family=binomial)` | `LOGISTIC REGRESSION` | medium — pseudo-R² definition |
| `logisticMultinomial` | `nnet::multinom` | `NOMREG` | **defect** — issue #14, plus regularization |
| `kmeans` | `stats::kmeans` | `QUICK CLUSTER` | indeterminate — labels, seeding |
| `hierarchicalCluster` | `hclust(method="ward.D2")` | `CLUSTER /METHOD=WARD` | **convention** — `ward.D` vs `ward.D2` |
| `efa` | `psych::fa`, `psych::KMO`, `psych::cortest.bartlett` | `FACTOR /EXTRACTION` | indeterminate + convention |
| `pca` | `prcomp`, `psych::principal` | `FACTOR /EXTRACTION=PC` | indeterminate — loading sign |
| `mds` | `cmdscale`, `MASS::isoMDS` | `PROXSCAL` / `ALSCAL` | indeterminate — rotation |
| `cronbachAlpha` | `psych::alpha` | `RELIABILITY /MODEL=ALPHA` | low |

### Known convention differences to resolve first

These are read off the implementation, not yet measured. They are the suite's first
three assertions precisely because each is a plausible silent mismatch.

| Site | This SDK | SPSS default |
| :--- | :--- | :--- |
| `src/python/descriptive.ts:71` — `scipy.stats.skew(col)` / `kurtosis(col)` | `bias=True`: population third and fourth moments | G1 and G2, the sample-adjusted forms, reported with their standard errors |
| `src/python/compare-means.ts:32` — `scipy.stats.levene(g1, g2)` | `center='median'`: Brown–Forsythe | Levene centred on the group mean |
| `src/python/descriptive.ts:88` — `scipy.stats.chi2_contingency(ct)` | `correction=True`: Yates applied to any 2 × 2 | Pearson chi-square uncorrected on the primary row; continuity correction is a separate row |

The Levene case is the consequential one. `equal_var` is chosen from
`levene_p > 0.05` (`compare-means.ts:33`), so a different Levene statistic can
select a different t-test and change `ttestIndependent`'s headline result — not
just an auxiliary number.

Resolution for each is one of: change the call to the SPSS convention; keep the
current convention and document it in README "Numerical Accuracy"; or report both.
The decision is recorded in the table in §"Declared conventions" once made.

## Tolerances

A single tolerance across the suite would be wrong, because different procedures
are limited by different things.

**Closed-form procedures, against R: `1e-9` relative.** Where R and this SDK
evaluate the same closed-form estimator — t-tests, ANOVA, OLS, chi-square,
Cronbach's alpha — the only gap is floating-point association order, and the NIST
work established that this codebase holds nine digits on well-conditioned
problems. A looser bound here would hide real drift. This is the fixture default.

**Iteratively fitted models: `1e-5` relative, per case.** A logistic fit has no
closed form. R's `glm` iterates by IRLS until the relative deviance change falls
below `1e-8`; statsmodels maximises by Newton–Raphson against its own tolerance.
Neither stops at the exact maximum, so the two land a convergence threshold
apart, not a rounding error apart. Measured across the 27 compared quantities of
`logistic-binary/mtcars/am~wt+hp`: 5.3e-8 worst on a standard error, 4.1e-7 on a
p-value, 8.9e-7 on a confidence bound — the bound grows along that list because a
confidence bound is `coefficient ± 1.96 × se` and carries both errors. Tying the
tolerance to either solver's stopping rule would be tying it to an implementation
detail of the reference, so these cases carry an explicit override and the
generator records the measurement behind it.

**Against SPSS: set once the first export exists.** The constraint depends on how
the value is captured. A number transcribed from a pivot table carries a
quantization of half its last printed digit — 5e-4 at the default three decimals —
which is why `scripts/spss/cross-check.sps` routes output through OMS to OXML
instead: OXML keeps the unrounded double in each cell's `number` attribute beside
the formatted `text`, so the reference arrives at full precision and the bound can
be set by the arithmetic rather than by the display. The fallback, if a value
turns out to be available only as formatted text, is `5e-4` absolute or `1e-3`
relative, whichever is larger.

Tolerances are relative rather than absolute wherever the quantities span
magnitudes, for the reason documented in `nist-strd.browser.test.ts`: the values
at stake here run from eigenvalues near 1e-2 to regression sums of squares near
1e5. `expectCloseTo` accepts either bound so that an absolute one can be supplied
where the reference is quantized.

`expectNotFlattenedToZero` is reused. Returning exactly `0` for a nonzero
reference value is a distinct failure mode — it is what issue #12 did — and a
relative tolerance reports it merely as "100% off".

## Comparing indeterminate output

Four procedures return quantities that are not unique, and comparing them
elementwise produces failures that mean nothing.

| Quantity | Invariant compared instead |
| :--- | :--- |
| PCA / EFA loadings | column-wise absolute values after aligning each column's sign to its largest-magnitude element; eigenvalues and explained variance directly |
| MDS coordinates | the full pairwise distance matrix between points, plus `stress`; never the coordinates |
| Cluster assignments (k-means, hierarchical) | adjusted Rand index against the reference partition, plus cluster sizes as a sorted multiset |
| Factor order | columns sorted by eigenvalue before comparison |

Where an invariant cannot be defined — k-means with a random start is a different
fit, not a different labelling of the same fit — the reference is generated with a
fixed seed on both sides and the test asserts the *partition*, with the numeric
centroids checked only for the deterministic case `k = 2` on `USArrests`.

## File layout

```
docs/validation/
  cross-check-r-spss.md          this document
  spss-manual-run.md             step-by-step for the licence holder
  report-2026-10-06-*.md         what a run found, with the measured differences
scripts/
  fetch-cross-check-data.mjs     downloads data/*.csv from UCI, SHA-256 pinned
  generate-r-reference.R         data/*.csv -> r-reference.json
  spss/cross-check.sps           syntax run by hand, emits one table per block
  import-spss-reference.mjs      SPSS export -> spss-reference.json
e2e/
  cross-check.browser.test.ts    one body, both fixtures
  fixtures/cross-check/
    data/*.csv                   the shared input
    data/provenance.json         URL, SHA-256, citation per dataset
    r-reference.json             tier 2
    spss-reference.json          tier 3
```

## Fixture schema

Both tiers emit the same shape, so the test body does not branch on provenance:

```jsonc
{
  "source": "R 4.2.2 Patched (2022-11-10 r83330)",   // or "IBM SPSS Statistics 29.0.1.0"
  "generatedAt": "2026-10-06",
  "tolerance": { "relative": 1e-9 },                  // or { "absolute": 5e-4, "relative": 1e-3 }
  "cases": [
    {
      "id": "anova-oneway/iris/Sepal.Length~Species",
      "dataset": "iris",
      "procedure": "anovaOneway",
      "input": { "variable": "Sepal.Length", "groupVariable": "Species" },
      "status": "check",             // "check" | "known-defect" | "convention-pending"
      "note": null,                  // issue number, or the convention at stake
      "expected": { "fStatistic": 119.2645, "sumOfSquaresBetween": 63.2121 }
    }
  ]
}
```

`expected` keys are the SDK's own output field names, so a case is written once and
read without a mapping layer. `tolerance` is optional and overrides the fixture
default for that case alone.

**One case per claim.** Where a procedure has both a sound part and a divergent
part — `crosstabs` computes the chi-square correctly but labels a numeric category
`"1.0"` where R and SPSS print `"1"` — they are separate cases. Folding them
together would put one `it.fails` over both, and a chi-square that later drifted
would be reported as "still failing" rather than as a new failure. A case whose `status` is not `check` runs as
`it.fails`, which keeps the divergence executable rather than absorbed into a
looser bound — the device `nist-strd.browser.test.ts` uses for Longley. The suite
is green while a divergence is open, and turns red the moment it is silently
fixed or silently worsened.

## Declared conventions

Filled in as each is resolved; mirrored into README "Numerical Accuracy" so the
contract is visible to users, not just to this suite.

| Statistic | Convention this SDK follows | Differs from | Rationale |
| :--- | :--- | :--- | :--- |
| _(pending — the four `convention-pending` cases below)_ | | | |

## What the first R run found

Eighteen cases against R 4.2.2, comparing 318 numeric quantities and 16 category
labels. Ten cases agree; the rest divide as the framing above predicts. The
measured per-case differences are tabulated in
[`report-2026-10-06-r-crosscheck.md`](./report-2026-10-06-r-crosscheck.md).

**Confirmed correct** — 254 compared quantities across ten cases, of which 239
are within 1e-9 and the fifteen that are not all belong to the logistic case.
The nine closed-form cases do not have a single quantity outside 1e-9; their
worst is 1.5e-11, on a t-test confidence bound. Covered: `descriptives` (moments,
quartiles, dispersion), `crosstabs` chi-square on a 3 × 5 table and the Yates
value on a 2 × 2, both arms of `ttestIndependent` plus median-centred Levene,
`ttestPaired`, `anovaOneway`, `linearRegression` with `method: 'enter'`,
`logisticBinary` on a 0/1 outcome, and `cronbachAlpha` including every item-total
column. Two of those also settle a question beyond their own numbers:
`linearRegression` reports `observations: 392`, so all three packages dropped the
same 6 rows with a missing `horsepower`, and `cronbachAlpha` reports 683 valid of
699, matching R's listwise split over the 16 missing `bare_nuclei` values.

**Defects, new — all three fixed.**

- `posthocTukey` returned every value truncated to four decimals, and all three
  p-values came back as exactly `0` where R reports 3.4e-14, 3.0e-15 and 8.3e-9 —
  the #12 flattening, reproduced. It read
  `pairwise_tukeyhsd(...).summary().data`, statsmodels' *display* table, which is
  formatted for printing. Removing the explicit `round(x, 6)` calls in PR #17 did
  not reach it, because the rounding belonged to the object being read rather
  than to our own code. **#18** switched the extraction to `meandiffs`,
  `pvalues`, `confint` and `reject`. The mean differences and all six confidence
  bounds now agree to better than 1e-9; the three tail p-values agree to 1.9e-14
  absolute, which is a difference between `psturng` and `ptukey` rather than a
  rounding loss, and the case carries an absolute tolerance leg that says so.
- `crosstabs` labelled an integer-coded category `"1.0"` where R and SPSS print
  `"1"`. The cause is a level below `crosstabs`: the bridge marshals every
  numeric column as a `Float64Array`
  (`bridge/columnar-serializer.ts:49`), so an integer category arrives in Python
  as a float. **#19** added a `category_label` helper to the shared Python
  preamble and applied it to the crosstab row and column labels, the `row`/`col`
  fields of each cell, `anovaOneway`'s `groupStats[].group` (which is declared a
  string and was emitting a number), and `posthocTukey`'s group labels.
- `logisticBinary` could not fit an outcome coded 1/2 — the norm in registry and
  survey data. `sm.Logit` rejected it with `ValueError: endog must be in the unit
  interval.` and the traceback reached the caller as the error string. SPSS
  `LOGISTIC REGRESSION` and R's `glm(factor(y) ~ .)` both fit such an outcome by
  modelling the higher value as the event. **#20** encodes the higher of the two
  observed values as the event, reports the encoding as `eventValue` /
  `referenceValue` rather than recoding silently, and rejects an outcome with
  more than two distinct values with a stated reason instead of a traceback.

**Defect, already filed.** #13 reproduces exactly as described: with `method`
unset, `linearRegression` fits a stepwise subset instead of the model requested,
dropping `displacement` and shrinking the remaining standard errors by 13–34%,
which reports significance optimistically. The same call with `method: 'enter'`
matches `lm` to 4.6e-13 across coefficients, standard errors, t, p, confidence
intervals, the ANOVA table and Durbin–Watson — so the defect is the default, not
the estimator.

**Conventions to decide** — the three predicted from reading the code, all
confirmed, plus one that has no counterpart to compare against:

1. `skewness`/`kurtosis` are the plain moment ratios g1/g2; SPSS reports the
   sample-adjusted G1/G2. The skewness difference is exactly 1.003% on all four
   iris variables, which is √(n(n−1))/(n−2) at n = 150 — one absent correction
   factor, not an arithmetic error. Kurtosis reaches 17% where excess kurtosis is
   near zero.
2. Levene is centred on the median (Brown–Forsythe); SPSS centres on the mean.
   On wine `proline` between cultivars 2 and 3 the two fall on opposite sides of
   .05 — mean p = .0403, median p = .0824 — so the convention decides which
   t-test the SDK presents as the result, not merely an auxiliary number.
3. A 2 × 2 chi-square has Yates applied; SPSS puts uncorrected Pearson on the
   primary row and the continuity correction on a separate one. On SPECT
   `diagnosis × f1` that is χ² 1.947 against 2.650.
4. `pseudoRSquared` is McFadden's. SPSS prints Cox & Snell and Nagelkerke and no
   McFadden column at all, so there is nothing to compare it against — the
   README has to name which one it is.

## Progress

| # | Step | State |
| :--- | :--- | :--- |
| 1 | Download the six datasets from their publishers, SHA-256 pinned | done — `scripts/fetch-cross-check-data.mjs` |
| 2 | R reference values for the closed-form procedures | done — 18 cases |
| 3 | Cross-check test body, tier 2 wired | done — `e2e/cross-check.browser.test.ts` |
| 4 | Resolve the four convention questions | open — needs a decision per row |
| 5 | Fix the three new defects | done — #18, #19, #20 |
| 6 | `cross-check.sps` + manual-run document | done |
| 7 | SPSS run by licence holder, importer written against the export | open |
| 8 | Indeterminate-output invariants (`efa`, `pca`, `mds`, both clusterings) | open |
| 9 | README contract for every declared convention | open |

`logisticMultinomial` (#14) is not covered yet: with `stdError`, `z`, `p` and the
confidence intervals hardcoded to `0.0`, there is nothing to compare, and the
estimator underneath it is `sklearn.linear_model.LogisticRegression`, which
applies L2 regularization by default and so maximises a penalized likelihood
rather than the likelihood `nnet::multinom` and SPSS's `NOMREG` maximise. It joins
the suite once #14 is addressed.
