/**
 * Python code for descriptive statistics functions.
 * These are executed inside Pyodide in the Web Worker.
 */

export const FREQUENCIES_PY = `
import json
import math
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

        # NaN represents missing / empty values
        if isinstance(val, float) and math.isnan(val):
            display_value = None
        elif not isinstance(val, (int, float)):
            display_value = str(val)
        else:
            display_value = val

        freqs.append({
            'value': display_value,
            'count': count,
            'percentage': pct,
            'cumulativePercentage': cum_pct
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
            'mean': float(desc['mean']),
            'std': float(desc['std']),
            'min': float(desc['min']),
            'max': float(desc['max']),
            'q25': float(desc['25%']),
            'q50': float(desc['50%']),
            'q75': float(desc['75%']),
            'skewness': float(sp_stats.skew(col)),
            'kurtosis': float(sp_stats.kurtosis(col))
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
    
    # category_label, not str: an integer-coded category arrives from the bridge
    # as a float and str() would append '.0' (#19).
    row_labels = [category_label(x) for x in ct.index.tolist()]
    col_labels = [category_label(x) for x in ct.columns.tolist()]
    
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
                'expected': exp,
                'rowPercentage': obs / float(row_sums.iloc[i]) * 100 if row_sums.iloc[i] > 0 else 0,
                'colPercentage': obs / float(col_sums.iloc[j]) * 100 if col_sums.iloc[j] > 0 else 0,
                'totalPercentage': obs / float(total) * 100 if total > 0 else 0
            })
    
    return json.dumps({
        'rowVariable': row_variable,
        'colVariable': col_variable,
        'table': table,
        'rowLabels': row_labels,
        'colLabels': col_labels,
        'chiSquare': float(chi2),
        'degreesOfFreedom': int(dof),
        'pValue': float(p),
        'cramersV': cramers_v
    })
`;
