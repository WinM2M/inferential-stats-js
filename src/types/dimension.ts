// EFA
export interface EFAInput {
  data: Record<string, unknown>[];
  variables: string[];
  nFactors: number;
  rotation?: 'varimax' | 'promax' | 'oblimin' | 'none';
  method?: 'minres' | 'ml' | 'principal';
}

export interface EFAOutput {
  loadings: Record<string, number[]>;
  eigenvalues: number[];
  variance: number[];
  cumulativeVariance: number[];
  communalities: Record<string, number>;
  uniquenesses: Record<string, number>;
  nFactors: number;
  rotation: string;
  kmo: number;
  bartlettChi2: number;
  bartlettPValue: number;
}

// PCA
export interface PCAInput {
  data: Record<string, unknown>[];
  variables: string[];
  nComponents?: number;
  standardize?: boolean;
}

export interface PCAOutput {
  components: number[][];
  explainedVariance: number[];
  explainedVarianceRatio: number[];
  cumulativeVarianceRatio: number[];
  loadings: Record<string, number[]>;
  singularValues: number[];
  nComponents: number;
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
