/**
 * Tests for how a JavaScript value becomes a Python literal.
 *
 * The worker used to stringify every argument and then guess the type back with a
 * regular expression:
 *
 *   if (/^[-+]?\d+(\.\d+)?$/.test(a) || a === "True" || ...) return a;
 *   return `'${escaped}'`;
 *
 * That round trip is not faithful. A caller passing the string "1" — which the public
 * type `group1Value: string | number` explicitly allows, and which survey exports
 * routinely produce — had it arrive in Python as the integer 1, so it never matched a
 * column holding the string "1". The group came out empty and the analysis returned a
 * table of NaN with no error. See issue #8.
 *
 * These tests pin the rule that replaced it: decide by type, never by appearance.
 */

import { encodePythonArg } from '../src/worker/python-arg';

describe('encodePythonArg', () => {
  it('keeps a number a number', () => {
    expect(encodePythonArg(1)).toBe('1');
    expect(encodePythonArg(-2.5)).toBe('-2.5');
    expect(encodePythonArg(0)).toBe('0');
  });

  it('keeps a digit-like string a string', () => {
    // 이것이 #8 이다. 예전에는 둘 다 파이썬 숫자가 되어, 문자열 코드가 담긴 열과
    // 영원히 매칭되지 않았다.
    expect(encodePythonArg('1')).toBe("'1'");
    expect(encodePythonArg('1.0')).toBe("'1.0'");
    expect(encodePythonArg('-3')).toBe("'-3'");
  });

  it('does not turn the words True/False/None into Python keywords', () => {
    // 'True' 라는 이름의 집단이 있을 수 있다. 문자열로 준 것은 문자열이다.
    expect(encodePythonArg('True')).toBe("'True'");
    expect(encodePythonArg('None')).toBe("'None'");
    expect(encodePythonArg(true)).toBe('True');
    expect(encodePythonArg(false)).toBe('False');
    expect(encodePythonArg(null)).toBe('None');
  });

  it('escapes what would otherwise break out of the literal', () => {
    expect(encodePythonArg("it's")).toBe("'it\\'s'");
    expect(encodePythonArg('back\\slash')).toBe("'back\\\\slash'");
    expect(encodePythonArg('two\nlines')).toBe("'two\\nlines'");
  });

  it('refuses a non-finite number rather than writing invalid Python', () => {
    // `String(NaN)` 은 'NaN' 이고, 파이썬에서 그건 정의되지 않은 이름이다.
    expect(() => encodePythonArg(NaN)).toThrow();
    expect(() => encodePythonArg(Infinity)).toThrow();
  });
});
