/**
 * 화면의 역할이 계산기의 **어느 인자**로 가는가.
 *
 * 여기가 이 기능에서 조용히 틀리기 가장 쉬운 자리다. `pyprocessmacro` 는 PROCESS
 * 원본의 작명을 따라 인자 이름을 모형마다 달리 받는다.
 *
 *   - 조절 전용 모형(1·2·3)에서 **조절변수는 `m`** 이다. 매개변수가 아니다.
 *   - 모형 14 의 b경로 조절변수는 `w` 가 아니라 **`v`** 다.
 *
 * 잘못 넘기면 예외가 나는 대신 **다른 모형이 조용히 계산된다** — 숫자는 나오고,
 * 논문에는 틀린 모형 번호가 실린다. 그래서 표를 테스트로 못 박는다.
 *
 * 아래 기대값은 2026-10-28 에 `pyprocessmacro` 2.2.0 을 직접 돌려 확인한 것이다.
 * 9개 모형 전부가 이 조합에서만 실행에 성공했다.
 */
import { describe, it, expect } from 'vitest';
import { PROCESS_PY, PROCESS_ROLE_MAP_PY } from '../src/python/process';

/** 모형 번호 -> (역할 -> 인자 이름). 실측으로 확정한 표. */
const EXPECTED: Record<number, Record<string, string>> = {
  1: { moderator: 'm' },
  2: { moderator: 'm', moderator2: 'w' },
  3: { moderator: 'm', moderator2: 'w' },
  4: { mediators: 'm' },
  6: { mediators: 'm' },
  7: { mediators: 'm', moderator: 'w' },
  14: { mediators: 'm', moderator: 'v' },
  58: { mediators: 'm', moderator: 'w' },
  59: { mediators: 'm', moderator: 'w' },
};

/** Python 리터럴에서 표를 되읽는다. 소스가 곧 기대값이 되지 않도록 따로 판다. */
function parseRoleMap(source: string): Record<number, Record<string, string>> {
  const body = source.slice(
    source.indexOf('_PROCESS_ROLE_MAP = {'),
    source.indexOf('_PROCESS_MODERATION_ONLY'),
  );
  const out: Record<number, Record<string, string>> = {};
  const rowPattern = /(\d+)\s*:\s*\{([^}]*)\}/g;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(body)) !== null) {
    const entries: Record<string, string> = {};
    const pairPattern = /'([a-zA-Z0-9_]+)'\s*:\s*'([a-zA-Z0-9_]+)'/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairPattern.exec(row[2])) !== null) {
      entries[pair[1]] = pair[2];
    }
    out[Number(row[1])] = entries;
  }
  return out;
}

describe('조건부 과정 분석 — 역할 매핑', () => {
  const actual = parseRoleMap(PROCESS_ROLE_MAP_PY);

  it('9개 모형을 모두 담는다', () => {
    expect(Object.keys(actual).map(Number).sort((a, b) => a - b)).toEqual([
      1, 2, 3, 4, 6, 7, 14, 58, 59,
    ]);
  });

  it.each(Object.keys(EXPECTED).map(Number))('모형 %i 의 인자 이름', (model) => {
    expect(actual[model]).toEqual(EXPECTED[model]);
  });

  it('조절 전용 모형에서 조절변수는 m 으로 간다 — 매개변수가 아니다', () => {
    for (const model of [1, 2, 3]) {
      expect(actual[model].moderator).toBe('m');
      expect(actual[model].mediators).toBeUndefined();
    }
  });

  it('모형 14 만 b경로 조절변수를 v 로 받는다', () => {
    expect(actual[14].moderator).toBe('v');
    for (const model of [7, 58, 59]) {
      expect(actual[model].moderator).toBe('w');
    }
  });
});

describe('조건부 과정 분석 — Python 페이로드', () => {
  it('표를 본문에 끼워 넣는다', () => {
    expect(PROCESS_PY).toContain('_PROCESS_ROLE_MAP = {');
    expect(PROCESS_PY).toContain('def run_process(');
  });

  it('그림용 모듈을 import 전에 막아 둔다', () => {
    const stub = PROCESS_PY.indexOf("sys.modules[_name] = types.ModuleType(_name)");
    const imp = PROCESS_PY.indexOf('from pyprocessmacro import Process');
    expect(stub).toBeGreaterThan(-1);
    expect(imp).toBeGreaterThan(stub);
  });

  it('조절 전용 모형은 매개변수를 요구하지 않는다', () => {
    expect(PROCESS_PY).toContain('_PROCESS_MODERATION_ONLY = {1, 2, 3}');
  });
});
