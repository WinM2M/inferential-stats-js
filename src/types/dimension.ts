// EFA
export interface EFAInput {
  data: Record<string, unknown>[];
  variables: string[];
  /**
   * @deprecated Factor count is auto-selected by Kaiser criterion
   * (eigenvalue >= 1). Provided values are ignored.
   */
  nFactors?: number;
  /**
   * Rotation applied to the extracted factors. `varimax` keeps the factors
   * uncorrelated; `promax` and `oblimin` let them correlate and therefore add
   * `structureLoadings` and `factorCorrelation` to the output.
   */
  rotation?: FactorRotation;
  /**
   * Extraction method.
   *
   * - `paf` — principal axis factoring. The usual choice for scale
   *   development, and what SPSS calls "Principal Axis Factoring". Ours; see
   *   `python/dimension.ts`.
   * - `minres` — minimum residual (ordinary least squares). The default.
   * - `ml` — maximum likelihood.
   * - `principal` — principal *components*, despite the name factor_analyzer
   *   gives it. It does not estimate communalities, so it answers a different
   *   question than the three above.
   */
  method?: 'paf' | 'minres' | 'ml' | 'principal';
}

export interface EFAOutput {
  /**
   * Whether principal axis factoring reached its convergence tolerance.
   * `null` for the other extraction methods, which do not iterate here.
   *
   * A solution that did not converge is unstable and will not reproduce, so a
   * number taken from it should not be written down without saying so.
   */
  converged?: boolean | null;
  /** Iterations principal axis factoring used. `null` elsewhere. */
  iterations?: number | null;
  /**
   * Items whose communality hit the ceiling -- a Heywood case. Usually a sign
   * that the model asks for more factors than the data carries, or that the
   * sample is small. `null` outside principal axis factoring.
   */
  heywoodItems?: string[] | null;
  /**
   * Share of the total variance each factor accounts for (SSL / variable
   * count). This is the one a table should print as a percentage.
   *
   * Note that `variance` is **not** this: it holds the sums of squared
   * loadings, which sit on the eigenvalue scale and routinely exceed 1.
   */
  explainedVarianceRatio?: number[];
  /** Running total of `explainedVarianceRatio`. Same values as `cumulativeVariance`. */
  cumulativeVarianceRatio?: number[];
  /** Variable order, so a table does not have to guess it from an object's keys. */
  variables?: string[];
  /** Pattern matrix under oblique rotation, rotated loadings otherwise. */
  loadings: Record<string, number[]>;
  /**
   * Row order for the loading tables, SPSS "Sort by size": grouped by the
   * factor a variable loads on most, then by descending absolute loading.
   * Same values as `loadings`, which keeps the input order.
   */
  sortedLoadings?: Array<{
    variable: string;
    dominantComponent: number;
    dominantLoading: number;
    loadings: number[];
  }>;
  /** Whether `sortedLoadings` is sorted or just the input order. */
  sortBySize?: boolean;
  /** Structure matrix (S = P x Phi). Oblique rotation only, else null. */
  structureLoadings?: Record<string, number[]> | null;
  /** Factor correlation matrix Phi. Oblique rotation only, else null. */
  factorCorrelation?: number[][] | null;
  eigenvalues: number[];
  variance: number[];
  cumulativeVariance: number[];
  communalities: Record<string, number>;
  uniquenesses: Record<string, number>;
  nFactors: number;
  rotation: string;
  /** False when rotation was requested but could not be applied (one factor). */
  rotationApplied?: boolean;
  /** True when the applied rotation lets the factors correlate. */
  rotationIsOblique?: boolean;
  kmo: number;
  bartlettChi2: number;
  bartlettPValue: number;
}

/**
 * Rotations this SDK supports, in both EFA and PCA.
 *
 * `varimax` is orthogonal: the factors stay uncorrelated. `promax` and
 * `oblimin` are oblique: they estimate the correlations among factors, so the
 * returned loadings are a pattern matrix and the output carries the structure
 * matrix and the factor correlation matrix alongside it.
 */
export type FactorRotation = 'varimax' | 'promax' | 'oblimin' | 'none';

// PCA
export interface PCAInput {
  data: Record<string, unknown>[];
  variables: string[];
  nComponents?: number;
  standardize?: boolean;
  rotation?: FactorRotation;
  sortBySize?: boolean;
}

export interface PCAVarianceRow {
  component: number;
  eigenvalue: number;
  /**
   * Null in the rotation rows of an oblique solution: correlated components
   * overlap, so their sums of squared loadings do not add up to the extracted
   * variance and no share of it can be attributed to each one.
   */
  variancePercent: number | null;
  cumulativePercent: number | null;
}

export interface PCAOutput {
  components: number[][];
  eigenvalues?: number[];
  explainedVariance: number[];
  explainedVarianceRatio: number[];
  cumulativeVarianceRatio: number[];
  /** Pattern matrix under oblique rotation, rotated loadings otherwise. */
  loadings: Record<string, number[]>;
  /** Structure matrix (S = P x Phi). Oblique rotation only, else null. */
  structureLoadings?: Record<string, number[]> | null;
  /** Component correlation matrix Phi. Oblique rotation only, else null. */
  factorCorrelation?: number[][] | null;
  /** Extraction communalities, read off the unrotated solution. */
  communalities?: Record<string, number>;
  sortedLoadings?: Array<{ variable: string; dominantComponent: number; dominantLoading: number; loadings: number[] }>;
  totalVarianceExplained?: {
    initial: PCAVarianceRow[];
    extraction: PCAVarianceRow[];
    rotation: PCAVarianceRow[];
  };
  rotation?: string;
  /** False when rotation was requested but could not be applied (one component). */
  rotationApplied?: boolean;
  /** True when the applied rotation lets the components correlate. */
  rotationIsOblique?: boolean;
  sortBySize?: boolean;
  singularValues: number[];
  nComponents: number;
  variables?: string[];
}

// MDS
export interface MDSInput {
  data: Record<string, unknown>[];
  variables: string[];
  nComponents?: number; // default 2
  metric?: boolean;
  maxIterations?: number;
  randomState?: number;
}

export interface MDSOutput {
  coordinates: number[][];
  stress: number;
  nComponents: number;
  labels?: string[];
}
