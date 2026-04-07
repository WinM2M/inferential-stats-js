import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InferentialStats } from '../src/index';

const workerUrl = new URL('../dist/stats-worker.js', import.meta.url).href;

type SurveyRow = Record<string, string | number>;

const expectNonZeroFiniteNumber = (value: unknown, label: string): void => {
  expect(typeof value, `${label} should be a number`).toBe('number');
  expect(Number.isFinite(value), `${label} should be finite`).toBe(true);
  expect(value, `${label} should not be zero`).not.toBe(0);
};

describe('InferentialStats browser e2e', () => {
  let stats: InferentialStats;
  let data: SurveyRow[];
  let binaryData: SurveyRow[];
  let sampledData: SurveyRow[];

  beforeAll(async () => {
    stats = new InferentialStats({ workerUrl });
    await stats.init();

    const response = await fetch('/docs/sample-survey-data.json');
    data = (await response.json()) as SurveyRow[];

    binaryData = data.map((row) => {
      const musicScore = Number(row.music_satisfaction);
      return {
        ...row,
        is_high_music: Number.isFinite(musicScore) && musicScore >= 4 ? 1 : 0,
      };
    });

    sampledData = data.slice(0, 300);
  });

  afterAll(() => {
    stats.destroy();
  });

  it('runs all stats-worker analyses and returns valid non-zero float metrics', async () => {
    const frequencies = await stats.frequencies({
      data,
      variable: 'favorite_music',
    });
    expect(frequencies.success, frequencies.error).toBe(true);
    expectNonZeroFiniteNumber(frequencies.data.frequencies[0]?.percentage, 'frequencies.percentage');
    expectNonZeroFiniteNumber(frequencies.data.frequencies[0]?.cumulativePercentage, 'frequencies.cumulativePercentage');

    const descriptives = await stats.descriptives({
      data,
      variables: [
        'music_satisfaction',
        'movie_satisfaction',
        'art_satisfaction',
        'weekly_hours_music',
        'weekly_hours_movie',
        'monthly_art_visits',
      ],
    });
    expect(descriptives.success).toBe(true);
    expectNonZeroFiniteNumber(descriptives.data.statistics[0]?.mean, 'descriptives.mean');
    expectNonZeroFiniteNumber(descriptives.data.statistics[0]?.std, 'descriptives.std');

    const crosstabs = await stats.crosstabs({
      data,
      rowVariable: 'gender',
      colVariable: 'favorite_music',
    });
    expect(crosstabs.success).toBe(true);
    expectNonZeroFiniteNumber(crosstabs.data.chiSquare, 'crosstabs.chiSquare');
    expectNonZeroFiniteNumber(crosstabs.data.cramersV, 'crosstabs.cramersV');

    const ttestIndependent = await stats.ttestIndependent({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'gender',
      group1Value: 'Male',
      group2Value: 'Female',
    });
    expect(ttestIndependent.success).toBe(true);
    expectNonZeroFiniteNumber(ttestIndependent.data.equalVariance.tStatistic, 'ttestIndependent.equalVariance.tStatistic');
    expectNonZeroFiniteNumber(ttestIndependent.data.unequalVariance.tStatistic, 'ttestIndependent.unequalVariance.tStatistic');

    const ttestPaired = await stats.ttestPaired({
      data,
      variable1: 'music_satisfaction',
      variable2: 'movie_satisfaction',
    });
    expect(ttestPaired.success).toBe(true);
    expectNonZeroFiniteNumber(ttestPaired.data.tStatistic, 'ttestPaired.tStatistic');
    expectNonZeroFiniteNumber(ttestPaired.data.stdDifference, 'ttestPaired.stdDifference');

    const anova = await stats.anovaOneway({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'age_group',
    });
    expect(anova.success).toBe(true);
    expectNonZeroFiniteNumber(anova.data.fStatistic, 'anova.fStatistic');
    expectNonZeroFiniteNumber(anova.data.etaSquared, 'anova.etaSquared');

    const posthoc = await stats.posthocTukey({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'age_group',
      alpha: 0.05,
    });
    expect(posthoc.success).toBe(true);
    expect(posthoc.data.comparisons.length).toBeGreaterThan(0);
    expectNonZeroFiniteNumber(posthoc.data.comparisons[0]?.meanDifference, 'posthoc.meanDifference');
    expectNonZeroFiniteNumber(posthoc.data.comparisons[0]?.lowerCI, 'posthoc.lowerCI');

    const linearRegression = await stats.linearRegression({
      data,
      dependentVariable: 'music_satisfaction',
      independentVariables: ['weekly_hours_music', 'weekly_hours_movie'],
    });
    expect(linearRegression.success).toBe(true);
    expectNonZeroFiniteNumber(linearRegression.data.rSquared, 'linearRegression.rSquared');
    expectNonZeroFiniteNumber(linearRegression.data.fStatistic, 'linearRegression.fStatistic');

    const logisticBinary = await stats.logisticBinary({
      data: binaryData,
      dependentVariable: 'is_high_music',
      independentVariables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
    });
    expect(logisticBinary.success).toBe(true);
    expectNonZeroFiniteNumber(logisticBinary.data.pseudoRSquared, 'logisticBinary.pseudoRSquared');
    expectNonZeroFiniteNumber(logisticBinary.data.aic, 'logisticBinary.aic');

    const logisticMultinomial = await stats.logisticMultinomial({
      data,
      dependentVariable: 'age_group',
      independentVariables: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
      referenceCategory: '20s',
    });
    expect(logisticMultinomial.success).toBe(true);
    expectNonZeroFiniteNumber(logisticMultinomial.data.pseudoRSquared, 'logisticMultinomial.pseudoRSquared');
    expectNonZeroFiniteNumber(logisticMultinomial.data.aic, 'logisticMultinomial.aic');

    const kmeans = await stats.kmeans({
      data,
      variables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
      k: 3,
      randomState: 42,
      maxIterations: 100,
    });
    expect(kmeans.success).toBe(true);
    expectNonZeroFiniteNumber(kmeans.data.inertia, 'kmeans.inertia');

    const hierarchicalCluster = await stats.hierarchicalCluster({
      data: sampledData,
      variables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
      method: 'ward',
      metric: 'euclidean',
      nClusters: 3,
    });
    expect(hierarchicalCluster.success).toBe(true);
    expectNonZeroFiniteNumber(hierarchicalCluster.data.linkageMatrix[0]?.[2], 'hierarchicalCluster.linkageMatrix[0][2]');

    const pca = await stats.pca({
      data,
      variables: [
        'music_satisfaction',
        'movie_satisfaction',
        'art_satisfaction',
        'weekly_hours_music',
        'weekly_hours_movie',
        'monthly_art_visits',
      ],
      nComponents: 3,
      standardize: true,
    });
    expect(pca.success).toBe(true);
    expectNonZeroFiniteNumber(pca.data.explainedVarianceRatio[0], 'pca.explainedVarianceRatio[0]');

    const efa = await stats.efa({
      data,
      variables: [
        'music_satisfaction',
        'movie_satisfaction',
        'art_satisfaction',
        'weekly_hours_music',
        'weekly_hours_movie',
        'monthly_art_visits',
      ],
      nFactors: 3,
      rotation: 'varimax',
    });
    expect(efa.success).toBe(true);
    const firstLoadingRow = Object.values(efa.data.loadings)[0];
    expectNonZeroFiniteNumber(firstLoadingRow?.[0], 'efa.loadings[0][0]');

    const mds = await stats.mds({
      data: sampledData,
      variables: [
        'music_satisfaction',
        'movie_satisfaction',
        'art_satisfaction',
        'weekly_hours_music',
        'weekly_hours_movie',
        'monthly_art_visits',
      ],
      nComponents: 2,
      metric: true,
      maxIterations: 100,
      randomState: 42,
    });
    expect(mds.success).toBe(true);
    expectNonZeroFiniteNumber(mds.data.stress, 'mds.stress');
    expectNonZeroFiniteNumber(mds.data.coordinates[0]?.[0], 'mds.coordinates[0][0]');

    const cronbachAlpha = await stats.cronbachAlpha({
      data,
      items: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
    });
    expect(cronbachAlpha.success).toBe(true);
    expectNonZeroFiniteNumber(cronbachAlpha.data.alpha, 'cronbachAlpha.alpha');
    expectNonZeroFiniteNumber(cronbachAlpha.data.standardizedAlpha, 'cronbachAlpha.standardizedAlpha');
  });
});
