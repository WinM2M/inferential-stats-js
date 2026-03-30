/**
 * Python code for descriptive statistics functions.
 * These are executed inside Pyodide in the Web Worker.
 */

export const FREQUENCIES_PY = `
import json
import pandas as pd

def run_frequencies(data_json, variable):
    df = pd.DataFrame(json.loads(data_json))
    series = df[variable]
    total = len(series)
    
    counts = series.value_counts(dropna=False)
    pcts = series.value_counts(normalize=True, dropna=False) * 100
    
    freqs = []
    cum_pct = 0
    for val in counts.index:
        count = int(counts[val])
        pct = float(pcts[val])
        cum_pct += pct
        freqs.append({
            'value': str(val) if not isinstance(val, (int, float)) else val,
            'count': count,
            'percentage': round(pct, 4),
            'cumulativePercentage': round(cum_pct, 4)
        })
    
    return json.dumps({
        'variable': variable,
        'totalCount': total,
        'frequencies': freqs
    })
`;

export const DESCRIPTIVES_PY = `
import json
import pandas as pd
from scipy import stats as sp_stats

def run_descriptives(data_json, variables_json):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    results = []
    for var in variables:
        col = pd.to_numeric(df[var], errors='coerce').dropna()
        desc = col.describe()
        results.append({
            'variable': var,
            'count': int(desc['count']),
            'mean': round(float(desc['mean']), 6),
            'std': round(float(desc['std']), 6),
            'min': round(float(desc['min']), 6),
            'max': round(float(desc['max']), 6),
            'q25': round(float(desc['25%']), 6),
            'q50': round(float(desc['50%']), 6),
            'q75': round(float(desc['75%']), 6),
            'skewness': round(float(sp_stats.skew(col)), 6),
            'kurtosis': round(float(sp_stats.kurtosis(col)), 6)
        })
    
    return json.dumps({'statistics': results})
`;

export const CROSSTABS_PY = `
import json
import pandas as pd
from scipy.stats import chi2_contingency
import numpy as np

def run_crosstabs(data_json, row_variable, col_variable):
    df = pd.DataFrame(json.loads(data_json))
    
    ct = pd.crosstab(df[row_variable], df[col_variable])
    chi2, p, dof, expected = chi2_contingency(ct)
    
    n = ct.values.sum()
    k = min(ct.shape) - 1
    cramers_v = float(np.sqrt(chi2 / (n * k))) if k > 0 else 0
    
    row_labels = [str(x) for x in ct.index.tolist()]
    col_labels = [str(x) for x in ct.columns.tolist()]
    
    table = []
    row_sums = ct.sum(axis=1)
    col_sums = ct.sum(axis=0)
    total = ct.values.sum()
    
    for i, rl in enumerate(row_labels):
        for j, cl in enumerate(col_labels):
            obs = int(ct.iloc[i, j])
            exp = float(expected[i, j])
            table.append({
                'row': rl,
                'col': cl,
                'observed': obs,
                'expected': round(exp, 4),
                'rowPercentage': round(obs / float(row_sums.iloc[i]) * 100, 4) if row_sums.iloc[i] > 0 else 0,
                'colPercentage': round(obs / float(col_sums.iloc[j]) * 100, 4) if col_sums.iloc[j] > 0 else 0,
                'totalPercentage': round(obs / float(total) * 100, 4) if total > 0 else 0
            })
    
    return json.dumps({
        'rowVariable': row_variable,
        'colVariable': col_variable,
        'table': table,
        'rowLabels': row_labels,
        'colLabels': col_labels,
        'chiSquare': round(float(chi2), 6),
        'degreesOfFreedom': int(dof),
        'pValue': float(p),
        'cramersV': round(cramers_v, 6)
    })
`;
