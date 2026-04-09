/**
 * Web Worker for Pyodide-based statistical analysis.
 * Runs Python code in a WASM sandbox for browser-based computations.
 */

// Worker global scope
declare const self: DedicatedWorkerGlobalScope;

// Pyodide types (minimal)
interface PyodideInterface {
  loadPackagesFromImports(
    code: string,
    options?: { messageCallback?: (msg: string) => void },
  ): Promise<void>;
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

declare function loadPyodide(
  options?: LoadPyodideOptions,
): Promise<PyodideInterface>;

// Import Python code strings - these will be inlined by the bundler
// For the worker bundle, we import them directly
import {
  FREQUENCIES_PY,
  DESCRIPTIVES_PY,
  CROSSTABS_PY,
} from "../python/descriptive";
import {
  TTEST_INDEPENDENT_PY,
  TTEST_PAIRED_PY,
  ANOVA_ONEWAY_PY,
  POSTHOC_TUKEY_PY,
} from "../python/compare-means";
import {
  LINEAR_REGRESSION_PY,
  LOGISTIC_BINARY_PY,
  LOGISTIC_MULTINOMIAL_PY,
} from "../python/regression";
import { KMEANS_PY, HIERARCHICAL_CLUSTER_PY } from "../python/classify";
import { EFA_PY, PCA_PY, MDS_PY } from "../python/dimension";
import { CRONBACH_ALPHA_PY } from "../python/scale";

import type {
  WorkerRequest,
  WorkerResponse,
  ProgressDetail,
  BinaryFrameHeader,
  ColumnarPayload,
} from "../types/common";

let pyodide: PyodideInterface | null = null;
const COLUMNAR_DATA_SENTINEL = "__INFERENTIAL_STATS_COLUMNAR__";
const FRAME_GLOBAL_NAME = "__columnar_df__";

const DATAFRAME_HELPERS_PY = `
import json
import math
import pandas as pd

_COLUMNAR_SENTINEL = '${COLUMNAR_DATA_SENTINEL}'

def _sanitize_for_json(obj):
    """Recursively replace NaN / Infinity with None so json.dumps produces valid JSON."""
    if isinstance(obj, float):
        if math.isnan(obj) or math.isinf(obj):
            return None
        return obj
    if isinstance(obj, dict):
        return {k: _sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_sanitize_for_json(v) for v in obj]
    return obj

# Monkey-patch json.dumps so every call in analysis functions automatically
# sanitises NaN / Infinity values that are not representable in standard JSON.
# Guard: only patch once so re-execution of this helper block does not wrap
# the already-patched function (which would cause infinite recursion).
if not getattr(json.dumps, '_is_nan_safe', False):
    _original_json_dumps = json.dumps

    def _safe_json_dumps(obj, *args, **kwargs):
        return _original_json_dumps(_sanitize_for_json(obj), *args, **kwargs)

    _safe_json_dumps._is_nan_safe = True
    json.dumps = _safe_json_dumps

def load_dataframe(data_json):
    if data_json == _COLUMNAR_SENTINEL and '${FRAME_GLOBAL_NAME}' in globals():
        return globals()['${FRAME_GLOBAL_NAME}']
    return pd.DataFrame(json.loads(data_json))
`;

/**
 * Send progress update to main thread
 */
function sendProgress(
  id: string,
  stage: string,
  progress: number,
  message: string,
): void {
  const response: WorkerResponse = {
    id,
    type: "progress",
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
    type: "result",
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
    type: "error",
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
  const header: BinaryFrameHeader = JSON.parse(
    new TextDecoder().decode(headerBytes),
  );

  if (header.rowCount === 0) return "[]";

  const { rowCount, columns } = header;
  let offset = 4 + headerLength;

  // Read columns into arrays
  const columnData: Map<string, (string | number)[]> = new Map();

  for (const col of columns) {
    if (col.dtype === "string") {
      const byteLen = rowCount * 4;
      const indices = new Int32Array(
        new Uint8Array(buffer, offset, byteLen).slice().buffer,
      );
      const values: string[] = [];
      for (let i = 0; i < rowCount; i++) {
        values.push(col.stringTable![indices[i]]);
      }
      columnData.set(col.name, values);
      offset += byteLen;
    } else {
      const byteLen = rowCount * 8;
      const arr = new Float64Array(
        new Uint8Array(buffer, offset, byteLen).slice().buffer,
      );
      const values: number[] = Array.from(arr);
      columnData.set(col.name, values);
      offset += byteLen;
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

function isColumnarPayload(payload: unknown): payload is ColumnarPayload {
  if (
    !payload ||
    typeof payload !== "object" ||
    payload instanceof ArrayBuffer
  ) {
    return false;
  }

  const candidate = payload as Partial<ColumnarPayload>;
  return !!candidate.columns && !!candidate.mappings;
}

async function prepareColumnarDataFrame(
  payload: ColumnarPayload,
): Promise<void> {
  if (!pyodide) return;

  pyodide.globals.set("__js_columns__", payload.columns);
  pyodide.globals.set("__js_mappings__", payload.mappings);
  pyodide.globals.set("__js_column_names__", Object.keys(payload.columns));

  await pyodide.runPythonAsync(`
import pandas as pd

js_columns = globals()['__js_columns__']
js_mappings = globals()['__js_mappings__']
column_names = globals()['__js_column_names__']

columns_dict = js_columns.to_py() if hasattr(js_columns, 'to_py') else js_columns
mappings_dict = js_mappings.to_py() if hasattr(js_mappings, 'to_py') else js_mappings
column_names = column_names.to_py() if hasattr(column_names, 'to_py') else column_names

frame_dict = {}
for column_name in column_names:
    frame_dict[column_name] = columns_dict[column_name]

df = pd.DataFrame(frame_dict)

for column_name in column_names:
    mapping = mappings_dict[column_name]
    if mapping is None:
        continue

    mapping_dict = mapping.to_py() if hasattr(mapping, 'to_py') else mapping
    normalized_mapping = {}
    for key, label in mapping_dict.items():
        try:
            normalized_mapping[float(key)] = label
        except (TypeError, ValueError):
            continue

    df[column_name] = df[column_name].map(normalized_mapping)

globals()['${FRAME_GLOBAL_NAME}'] = df
`);
}

/**
 * Initialize Pyodide with required packages
 */
async function initPyodide(id: string, pyodideUrl?: string): Promise<void> {
  const totalSteps = 6;
  let currentStep = 0;

  const reportStep = (message: string) => {
    currentStep++;
    sendProgress(
      id,
      "init",
      Math.round((currentStep / totalSteps) * 100),
      message,
    );
  };

  try {
    // Step 1: Load Pyodide core
    sendProgress(id, "init", 0, "Loading Pyodide WASM runtime...");

    // Try to load Pyodide - it should be available via importScripts or already loaded
    if (typeof loadPyodide === "undefined") {
      const pyodideCdnUrl =
        pyodideUrl || "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/";
      importScripts(pyodideCdnUrl + "pyodide.js");
    }

    pyodide = await loadPyodide({
      indexURL: pyodideUrl || "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
    });
    reportStep("Pyodide runtime loaded successfully");

    // Step 2: Install micropip
    await pyodide.loadPackagesFromImports("import micropip", {
      messageCallback: (msg: string) => {
        sendProgress(
          id,
          "init",
          Math.round((currentStep / totalSteps) * 100),
          `micropip: ${msg}`,
        );
      },
    });
    reportStep("micropip package manager ready");

    // Step 3: Install pandas and scipy
    await pyodide.runPythonAsync(`
import micropip
await micropip.install(['pandas', 'scipy'])
    `);
    reportStep("pandas and scipy installed");

    // Step 4: Install statsmodels
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('statsmodels')
    `);
    reportStep("statsmodels installed");

    // Step 5: Install scikit-learn
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('scikit-learn')
    `);
    reportStep("scikit-learn installed");

    // Step 6: Install factor_analyzer
    await pyodide.runPythonAsync(`
import micropip
await micropip.install('factor_analyzer')
    `);
    reportStep("factor_analyzer installed - all packages ready");

    sendResult(id, { initialized: true });
  } catch (err) {
    sendError(
      id,
      `Initialization failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Run a Python analysis function.
 * Handles proxy cleanup to prevent memory leaks.
 *
 * Memory strategy:
 *   1. The analysis function is defined in the Python global scope.
 *   2. It is called and its return value stored in `_result`.
 *   3. After reading the result string, we `del` both `_result` and the
 *      function itself, then run `gc.collect()` to release DataFrames,
 *      model objects, and intermediate numpy arrays promptly.
 *   4. On the error path we do the same best-effort cleanup.
 */
async function runAnalysis(
  id: string,
  pythonCode: string,
  functionName: string,
  args: string[],
): Promise<void> {
  if (!pyodide) {
    sendError(id, "Pyodide is not initialized. Call init() first.");
    return;
  }

  try {
    const preparedPythonCode = `${DATAFRAME_HELPERS_PY}\n${pythonCode.replace(
      /pd\.DataFrame\(json\.loads\(data_json\)\)/g,
      "load_dataframe(data_json)",
    )}`;

    // Load the Python function
    await pyodide.runPythonAsync(preparedPythonCode);

    // Build the function call
    const argsStr = args
      .map((a) => {
        // If it looks like a raw Python expression (number, bool), pass as-is
        if (
          /^[-+]?\d+(\.\d+)?$/.test(a) ||
          a === "True" ||
          a === "False" ||
          a === "None"
        ) {
          return a;
        }
        // Otherwise, wrap as a Python string
        // Escape backslashes and single quotes
        const escaped = a.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        return `'${escaped}'`;
      })
      .join(", ");

    const callCode = `
import gc as _gc
_result = ${functionName}(${argsStr})
_result
`;
    const result = await pyodide.runPythonAsync(callCode);

    // Parse the JSON result from Python
    const resultStr = String(result);
    const parsed = JSON.parse(resultStr);

    // Cleanup: delete the result, the analysis function, and force gc
    await pyodide.runPythonAsync(`
try:
    del _result
except NameError:
    pass
try:
    del ${functionName}
except NameError:
    pass
try:
    del ${FRAME_GLOBAL_NAME}
except NameError:
    pass
for _global_name in ('__js_columns__', '__js_mappings__', '__js_column_names__'):
    try:
        del globals()[_global_name]
    except KeyError:
        pass
_gc.collect()
del _gc
`);

    sendResult(id, parsed);
  } catch (err) {
    // Attempt cleanup even on error – delete both _result and the function
    try {
      await pyodide.runPythonAsync(`
import gc as _gc
try:
    del _result
except NameError:
    pass
try:
    del ${functionName}
except NameError:
    pass
try:
    del ${FRAME_GLOBAL_NAME}
except NameError:
    pass
for _global_name in ('__js_columns__', '__js_mappings__', '__js_column_names__'):
    try:
        del globals()[_global_name]
    except KeyError:
        pass
_gc.collect()
del _gc
`);
    } catch {
      // Ignore cleanup errors
    }
    sendError(
      id,
      `Analysis failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload, params } = event.data;

  try {
    // Convert ArrayBuffer payload to JSON string if present
    let dataJson = "[]";
    if (payload && payload instanceof ArrayBuffer && payload.byteLength > 0) {
      dataJson = bufferToJsonString(payload);
    } else if (isColumnarPayload(payload) && payload.rowCount > 0) {
      await prepareColumnarDataFrame(payload);
      dataJson = COLUMNAR_DATA_SENTINEL;
    } else if (params?.data) {
      dataJson = JSON.stringify(params.data);
    }

    switch (type) {
      case "init":
        await initPyodide(id, params?.pyodideUrl as string | undefined);
        break;

      // === Descriptive Statistics ===
      case "frequencies":
        await runAnalysis(id, FREQUENCIES_PY, "run_frequencies", [
          dataJson,
          String(params?.variable ?? ""),
        ]);
        break;

      case "descriptives":
        await runAnalysis(id, DESCRIPTIVES_PY, "run_descriptives", [
          dataJson,
          JSON.stringify(params?.variables ?? []),
        ]);
        break;

      case "crosstabs":
        await runAnalysis(id, CROSSTABS_PY, "run_crosstabs", [
          dataJson,
          String(params?.rowVariable ?? ""),
          String(params?.colVariable ?? ""),
        ]);
        break;

      // === Compare Means ===
      case "ttest_independent":
        await runAnalysis(id, TTEST_INDEPENDENT_PY, "run_ttest_independent", [
          dataJson,
          String(params?.variable ?? ""),
          String(params?.groupVariable ?? ""),
          String(params?.group1Value ?? ""),
          String(params?.group2Value ?? ""),
        ]);
        break;

      case "ttest_paired":
        await runAnalysis(id, TTEST_PAIRED_PY, "run_ttest_paired", [
          dataJson,
          String(params?.variable1 ?? ""),
          String(params?.variable2 ?? ""),
        ]);
        break;

      case "anova_oneway":
        await runAnalysis(id, ANOVA_ONEWAY_PY, "run_anova_oneway", [
          dataJson,
          String(params?.variable ?? ""),
          String(params?.groupVariable ?? ""),
        ]);
        break;

      case "posthoc_tukey":
        await runAnalysis(id, POSTHOC_TUKEY_PY, "run_posthoc_tukey", [
          dataJson,
          String(params?.variable ?? ""),
          String(params?.groupVariable ?? ""),
          String(params?.alpha ?? 0.05),
        ]);
        break;

      // === Regression ===
      case "linear_regression":
        await runAnalysis(id, LINEAR_REGRESSION_PY, "run_linear_regression", [
          dataJson,
          String(params?.dependentVariable ?? ""),
          JSON.stringify(params?.independentVariables ?? []),
          String(params?.addConstant !== false ? "True" : "False"),
        ]);
        break;

      case "logistic_binary":
        await runAnalysis(id, LOGISTIC_BINARY_PY, "run_logistic_binary", [
          dataJson,
          String(params?.dependentVariable ?? ""),
          JSON.stringify(params?.independentVariables ?? []),
          String(params?.addConstant !== false ? "True" : "False"),
        ]);
        break;

      case "logistic_multinomial":
        await runAnalysis(
          id,
          LOGISTIC_MULTINOMIAL_PY,
          "run_logistic_multinomial",
          [
            dataJson,
            String(params?.dependentVariable ?? ""),
            JSON.stringify(params?.independentVariables ?? []),
            params?.referenceCategory != null
              ? String(params.referenceCategory)
              : "None",
          ],
        );
        break;

      // === Classify ===
      case "kmeans":
        await runAnalysis(id, KMEANS_PY, "run_kmeans", [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.k ?? 3),
          String(params?.maxIterations ?? 300),
          String(params?.randomState ?? 42),
        ]);
        break;

      case "hierarchical_cluster":
        await runAnalysis(
          id,
          HIERARCHICAL_CLUSTER_PY,
          "run_hierarchical_cluster",
          [
            dataJson,
            JSON.stringify(params?.variables ?? []),
            String(params?.method ?? "ward"),
            String(params?.metric ?? "euclidean"),
            params?.nClusters != null ? String(params.nClusters) : "None",
            params?.distanceThreshold != null
              ? String(params.distanceThreshold)
              : "None",
          ],
        );
        break;

      // === Dimension Reduction ===
      case "efa":
        await runAnalysis(id, EFA_PY, "run_efa", [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.nFactors ?? 2),
          String(params?.rotation ?? "varimax"),
          String(params?.method ?? "minres"),
        ]);
        break;

      case "pca":
        await runAnalysis(id, PCA_PY, "run_pca", [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          params?.nComponents != null ? String(params.nComponents) : "None",
          String(params?.standardize !== false ? "True" : "False"),
        ]);
        break;

      case "mds":
        await runAnalysis(id, MDS_PY, "run_mds", [
          dataJson,
          JSON.stringify(params?.variables ?? []),
          String(params?.nComponents ?? 2),
          String(params?.metric !== false ? "True" : "False"),
          String(params?.maxIterations ?? 300),
          String(params?.randomState ?? 42),
        ]);
        break;

      // === Scale ===
      case "cronbach_alpha":
        await runAnalysis(id, CRONBACH_ALPHA_PY, "run_cronbach_alpha", [
          dataJson,
          JSON.stringify(params?.items ?? []),
        ]);
        break;

      // === Lifecycle ===
      case "destroy":
        try {
          if (pyodide) {
            // Final gc pass to release remaining Python objects
            try {
              await pyodide.runPythonAsync("import gc; gc.collect()");
            } catch {
              // Ignore – runtime may already be in a bad state
            }
            pyodide = null;
          }
          sendResult(id, { destroyed: true });
        } catch (err) {
          sendError(
            id,
            `Destroy failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
        break;

      default:
        sendError(id, `Unknown analysis type: ${type}`);
    }
  } catch (err) {
    sendError(
      id,
      `Worker error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// Signal that the worker is ready
self.postMessage({
  id: "__worker_ready__",
  type: "result",
  data: { ready: true },
});
