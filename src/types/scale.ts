// Cronbach's Alpha
export interface CronbachAlphaInput {
  data: Record<string, unknown>[];
  items: string[]; // column names of items/questions
}

export interface ItemAnalysis {
  item: string;
  itemMean: number;
  itemStd: number;
  correctedItemTotalCorrelation: number;
  alphaIfItemDeleted: number;
}

export interface CronbachAlphaOutput {
  alpha: number;
  standardizedAlpha: number;
  nItems: number;
  nObservations: number;
  itemAnalysis: ItemAnalysis[];
  interItemCorrelationMean: number;
}
