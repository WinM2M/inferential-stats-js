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
    
    X = df[items].apply(pd.to_numeric, errors='coerce').dropna()
    
    n_items = len(items)
    n_obs = len(X)
    
    # Compute Cronbach's Alpha
    item_vars = X.var(ddof=1)
    total_var = X.sum(axis=1).var(ddof=1)
    alpha = (n_items / (n_items - 1)) * (1 - item_vars.sum() / total_var)
    
    # Standardized alpha (using correlation matrix)
    corr_matrix = X.corr()
    mean_r = (corr_matrix.sum().sum() - n_items) / (n_items * (n_items - 1))
    std_alpha = (n_items * mean_r) / (1 + (n_items - 1) * mean_r)
    
    # Item analysis
    item_analysis = []
    total_score = X.sum(axis=1)
    
    for item in items:
        item_col = X[item]
        other_items = [i for i in items if i != item]
        other_sum = X[other_items].sum(axis=1)
        
        # Corrected item-total correlation
        citc = float(item_col.corr(other_sum))
        
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
            'correctedItemTotalCorrelation': round(citc, 6),
            'alphaIfItemDeleted': round(float(alpha_deleted), 6)
        })
    
    return json.dumps({
        'alpha': round(float(alpha), 6),
        'standardizedAlpha': round(float(std_alpha), 6),
        'nItems': n_items,
        'nObservations': n_obs,
        'itemAnalysis': item_analysis,
        'interItemCorrelationMean': round(float(mean_r), 6)
    })
`;
