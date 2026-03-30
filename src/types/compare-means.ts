// Independent Samples T-Test
export interface TTestIndependentInput {
  data: Record<string, unknown>[];
  variable: string;
  groupVariable: string;
  group1Value: string | number;
  group2Value: string | number;
  equalVariance?: boolean; // if not specified, Levene's test determines
}

export interface TTestResult {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  meanDifference: number;
  confidenceInterval: [number, number];
  group1Mean: number;
  group1Std: number;
  group1N: number;
  group2Mean: number;
  group2Std: number;
  group2N: number;
}

export interface LeveneTestResult {
  statistic: number;
  pValue: number;
  equalVariance: boolean;
}

export interface TTestIndependentOutput {
  leveneTest: LeveneTestResult;
  equalVariance: TTestResult;
  unequalVariance: TTestResult;
}

// Paired Samples T-Test
export interface TTestPairedInput {
  data: Record<string, unknown>[];
  variable1: string;
  variable2: string;
}

export interface TTestPairedOutput {
  tStatistic: number;
  degreesOfFreedom: number;
  pValue: number;
  meanDifference: number;
  stdDifference: number;
  confidenceInterval: [number, number];
  mean1: number;
  mean2: number;
  n: number;
}

// One-Way ANOVA
export interface AnovaInput {
  data: Record<string, unknown>[];
  variable: string;
  groupVariable: string;
}

export interface AnovaGroupStats {
  group: string;
  n: number;
  mean: number;
  std: number;
}

export interface AnovaOutput {
  fStatistic: number;
  pValue: number;
  degreesOfFreedomBetween: number;
  degreesOfFreedomWithin: number;
  sumOfSquaresBetween: number;
  sumOfSquaresWithin: number;
  meanSquareBetween: number;
  meanSquareWithin: number;
  groupStats: AnovaGroupStats[];
  etaSquared: number;
}

// Post-hoc Tukey HSD
export interface PostHocInput {
  data: Record<string, unknown>[];
  variable: string;
  groupVariable: string;
  alpha?: number; // default 0.05
}

export interface PostHocComparison {
  group1: string;
  group2: string;
  meanDifference: number;
  pValue: number;
  lowerCI: number;
  upperCI: number;
  reject: boolean;
}

export interface PostHocOutput {
  comparisons: PostHocComparison[];
  alpha: number;
}
