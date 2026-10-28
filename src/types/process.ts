/**
 * 조건부 과정 분석 — 매개(mediation) · 조절(moderation) · 조절된 매개.
 *
 * 계산은 `PyProcessMacro`(MIT, Quentin André)가 한다. Andrew F. Hayes 의 PROCESS
 * 매크로와 **같은 모형**을 푸는 독립 구현이고, 원본 코드를 참조하지 않았다. 원본
 * PROCESS 자체는 상업적 이용과 공개 서버 게시를 금지하므로 여기 들어올 수 없다.
 *
 * 모형 번호는 Hayes 의 번호 체계를 그대로 쓴다. 논문에 "Model 4" 라고 적어야 하는
 * 사람이 쓰는 도구이므로, 우리가 번호를 새로 매기면 그 쓸모가 사라진다.
 */

/**
 * 1차로 지원하는 모형.
 *
 * PROCESS 5 에는 42개, PyProcessMacro 에는 76개가 있다. 여기 9개만 내놓는 것은
 * 계산이 안 돼서가 아니라 **역할 매핑과 결과표를 전부 검증한 범위**가 여기까지이기
 * 때문이다. 넓힐 때는 `PROCESS_MODEL_ROLES` 와 그 테스트를 함께 넓힌다.
 */
export type ProcessModelNumber = 1 | 2 | 3 | 4 | 6 | 7 | 14 | 58 | 59;

export interface ProcessInput {
  data: Record<string, unknown>[];
  model: ProcessModelNumber;
  /** X — 독립변수. */
  predictor: string;
  /** Y — 종속변수. */
  outcome: string;
  /**
   * M — 매개변수. 매개 모형(4·6·7·14·58·59)에서만 쓴다.
   *
   * 모형 4 는 **병렬**(X 가 각 M 을 거쳐 따로 Y 로 간다), 모형 6 은 **순차**
   * (X → M₁ → M₂ → Y)다. 같은 목록이 모형 번호에 따라 전혀 다른 그림이 된다.
   */
  mediators?: string[];
  /**
   * 조절변수.
   *
   * 조절 전용 모형(1·2·3)에서는 X 와 곱해지는 변수, 매개 모형에서는 경로를
   * 조절하는 변수다. 어느 경로를 조절하는지는 모형 번호가 정한다 — 7 은 a경로,
   * 14 는 b경로, 58 은 a·b, 59 는 a·b·c'.
   */
  moderator?: string;
  /** 두 번째 조절변수. 모형 2(각각 조절)와 3(3원 상호작용)에서만 쓴다. */
  moderator2?: string;
  /** 통제변수. 모든 회귀식에 함께 들어간다. */
  covariates?: string[];
  /** 부트스트랩 표본 수. 기본 5000. */
  bootstrapSamples?: number;
  /** 신뢰수준(%). 기본 95. */
  confidenceLevel?: number;
  /** 부트스트랩 난수 시드. 주면 같은 구간이 재현된다. */
  seed?: number;
}

/** 경로 회귀식의 계수 한 줄. `term` 은 `Cons`·`x`·`x*w` 처럼 온다. */
export interface ProcessPathCoefficient {
  term: string;
  coefficient: number;
  stdError: number;
  tStatistic: number | null;
  pValue: number | null;
  confidenceInterval: [number, number];
}

/** 경로 회귀식 하나 — PROCESS 출력의 OUTCOME MODEL 한 블록. */
export interface ProcessOutcomeModel {
  /** 이 식의 종속변수. 매개 모형이면 M 과 Y 두 개 이상이 나온다. */
  outcome: string;
  rSquared: number;
  adjustedRSquared: number;
  fStatistic: number | null;
  pValue: number | null;
  observations: number;
  coefficients: ProcessPathCoefficient[];
}

/**
 * 효과 한 줄.
 *
 * `moderatorLevels` 는 그 효과가 **어느 조절변수 수준에서의 값인지**를 담는다.
 * 조절이 없는 모형에서는 빈 객체이고, 있으면 기본적으로 평균과 ±1 표준편차
 * 세 수준이 들어온다(PROCESS 기본값).
 */
export interface ProcessEffect {
  moderatorLevels: Record<string, number>;
  effect: number;
  stdError: number;
  /**
   * 부트스트랩으로 구한 효과에는 **없다**(null).
   *
   * 간접효과의 표집분포는 정규가 아니라서 t·p 를 쓰지 않는 것이 이 방법의 요지다.
   * 판정은 신뢰구간이 0 을 품는지로 한다. 화면에서 빈 칸으로 두지 말고 열을 빼야
   * 한다 — 빈 칸은 "계산 실패"로 읽힌다.
   */
  tStatistic: number | null;
  pValue: number | null;
  confidenceInterval: [number, number];
  /** `ols` 또는 `bootstrap_bc`(편향보정 부트스트랩). */
  method: string;
}

/** 간접효과. `via` 가 어느 매개 경로인지 말한다. */
export interface ProcessIndirectEffect extends ProcessEffect {
  via: string;
}

/**
 * 조절된 매개 지수 — 조절변수가 한 단위 오를 때 간접효과가 얼마나 움직이는가.
 *
 * 모형 7·14·58 에서 나온다. 이 구간이 0 을 품지 않아야 "매개가 조절된다"고 말할
 * 수 있다. 수준별 간접효과가 각각 유의한지를 보고 판정하는 것은 흔한 오독이다.
 */
export interface ProcessModeratedMediationIndex {
  via: string;
  moderator: string;
  index: number;
  stdError: number;
  confidenceInterval: [number, number];
}

export interface ProcessOutput {
  model: ProcessModelNumber;
  observations: number;
  bootstrapSamples: number;
  confidenceLevel: number;
  /** 부트스트랩 구간의 종류. 현재는 편향보정(`bootstrap_bc`) 고정. */
  bootstrapMethod: string;
  /** 수렴하지 않아 버린 부트스트랩 표본 수. 0 이 아니면 결과를 의심해야 한다. */
  discardedBootstrapSamples: number;
  outcomeModels: ProcessOutcomeModel[];
  directEffects: ProcessEffect[];
  indirectEffects: ProcessIndirectEffect[];
  moderatedMediationIndices: ProcessModeratedMediationIndex[];
  /**
   * 화면의 역할이 계산기의 어느 인자로 갔는가.
   *
   * 모형마다 인자 이름이 다르다 — 모형 1~3 에서 **조절변수는 `m`** 이고,
   * 모형 14 의 b경로 조절변수는 `v` 다. 조용히 어긋나기 가장 쉬운 자리라
   * 결과에 실어 보내 눈으로도 검증할 수 있게 한다.
   */
  roleMapping: Record<string, string | string[]>;
}
