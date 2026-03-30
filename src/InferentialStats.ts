import { serializeToBuffer, getTransferables } from './bridge/serializer';
import type {
  WorkerRequest, WorkerResponse, WorkerRequestType, ProgressDetail, AnalysisResult,
} from './types/common';
import type {
  FrequenciesInput, FrequenciesOutput,
  DescriptivesInput, DescriptivesOutput,
  CrosstabsInput, CrosstabsOutput,
} from './types/descriptive';
import type {
  TTestIndependentInput, TTestIndependentOutput,
  TTestPairedInput, TTestPairedOutput,
  AnovaInput, AnovaOutput,
  PostHocInput, PostHocOutput,
} from './types/compare-means';
import type {
  LinearRegressionInput, LinearRegressionOutput,
  LogisticBinaryInput, LogisticBinaryOutput,
  MultinomialLogisticInput, MultinomialLogisticOutput,
} from './types/regression';
import type {
  KMeansInput, KMeansOutput,
  HierarchicalClusterInput, HierarchicalClusterOutput,
} from './types/classify';
import type {
  EFAInput, EFAOutput,
  PCAInput, PCAOutput,
  MDSInput, MDSOutput,
} from './types/dimension';
import type {
  CronbachAlphaInput, CronbachAlphaOutput,
} from './types/scale';

/** Configuration for InferentialStats SDK */
export interface InferentialStatsConfig {
  /** URL to the worker script file. If not provided, uses the default bundled worker. */
  workerUrl?: string;
  /** URL to the Pyodide CDN. Defaults to jsdelivr CDN. */
  pyodideUrl?: string;
  /** EventTarget for dispatching progress events. Defaults to globalThis (window). */
  eventTarget?: EventTarget;
}

/** Custom event name for progress updates */
export const PROGRESS_EVENT_NAME = 'inferential-stats-progress';

/**
 * InferentialStats - Main SDK class for browser-based statistical analysis.
 *
 * Uses Pyodide (WebAssembly) running in a Web Worker to perform
 * SPSS-level statistical computations entirely client-side.
 *
 * Data is transferred to the worker using ArrayBuffer (Transferable Objects)
 * for maximum efficiency with large datasets.
 */
export class InferentialStats {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (value: unknown) => void;
    reject: (reason: unknown) => void;
  }> = new Map();
  private requestCounter = 0;
  private config: Required<InferentialStatsConfig>;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: InferentialStatsConfig = {}) {
    this.config = {
      workerUrl: config.workerUrl ?? '',
      pyodideUrl: config.pyodideUrl ?? 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      eventTarget: config.eventTarget ?? (typeof globalThis !== 'undefined' ? globalThis : null as unknown as EventTarget),
    };
  }

  /**
   * Initialize the SDK - loads Pyodide and all required Python packages.
   * Must be called before any analysis methods.
   * Dispatches 'inferential-stats-progress' CustomEvents during loading.
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  private async _doInit(): Promise<void> {
    // Create worker
    if (this.config.workerUrl) {
      this.worker = new Worker(this.config.workerUrl);
    } else {
      throw new Error(
        'workerUrl is required. Point it to the stats-worker.js file from @winm2m/inferential-stats-js/worker'
      );
    }

    // Set up message handler
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this._handleWorkerMessage(event.data);
    };

    this.worker.onerror = (event: ErrorEvent) => {
      console.error('[InferentialStats] Worker error:', event.message);
    };

    // Wait for worker ready signal
    await new Promise<void>((resolve) => {
      const readyHandler = (event: MessageEvent<WorkerResponse>) => {
        if (event.data.id === '__worker_ready__') {
          resolve();
        }
      };
      this.worker!.addEventListener('message', readyHandler, { once: true });
    });

    // Initialize Pyodide in the worker
    await this._sendRequest<{ initialized: boolean }>('init', undefined, {
      pyodideUrl: this.config.pyodideUrl,
    });

    this.initialized = true;
  }

  /** Handle messages from the worker */
  private _handleWorkerMessage(response: WorkerResponse): void {
    if (response.type === 'progress' && response.progress) {
      this._dispatchProgress(response.progress);
      return; // Don't resolve the promise for progress messages
    }

    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;

    this.pendingRequests.delete(response.id);

    if (response.type === 'error') {
      pending.reject(new Error(response.error ?? 'Unknown worker error'));
    } else {
      pending.resolve(response.data);
    }
  }

  /** Dispatch a progress CustomEvent */
  private _dispatchProgress(detail: ProgressDetail): void {
    try {
      if (this.config.eventTarget && typeof CustomEvent !== 'undefined') {
        const event = new CustomEvent(PROGRESS_EVENT_NAME, { detail });
        this.config.eventTarget.dispatchEvent(event);
      }
    } catch {
      // Silently ignore if CustomEvent is not available (e.g., Node.js test env)
    }
  }

  /**
   * Send a request to the worker and return a promise for the result.
   * Optionally serializes data to ArrayBuffer for efficient transfer.
   */
  private _sendRequest<T>(
    type: WorkerRequestType,
    data?: Record<string, unknown>[],
    params?: Record<string, unknown>
  ): Promise<T> {
    if (!this.worker) {
      return Promise.reject(new Error('Worker not initialized. Call init() first.'));
    }

    const id = `req_${++this.requestCounter}_${Date.now()}`;

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      const request: WorkerRequest = { id, type, params };

      if (data && data.length > 0) {
        // Serialize to ArrayBuffer for efficient transfer
        const buffer = serializeToBuffer(data);
        request.payload = buffer;
        this.worker!.postMessage(request, getTransferables(buffer));
      } else {
        this.worker!.postMessage(request);
      }
    });
  }

  /** Helper to wrap analysis calls with timing */
  private async _runAnalysis<I extends { data: Record<string, unknown>[] }, O>(
    type: WorkerRequestType,
    input: I
  ): Promise<AnalysisResult<O>> {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call init() first.');
    }

    const startTime = performance.now();
    try {
      const { data, ...params } = input;
      const result = await this._sendRequest<O>(type, data, params as Record<string, unknown>);
      return {
        success: true,
        data: result,
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    } catch (err) {
      return {
        success: false,
        data: null as unknown as O,
        error: err instanceof Error ? err.message : String(err),
        executionTimeMs: Math.round(performance.now() - startTime),
      };
    }
  }

  // ═══════════════════════════════════════
  // ① Descriptive Statistics
  // ═══════════════════════════════════════

  /** Frequency analysis for categorical variables */
  async frequencies(input: FrequenciesInput): Promise<AnalysisResult<FrequenciesOutput>> {
    return this._runAnalysis('frequencies', input);
  }

  /** Descriptive statistics for continuous variables */
  async descriptives(input: DescriptivesInput): Promise<AnalysisResult<DescriptivesOutput>> {
    return this._runAnalysis('descriptives', input);
  }

  /** Cross-tabulation with Chi-square test */
  async crosstabs(input: CrosstabsInput): Promise<AnalysisResult<CrosstabsOutput>> {
    return this._runAnalysis('crosstabs', input);
  }

  // ═══════════════════════════════════════
  // ② Compare Means
  // ═══════════════════════════════════════

  /** Independent-samples T-test with Levene's test */
  async ttestIndependent(input: TTestIndependentInput): Promise<AnalysisResult<TTestIndependentOutput>> {
    return this._runAnalysis('ttest_independent', input);
  }

  /** Paired-samples T-test */
  async ttestPaired(input: TTestPairedInput): Promise<AnalysisResult<TTestPairedOutput>> {
    return this._runAnalysis('ttest_paired', input);
  }

  /** One-Way ANOVA */
  async anovaOneway(input: AnovaInput): Promise<AnalysisResult<AnovaOutput>> {
    return this._runAnalysis('anova_oneway', input);
  }

  /** Post-hoc Tukey HSD test */
  async posthocTukey(input: PostHocInput): Promise<AnalysisResult<PostHocOutput>> {
    return this._runAnalysis('posthoc_tukey', input);
  }

  // ═══════════════════════════════════════
  // ③ Regression
  // ═══════════════════════════════════════

  /** Linear regression (OLS) */
  async linearRegression(input: LinearRegressionInput): Promise<AnalysisResult<LinearRegressionOutput>> {
    return this._runAnalysis('linear_regression', input);
  }

  /** Binary logistic regression */
  async logisticBinary(input: LogisticBinaryInput): Promise<AnalysisResult<LogisticBinaryOutput>> {
    return this._runAnalysis('logistic_binary', input);
  }

  /** Multinomial logistic regression */
  async logisticMultinomial(input: MultinomialLogisticInput): Promise<AnalysisResult<MultinomialLogisticOutput>> {
    return this._runAnalysis('logistic_multinomial', input);
  }

  // ═══════════════════════════════════════
  // ④ Classify
  // ═══════════════════════════════════════

  /** K-Means clustering */
  async kmeans(input: KMeansInput): Promise<AnalysisResult<KMeansOutput>> {
    return this._runAnalysis('kmeans', input);
  }

  /** Hierarchical (agglomerative) clustering */
  async hierarchicalCluster(input: HierarchicalClusterInput): Promise<AnalysisResult<HierarchicalClusterOutput>> {
    return this._runAnalysis('hierarchical_cluster', input);
  }

  // ═══════════════════════════════════════
  // ⑤ Dimension Reduction
  // ═══════════════════════════════════════

  /** Exploratory Factor Analysis (EFA) with varimax rotation */
  async efa(input: EFAInput): Promise<AnalysisResult<EFAOutput>> {
    return this._runAnalysis('efa', input);
  }

  /** Principal Component Analysis (PCA) */
  async pca(input: PCAInput): Promise<AnalysisResult<PCAOutput>> {
    return this._runAnalysis('pca', input);
  }

  /** Multidimensional Scaling (MDS) */
  async mds(input: MDSInput): Promise<AnalysisResult<MDSOutput>> {
    return this._runAnalysis('mds', input);
  }

  // ═══════════════════════════════════════
  // ⑥ Scale
  // ═══════════════════════════════════════

  /** Reliability analysis (Cronbach's Alpha) */
  async cronbachAlpha(input: CronbachAlphaInput): Promise<AnalysisResult<CronbachAlphaOutput>> {
    return this._runAnalysis('cronbach_alpha', input);
  }

  // ═══════════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════════

  /** Check if the SDK is initialized */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Terminate the worker and clean up resources */
  destroy(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.initialized = false;
    this.initPromise = null;
    this.pendingRequests.clear();
  }
}
