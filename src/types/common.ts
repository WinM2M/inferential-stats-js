/** Generic analysis result wrapper */
export interface AnalysisResult<T> {
  success: boolean;
  data: T;
  error?: string;
  executionTimeMs: number;
}

/** Progress event detail */
export interface ProgressDetail {
  /**
   * Which phase the update is about.
   *
   * `"init"` — loading Pyodide and installing packages, once per worker.
   * `"analysis"` — an analysis is executing. Emitted at 0 when it starts and 100 when it
   * finishes, so a host can drive a spinner from events alone rather than also tracking
   * promise state.
   *
   * Left as `string` rather than a union: narrowing it would break callers that compare
   * against their own constants.
   */
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
  payload?: ArrayBuffer | ColumnarPayload;
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

export interface ColumnarPayload {
  rowCount: number;
  columns: Record<string, Float64Array>;
  mappings: Record<string, Record<number, string> | null>;
}
