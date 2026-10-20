// Frequencies
export interface FrequenciesInput {
  data: Record<string, unknown>[];
  /** A single variable. Ignored when `variables` is given. */
  variable?: string;
  /** Several variables: one frequency table each, in this order. */
  variables?: string[];
}

export interface FrequencyItem {
  value: string | number;
  count: number;
  percentage: number;
  cumulativePercentage: number;
}

export interface FrequencyTable {
  variable: string;
  totalCount: number;
  frequencies: FrequencyItem[];
}

export interface FrequenciesOutput extends FrequencyTable {
  /**
   * One entry per requested variable. The top-level `variable`, `totalCount`
   * and `frequencies` repeat the first entry so callers written against the
   * single-variable shape keep working.
   */
  tables?: FrequencyTable[];
}

// Multiple response (choose all that apply)
export interface MultipleResponseInput {
  data: Record<string, unknown>[];
  /** One 0/1 column per option, in the order the options are shown. */
  variables: string[];
}

export interface MultipleResponseItem {
  variable: string;
  count: number;
  /** Share of all picks. These sum to 100. */
  percentOfResponses: number;
  /** Share of respondents who answered. These sum past 100 -- one person picks several. */
  percentOfCases: number;
}

export interface MultipleResponseOutput {
  variables: string[];
  items: MultipleResponseItem[];
  totalResponses: number;
  /** Respondents who answered the question at all. */
  validCases: number;
  missingCases: number;
  percentOfCasesTotal: number;
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
  /** A single row variable. Ignored when `rowVariables` is given. */
  rowVariable?: string;
  /** Several row variables: one table each, all against `colVariable`. */
  rowVariables?: string[];
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

export interface CrosstabTable {
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

export interface CrosstabsOutput extends CrosstabTable {
  /**
   * One entry per row variable. The top-level fields repeat the first entry so
   * callers written against the single-table shape keep working.
   */
  tables?: CrosstabTable[];
}
