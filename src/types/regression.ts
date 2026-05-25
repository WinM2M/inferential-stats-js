// Linear Regression
export interface LinearRegressionInput {
  data: Record<string, unknown>[];
  dependentVariable: string;
  independentVariables: string[];
  addConstant?: boolean; // default true
  method?: 'stepwise' | 'enter' | 'forward' | 'backward';
}

export interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  stdError: number;
  tStatistic: number;
  pValue: number;
  confidenceInterval: [number, number];
}

export interface RegressionModelSummary {
  r: number;
  rSquared: number;
  adjustedRSquared: number;
  stdErrorOfEstimate: number;
}

export interface RegressionAnovaRow {
  source: 'Regression' | 'Residual' | 'Total';
  sumOfSquares: number;
  df: number;
  meanSquare: number | null;
  fStatistic: number | null;
  pValue: number | null;
}

export interface RegressionAnovaTable {
  dependentVariable: string;
  rows: RegressionAnovaRow[];
}

export interface LinearRegressionOutput {
  rSquared: number;
  adjustedRSquared: number;
  modelSummary?: RegressionModelSummary;
  anova?: RegressionAnovaTable;
  fStatistic: number;
  fPValue: number;
  coefficients: RegressionCoefficient[];
  standardizedCoefficients?: RegressionCoefficient[];
  multicollinearity?: Array<{ variable: string; tolerance: number; vif: number }>;
  selectedVariables?: string[];
  method?: 'stepwise' | 'enter' | 'forward' | 'backward';
  residualStdError: number;
  observations: number;
  degreesOfFreedom: number;
  durbinWatson: number;
}

// Binary Logistic Regression
export interface LogisticBinaryInput {
  data: Record<string, unknown>[];
  dependentVariable: string;
  independentVariables: string[];
  addConstant?: boolean;
}

export interface LogisticCoefficient {
  variable: string;
  coefficient: number;
  stdError: number;
  zStatistic: number;
  pValue: number;
  oddsRatio: number;
  confidenceInterval: [number, number];
}

export interface LogisticBinaryOutput {
  coefficients: LogisticCoefficient[];
  pseudoRSquared: number;
  logLikelihood: number;
  llrPValue: number;
  aic: number;
  bic: number;
  observations: number;
  convergence: boolean;
}

// Multinomial Logistic Regression
export interface MultinomialLogisticInput {
  data: Record<string, unknown>[];
  dependentVariable: string;
  independentVariables: string[];
  referenceCategory?: string | number;
}

export interface MultinomialCoefficient {
  category: string;
  variable: string;
  coefficient: number;
  stdError: number;
  zStatistic: number;
  pValue: number;
  oddsRatio: number;
  confidenceInterval: [number, number];
}

export interface MultinomialLogisticOutput {
  coefficients: MultinomialCoefficient[];
  pseudoRSquared: number;
  logLikelihood: number;
  llrPValue: number;
  aic: number;
  bic: number;
  categories: string[];
  referenceCategory: string;
  observations: number;
}
