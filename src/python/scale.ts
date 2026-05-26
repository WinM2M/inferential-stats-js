/**
 * Python code for scale/reliability functions.
 */

export const CRONBACH_ALPHA_PY = `
import json
import pandas as pd
import numpy as np

def run_cronbach_alpha(data_json, items_json):
    df = pd.DataFrame(json.loads(data_json))
    items = json.loads(items_json)

    # Coerce to numeric to compute row-wise validity
    numeric = df[items].apply(pd.to_numeric, errors='coerce')

    n_total = int(len(numeric))
    valid_mask = numeric.notna().all(axis=1)
    X = numeric[valid_mask]
    n_valid = int(len(X))
    n_excluded = int(n_total - n_valid)

    n_items = len(items)
    n_obs = n_valid

    # Compute Cronbach's Alpha
    item_vars = X.var(ddof=1)
    total_score = X.sum(axis=1)
    total_var = total_score.var(ddof=1)
    alpha = (n_items / (n_items - 1)) * (1 - item_vars.sum() / total_var)

    # Standardized alpha (using correlation matrix)
    corr_matrix = X.corr()
    mean_r = (corr_matrix.sum().sum() - n_items) / (n_items * (n_items - 1))
    std_alpha = (n_items * mean_r) / (1 + (n_items - 1) * mean_r)

    scale_mean = float(total_score.mean())
    scale_std = float(total_score.std(ddof=1))
    scale_min = float(total_score.min())
    scale_max = float(total_score.max())

    # Item analysis (Item-Total Statistics)
    item_analysis = []

    for item in items:
        item_col = X[item]
        other_items = [i for i in items if i != item]
        other_sum = X[other_items].sum(axis=1)

        # Corrected item-total correlation
        citc = float(item_col.corr(other_sum))

        # Scale mean / std if this item is deleted (i.e. sum of the remaining items)
        scale_mean_if_deleted = float(other_sum.mean())
        scale_std_if_deleted = float(other_sum.std(ddof=1))

        # Alpha if item deleted
        if len(other_items) > 1:
            sub_X = X[other_items]
            sub_vars = sub_X.var(ddof=1)
            sub_total_var = sub_X.sum(axis=1).var(ddof=1)
            k = len(other_items)
            alpha_deleted = (k / (k - 1)) * (1 - sub_vars.sum() / sub_total_var)
        else:
            alpha_deleted = 0.0

        item_analysis.append({
            'item': item,
            'itemMean': round(float(item_col.mean()), 6),
            'itemStd': round(float(item_col.std(ddof=1)), 6),
            'scaleMeanIfItemDeleted': round(scale_mean_if_deleted, 6),
            'scaleStdIfItemDeleted': round(scale_std_if_deleted, 6),
            'correctedItemTotalCorrelation': round(citc, 6),
            'alphaIfItemDeleted': round(float(alpha_deleted), 6)
        })

    return json.dumps({
        'alpha': round(float(alpha), 6),
        'standardizedAlpha': round(float(std_alpha), 6),
        'nItems': n_items,
        'nObservations': n_obs,
        'itemAnalysis': item_analysis,
        'interItemCorrelationMean': round(float(mean_r), 6),
        'caseProcessing': {
            'valid': n_valid,
            'excluded': n_excluded,
            'total': n_total
        },
        'scaleStatistics': {
            'nItems': n_items,
            'mean': round(scale_mean, 6),
            'std': round(scale_std, 6),
            'minimum': round(scale_min, 6),
            'maximum': round(scale_max, 6)
        }
    })
`;
