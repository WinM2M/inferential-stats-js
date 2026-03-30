/**
 * Web Worker for Pyodide-based statistical analysis.
 * Runs Python code in a WASM sandbox for browser-based computations.
 */

// Worker global scope
declare const self: DedicatedWorkerGlobalScope;

// Pyodide types (minimal)
interface PyodideInterface {
  loadPackagesFromImports(code: string, options?: { messageCallback?: (msg: string) => void }): Promise<void>;
  runPythonAsync(code: string): Promise<unknown>;
  runPython(code: string): unknown;
  globals: {
    get(name: string): unknown;
    set(name: string, value: unknown): void;
  };
  toPy(obj: unknown): unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  FS: any;
}

interface LoadPyodideOptions {
  indexURL?: string;
  stdout?: (msg: string) => void;
  stderr?: (msg: string) => void;
}

declare function loadPyodide(options?: LoadPyodideOptions): Promise<PyodideInterface>;

// Import Python code strings - these will be inlined by the bundler
// For the worker bundle, we import them directly
import {
  FREQUENCIES_PY, DESCRIPTIVES_PY, CROSSTABS_PY
} from '../python/descriptive';
import {
  TTEST_INDEPENDENT_PY, TTEST_PAIRED_PY, ANOVA_ONEWAY_PY, POSTHOC_TUKEY_PY
} from '../python/compare-means';
import {
  LINEAR_REGRESSION_PY, LOGISTIC_BINARY_PY, LOGISTIC_MULTINOMIAL_PY
} from '../python/regression';
import {
  KMEANS_PY, HIERARCHICAL_CLUSTER_PY
} from '../python/classify';
import {
  EFA_PY, PCA_PY, MDS_PY
} from '../python/dimension';
import {
  CRONBACH_ALPHA_PY
} from '../python/scale';

import type { WorkerRequest, WorkerResponse, ProgressDetail, BinaryFrameHeader } from '../types/common';

let pyodide: PyodideInterface | null = null;

/**
 * Send progress update to main thread
 */
function sendProgress(id: string, stage: string, progress: number, message: string): void {
  const response: WorkerResponse = {
    id,
    type: 'progress',
    progress: { stage, progress, message } satisfies ProgressDetail,
  };
  self.postMessage(response);
}

/**
 * Send result to main thread
 */
function sendResult(id: string, data: unknown): void {
  const response: WorkerResponse = {
    id,
    type: 'result',
    data,
  };
  self.postMessage(response);
}

/**
 * Send error to main thread
 */
function sendError(id: string, error: string): void {
  const response: WorkerResponse = {
    id,
    type: 'error',
    error,
  };
  self.postMessage(response);
}

/**
 * Deserialize ArrayBuffer to JSON string for Python consumption.
 * Matches the format produced by serializeToBuffer in bridge/serializer.ts.
 */
function bufferToJsonString(buffer: ArrayBuffer): string {
  const view = new DataView(buffer);
  const headerLength = view.getUint32(0, true);
  const headerBytes = new Uint8Array(buffer, 4, headerLength);
  const header: BinaryFrameHeader = JSON.parse(new TextDecoder().decode(headerBytes));

  if (header.rowCount === 0) return '[]';

  const { rowCount, columns } = header;
  let offset = 4 + headerLength;

  // Read columns into arrays
  const columnData: Map<string, (string | number)[]> = new Map();

  for (const col of columns) {
    if (col.dtype === 'string') {
      const indices = new Int32Array(buffer, offset, rowCount);
      const values: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        values.push(col.stringTable![indices[i]]);
      }
      columnData.set(col.name, values);
      offset += rowCount * 4;
    } else {
      const arr = new Float64Array(buffer, offset, rowCount);
      const values: number[] = Array.from(arr);
      columnData.set(col.name, values);
      offset += rowCount * 8;
    }
  }

  // Build row-oriented JSON
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < rowCount; i++) {
    const row: Record<string, unknown> = {};
    for (const col of columns) {
      row[col.name] = columnData.get(col.name)![i];
    }
    rows.push(row);
  }

  return JSON.stringify(rows);
}

/**
 * Initialize Pyodide with required packages
 */
async function initPyodide(id: string, pyodideUrl?: string): Promise<void> {
  const totalSteps = 6;
  let currentStep = 0;

  const reportStep = (message: string) => {
    currentStep++;
    sendProgress(id, 'init', Math.round((currentStep / totalSteps) * 100), message);
  };

  try {
    // Step 1: Load Pyodide core
    sendProgress(id, 'init', 0, 'Loading Pyodide WASM runtime...');
    
    // Try to load Pyodide - it should be available via importScripts or already loaded
    if (typeof loadPyodide === 'undefined') {
      const pyodideCdnUrl = pyodideUrl || 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/';
      importScripts(pyodideCdnUrl + 'pyodide.js');
    }

    pyodide = await loadPyodide({
      indexURL: pyodideUrl || 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
    });
    reportStep('Pyodide runtime loaded successfully');

    // Step 2: Install micropip
    await pyodide.loadPackagesFromImports('import micropip', {
      messageCallback: (msg: string) => {
        sendProgress(id, 'init', Math.round((currentStep / totalSteps) * 100), `micropip: ${msg}`);
      }
    });
    reportStep('micropip package manager ready');

    // Step 3: Install pandas and scipy
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(['pandas', 'scipy'])
    `);
    reportStep('pandas and scipy installed');

    // Step 4: Install statsmodels
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('statsmodels')
    `);
    reportStep('statsmodels installed');

    // Step 5: Install scikit-learn
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('scikit-learn')
    `);
    reportStep('scikit-learn installed');

    // Step 6: Install factor_analyzer
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('factor_analyzer')
    `);
    reportStep('factor_analyzer installed - all packages ready');

    sendResult(id, { initialized: true });
  } catch (err) {
    sendError(id, `Initialization failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Run a Python analysis function.
 * Handles proxy cleanup to prevent memory leaks.
 */
async function runAnalysis(
  id: string,
  pythonCode: string,
  functionName: string,
  args: string[]
): Promise<void> {
  if (!pyodide) {
    sendError(id, 'Pyodide is not initialized. Call init() first.');
    return;
  }

  try {
    // Load the Python function
    await pyodide.runPythonAsync(pythonCode);
    
    // Build the function call
    const argsStr = args.map(a => {
      // If it looks like a raw Python expression (number, bool), pass as-is
      if (/^[-+]?\d+(\.\d+)?$/.test(a) || a === 'True' || a === 'False' || a === 'None') {
        return a;
      }
      // Otherwise, wrap as a Python string
      // Escape backslashes and single quotes
      const escaped = a.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `'${escaped}'`;
    }).join(', ');

    const callCode = `
import gc
_result = ${functionName}(${argsStr})
_result
`;
    const result = await pyodide.runPythonAsync(callCode);
    
    // Parse the JSON result from Python
    const resultStr = String(result);
    const parsed = JSON.parse(resultStr);
    
    // Cleanup Python memory
    await pyodide.runPythonAsync(`
del _result
gc.collect()
`);

    sendResult(id, parsed);
  } catch (err) {
    // Attempt cleanup even on error
    try {
      await pyodide.runPythonAsync('import gc; gc.collect()');
    } catch {
      // Ignore cleanup errors
    }
    sendError(id, `Analysis failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload, params } = event.data;

  try {
    // Convert ArrayBuffer payload to JSON string if present
    let dataJson = '[]';
    if (payload && payload instanceof ArrayBuffer && payload.byteLength > 0) {
      dataJson = bufferToJsonString(payload);
    } else if (params?.data) {
      dataJson = JSON.stringify(params.data);
    }

    switch (type) {
      case 'init':
        await initPyodide(id, params?.pyodideUrl as string | undefined);
        break;

      // === Descriptive Statistics ===
      case 'frequencies':
        await runAnalysis(id, FREQUENCIES_PY, 'run_frequencies', [
          dataJson,
          String(params?.variable ?? '')
        ]);
        break;

      case 'descriptives':
        await runAnalysis(id, DESCRIPTIVES_PY, 'run_descriptives', [
          dataJson,
          JSON.stringify(params?.variables ?? [])
        ]);
        break;

      case 'crosstabs':
        await runAnalysis(id, CROSSTABS_PY, 'run_crosstabs', [
          dataJson,
          String(params?.rowVariable ?? ''),
          String(params?.colVariable ?? '')
        ]);
        break;

      // === Compare Means ===
      case 'ttest_independent':
        await runAnalysis(id, TTEST_INDEPENDENT_PY, 'run_ttest_independent', [
          dataJson,
          String(params?.variable ?? ''),
          String(params?.groupVariable ?? ''),
          String(params?.group1Value ?? ''),
          String(params?.group2Value ?? '')
        ]);
        break;

      case 'ttest_paired':
        await runAnalysis(id, TTEST_PAIRED_PY, 'run_ttest_paired', [
          dataJson,
          String(params?.variable1 ?? ''),
          String(params?.variable2 ?? '')
        ]);
        break;

      case 'anova_oneway':
        await runAnalysis(id, ANOVA_ONEWAY_PY, 'run_anova_oneway', [
          dataJson,
          String(params?.variable ?? ''),
          String(params?.groupVariable ?? '')
        ]);
        break;

      case 'posthoc_tukey':
        await runAnalysis(id, POSTHOC_TUKEY_PY, 'run_posthoc_tukey', [
          dataJson,
          String(params?.variable ?? ''),
          String(params?.groupVariable ?? ''),
          String(params?.alpha ?? 0.05)
        ]);
        break;

      // === Regression ===
      case 'linear_regression':
        await runAnalysis(id, LINEAR_REGRESSION_PY, 'run_linear_regression', [
          dataJson,
          String(params?.dependentVariable ?? ''),
          JSON.stringify(params?.independentVariables ?? []),
          String(params?.addConstant !== false ? 'True' : 'False')
        ]);
        break;

      case 'logistic_binary':
        await runAnalysis(id, LOGISTIC_BINARY_PY, 'run_logistic_binary', [
          dataJson,
          String(params?.dependentVariable ?? ''),
          JSON.stringify(params?.independentVariables ?? []),
          String(params?.addConstant !== false ? 'True' : 'False')
        ]);
        break;

      case 'logistic_multinomial':
        await runAnalysis(id, LOGISTIC_MULTINOMIAL_PY, 'run_logistic_multinomial', [
          dataJson,
          String(params?.dependentVariable ?? ''),
          JSON.stringify(params?.independentVariables ?? []),
          params?.referenceCategory != null ? String(params.referenceCategory) : 'None'
        ]);
        break;

      // === Classify ===
      case 'kmeans':
        await runAnalysis(id, KMEANS_PY, 'run_kmeans', [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.k ?? 3),
          String(params?.maxIterations ?? 300),
          String(params?.randomState ?? 42)
        ]);
        break;

      case 'hierarchical_cluster':
        await runAnalysis(id, HIERARCHICAL_CLUSTER_PY, 'run_hierarchical_cluster', [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.method ?? 'ward'),
          String(params?.metric ?? 'euclidean'),
          params?.nClusters != null ? String(params.nClusters) : 'None',
          params?.distanceThreshold != null ? String(params.distanceThreshold) : 'None'
        ]);
        break;

      // === Dimension Reduction ===
      case 'efa':
        await runAnalysis(id, EFA_PY, 'run_efa', [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.nFactors ?? 2),
          String(params?.rotation ?? 'varimax'),
          String(params?.method ?? 'minres')
        ]);
        break;

      case 'pca':
        await runAnalysis(id, PCA_PY, 'run_pca', [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          params?.nComponents != null ? String(params.nComponents) : 'None',
          String(params?.standardize !== false ? 'True' : 'False')
        ]);
        break;

      case 'mds':
        await runAnalysis(id, MDS_PY, 'run_mds', [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.nComponents ?? 2),
          String(params?.metric !== false ? 'True' : 'False'),
          String(params?.maxIterations ?? 300),
          String(params?.randomState ?? 42)
        ]);
        break;

      // === Scale ===
      case 'cronbach_alpha':
        await runAnalysis(id, CRONBACH_ALPHA_PY, 'run_cronbach_alpha', [
          dataJson,
          JSON.stringify(params?.items ?? [])
        ]);
        break;

      default:
        sendError(id, `Unknown analysis type: ${type}`);
    }
  } catch (err) {
    sendError(id, `Worker error: ${err instanceof Error ? err.message : String(err)}`);
  }
};

// Signal that the worker is ready
self.postMessage({ id: '__worker_ready__', type: 'result', data: { ready: true } });
