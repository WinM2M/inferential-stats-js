import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { InferentialStats, PROGRESS_EVENT_NAME } from '../src/index';
import type { ProgressDetail } from '../src/index';

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
  const progressEvents: ProgressDetail[] = [];

  beforeAll(async () => {
    const eventTarget = new EventTarget();
    eventTarget.addEventListener(PROGRESS_EVENT_NAME, (event) => {
      progressEvents.push((event as CustomEvent<ProgressDetail>).detail);
    });
    stats = new InferentialStats({ workerUrl, eventTarget });
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

  it('rotates obliquely and reports the three matrices the rotation splits into', async () => {
    // 사교 회전은 적재 한 장으로 끝나지 않는다. 패턴·구조·요인상관이 서로
    // 맞물려 나와야 해석이 되고, 공통성은 회전에 변하지 않아야 한다.
    const variables = [
      'music_satisfaction',
      'movie_satisfaction',
      'art_satisfaction',
      'weekly_hours_music',
      'weekly_hours_movie',
      'monthly_art_visits',
    ];

    const varimax = await stats.pca({ data, variables, nComponents: 3, rotation: 'varimax' });
    expect(varimax.success, JSON.stringify(varimax.error)).toBe(true);
    expect(varimax.data.rotationApplied).toBe(true);
    expect(varimax.data.rotationIsOblique).toBe(false);
    expect(varimax.data.factorCorrelation ?? null).toBeNull();
    expect(varimax.data.structureLoadings ?? null).toBeNull();

    const orthogonalRotationRows = varimax.data.totalVarianceExplained?.rotation ?? [];
    expect(orthogonalRotationRows.length).toBe(3);
    expectNonZeroFiniteNumber(orthogonalRotationRows[0]?.variancePercent, 'varimax rotation variancePercent');

    for (const rotation of ['promax', 'oblimin'] as const) {
      const oblique = await stats.pca({ data, variables, nComponents: 3, rotation });
      expect(oblique.success, JSON.stringify(oblique.error)).toBe(true);

      const result = oblique.data;
      expect(result.rotation, `${rotation}: rotation echoed back`).toBe(rotation);
      expect(result.rotationApplied).toBe(true);
      expect(result.rotationIsOblique).toBe(true);

      // 요인상관 Phi: 대칭이고 대각은 1, 비대각은 상관이므로 (-1, 1).
      const phi = result.factorCorrelation;
      expect(Array.isArray(phi), `${rotation}: factorCorrelation is a matrix`).toBe(true);
      expect(phi?.length).toBe(3);
      phi?.forEach((row, i) => {
        expect(row.length).toBe(3);
        expect(row[i], `${rotation}: Phi[${i}][${i}]`).toBeCloseTo(1, 10);
        row.forEach((value, j) => {
          expect(value, `${rotation}: Phi[${i}][${j}] symmetric`).toBeCloseTo(phi[j][i], 12);
          // 상관이므로 |phi| <= 1. 대각은 부동소수점으로 1 을 아주 살짝 넘겨 돌아온다.
          expect(Math.abs(value), `${rotation}: Phi[${i}][${j}] in range`).toBeLessThanOrEqual(1 + 1e-9);
        });
      });
      // 직교 회전과 구분되려면 적어도 한 쌍은 실제로 상관이 있어야 한다.
      expect(Math.abs(phi?.[0]?.[1] ?? 0), `${rotation}: components actually correlate`).toBeGreaterThan(1e-6);

      // 구조 행렬은 패턴에 Phi 를 곱한 것이다. 둘 중 하나만 맞아도 해석이 어긋난다.
      const structure = result.structureLoadings ?? {};
      for (const variable of variables) {
        const pattern = result.loadings[variable];
        for (let j = 0; j < 3; j += 1) {
          const expected = pattern.reduce((sum, value, k) => sum + value * (phi?.[k]?.[j] ?? 0), 0);
          expect(structure[variable]?.[j], `${rotation}: structure[${variable}][${j}]`).toBeCloseTo(expected, 10);
        }
        // 공통성은 회전에 불변이다. 사교에서 적재 제곱합을 그대로 쓰면 틀린다.
        expect(result.communalities?.[variable], `${rotation}: communality of ${variable}`)
          .toBeCloseTo(varimax.data.communalities?.[variable] ?? NaN, 10);
      }

      // 상관된 성분의 제곱합은 더해지지 않으므로 분산 비율을 내지 않는다(SPSS).
      const rotationRows = result.totalVarianceExplained?.rotation ?? [];
      expect(rotationRows.length).toBe(3);
      rotationRows.forEach((row, index) => {
        expectNonZeroFiniteNumber(row.eigenvalue, `${rotation}: rotation SSL ${index}`);
        expect(row.variancePercent, `${rotation}: no percent of variance`).toBeNull();
        expect(row.cumulativePercent, `${rotation}: no cumulative percent`).toBeNull();
      });
    }
  });

  it('declines to rotate a one-component solution instead of failing on it', async () => {
    // factor_analyzer 는 1성분에 varimax 를 걸면 예외를 던지고 promax 는 행렬을
    // 잘라서 돌려준다. Kaiser 기준이 1성분을 고르는 데이터가 흔하므로 여기서 막는다.
    const single = await stats.pca({
      data,
      variables: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
      nComponents: 1,
      rotation: 'varimax',
    });
    expect(single.success, JSON.stringify(single.error)).toBe(true);
    expect(single.data.nComponents).toBe(1);
    expect(single.data.rotationApplied).toBe(false);
    expect(single.data.rotationIsOblique).toBe(false);
    expectNonZeroFiniteNumber(single.data.loadings.music_satisfaction?.[0], 'single-component loading');
  });

  it('refuses a rotation it does not implement instead of silently not rotating', async () => {
    const result = await stats.pca({
      data,
      variables: ['music_satisfaction', 'movie_satisfaction', 'art_satisfaction'],
      nComponents: 2,
      // 타입이 막는 값이라 캐스팅한다. 런타임에서도 거절해야 한다.
      rotation: 'quartimax' as 'varimax',
    });
    expect(result.success).toBe(false);
    expect(String(result.error)).toMatch(/quartimax/);
  });

  it('rotates factors obliquely in EFA as well', async () => {
    const variables = [
      'music_satisfaction',
      'movie_satisfaction',
      'art_satisfaction',
      'weekly_hours_music',
      'weekly_hours_movie',
      'monthly_art_visits',
    ];

    const varimax = await stats.efa({ data, variables, rotation: 'varimax' });
    expect(varimax.success, JSON.stringify(varimax.error)).toBe(true);

    const promax = await stats.efa({ data, variables, rotation: 'promax' });
    expect(promax.success, JSON.stringify(promax.error)).toBe(true);

    if (promax.data.rotationApplied) {
      expect(promax.data.rotationIsOblique).toBe(true);
      const phi = promax.data.factorCorrelation;
      expect(Array.isArray(phi)).toBe(true);
      expect(phi?.length).toBe(promax.data.nFactors);
      // 공통성은 추출 해의 값이어야 한다. factor_analyzer 의
      // get_communalities() 는 사교에서 패턴 제곱합을 돌려주므로 더 작다.
      for (const variable of variables) {
        expect(promax.data.communalities[variable], `EFA communality of ${variable}`)
          .toBeCloseTo(varimax.data.communalities[variable], 6);
        expect(promax.data.uniquenesses[variable]).toBeCloseTo(1 - promax.data.communalities[variable], 10);
      }
    } else {
      // 한 요인만 뽑힌 데이터라면 회전할 축이 없다. 그래도 실패하지는 않는다.
      expect(promax.data.nFactors).toBe(1);
      expect(promax.data.factorCorrelation ?? null).toBeNull();
    }

    // rotation: 'none' 은 FactorAnalyzer 가 문자열로 받지 못한다. 걸러져야 한다.
    const unrotated = await stats.efa({ data, variables, rotation: 'none' });
    expect(unrotated.success, JSON.stringify(unrotated.error)).toBe(true);
    expect(unrotated.data.rotationApplied).toBe(false);
  });

  it('extracts factors by principal axis factoring, not components', async () => {
    // factor_analyzer 의 'principal' 은 이름과 달리 주성분분석이다 — 공통성을
    // 추정하지 않고 특이값 분해로 성분을 뽑는다. 그래서 'paf' 를 직접 구현했고,
    // 여기서 **그것이 여전히 공통요인법인지**를 고정한다.
    //
    // 설문 픽스처를 쓰지 않는다. 그 데이터는 고유값이 전부 1 부근이라 요인
    // 구조가 없고, 그런 자료에서는 어떤 추출법도 의미 있는 답을 내지 못한다
    // (minres 는 공통성이 0.995 까지 치솟는 헤이우드 케이스가 난다). 요인이
    // **있는** 자료라야 「요인을 제대로 뽑는가」를 물을 수 있다.
    const rng = (seed: number) => () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const next = rng(20261020);
    const normal = () => {
      // Box–Muller. 균등난수 둘로 정규난수 하나.
      const u = Math.max(next(), 1e-9);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    };
    const structured: Record<string, number>[] = [];
    for (let i = 0; i < 400; i += 1) {
      const factorA = normal();
      const factorB = normal();
      const row: Record<string, number> = {};
      for (let j = 0; j < 4; j += 1) row[`a${j}`] = 0.75 * factorA + 0.66 * normal();
      for (let j = 0; j < 4; j += 1) row[`b${j}`] = 0.75 * factorB + 0.66 * normal();
      structured.push(row);
    }
    const variables = ['a0', 'a1', 'a2', 'a3', 'b0', 'b1', 'b2', 'b3'];

    const paf = await stats.efa({
      data: structured,
      variables,
      method: 'paf',
      nFactors: 2,
      rotation: 'varimax',
    });
    expect(paf.success, JSON.stringify(paf.error)).toBe(true);

    const pca = await stats.efa({
      data: structured,
      variables,
      method: 'principal',
      nFactors: 2,
      rotation: 'varimax',
    });
    expect(pca.success, JSON.stringify(pca.error)).toBe(true);

    for (const variable of variables) {
      const communality = paf.data.communalities[variable];
      expectNonZeroFiniteNumber(communality, `paf.communalities.${variable}`);
      // 공통요인법의 공통성은 1 을 넘지 못한다. 넘으면 헤이우드 케이스를
      // 그대로 내보낸 것이다.
      expect(communality).toBeLessThanOrEqual(1);
      expect(paf.data.uniquenesses[variable]).toBeCloseTo(1 - communality, 10);
      // 요인이 실제로 있는 자료다. 공통성이 0 에 붙어 있으면 못 뽑은 것이다.
      expect(communality).toBeGreaterThan(0.2);

      // 🔴 성분은 공통분산만 설명하지 않으므로 공통성이 늘 더 크다. 두 수가
      // 같아졌다면 'paf' 가 실제로는 주성분을 돌린 것이다.
      expect(communality, `paf vs pca communality of ${variable}`)
        .toBeLessThan(pca.data.communalities[variable]);
    }

    // 넣은 구조를 되찾는지 — a 묶음과 b 묶음이 서로 다른 요인에 실려야 한다.
    const dominant = (variable: string) => {
      const row = paf.data.loadings[variable];
      return Math.abs(row[0]) >= Math.abs(row[1]) ? 0 : 1;
    };
    const groupA = new Set(['a0', 'a1', 'a2', 'a3'].map(dominant));
    const groupB = new Set(['b0', 'b1', 'b2', 'b3'].map(dominant));
    expect(groupA.size, 'a 묶음이 한 요인에 모여야 한다').toBe(1);
    expect(groupB.size, 'b 묶음이 한 요인에 모여야 한다').toBe(1);
    expect([...groupA][0]).not.toBe([...groupB][0]);

    // 🔴 믿어도 되는 해인지를 결과가 스스로 말해야 한다. 수렴하지 못한 PAF 해는
    // 재현되지 않고, 헤이우드가 난 항목은 요인 수가 과하다는 신호다. 조용히
    // 넘기면 그 숫자가 그대로 논문에 적힌다.
    expect(paf.data.converged, 'PAF 수렴 여부가 결과에 실려야 한다').toBe(true);

    // 🔴 화면이 표를 그리려면 **비율**이 필요하다. `variance` 는 제곱적재합이라
    // 1 을 넘고, 그걸 비율로 읽으면 「320%」가 찍힌다. 둘이 섞이지 않는지 본다.
    const ratios = paf.data.explainedVarianceRatio ?? [];
    expect(ratios.length).toBe(paf.data.nFactors);
    for (const ratio of ratios) {
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1);
    }
    expect(ratios.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(1);
    // 제곱적재합은 비율이 아니므로 같은 수일 리가 없다.
    expect(paf.data.variance[0]).toBeGreaterThan(ratios[0]);

    // 🔴 화면이 읽는 이름으로 나와야 한다. 주성분분석 쪽과 이름이 어긋나
    // 요인분석만 누적 열이 통째로 비어 있던 자리다.
    const cumulative = paf.data.cumulativeVarianceRatio ?? [];
    expect(cumulative.length).toBe(paf.data.nFactors);
    expect(cumulative[cumulative.length - 1]).toBeCloseTo(
      ratios.reduce((sum, value) => sum + value, 0),
      6,
    );
    expect(paf.data.variables).toEqual(variables);
    expect(typeof paf.data.iterations).toBe('number');
    expect(paf.data.heywoodItems).toEqual([]);
    // 다른 추출법은 이 자리에서 반복하지 않으므로 「해당 없음」이어야 한다.
    expect(pca.data.converged ?? null).toBeNull();
    expect(pca.data.heywoodItems ?? null).toBeNull();
  });

  it('honours the requested number of factors instead of Kaiser', async () => {
    // 요청한 요인 수가 조용히 무시되고 있었다(#고유값 기준으로 덮어썼다).
    // 카이저는 기본값이지 판정이 아니다 — 과대추출로 알려져 있고, 스크리나
    // 이론으로 요인 수를 정하는 것이 보통의 연구 절차다.
    const variables = [
      'music_satisfaction',
      'movie_satisfaction',
      'art_satisfaction',
      'weekly_hours_music',
      'weekly_hours_movie',
      'monthly_art_visits',
    ];

    const auto = await stats.efa({ data, variables, rotation: 'none' });
    expect(auto.success, JSON.stringify(auto.error)).toBe(true);

    const asked = await stats.efa({ data, variables, nFactors: 2, rotation: 'none' });
    expect(asked.success, JSON.stringify(asked.error)).toBe(true);
    expect(asked.data.nFactors).toBe(2);
    expect(Object.values(asked.data.loadings)[0]).toHaveLength(2);

    // 변수 수를 넘겨 달라고 해도 뽑을 수 있는 만큼만 나온다.
    const tooMany = await stats.efa({
      data,
      variables,
      nFactors: variables.length + 5,
      rotation: 'none',
    });
    expect(tooMany.success, JSON.stringify(tooMany.error)).toBe(true);
    expect(tooMany.data.nFactors).toBe(variables.length);
  });

  it('reports progress while an analysis runs, not only while Pyodide loads', async () => {
    // init 구간에는 진행 이벤트가 있었고 실행 구간에는 없었다(#10). 실제 워커로 확인한다.
    expect(progressEvents.some((e) => e.stage === 'init')).toBe(true);

    progressEvents.length = 0;
    await stats.descriptives({ data, variables: ['music_satisfaction'] });

    const analysis = progressEvents.filter((e) => e.stage === 'analysis');
    expect(analysis.length, 'an analysis emits progress of its own').toBeGreaterThanOrEqual(2);
    expect(analysis[0].progress).toBe(0);
    expect(analysis[analysis.length - 1].progress).toBe(100);
    // 사람이 읽을 문구가 실려야 호스트가 그대로 띄울 수 있다.
    expect(analysis[0].message).toMatch(/run_descriptives/);
  });
});
