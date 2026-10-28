/**
 * Python code for conditional process analysis (mediation / moderation).
 *
 * 계산은 `pyprocessmacro`(MIT) 가 한다. 워커가 micropip 으로 받아 둔다.
 */

/**
 * 화면의 역할을 `Process(...)` 의 인자 이름으로 바꾸는 표.
 *
 * 🔴 **이 표가 이 파일에서 가장 조용히 틀리기 쉬운 자리다.** 인자 이름이 모형마다
 * 다르다 — 조절 전용 모형(1·2·3)에서 조절변수는 `m` 으로 들어가고(매개변수가
 * 아니다), 모형 14 의 b경로 조절변수는 `w` 가 아니라 `v` 다. PROCESS 원본의 작명을
 * 따른 결과인데, 잘못 넘기면 예외가 나는 대신 **다른 모형이 조용히 계산된다.**
 * 그래서 결과에 `roleMapping` 을 실어 보내고, 테스트로 9개 전부를 못 박는다.
 */
export const PROCESS_ROLE_MAP_PY = `
# 역할 -> 모형별 인자 이름
_PROCESS_ROLE_MAP = {
    1:  {'moderator': 'm'},
    2:  {'moderator': 'm', 'moderator2': 'w'},
    3:  {'moderator': 'm', 'moderator2': 'w'},
    4:  {'mediators': 'm'},
    6:  {'mediators': 'm'},
    7:  {'mediators': 'm', 'moderator': 'w'},
    14: {'mediators': 'm', 'moderator': 'v'},
    58: {'mediators': 'm', 'moderator': 'w'},
    59: {'mediators': 'm', 'moderator': 'w'},
}

# 조절 전용 모형은 매개변수를 받지 않는다. 받으면 라이브러리가 거부한다.
_PROCESS_MODERATION_ONLY = {1, 2, 3}
`;

export const PROCESS_PY = `
import json
import sys
import types

import numpy as np
import pandas as pd

# pyprocessmacro 의 utils 가 그림용 matplotlib·seaborn 을 모듈 로드 시점에 import
# 한다. 우리는 그림을 쓰지 않는데 Pyodide 가 수 MB 를 더 받게 되므로 빈 모듈을 미리
# 꽂아 둔다. 라이브러리의 plot_* 함수를 부르면 깨지지만, 우리는 부르지 않는다.
# (상류에 지연 import PR 이 반영되면 이 블록을 지운다.)
for _name in ('matplotlib', 'matplotlib.pyplot', 'seaborn'):
    if _name not in sys.modules:
        sys.modules[_name] = types.ModuleType(_name)
if not hasattr(sys.modules['seaborn'], 'FacetGrid'):
    sys.modules['seaborn'].FacetGrid = object
if not hasattr(sys.modules['matplotlib'], 'pyplot'):
    sys.modules['matplotlib'].pyplot = sys.modules['matplotlib.pyplot']

from pyprocessmacro import Process

${PROCESS_ROLE_MAP_PY}

# tidy() 가 늘 주는 열. 이것 말고 남는 열은 **조절변수 수준** 열이고, 이름이
# 조절변수의 변수명이라 미리 적어 둘 수 없다.
_PROCESS_FIXED_COLUMNS = {
    'component', 'outcome', 'term', 'moderator', 'estimate', 'std_error',
    'statistic', 'p_value', 'conf_low', 'conf_high', 'method', 'conf_level',
    'n_boot',
}


def _num(value):
    """NaN/Inf 를 None 으로. JSON 에 그대로 실을 수 없는 값들이다."""
    if value is None:
        return None
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if np.isnan(f) or np.isinf(f):
        return None
    return f


def _levels(row, level_columns):
    out = {}
    for col in level_columns:
        v = _num(row.get(col))
        if v is not None:
            out[col] = v
    return out


def _effect(row, level_columns):
    return {
        'moderatorLevels': _levels(row, level_columns),
        'effect': _num(row.get('estimate')),
        'stdError': _num(row.get('std_error')),
        'tStatistic': _num(row.get('statistic')),
        'pValue': _num(row.get('p_value')),
        'confidenceInterval': [_num(row.get('conf_low')), _num(row.get('conf_high'))],
        'method': str(row.get('method')),
    }


def run_process(
    data_json,
    model,
    predictor,
    outcome,
    mediators_json,
    moderator,
    moderator2,
    covariates_json,
    boot,
    conf_level,
    seed,
):
    df = load_dataframe(data_json)
    model = int(model)
    mediators = json.loads(mediators_json) if mediators_json else []
    covariates = json.loads(covariates_json) if covariates_json else []

    if model not in _PROCESS_ROLE_MAP:
        raise ValueError(
            'Model ' + str(model) + ' is not one of the supported models '
            '(1, 2, 3, 4, 6, 7, 14, 58, 59).'
        )

    role_names = _PROCESS_ROLE_MAP[model]

    # 역할 -> 인자 이름. 여기서 어긋나면 다른 모형이 조용히 계산된다.
    kwargs = {'x': predictor, 'y': outcome}
    role_mapping = {'x': predictor, 'y': outcome}

    if model in _PROCESS_MODERATION_ONLY:
        if not moderator:
            raise ValueError(
                'Model ' + str(model) + ' is a moderation model and needs a moderator.'
            )
        kwargs[role_names['moderator']] = moderator
        role_mapping[role_names['moderator']] = moderator
        if 'moderator2' in role_names:
            if not moderator2:
                raise ValueError(
                    'Model ' + str(model) + ' needs a second moderator.'
                )
            kwargs[role_names['moderator2']] = moderator2
            role_mapping[role_names['moderator2']] = moderator2
    else:
        if not mediators:
            raise ValueError(
                'Model ' + str(model) + ' is a mediation model and needs at least '
                'one mediator.'
            )
        kwargs[role_names['mediators']] = list(mediators)
        role_mapping[role_names['mediators']] = list(mediators)
        if 'moderator' in role_names:
            if not moderator:
                raise ValueError(
                    'Model ' + str(model) + ' needs a moderator.'
                )
            kwargs[role_names['moderator']] = moderator
            role_mapping[role_names['moderator']] = moderator

    if covariates:
        kwargs['controls'] = list(covariates)
        role_mapping['controls'] = list(covariates)

    # 쓰는 변수만 남기고 결측 행을 떨군다. 라이브러리는 결측을 알아서 다루지 않는다.
    used = [predictor, outcome]
    used += [v for v in mediators if v]
    used += [v for v in (moderator, moderator2) if v]
    used += [v for v in covariates if v]
    used = list(dict.fromkeys(used))

    frame = df[used].apply(pd.to_numeric, errors='coerce').dropna()
    if len(frame) < 10:
        raise ValueError(
            'Conditional process analysis needs at least 10 complete cases; '
            'got ' + str(len(frame)) + '.'
        )

    boot = int(boot) if boot else 5000
    conf_level = int(conf_level) if conf_level else 95

    if seed is not None:
        kwargs['seed'] = int(seed)

    proc = Process(
        data=frame,
        model=model,
        boot=boot,
        conf=conf_level,
        suppr_init=True,
        **kwargs
    )

    tidy = proc.tidy()
    glance = proc.glance()

    level_columns = [c for c in tidy.columns if c not in _PROCESS_FIXED_COLUMNS]

    # --- 경로 회귀식 ---
    fit_by_outcome = {}
    for _, g in glance.iterrows():
        fit_by_outcome[str(g.get('outcome'))] = g

    outcome_models = []
    coeff_rows = tidy[tidy['component'] == 'outcome']
    for dv in list(dict.fromkeys(coeff_rows['outcome'].tolist())):
        rows = coeff_rows[coeff_rows['outcome'] == dv]
        fit = fit_by_outcome.get(str(dv), {})
        outcome_models.append({
            'outcome': str(dv),
            'rSquared': _num(fit.get('r_squared')),
            'adjustedRSquared': _num(fit.get('adj_r_squared')),
            'fStatistic': _num(fit.get('f_statistic')),
            'pValue': _num(fit.get('p_value')),
            'observations': int(fit.get('n') or len(frame)),
            'coefficients': [
                {
                    'term': str(r.get('term')),
                    'coefficient': _num(r.get('estimate')),
                    'stdError': _num(r.get('std_error')),
                    'tStatistic': _num(r.get('statistic')),
                    'pValue': _num(r.get('p_value')),
                    'confidenceInterval': [
                        _num(r.get('conf_low')), _num(r.get('conf_high'))
                    ],
                }
                for _, r in rows.iterrows()
            ],
        })

    # --- 직접효과 ---
    direct_effects = [
        _effect(r, level_columns)
        for _, r in tidy[tidy['component'] == 'direct'].iterrows()
    ]

    # --- 간접효과 ---
    indirect_effects = []
    for _, r in tidy[tidy['component'] == 'indirect'].iterrows():
        eff = _effect(r, level_columns)
        eff['via'] = str(r.get('term'))
        indirect_effects.append(eff)

    # --- 조절된 매개 지수 ---
    indices = []
    for _, r in tidy[tidy['component'] == 'index_mm'].iterrows():
        indices.append({
            'via': str(r.get('term')),
            'moderator': str(r.get('moderator')),
            'index': _num(r.get('estimate')),
            'stdError': _num(r.get('std_error')),
            'confidenceInterval': [
                _num(r.get('conf_low')), _num(r.get('conf_high'))
            ],
        })

    methods = [m for m in tidy['method'].unique().tolist() if str(m).startswith('bootstrap')]

    return json.dumps({
        'model': model,
        'observations': int(len(frame)),
        'bootstrapSamples': boot,
        'confidenceLevel': conf_level,
        'bootstrapMethod': str(methods[0]) if methods else 'ols',
        'discardedBootstrapSamples': int(getattr(proc, 'n_obs_null', 0) or 0),
        'outcomeModels': outcome_models,
        'directEffects': direct_effects,
        'indirectEffects': indirect_effects,
        'moderatedMediationIndices': indices,
        'roleMapping': role_mapping,
    })
`;
