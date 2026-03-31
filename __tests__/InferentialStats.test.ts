/**
 * Tests for the InferentialStats main SDK class.
 *
 * Since the SDK relies on Web Workers and Pyodide (browser-only), we mock
 * the Worker API to verify the SDK's behavior in a Node.js test environment.
 *
 * Tests are based on the README documentation:
 * - Constructor with config options
 * - init() / isInitialized() / destroy() lifecycle
 * - Progress event dispatching via CustomEvent
 * - All 16 analysis method signatures
 * - Error handling for uninitialized state
 */

import { InferentialStats, PROGRESS_EVENT_NAME } from '../src/index';
import type { WorkerResponse } from '../src/types/common';

if (typeof globalThis.CustomEvent === 'undefined') {
  class NodeCustomEvent<T = unknown> extends Event implements CustomEvent<T> {
    detail: T;

    constructor(type: string, params?: CustomEventInit<T>) {
      super(type, params);
      this.detail = params?.detail as T;
    }

    initCustomEvent(): void {}
  }

  Object.defineProperty(globalThis, 'CustomEvent', {
    value: NodeCustomEvent,
    writable: true,
    configurable: true,
  });
}

// ─── Mock Worker ────────────────────────────────────────────────────────────

type MessageHandler = ((event: MessageEvent) => void) | null;

class MockWorker {
  onmessage: MessageHandler = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private listeners: Map<string, Array<{ handler: EventListenerOrEventListenerObject; once: boolean }>> = new Map();

  postMessage(data: unknown, _transfer?: Transferable[]): void {
    // Simulate async worker responses
    setTimeout(() => {
      if (data && typeof data === 'object' && 'type' in data) {
        const request = data as { id: string; type: string; params?: Record<string, unknown> };

        if (request.type === 'init') {
          // Send progress events first
          this.sendToMain({
            id: request.id,
            type: 'progress',
            progress: { stage: 'init', progress: 50, message: 'Loading...' },
          });
          // Then send result
          setTimeout(() => {
            this.sendToMain({
              id: request.id,
              type: 'result',
              data: { initialized: true },
            });
          }, 5);
        } else {
          // For analysis requests, return a mock result
          this.sendToMain({
            id: request.id,
            type: 'result',
            data: { mockResult: true, analysisType: request.type },
          });
        }
      }
    }, 5);
  }

  addEventListener(
    type: string,
    handler: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void {
    const once = typeof options === 'object' ? !!options.once : false;
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push({ handler, once });
  }

  removeEventListener(type: string, handler: EventListenerOrEventListenerObject): void {
    const list = this.listeners.get(type);
    if (list) {
      const idx = list.findIndex((l) => l.handler === handler);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  terminate(): void {
    this.onmessage = null;
    this.onerror = null;
    this.listeners.clear();
  }

  // Helper: simulate sending a message from worker to main thread
  sendToMain(response: WorkerResponse): void {
    const event = { data: response } as MessageEvent;

    // Fire onmessage
    if (this.onmessage) {
      this.onmessage(event);
    }

    // Fire addEventListener listeners
    const list = this.listeners.get('message');
    if (list) {
      const toRemove: number[] = [];
      list.forEach((entry, idx) => {
        if (typeof entry.handler === 'function') {
          entry.handler(event);
        } else {
          entry.handler.handleEvent(event);
        }
        if (entry.once) toRemove.push(idx);
      });
      // Remove once listeners in reverse order
      for (let i = toRemove.length - 1; i >= 0; i--) {
        list.splice(toRemove[i], 1);
      }
    }
  }

  // Simulate the worker ready signal
  signalReady(): void {
    this.sendToMain({
      id: '__worker_ready__',
      type: 'result',
      data: { ready: true },
    });
  }
}

// Replace global Worker with our mock
let mockWorkerInstance: MockWorker;
const OriginalWorker = globalThis.Worker;

beforeEach(() => {
  mockWorkerInstance = new MockWorker();
  // @ts-expect-error - mocking Worker constructor
  globalThis.Worker = class {
    constructor() {
      // Signal ready after a tick so the SDK can set up handlers first
      setTimeout(() => mockWorkerInstance.signalReady(), 1);
      return mockWorkerInstance;
    }
  };
});

afterEach(() => {
  if (OriginalWorker) {
    globalThis.Worker = OriginalWorker;
  }
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('InferentialStats: Constructor', () => {
  it('should create an instance with workerUrl', () => {
    // README: new InferentialStats({ workerUrl: '...' })
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    expect(stats).toBeInstanceOf(InferentialStats);
    expect(stats.isInitialized()).toBe(false);
    stats.destroy();
  });

  it('should create an instance with all config options', () => {
    // README: config.workerUrl, config.pyodideUrl, config.eventTarget
    const eventTarget = new EventTarget();
    const stats = new InferentialStats({
      workerUrl: '/test-worker.js',
      pyodideUrl: 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/',
      eventTarget,
    });
    expect(stats).toBeInstanceOf(InferentialStats);
    stats.destroy();
  });
});

describe('InferentialStats: Lifecycle', () => {
  it('should initialize successfully', async () => {
    // README: await stats.init()
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
    expect(stats.isInitialized()).toBe(true);
    stats.destroy();
  });

  it('should not initialize twice', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
    // Calling init() again should be a no-op
    await stats.init();
    expect(stats.isInitialized()).toBe(true);
    stats.destroy();
  });

  it('should report isInitialized() correctly', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    expect(stats.isInitialized()).toBe(false);
    await stats.init();
    expect(stats.isInitialized()).toBe(true);
    stats.destroy();
    expect(stats.isInitialized()).toBe(false);
  });

  it('should destroy and clean up', async () => {
    // README: stats.destroy()
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
    stats.destroy();
    expect(stats.isInitialized()).toBe(false);
  });

  it('should throw error when workerUrl is empty', async () => {
    const stats = new InferentialStats();
    await expect(stats.init()).rejects.toThrow('workerUrl is required');
    stats.destroy();
  });
});

describe('InferentialStats: Progress Events', () => {
  it('should dispatch progress CustomEvents during init', async () => {
    // README: Progress Event Handling section
    const eventTarget = new EventTarget();
    const progressEvents: Array<{ stage: string; progress: number; message: string }> = [];

    eventTarget.addEventListener(PROGRESS_EVENT_NAME, ((event: Event) => {
      const detail = (event as CustomEvent).detail;
      progressEvents.push(detail);
    }) as EventListener);

    const stats = new InferentialStats({
      workerUrl: '/test-worker.js',
      eventTarget,
    });
    await stats.init();

    // Our mock sends one progress event
    expect(progressEvents.length).toBeGreaterThanOrEqual(1);
    expect(progressEvents[0]).toHaveProperty('stage');
    expect(progressEvents[0]).toHaveProperty('progress');
    expect(progressEvents[0]).toHaveProperty('message');

    stats.destroy();
  });
});

describe('InferentialStats: Analysis Methods Exist', () => {
  // README API Reference: 16 analysis methods
  let stats: InferentialStats;

  beforeEach(async () => {
    stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
  });

  afterEach(() => {
    stats.destroy();
  });

  // ① Descriptive Statistics
  it('should have frequencies() method', () => {
    expect(typeof stats.frequencies).toBe('function');
  });

  it('should have descriptives() method', () => {
    expect(typeof stats.descriptives).toBe('function');
  });

  it('should have crosstabs() method', () => {
    expect(typeof stats.crosstabs).toBe('function');
  });

  // ② Compare Means
  it('should have ttestIndependent() method', () => {
    expect(typeof stats.ttestIndependent).toBe('function');
  });

  it('should have ttestPaired() method', () => {
    expect(typeof stats.ttestPaired).toBe('function');
  });

  it('should have anovaOneway() method', () => {
    expect(typeof stats.anovaOneway).toBe('function');
  });

  it('should have posthocTukey() method', () => {
    expect(typeof stats.posthocTukey).toBe('function');
  });

  // ③ Regression
  it('should have linearRegression() method', () => {
    expect(typeof stats.linearRegression).toBe('function');
  });

  it('should have logisticBinary() method', () => {
    expect(typeof stats.logisticBinary).toBe('function');
  });

  it('should have logisticMultinomial() method', () => {
    expect(typeof stats.logisticMultinomial).toBe('function');
  });

  // ④ Classify
  it('should have kmeans() method', () => {
    expect(typeof stats.kmeans).toBe('function');
  });

  it('should have hierarchicalCluster() method', () => {
    expect(typeof stats.hierarchicalCluster).toBe('function');
  });

  // ⑤ Dimension Reduction
  it('should have efa() method', () => {
    expect(typeof stats.efa).toBe('function');
  });

  it('should have pca() method', () => {
    expect(typeof stats.pca).toBe('function');
  });

  it('should have mds() method', () => {
    expect(typeof stats.mds).toBe('function');
  });

  // ⑥ Scale
  it('should have cronbachAlpha() method', () => {
    expect(typeof stats.cronbachAlpha).toBe('function');
  });
});

describe('InferentialStats: Analysis Method Execution (mocked)', () => {
  let stats: InferentialStats;

  beforeEach(async () => {
    stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
  });

  afterEach(() => {
    stats.destroy();
  });

  const sampleData = [
    { group: 'A', score: 85, grade: 90 },
    { group: 'A', score: 90, grade: 88 },
    { group: 'B', score: 78, grade: 82 },
    { group: 'B', score: 82, grade: 80 },
  ];

  it('should call frequencies() and return AnalysisResult', async () => {
    const result = await stats.frequencies({
      data: sampleData,
      variable: 'group',
    });
    // README: AnalysisResult { success, data, executionTimeMs }
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('executionTimeMs');
    expect(typeof result.executionTimeMs).toBe('number');
  });

  it('should call descriptives() and return AnalysisResult', async () => {
    const result = await stats.descriptives({
      data: sampleData,
      variables: ['score', 'grade'],
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('executionTimeMs');
  });

  it('should call crosstabs() and return AnalysisResult', async () => {
    // README CDN example: stats.crosstabs({ data, rowVariable: 'gender', colVariable: 'favorite_music' })
    const result = await stats.crosstabs({
      data: sampleData,
      rowVariable: 'group',
      colVariable: 'group',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  });

  it('should call anovaOneway() and return AnalysisResult', async () => {
    // README Quick Start example: stats.anovaOneway({ data, variable: 'score', groupVariable: 'group' })
    const result = await stats.anovaOneway({
      data: sampleData,
      variable: 'score',
      groupVariable: 'group',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  });

  it('should call ttestIndependent() and return AnalysisResult', async () => {
    const result = await stats.ttestIndependent({
      data: sampleData,
      variable: 'score',
      groupVariable: 'group',
      group1Value: 'A',
      group2Value: 'B',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  });

  it('should call ttestPaired() and return AnalysisResult', async () => {
    const result = await stats.ttestPaired({
      data: sampleData,
      variable1: 'score',
      variable2: 'grade',
    });
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('data');
  });

  it('should call posthocTukey() and return AnalysisResult', async () => {
    const result = await stats.posthocTukey({
      data: sampleData,
      variable: 'score',
      groupVariable: 'group',
      alpha: 0.05,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call linearRegression() and return AnalysisResult', async () => {
    const result = await stats.linearRegression({
      data: sampleData,
      dependentVariable: 'score',
      independentVariables: ['grade'],
      addConstant: true,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call logisticBinary() and return AnalysisResult', async () => {
    const data = sampleData.map((d) => ({ ...d, outcome: d.score > 84 ? 1 : 0 }));
    const result = await stats.logisticBinary({
      data,
      dependentVariable: 'outcome',
      independentVariables: ['grade'],
    });
    expect(result).toHaveProperty('success');
  });

  it('should call logisticMultinomial() and return AnalysisResult', async () => {
    const result = await stats.logisticMultinomial({
      data: sampleData,
      dependentVariable: 'group',
      independentVariables: ['score'],
    });
    expect(result).toHaveProperty('success');
  });

  it('should call kmeans() and return AnalysisResult', async () => {
    const result = await stats.kmeans({
      data: sampleData,
      variables: ['score', 'grade'],
      k: 2,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call hierarchicalCluster() and return AnalysisResult', async () => {
    const result = await stats.hierarchicalCluster({
      data: sampleData,
      variables: ['score', 'grade'],
      method: 'ward',
      nClusters: 2,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call efa() and return AnalysisResult', async () => {
    const result = await stats.efa({
      data: sampleData,
      variables: ['score', 'grade'],
      nFactors: 1,
      rotation: 'varimax',
    });
    expect(result).toHaveProperty('success');
  });

  it('should call pca() and return AnalysisResult', async () => {
    const result = await stats.pca({
      data: sampleData,
      variables: ['score', 'grade'],
      nComponents: 1,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call mds() and return AnalysisResult', async () => {
    const result = await stats.mds({
      data: sampleData,
      variables: ['score', 'grade'],
      nComponents: 2,
    });
    expect(result).toHaveProperty('success');
  });

  it('should call cronbachAlpha() and return AnalysisResult', async () => {
    const result = await stats.cronbachAlpha({
      data: sampleData,
      items: ['score', 'grade'],
    });
    expect(result).toHaveProperty('success');
  });
});

describe('InferentialStats: Cross-Origin Worker', () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = globalThis.URL.createObjectURL;
  const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
  const originalLocation = globalThis.location;

  beforeEach(() => {
    // Mock location to simulate a browser with a specific origin
    Object.defineProperty(globalThis, 'location', {
      value: { origin: 'https://example.codepen.dev', href: 'https://example.codepen.dev/' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
    Object.defineProperty(globalThis, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  it('should fetch worker script and create Blob URL for cross-origin workerUrl', async () => {
    const fakeBlobUrl = 'blob:https://example.codepen.dev/fake-uuid';
    let createdBlobType: string | undefined;
    let revokedUrl: string | undefined;

    // Mock fetch to return a fake worker script
    globalThis.fetch = (async () => ({
      ok: true,
      text: async () => 'self.postMessage({ id: "__worker_ready__", type: "result", data: { ready: true } });',
    })) as unknown as typeof fetch;

    // Mock URL.createObjectURL
    globalThis.URL.createObjectURL = ((blob: Blob) => {
      createdBlobType = blob.type;
      return fakeBlobUrl;
    }) as typeof URL.createObjectURL;

    // Mock URL.revokeObjectURL
    globalThis.URL.revokeObjectURL = ((url: string) => {
      revokedUrl = url;
    }) as typeof URL.revokeObjectURL;

    const stats = new InferentialStats({
      workerUrl: 'https://unpkg.com/@winm2m/inferential-stats-js/dist/stats-worker.js',
    });
    await stats.init();

    // Verify Blob was created with correct MIME type
    expect(createdBlobType).toBe('application/javascript');
    expect(stats.isInitialized()).toBe(true);

    // Verify Blob URL is revoked on destroy
    stats.destroy();
    expect(revokedUrl).toBe(fakeBlobUrl);
  });

  it('should not use Blob URL for same-origin workerUrl', async () => {
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return { ok: true, text: async () => '' };
    }) as unknown as typeof fetch;

    // Same-origin URL
    const stats = new InferentialStats({
      workerUrl: 'https://example.codepen.dev/stats-worker.js',
    });
    await stats.init();
    stats.destroy();

    // fetch should NOT have been called for same-origin
    expect(fetchCalled).toBe(false);
  });

  it('should not use Blob URL for relative workerUrl', async () => {
    let fetchCalled = false;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return { ok: true, text: async () => '' };
    }) as unknown as typeof fetch;

    const stats = new InferentialStats({
      workerUrl: '/worker/stats-worker.js',
    });
    await stats.init();
    stats.destroy();

    expect(fetchCalled).toBe(false);
  });

  it('should throw error when cross-origin fetch fails', async () => {
    globalThis.fetch = (async () => ({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    })) as unknown as typeof fetch;

    const stats = new InferentialStats({
      workerUrl: 'https://unpkg.com/@winm2m/inferential-stats-js/dist/stats-worker.js',
    });
    await expect(stats.init()).rejects.toThrow('Failed to fetch worker script');
    stats.destroy();
  });

  it('should throw error when cross-origin fetch encounters a network error', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;

    const stats = new InferentialStats({
      workerUrl: 'https://unpkg.com/@winm2m/inferential-stats-js/dist/stats-worker.js',
    });
    await expect(stats.init()).rejects.toThrow('Failed to fetch');
    stats.destroy();
  });
});

describe('InferentialStats: Error Handling', () => {
  it('should throw when calling analysis methods before init()', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    // README: Must call init() before any analysis methods
    await expect(
      stats.frequencies({
        data: [{ x: 1 }],
        variable: 'x',
      }),
    ).rejects.toThrow('SDK not initialized');
    stats.destroy();
  });

  it('should return { success: false, error } when the worker sends an error response', async () => {
    // Replace the mock worker to simulate an error response from the worker
    const errorWorkerInstance = new MockWorker();
    // Override postMessage to respond with an error for analysis requests
    errorWorkerInstance.postMessage = function (data: unknown, _transfer?: Transferable[]) {
      setTimeout(() => {
        if (data && typeof data === 'object' && 'type' in data) {
          const request = data as { id: string; type: string };
          if (request.type === 'init') {
            this.sendToMain({
              id: request.id,
              type: 'result',
              data: { initialized: true },
            });
          } else {
            // Simulate a worker-side analysis error
            this.sendToMain({
              id: request.id,
              type: 'error',
              error: 'Python analysis raised ValueError: variable not found',
            });
          }
        }
      }, 5);
    };

    // @ts-expect-error - mocking Worker constructor
    globalThis.Worker = class {
      constructor() {
        setTimeout(() => errorWorkerInstance.signalReady(), 1);
        return errorWorkerInstance;
      }
    };

    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();

    const result = await stats.frequencies({
      data: [{ x: 1 }],
      variable: 'x',
    });

    // _runAnalysis catches the rejection and wraps it
    expect(result.success).toBe(false);
    expect(result.error).toContain('variable not found');
    expect(result.data).toBeNull();
    expect(typeof result.executionTimeMs).toBe('number');

    stats.destroy();
  });

  it('should throw when calling analysis methods after destroy()', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();
    stats.destroy();

    // After destroy, isInitialized() returns false so _runAnalysis should throw
    await expect(
      stats.frequencies({
        data: [{ x: 1 }],
        variable: 'x',
      }),
    ).rejects.toThrow('SDK not initialized');
  });

  it('should reject pending requests when destroy() is called mid-flight', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();

    // Create a slow mock worker that doesn't reply immediately
    const neverReplyInstance = new MockWorker();
    neverReplyInstance.postMessage = function () {
      // Never send a response — simulates a long-running analysis
    };
    // @ts-expect-error - replace the internal worker
    stats['worker'] = neverReplyInstance;

    // Start a request (it will hang because the mock never replies)
    const promise = stats.frequencies({
      data: [{ x: 1 }],
      variable: 'x',
    });

    // Destroy while the request is pending — it should reject with a clear error
    // We need a tiny yield so the promise executor runs
    await new Promise((r) => setTimeout(r, 0));
    stats.destroy();

    // _runAnalysis catches the rejection and wraps it into { success: false }
    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('destroyed');
  });

  it('should reject pending requests when the worker fires an onerror event', async () => {
    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();

    // Replace mock worker with one that fires onerror instead of replying
    const brokenWorkerInstance = new MockWorker();
    brokenWorkerInstance.postMessage = function () {
      // Don't respond – trigger onerror instead
    };
    // @ts-expect-error - replace the internal worker (private field)
    stats['worker'] = brokenWorkerInstance;

    // Wire up onerror: the SDK sets worker.onerror during _doInit, but we
    // replaced the worker, so we need to manually replicate its behavior.
    brokenWorkerInstance.onerror = (event: ErrorEvent) => {
      const errorMsg = `Worker error: ${event.message ?? 'Unknown worker error'}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pendingRequests = (stats as any)['pendingRequests'] as Map<string, { resolve: (v: unknown) => void; reject: (r: unknown) => void }>;
      for (const [reqId, pending] of pendingRequests) {
        pending.reject(new Error(errorMsg));
        pendingRequests.delete(reqId);
      }
    };

    // Start a request
    const promise = stats.frequencies({
      data: [{ x: 1 }],
      variable: 'x',
    });

    // Simulate a worker error event after a tick
    await new Promise((r) => setTimeout(r, 5));
    if (brokenWorkerInstance.onerror) {
      brokenWorkerInstance.onerror({ message: 'Script error.' } as ErrorEvent);
    }

    const result = await promise;
    expect(result.success).toBe(false);
    expect(result.error).toContain('Worker error');

    stats.destroy();
  });

  it('should return error for unknown analysis type via _sendRequest', async () => {
    // The mock worker sends a successful result for any type, so we need a
    // custom mock that echoes an error for unknown types.
    const unknownTypeWorkerInstance = new MockWorker();
    unknownTypeWorkerInstance.postMessage = function (data: unknown, _transfer?: Transferable[]) {
      setTimeout(() => {
        if (data && typeof data === 'object' && 'type' in data) {
          const request = data as { id: string; type: string };
          if (request.type === 'init') {
            this.sendToMain({
              id: request.id,
              type: 'result',
              data: { initialized: true },
            });
          } else {
            // Mirror the worker's default branch: unknown type -> error
            this.sendToMain({
              id: request.id,
              type: 'error',
              error: `Unknown analysis type: ${request.type}`,
            });
          }
        }
      }, 5);
    };

    // @ts-expect-error - mocking Worker constructor
    globalThis.Worker = class {
      constructor() {
        setTimeout(() => unknownTypeWorkerInstance.signalReady(), 1);
        return unknownTypeWorkerInstance;
      }
    };

    const stats = new InferentialStats({ workerUrl: '/test-worker.js' });
    await stats.init();

    // Use _sendRequest with an arbitrary type to simulate an unknown analysis type.
    // Since we can't easily call a non-existent public method, we call an existing
    // one whose mock will always return the 'error' above.
    const result = await stats.descriptives({
      data: [{ x: 1 }],
      variables: ['x'],
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown analysis type');

    stats.destroy();
  });
});
