/**
 * Python code for regression analysis functions.
 */

export const LINEAR_REGRESSION_PY = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

def run_linear_regression(data_json, dependent, independents_json, add_constant=True):
    df = pd.DataFrame(json.loads(data_json))
    independents = json.loads(independents_json)
    
    y = pd.to_numeric(df[dependent], errors='coerce')
    X = df[independents].apply(pd.to_numeric, errors='coerce')
    
    mask = y.notna() & X.notna().all(axis=1)
    y = y[mask]
    X = X[mask]
    
    if add_constant:
        X = sm.add_constant(X)
    
    model = sm.OLS(y, X).fit()
    
    coefficients = []
    for i, name in enumerate(model.params.index):
        ci = model.conf_int().iloc[i]
        coefficients.append({
            'variable': str(name),
            'coefficient': round(float(model.params.iloc[i]), 6),
            'stdError': round(float(model.bse.iloc[i]), 6),
            'tStatistic': round(float(model.tvalues.iloc[i]), 6),
            'pValue': float(model.pvalues.iloc[i]),
            'confidenceInterval': [round(float(ci[0]), 6), round(float(ci[1]), 6)]
        })
    
    dw = float(sm.stats.stattools.durbin_watson(model.resid))
    
    return json.dumps({
        'rSquared': round(float(model.rsquared), 6),
        'adjustedRSquared': round(float(model.rsquared_adj), 6),
        'fStatistic': round(float(model.fvalue), 6),
        'fPValue': float(model.f_pvalue),
        'coefficients': coefficients,
        'residualStdError': round(float(np.sqrt(model.mse_resid)), 6),
        'observations': int(model.nobs),
        'degreesOfFreedom': int(model.df_resid),
        'durbin_watson': round(dw, 6)
    })
`;

export const LOGISTIC_BINARY_PY = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

def run_logistic_binary(data_json, dependent, independents_json, add_constant=True):
    df = pd.DataFrame(json.loads(data_json))
    independents = json.loads(independents_json)
    
    y = pd.to_numeric(df[dependent], errors='coerce')
    X = df[independents].apply(pd.to_numeric, errors='coerce')
    
    mask = y.notna() & X.notna().all(axis=1)
    y = y[mask]
    X = X[mask]
    
    if add_constant:
        X = sm.add_constant(X)
    
    model = sm.Logit(y, X).fit(disp=0)
    
    coefficients = []
    ci = model.conf_int()
    for i, name in enumerate(model.params.index):
        coef = float(model.params.iloc[i])
        coefficients.append({
            'variable': str(name),
            'coefficient': round(coef, 6),
            'stdError': round(float(model.bse.iloc[i]), 6),
            'zStatistic': round(float(model.tvalues.iloc[i]), 6),
            'pValue': float(model.pvalues.iloc[i]),
            'oddsRatio': round(float(np.exp(coef)), 6),
            'confidenceInterval': [round(float(ci.iloc[i, 0]), 6), round(float(ci.iloc[i, 1]), 6)]
        })
    
    return json.dumps({
        'coefficients': coefficients,
        'pseudoRSquared': round(float(model.prsquared), 6),
        'logLikelihood': round(float(model.llf), 6),
        'llrPValue': float(model.llr_pvalue),
        'aic': round(float(model.aic), 6),
        'bic': round(float(model.bic), 6),
        'observations': int(model.nobs),
        'convergence': bool(model.mle_retvals['converged'])
    })
`;

export const LOGISTIC_MULTINOMIAL_PY = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

def run_logistic_multinomial(data_json, dependent, independents_json, reference_category=None):
    df = pd.DataFrame(json.loads(data_json))
    independents = json.loads(independents_json)
    
    X = df[independents].apply(pd.to_numeric, errors='coerce')
    y = df[dependent]
    
    mask = X.notna().all(axis=1) & y.notna()
    X = X[mask]
    y = y[mask]
    
    # Encode categories
    categories = sorted(y.unique().tolist(), key=str)
    if reference_category is not None:
        ref = str(reference_category)
    else:
        ref = str(categories[0])
    
    y_coded = pd.Categorical(y, categories=categories)
    y_dummies = pd.get_dummies(y_coded, drop_first=False)
    
    X_const = sm.add_constant(X)
    
    from sklearn.linear_model import LogisticRegression
    
    le_map = {str(c): i for i, c in enumerate(categories)}
    y_numeric = y.map(lambda x: le_map[str(x)])
    
    model = LogisticRegression(multi_class='multinomial', solver='lbfgs', max_iter=1000)
    model.fit(X, y_numeric)
    
    ref_idx = le_map[ref]
    non_ref_cats = [c for c in categories if str(c) != ref]
    
    coefficients = []
    for cat in non_ref_cats:
        cat_idx = le_map[str(cat)]
        for j, var_name in enumerate(independents):
            coef = float(model.coef_[cat_idx][j] - model.coef_[ref_idx][j])
            coefficients.append({
                'category': str(cat),
                'variable': var_name,
                'coefficient': round(coef, 6),
                'stdError': 0.0,
                'zStatistic': 0.0,
                'pValue': 0.0,
                'oddsRatio': round(float(np.exp(coef)), 6),
                'confidenceInterval': [0.0, 0.0]
            })
    
    # Log-likelihood
    proba = model.predict_proba(X)
    ll = float(np.sum(np.log(proba[np.arange(len(y_numeric)), y_numeric] + 1e-10)))
    n_params = len(non_ref_cats) * (len(independents) + 1)
    aic = -2 * ll + 2 * n_params
    bic_val = -2 * ll + n_params * np.log(len(y))
    
    return json.dumps({
        'coefficients': coefficients,
        'pseudoRSquared': round(float(model.score(X, y_numeric)), 6),
        'logLikelihood': round(ll, 6),
        'llrPValue': 0.0,
        'aic': round(float(aic), 6),
        'bic': round(float(bic_val), 6),
        'categories': [str(c) for c in categories],
        'referenceCategory': ref,
        'observations': int(len(y))
    })
`;
