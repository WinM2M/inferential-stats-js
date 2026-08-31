/**
 * JavaScript 값을 파이썬 리터럴로 적는다.
 *
 * 워커에서 떼어 둔 이유는 둘이다. `stats-worker.ts` 는 최상위에서 `self.onmessage` 를
 * 걸기 때문에 Node 에서 임포트할 수 없어 테스트가 안 되고, 이 규칙은 워커의 관심사가
 * 아니라 그 자체로 하나의 규칙이다.
 */

/**
 * 파이썬 함수 인자로 넘길 수 있는 값.
 *
 * 예전에는 호출부가 `String(v)` 로 눌러 보낸 것을 정규식으로 되살렸다. 그 왕복이 값의
 * 타입을 잃는다 — 문자열 "1" 이 파이썬 정수 1 로 도착해, 문자열 코드가 담긴 열과
 * 영원히 매칭되지 않았다. 설문 내보내기가 집단 코드를 문자열로 담는 일은 흔하다. (#8)
 */
export type PythonArg = string | number | boolean | null;

/**
 * 값 하나를 파이썬 리터럴로 적는다.
 *
 * 숫자는 숫자로, 불리언은 True/False, 그 밖은 따옴표 친 문자열이다. **문자열이 숫자처럼
 * 생겼는지는 보지 않는다** — 문자열로 준 것은 문자열로 도착해야 한다.
 */
export function encodePythonArg(value: PythonArg): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`Cannot pass a non-finite number to Python: ${value}`);
    }
    return String(value);
  }
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
  return `'${escaped}'`;
}
