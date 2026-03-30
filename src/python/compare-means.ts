/**
 * Python code for compare means functions.
 */

export const TTEST_INDEPENDENT_PY = `
import json
import pandas as pd
import numpy as np
from scipy import stats

def run_ttest_independent(data_json, variable, group_variable, group1_value, group2_value):
    df = pd.DataFrame(json.loads(data_json))
    
    g1 = pd.to_numeric(df[df[group_variable] == group1_value][variable], errors='coerce').dropna()
    g2 = pd.to_numeric(df[df[group_variable] == group2_value][variable], errors='coerce').dropna()
    
    # Levene's test for equality of variances
    levene_stat, levene_p = stats.levene(g1, g2)
    equal_var = levene_p > 0.05
    
    # T-test with equal variance
    t_eq, p_eq = stats.ttest_ind(g1, g2, equal_var=True)
    # T-test with unequal variance (Welch's)
    t_uneq, p_uneq = stats.ttest_ind(g1, g2, equal_var=False)
    
    mean_diff = float(g1.mean() - g2.mean())
    
    # Degrees of freedom
    df_eq = len(g1) + len(g2) - 2
    
    # Welch df
    s1_sq = g1.var(ddof=1)
    s2_sq = g2.var(ddof=1)
    n1, n2 = len(g1), len(g2)
    num = (s1_sq/n1 + s2_sq/n2)**2
    denom = (s1_sq/n1)**2/(n1-1) + (s2_sq/n2)**2/(n2-1)
    df_welch = float(num/denom)
    
    # Confidence intervals
    se_eq = float(np.sqrt(((n1-1)*s1_sq + (n2-1)*s2_sq)/(n1+n2-2) * (1/n1 + 1/n2)))
    se_uneq = float(np.sqrt(s1_sq/n1 + s2_sq/n2))
    
    ci_eq = stats.t.interval(0.95, df_eq, loc=mean_diff, scale=se_eq)
    ci_uneq = stats.t.interval(0.95, df_welch, loc=mean_diff, scale=se_uneq)
    
    def make_result(t_stat, df_val, p_val, ci):
        return {
            'tStatistic': round(float(t_stat), 6),
            'degreesOfFreedom': round(float(df_val), 6),
            'pValue': float(p_val),
            'meanDifference': round(mean_diff, 6),
            'confidenceInterval': [round(float(ci[0]), 6), round(float(ci[1]), 6)],
            'group1Mean': round(float(g1.mean()), 6),
            'group1Std': round(float(g1.std(ddof=1)), 6),
            'group1N': n1,
            'group2Mean': round(float(g2.mean()), 6),
            'group2Std': round(float(g2.std(ddof=1)), 6),
            'group2N': n2
        }
    
    return json.dumps({
        'leveneTest': {
            'statistic': round(float(levene_stat), 6),
            'pValue': float(levene_p),
            'equalVariance': bool(equal_var)
        },
        'equalVariance': make_result(t_eq, df_eq, p_eq, ci_eq),
        'unequalVariance': make_result(t_uneq, df_welch, p_uneq, ci_uneq)
    })
`;

export const TTEST_PAIRED_PY = `
import json
import pandas as pd
import numpy as np
from scipy import stats

def run_ttest_paired(data_json, variable1, variable2):
    df = pd.DataFrame(json.loads(data_json))
    
    v1 = pd.to_numeric(df[variable1], errors='coerce').dropna()
    v2 = pd.to_numeric(df[variable2], errors='coerce').dropna()
    
    # Align by index
    common = v1.index.intersection(v2.index)
    v1 = v1.loc[common]
    v2 = v2.loc[common]
    
    diff = v1 - v2
    n = len(diff)
    
    t_stat, p_val = stats.ttest_rel(v1, v2)
    
    mean_diff = float(diff.mean())
    std_diff = float(diff.std(ddof=1))
    se = std_diff / np.sqrt(n)
    ci = stats.t.interval(0.95, n-1, loc=mean_diff, scale=se)
    
    return json.dumps({
        'tStatistic': round(float(t_stat), 6),
        'degreesOfFreedom': n - 1,
        'pValue': float(p_val),
        'meanDifference': round(mean_diff, 6),
        'stdDifference': round(std_diff, 6),
        'confidenceInterval': [round(float(ci[0]), 6), round(float(ci[1]), 6)],
        'mean1': round(float(v1.mean()), 6),
        'mean2': round(float(v2.mean()), 6),
        'n': n
    })
`;

export const ANOVA_ONEWAY_PY = `
import json
import pandas as pd
import numpy as np
from scipy import stats

def run_anova_oneway(data_json, variable, group_variable):
    df = pd.DataFrame(json.loads(data_json))
    
    groups = df.groupby(group_variable)[variable].apply(
        lambda x: pd.to_numeric(x, errors='coerce').dropna().tolist()
    )
    
    group_arrays = [np.array(g) for g in groups.values if len(g) > 0]
    group_names = [str(name) for name, g in zip(groups.index, groups.values) if len(g) > 0]
    
    f_stat, p_val = stats.f_oneway(*group_arrays)
    
    # Compute detailed ANOVA table
    grand_mean = np.concatenate(group_arrays).mean()
    n_total = sum(len(g) for g in group_arrays)
    k = len(group_arrays)
    
    ss_between = sum(len(g) * (g.mean() - grand_mean)**2 for g in group_arrays)
    ss_within = sum(((g - g.mean())**2).sum() for g in group_arrays)
    
    df_between = k - 1
    df_within = n_total - k
    
    ms_between = ss_between / df_between
    ms_within = ss_within / df_within
    
    ss_total = ss_between + ss_within
    eta_sq = ss_between / ss_total if ss_total > 0 else 0
    
    group_stats = []
    for name, arr in zip(group_names, group_arrays):
        group_stats.append({
            'group': name,
            'n': len(arr),
            'mean': round(float(arr.mean()), 6),
            'std': round(float(arr.std(ddof=1)), 6)
        })
    
    return json.dumps({
        'fStatistic': round(float(f_stat), 6),
        'pValue': float(p_val),
        'degreesOfFreedomBetween': df_between,
        'degreesOfFreedomWithin': df_within,
        'sumOfSquaresBetween': round(float(ss_between), 6),
        'sumOfSquaresWithin': round(float(ss_within), 6),
        'meanSquareBetween': round(float(ms_between), 6),
        'meanSquareWithin': round(float(ms_within), 6),
        'groupStats': group_stats,
        'etaSquared': round(float(eta_sq), 6)
    })
`;

export const POSTHOC_TUKEY_PY = `
import json
import pandas as pd
import numpy as np
from statsmodels.stats.multicomp import pairwise_tukeyhsd

def run_posthoc_tukey(data_json, variable, group_variable, alpha=0.05):
    df = pd.DataFrame(json.loads(data_json))
    
    df[variable] = pd.to_numeric(df[variable], errors='coerce')
    df = df.dropna(subset=[variable])
    
    result = pairwise_tukeyhsd(df[variable], df[group_variable], alpha=alpha)
    
    comparisons = []
    for i in range(len(result.summary().data) - 1):
        row = result.summary().data[i + 1]
        comparisons.append({
            'group1': str(row[0]),
            'group2': str(row[1]),
            'meanDifference': round(float(row[2]), 6),
            'pValue': round(float(row[3]), 6),
            'lowerCI': round(float(row[4]), 6),
            'upperCI': round(float(row[5]), 6),
            'reject': bool(row[6])
        })
    
    return json.dumps({
        'comparisons': comparisons,
        'alpha': alpha
    })
`;
