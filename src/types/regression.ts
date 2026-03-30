// Linear Regression
export interface LinearRegressionInput {
  data: Record<string, unknown>[];
  dependentVariable: string;
  independentVariables: string[];
  addConstant?: boolean; // default true
}

export interface RegressionCoefficient {
  variable: string;
  coefficient: number;
  stdError: number;
  tStatistic: number;
  pValue: number;
  confidenceInterval: [number, number];
}

export interface LinearRegressionOutput {
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number;
  fPValue: number;
  coefficients: RegressionCoefficient[];
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
