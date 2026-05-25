/**
 * Python code for regression analysis functions.
 */

export const LINEAR_REGRESSION_PY = `
import json
import pandas as pd
import numpy as np
import statsmodels.api as sm

def run_linear_regression(data_json, dependent, independents_json, add_constant=True, method='stepwise'):
    df = pd.DataFrame(json.loads(data_json))
    independents = json.loads(independents_json)
    
    y = pd.to_numeric(df[dependent], errors='coerce')
    X = df[independents].apply(pd.to_numeric, errors='coerce')
    
    mask = y.notna() & X.notna().all(axis=1)
    y = y[mask]
    X = X[mask]
    
    def fit_model(selected_vars):
        X_selected = X[selected_vars].copy() if len(selected_vars) > 0 else pd.DataFrame(index=X.index)
        if add_constant:
            X_selected = sm.add_constant(X_selected, has_constant='add')
        return sm.OLS(y, X_selected).fit()

    selected_vars = list(independents)
    if method == 'forward':
        selected_vars = []
        candidates = list(independents)
        while candidates:
            pvals = []
            for var in candidates:
                try:
                    model_try = fit_model(selected_vars + [var])
                    pvals.append((float(model_try.pvalues.get(var, 1.0)), var))
                except Exception:
                    continue
            if not pvals:
                break
            best_p, best_var = min(pvals, key=lambda x: x[0])
            if best_p < 0.05:
                selected_vars.append(best_var)
                candidates.remove(best_var)
            else:
                break
    elif method == 'backward':
        selected_vars = list(independents)
        while len(selected_vars) > 1:
            model_try = fit_model(selected_vars)
            pvals = model_try.pvalues.drop('const', errors='ignore')
            worst_var = pvals.idxmax()
            worst_p = float(pvals.max())
            if worst_p > 0.1:
                selected_vars.remove(worst_var)
            else:
                break
    elif method == 'stepwise':
        selected_vars = []
        candidates = list(independents)
        changed = True
        while changed:
            changed = False
            # forward step
            pvals = []
            for var in candidates:
                try:
                    model_try = fit_model(selected_vars + [var])
                    pvals.append((float(model_try.pvalues.get(var, 1.0)), var))
                except Exception:
                    continue
            if pvals:
                best_p, best_var = min(pvals, key=lambda x: x[0])
                if best_p < 0.05:
                    selected_vars.append(best_var)
                    candidates.remove(best_var)
                    changed = True

            # backward cleanup
            if selected_vars:
                model_try = fit_model(selected_vars)
                selected_pvals = model_try.pvalues.drop('const', errors='ignore')
                if not selected_pvals.empty:
                    worst_var = selected_pvals.idxmax()
                    worst_p = float(selected_pvals.max())
                    if worst_p > 0.1:
                        selected_vars.remove(worst_var)
                        if worst_var not in candidates:
                            candidates.append(worst_var)
                        changed = True

        if not selected_vars and independents:
            selected_vars = [independents[0]]
    else:
        selected_vars = list(independents)

    model = fit_model(selected_vars)
    
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

    standardized_coefficients = []
    y_std = float(np.std(y, ddof=0))
    for i, name in enumerate(model.params.index):
        if name == 'const':
            standardized_coefficients.append({
                'variable': str(name),
                'coefficient': 0.0,
                'stdError': round(float(model.bse.iloc[i]), 6),
                'tStatistic': round(float(model.tvalues.iloc[i]), 6),
                'pValue': float(model.pvalues.iloc[i]),
                'confidenceInterval': [0.0, 0.0]
            })
            continue
        x_std = float(np.std(X[name], ddof=0))
        beta = 0.0 if y_std == 0 else float(model.params[name]) * x_std / y_std
        ci = model.conf_int().loc[name]
        standardized_coefficients.append({
            'variable': str(name),
            'coefficient': round(beta, 6),
            'stdError': round(float(model.bse[name]), 6),
            'tStatistic': round(float(model.tvalues[name]), 6),
            'pValue': float(model.pvalues[name]),
            'confidenceInterval': [round(float(ci[0]), 6), round(float(ci[1]), 6)]
        })

    multicollinearity = []
    if len(selected_vars) > 0:
        corr = X[selected_vars].corr().values
        for idx, var in enumerate(selected_vars):
            vif = None
            try:
                if len(selected_vars) == 1:
                    vif = 1.0
                else:
                    r2 = float(sm.OLS(X[selected_vars].iloc[:, idx], sm.add_constant(X[selected_vars].drop(columns=[var]), has_constant='add')).fit().rsquared)
                    vif = np.inf if r2 >= 0.999999 else 1.0 / max(1.0 - r2, 1e-12)
            except Exception:
                vif = np.nan
            tolerance = 0.0 if (not np.isfinite(vif) or vif == 0) else 1.0 / float(vif)
            multicollinearity.append({
                'variable': var,
                'tolerance': round(float(tolerance), 6),
                'vif': round(float(vif), 6) if np.isfinite(vif) else None
            })
    
    dw = float(sm.stats.stattools.durbin_watson(model.resid))

    # Model Summary (SPSS-style): R, R², Adjusted R², Std. Error of the Estimate
    r_squared = float(model.rsquared)
    adj_r_squared = float(model.rsquared_adj)
    r_value = float(np.sqrt(max(r_squared, 0.0)))
    std_error_estimate = float(np.sqrt(model.mse_resid))

    # ANOVA table: Regression / Residual / Total
    ss_regression = float(model.ess)
    ss_residual = float(model.ssr)
    ss_total = float(model.centered_tss)
    df_regression = int(model.df_model)
    df_residual = int(model.df_resid)
    df_total = df_regression + df_residual
    ms_regression = ss_regression / df_regression if df_regression > 0 else 0.0
    ms_residual = ss_residual / df_residual if df_residual > 0 else 0.0
    f_value = float(model.fvalue) if np.isfinite(model.fvalue) else 0.0
    f_pvalue = float(model.f_pvalue) if np.isfinite(model.f_pvalue) else 0.0

    anova_rows = [
        {
            'source': 'Regression',
            'sumOfSquares': round(ss_regression, 6),
            'df': df_regression,
            'meanSquare': round(ms_regression, 6),
            'fStatistic': round(f_value, 6),
            'pValue': f_pvalue
        },
        {
            'source': 'Residual',
            'sumOfSquares': round(ss_residual, 6),
            'df': df_residual,
            'meanSquare': round(ms_residual, 6),
            'fStatistic': None,
            'pValue': None
        },
        {
            'source': 'Total',
            'sumOfSquares': round(ss_total, 6),
            'df': df_total,
            'meanSquare': None,
            'fStatistic': None,
            'pValue': None
        }
    ]

    return json.dumps({
        'rSquared': round(r_squared, 6),
        'adjustedRSquared': round(adj_r_squared, 6),
        'modelSummary': {
            'r': round(r_value, 6),
            'rSquared': round(r_squared, 6),
            'adjustedRSquared': round(adj_r_squared, 6),
            'stdErrorOfEstimate': round(std_error_estimate, 6)
        },
        'anova': {
            'dependentVariable': str(dependent),
            'rows': anova_rows
        },
        'fStatistic': round(f_value, 6),
        'fPValue': f_pvalue,
        'coefficients': coefficients,
        'standardizedCoefficients': standardized_coefficients,
        'multicollinearity': multicollinearity,
        'selectedVariables': selected_vars,
        'method': method,
        'residualStdError': round(std_error_estimate, 6),
        'observations': int(model.nobs),
        'degreesOfFreedom': int(model.df_resid),
        'durbinWatson': round(dw, 6)
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
