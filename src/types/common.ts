/** Generic analysis result wrapper */
export interface AnalysisResult<T> {
  success: boolean;
  data: T;
  error?: string;
  executionTimeMs: number;
}

/** Progress event detail */
export interface ProgressDetail {
  stage: string;
  progress: number; // 0-100
  message: string;
}

/** Worker message types */
export type WorkerRequestType =
  | 'init'
  | 'destroy'
  | 'frequencies'
  | 'descriptives'
  | 'crosstabs'
  | 'ttest_independent'
  | 'ttest_paired'
  | 'anova_oneway'
  | 'posthoc_tukey'
  | 'linear_regression'
  | 'logistic_binary'
  | 'logistic_multinomial'
  | 'kmeans'
  | 'hierarchical_cluster'
  | 'efa'
  | 'pca'
  | 'mds'
  | 'cronbach_alpha';

export interface WorkerRequest {
  id: string;
  type: WorkerRequestType;
  payload?: ArrayBuffer;
  params?: Record<string, unknown>;
}

export interface WorkerResponse {
  id: string;
  type: 'result' | 'progress' | 'error';
  data?: unknown;
  progress?: ProgressDetail;
  error?: string;
}

/** Column metadata for binary serialization */
export interface ColumnMeta {
  name: string;
  dtype: 'float64' | 'int32' | 'string';
  stringTable?: string[];
}

/** Binary frame header for serialized data */
export interface BinaryFrameHeader {
  rowCount: number;
  columns: ColumnMeta[];
}
