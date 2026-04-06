/**
 * @winm2m/inferential-stats-js
 *
 * A headless JavaScript SDK for advanced statistical analysis in the browser.
 * Uses Pyodide (WebAssembly) in a Web Worker to perform SPSS-level
 * inferential statistics entirely client-side.
 *
 * @author Youngjune Kwon <yjkwon@winm2m.com>
 * @license MIT
 */

export { InferentialStats, PROGRESS_EVENT_NAME } from './InferentialStats';
export type { InferentialStatsConfig } from './InferentialStats';

// Re-export all types
export type {
  AnalysisResult,
  ProgressDetail,
  WorkerRequestType,
} from './types/common';

export type {
  FrequenciesInput, FrequenciesOutput, FrequencyItem,
  DescriptivesInput, DescriptivesOutput, DescriptiveStats,
  CrosstabsInput, CrosstabsOutput, CrosstabCell,
} from './types/descriptive';

export type {
  TTestIndependentInput, TTestIndependentOutput, TTestResult, LeveneTestResult,
  TTestPairedInput, TTestPairedOutput,
  AnovaInput, AnovaOutput, AnovaGroupStats,
  PostHocInput, PostHocOutput, PostHocComparison,
} from './types/compare-means';

export type {
  LinearRegressionInput, LinearRegressionOutput, RegressionCoefficient,
  LogisticBinaryInput, LogisticBinaryOutput, LogisticCoefficient,
  MultinomialLogisticInput, MultinomialLogisticOutput, MultinomialCoefficient,
} from './types/regression';

export type {
  KMeansInput, KMeansOutput, ClusterCenter,
  HierarchicalClusterInput, HierarchicalClusterOutput,
} from './types/classify';

export type {
  EFAInput, EFAOutput,
  PCAInput, PCAOutput,
  MDSInput, MDSOutput,
} from './types/dimension';

export type {
  CronbachAlphaInput, CronbachAlphaOutput, ItemAnalysis,
} from './types/scale';

// Export bridge utilities for advanced users
export { serializeToBuffer, getTransferables } from './bridge/serializer';
export { deserializeFromBuffer, deserializeToColumns } from './bridge/deserializer';

// SPSS (.sav) utility
export { readSavFile } from './sav';
