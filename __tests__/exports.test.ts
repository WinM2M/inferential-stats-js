/**
 * Tests that verify all public exports match what is documented in the README.
 *
 * README documents:
 * - InferentialStats class (main SDK)
 * - PROGRESS_EVENT_NAME constant
 * - InferentialStatsConfig type
 * - AnalysisResult<T> interface
 * - ProgressDetail interface
 * - All 16 analysis input/output types
 * - Bridge utilities (serializeToBuffer, deserializeFromBuffer, etc.)
 */

import {
  InferentialStats,
  PROGRESS_EVENT_NAME,
  serializeToBuffer,
  getTransferables,
  deserializeFromBuffer,
  deserializeToColumns,
} from '../src/index';

// Import types to verify they exist (compile-time check)
import type {
  InferentialStatsConfig,
  AnalysisResult,
  ProgressDetail,
  WorkerRequestType,
  FrequenciesInput,
  FrequenciesOutput,
  FrequencyItem,
  DescriptivesInput,
  DescriptivesOutput,
  DescriptiveStats,
  CrosstabsInput,
  CrosstabsOutput,
  CrosstabCell,
  TTestIndependentInput,
  TTestIndependentOutput,
  TTestResult,
  LeveneTestResult,
  TTestPairedInput,
  TTestPairedOutput,
  AnovaInput,
  AnovaOutput,
  AnovaGroupStats,
  PostHocInput,
  PostHocOutput,
  PostHocComparison,
  LinearRegressionInput,
  LinearRegressionOutput,
  RegressionCoefficient,
  LogisticBinaryInput,
  LogisticBinaryOutput,
  LogisticCoefficient,
  MultinomialLogisticInput,
  MultinomialLogisticOutput,
  MultinomialCoefficient,
  KMeansInput,
  KMeansOutput,
  ClusterCenter,
  HierarchicalClusterInput,
  HierarchicalClusterOutput,
  EFAInput,
  EFAOutput,
  PCAInput,
  PCAOutput,
  MDSInput,
  MDSOutput,
  CronbachAlphaInput,
  CronbachAlphaOutput,
  ItemAnalysis,
} from '../src/index';

describe('Public exports', () => {
  it('should export InferentialStats class', () => {
    expect(InferentialStats).toBeDefined();
    expect(typeof InferentialStats).toBe('function');
  });

  it('should export PROGRESS_EVENT_NAME constant as "inferential-stats-progress"', () => {
    // README: The event name is exported as the constant PROGRESS_EVENT_NAME
    // (value: 'inferential-stats-progress').
    expect(PROGRESS_EVENT_NAME).toBe('inferential-stats-progress');
  });

  it('should export bridge utilities', () => {
    // README: "Export bridge utilities for advanced users"
    expect(typeof serializeToBuffer).toBe('function');
    expect(typeof getTransferables).toBe('function');
    expect(typeof deserializeFromBuffer).toBe('function');
    expect(typeof deserializeToColumns).toBe('function');
  });
});

describe('Type exports (compile-time verification)', () => {
  // These tests verify that types are properly exported and assignable.
  // If any type is missing, the file won't compile.

  it('should define AnalysisResult interface correctly', () => {
    // README: interface AnalysisResult<T> { success, data, error?, executionTimeMs }
    const result: AnalysisResult<{ value: number }> = {
      success: true,
      data: { value: 42 },
      executionTimeMs: 10,
    };
    expect(result.success).toBe(true);
    expect(result.data.value).toBe(42);
    expect(result.executionTimeMs).toBe(10);
    expect(result.error).toBeUndefined();
  });

  it('should define AnalysisResult with error', () => {
    const result: AnalysisResult<null> = {
      success: false,
      data: null,
      error: 'Something went wrong',
      executionTimeMs: 5,
    };
    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });

  it('should define ProgressDetail interface', () => {
    // README: ProgressDetail { stage, progress (0-100), message }
    const detail: ProgressDetail = {
      stage: 'packages',
      progress: 55,
      message: 'Installing scipy…',
    };
    expect(detail.stage).toBe('packages');
    expect(detail.progress).toBe(55);
    expect(detail.message).toBe('Installing scipy…');
  });

  it('should define FrequenciesInput/Output types', () => {
    const input: FrequenciesInput = {
      data: [{ gender: 'Male' }, { gender: 'Female' }],
      variable: 'gender',
    };
    expect(input.variable).toBe('gender');

    const output: FrequenciesOutput = {
      variable: 'gender',
      totalCount: 2,
      frequencies: [
        { value: 'Male', count: 1, percentage: 50, cumulativePercentage: 50 },
        { value: 'Female', count: 1, percentage: 50, cumulativePercentage: 100 },
      ],
    };
    expect(output.frequencies).toHaveLength(2);
  });

  it('should define DescriptivesInput/Output types', () => {
    const input: DescriptivesInput = {
      data: [{ score: 85 }, { score: 90 }],
      variables: ['score'],
    };
    expect(input.variables).toEqual(['score']);

    const stat: DescriptiveStats = {
      variable: 'score',
      count: 2,
      mean: 87.5,
      std: 3.535,
      min: 85,
      max: 90,
      q25: 86.25,
      q50: 87.5,
      q75: 88.75,
      skewness: 0,
      kurtosis: -2,
    };
    expect(stat.mean).toBe(87.5);
  });

  it('should define CrosstabsInput/Output types', () => {
    // README CDN example: stats.crosstabs({ data, rowVariable: 'gender', colVariable: 'favorite_music' })
    const input: CrosstabsInput = {
      data: [{ gender: 'Male', favorite_music: 'Rock' }],
      rowVariable: 'gender',
      colVariable: 'favorite_music',
    };
    expect(input.rowVariable).toBe('gender');

    const cell: CrosstabCell = {
      row: 'Male',
      col: 'Rock',
      observed: 10,
      expected: 8.5,
      rowPercentage: 40,
      colPercentage: 60,
      totalPercentage: 20,
    };
    expect(cell.observed).toBe(10);
  });

  it('should define TTestIndependentInput/Output types', () => {
    const input: TTestIndependentInput = {
      data: [{ group: 'A', score: 85 }],
      variable: 'score',
      groupVariable: 'group',
      group1Value: 'A',
      group2Value: 'B',
    };
    expect(input.groupVariable).toBe('group');

    const levene: LeveneTestResult = {
      statistic: 0.5,
      pValue: 0.48,
      equalVariance: true,
    };
    expect(levene.equalVariance).toBe(true);
  });

  it('should define TTestPairedInput/Output types', () => {
    const input: TTestPairedInput = {
      data: [{ before: 80, after: 85 }],
      variable1: 'before',
      variable2: 'after',
    };
    expect(input.variable1).toBe('before');
  });

  it('should define AnovaInput/Output types', () => {
    // README Quick Start: stats.anovaOneway({ data, variable: 'score', groupVariable: 'group' })
    const input: AnovaInput = {
      data: [{ group: 'A', score: 85 }],
      variable: 'score',
      groupVariable: 'group',
    };
    expect(input.variable).toBe('score');

    const groupStat: AnovaGroupStats = {
      group: 'A',
      n: 10,
      mean: 85,
      std: 5.2,
    };
    expect(groupStat.group).toBe('A');
  });

  it('should define PostHocInput/Output types', () => {
    const input: PostHocInput = {
      data: [{ group: 'A', score: 85 }],
      variable: 'score',
      groupVariable: 'group',
      alpha: 0.05,
    };
    expect(input.alpha).toBe(0.05);

    const comparison: PostHocComparison = {
      group1: 'A',
      group2: 'B',
      meanDifference: 5.3,
      pValue: 0.02,
      lowerCI: 1.2,
      upperCI: 9.4,
      reject: true,
    };
    expect(comparison.reject).toBe(true);
  });

  it('should define LinearRegressionInput/Output types', () => {
    const input: LinearRegressionInput = {
      data: [{ x: 1, y: 2 }],
      dependentVariable: 'y',
      independentVariables: ['x'],
      addConstant: true,
    };
    expect(input.dependentVariable).toBe('y');

    const coef: RegressionCoefficient = {
      variable: 'x',
      coefficient: 1.5,
      stdError: 0.3,
      tStatistic: 5.0,
      pValue: 0.001,
      confidenceInterval: [0.9, 2.1],
    };
    expect(coef.coefficient).toBe(1.5);
  });

  it('should define LogisticBinaryInput/Output types', () => {
    const input: LogisticBinaryInput = {
      data: [{ x: 1, y: 0 }],
      dependentVariable: 'y',
      independentVariables: ['x'],
    };
    expect(input.dependentVariable).toBe('y');

    const coef: LogisticCoefficient = {
      variable: 'x',
      coefficient: 0.8,
      stdError: 0.2,
      zStatistic: 4.0,
      pValue: 0.001,
      oddsRatio: 2.23,
      confidenceInterval: [0.4, 1.2],
    };
    expect(coef.oddsRatio).toBe(2.23);
  });

  it('should define MultinomialLogisticInput/Output types', () => {
    const input: MultinomialLogisticInput = {
      data: [{ x: 1, category: 'A' }],
      dependentVariable: 'category',
      independentVariables: ['x'],
      referenceCategory: 'A',
    };
    expect(input.referenceCategory).toBe('A');

    const coef: MultinomialCoefficient = {
      category: 'B',
      variable: 'x',
      coefficient: 1.2,
      stdError: 0.3,
      zStatistic: 4.0,
      pValue: 0.001,
      oddsRatio: 3.32,
      confidenceInterval: [0.6, 1.8],
    };
    expect(coef.category).toBe('B');
  });

  it('should define KMeansInput/Output types', () => {
    const input: KMeansInput = {
      data: [{ x: 1, y: 2 }],
      variables: ['x', 'y'],
      k: 3,
    };
    expect(input.k).toBe(3);

    const center: ClusterCenter = {
      cluster: 0,
      center: { x: 1.5, y: 2.5 },
    };
    expect(center.cluster).toBe(0);
  });

  it('should define HierarchicalClusterInput/Output types', () => {
    const input: HierarchicalClusterInput = {
      data: [{ x: 1, y: 2 }],
      variables: ['x', 'y'],
      method: 'ward',
      metric: 'euclidean',
      nClusters: 3,
    };
    expect(input.method).toBe('ward');
  });

  it('should define EFAInput/Output types', () => {
    const input: EFAInput = {
      data: [{ q1: 4, q2: 5, q3: 3 }],
      variables: ['q1', 'q2', 'q3'],
      nFactors: 2,
      rotation: 'varimax',
    };
    expect(input.rotation).toBe('varimax');
  });

  it('should define PCAInput/Output types', () => {
    const input: PCAInput = {
      data: [{ x: 1, y: 2, z: 3 }],
      variables: ['x', 'y', 'z'],
      nComponents: 2,
      standardize: true,
    };
    expect(input.nComponents).toBe(2);
  });

  it('should define MDSInput/Output types', () => {
    const input: MDSInput = {
      data: [{ x: 1, y: 2 }],
      variables: ['x', 'y'],
      nComponents: 2,
      metric: true,
    };
    expect(input.nComponents).toBe(2);
  });

  it('should define CronbachAlphaInput/Output types', () => {
    const input: CronbachAlphaInput = {
      data: [{ q1: 4, q2: 5, q3: 3 }],
      items: ['q1', 'q2', 'q3'],
    };
    expect(input.items).toEqual(['q1', 'q2', 'q3']);

    const item: ItemAnalysis = {
      item: 'q1',
      itemMean: 3.8,
      itemStd: 0.9,
      correctedItemTotalCorrelation: 0.72,
      alphaIfItemDeleted: 0.81,
    };
    expect(item.correctedItemTotalCorrelation).toBe(0.72);
  });

  it('should define WorkerRequestType as a union of all analysis types', () => {
    // Verify all 17 request types (init + 16 analyses) are valid
    const types: WorkerRequestType[] = [
      'init',
      'frequencies',
      'descriptives',
      'crosstabs',
      'ttest_independent',
      'ttest_paired',
      'anova_oneway',
      'posthoc_tukey',
      'linear_regression',
      'logistic_binary',
      'logistic_multinomial',
      'kmeans',
      'hierarchical_cluster',
      'efa',
      'pca',
      'mds',
      'cronbach_alpha',
    ];
    expect(types).toHaveLength(17);
  });
});
