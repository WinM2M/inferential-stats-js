/**
 * Python code for descriptive statistics functions.
 * These are executed inside Pyodide in the Web Worker.
 */

export const FREQUENCIES_PY = `
import json
import math
import pandas as pd

def _frequency_table(series):
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
    return total, freqs


def run_frequencies(data_json, variable, variables_json=None):
    """Frequency tables for one variable or for several.

    SPSS's Frequencies takes a variable list and prints one table each, which is
    what people actually do with it -- reading a questionnaire item by item. The
    single-variable keys stay on the output so older callers keep working.
    """
    df = pd.DataFrame(json.loads(data_json))

    names = []
    if variables_json:
        parsed = json.loads(variables_json)
        if isinstance(parsed, list):
            names = [str(name) for name in parsed if name]
    if not names and variable:
        names = [str(variable)]

    tables = []
    for name in names:
        total, freqs = _frequency_table(df[name])
        tables.append({
            'variable': name,
            'totalCount': total,
            'frequencies': freqs
        })

    first = tables[0] if tables else {'variable': variable, 'totalCount': 0, 'frequencies': []}
    return json.dumps({
        'variable': first['variable'],
        'totalCount': first['totalCount'],
        'frequencies': first['frequencies'],
        'tables': tables
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

def _crosstab_one(df, row_variable, col_variable):
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

    return {
        'rowVariable': row_variable,
        'colVariable': col_variable,
        'table': table,
        'rowLabels': row_labels,
        'colLabels': col_labels,
        'chiSquare': float(chi2),
        'degreesOfFreedom': int(dof),
        'pValue': float(p),
        'cramersV': cramers_v
    }


def run_crosstabs(data_json, row_variable, col_variable, row_variables_json=None):
    """One table, or one table per row variable against the same column.

    A multiple-response question arrives as several binary columns. Crossing
    them one at a time means running the analysis once per column and reading
    the results apart; SPSS takes a row list for the same reason.
    """
    df = pd.DataFrame(json.loads(data_json))

    rows = []
    if row_variables_json:
        parsed = json.loads(row_variables_json)
        if isinstance(parsed, list):
            rows = [str(name) for name in parsed if name]
    if not rows and row_variable:
        rows = [str(row_variable)]

    tables = [_crosstab_one(df, name, col_variable) for name in rows]
    first = dict(tables[0]) if tables else {}
    first['tables'] = tables
    return json.dumps(first)
`;
