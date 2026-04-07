// @ts-nocheck
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InferentialStats } from '../src/index';

const workerUrl = new URL('../dist/stats-worker.js', import.meta.url).href;
const BENCHMARK_MARKER = '__INFERENTIAL_BENCHMARK_JSON__';

type SurveyRow = Record<string, string | number>;

describe('InferentialStats benchmark e2e', () => {
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

  it('collects per-function timing metrics for all 16 analyses', async () => {
    const functionTimingsMs: Record<string, number> = {};

    const record = <T extends { success: boolean; executionTimeMs: number; data: unknown }>(
      functionName: string,
      result: T
    ): T => {
      expect(result.success).toBe(true);
      expect(Number.isFinite(result.executionTimeMs)).toBe(true);
      functionTimingsMs[functionName] = result.executionTimeMs;
      return result;
    };

    const frequencies = record('frequencies', await stats.frequencies({
      data,
      variable: 'favorite_music',
    }));
    expect((frequencies.data as { frequencies: unknown[] }).frequencies.length).toBeGreaterThan(0);

    const descriptives = record('descriptives', await stats.descriptives({
      data,
      variables: [
        'music_satisfaction',
        'movie_satisfaction',
        'art_satisfaction',
        'weekly_hours_music',
        'weekly_hours_movie',
        'monthly_art_visits',
      ],
    }));
    expect((descriptives.data as { statistics: unknown[] }).statistics.length).toBeGreaterThan(0);

    record('crosstabs', await stats.crosstabs({
      data,
      rowVariable: 'gender',
      colVariable: 'favorite_music',
    }));

    record('ttestIndependent', await stats.ttestIndependent({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'gender',
      group1Value: 'Male',
      group2Value: 'Female',
    }));

    record('ttestPaired', await stats.ttestPaired({
      data,
      variable1: 'music_satisfaction',
      variable2: 'movie_satisfaction',
    }));

    record('anovaOneway', await stats.anovaOneway({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'age_group',
    }));

    record('posthocTukey', await stats.posthocTukey({
      data,
      variable: 'music_satisfaction',
      groupVariable: 'age_group',
      alpha: 0.05,
    }));

    record('linearRegression', await stats.linearRegression({
      data,
      dependentVariable: 'music_satisfaction',
      independentVariables: ['weekly_hours_music', 'weekly_hours_movie'],
    }));

    record('logisticBinary', await stats.logisticBinary({
      data: binaryData,
      dependentVariable: 'is_high_music',
      independentVariables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
    }));

    record('logisticMultinomial', await stats.logisticMultinomial({
      data,
      dependentVariable: 'age_group',
      independentVariables: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
      referenceCategory: '20s',
    }));

    record('kmeans', await stats.kmeans({
      data,
      variables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
      k: 3,
      randomState: 42,
      maxIterations: 100,
    }));

    record('hierarchicalCluster', await stats.hierarchicalCluster({
      data: sampledData,
      variables: ['weekly_hours_music', 'weekly_hours_movie', 'monthly_art_visits'],
      method: 'ward',
      metric: 'euclidean',
      nClusters: 3,
    }));

    record('pca', await stats.pca({
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
    }));

    record('efa', await stats.efa({
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
    }));

    record('mds', await stats.mds({
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
    }));

    record('cronbachAlpha', await stats.cronbachAlpha({
      data,
      items: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
    }));

    const totalExecutionTimeMs = Object.values(functionTimingsMs).reduce((sum, ms) => sum + ms, 0);

    console.log(`${BENCHMARK_MARKER}${JSON.stringify({ functionTimingsMs, totalExecutionTimeMs })}`);
  });
});
