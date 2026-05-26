// Cronbach's Alpha
export interface CronbachAlphaInput {
  data: Record<string, unknown>[];
  items: string[]; // column names of items/questions
}

export interface ItemAnalysis {
  item: string;
  itemMean: number;
  itemStd: number;
  scaleMeanIfItemDeleted: number;
  scaleStdIfItemDeleted: number;
  correctedItemTotalCorrelation: number;
  alphaIfItemDeleted: number;
}

export interface CronbachCaseProcessing {
  valid: number;
  excluded: number;
  total: number;
}

export interface CronbachScaleStatistics {
  nItems: number;
  mean: number;
  std: number;
  minimum: number;
  maximum: number;
}

export interface CronbachAlphaOutput {
  alpha: number;
  standardizedAlpha: number;
  nItems: number;
  nObservations: number;
  itemAnalysis: ItemAnalysis[];
  interItemCorrelationMean: number;
  caseProcessing: CronbachCaseProcessing;
  scaleStatistics: CronbachScaleStatistics;
}
