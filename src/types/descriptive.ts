// Frequencies
export interface FrequenciesInput {
  data: Record<string, unknown>[];
  variable: string;
}

export interface FrequencyItem {
  value: string | number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

export interface FrequenciesOutput {
  variable: string;
  totalCount: number;
  frequencies: FrequencyItem[];
}

// Descriptives
export interface DescriptivesInput {
  data: Record<string, unknown>[];
  variables: string[];
}

export interface DescriptiveStats {
  variable: string;
  count: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  q25: number;
  q50: number;
  q75: number;
  skewness: number;
  kurtosis: number;
}

export interface DescriptivesOutput {
  statistics: DescriptiveStats[];
}

// Crosstabs
export interface CrosstabsInput {
  data: Record<string, unknown>[];
  rowVariable: string;
  colVariable: string;
}

export interface CrosstabCell {
  row: string;
  col: string;
  observed: number;
  expected: number;
  rowPercentage: number;
  colPercentage: number;
  totalPercentage: number;
}

export interface CrosstabsOutput {
  rowVariable: string;
  colVariable: string;
  table: CrosstabCell[];
  rowLabels: string[];
  colLabels: string[];
  chiSquare: number;
  degreesOfFreedom: number;
  pValue: number;
  cramersV: number;
}
