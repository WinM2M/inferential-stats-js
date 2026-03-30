/**
 * Python code for dimension reduction functions.
 */

export const EFA_PY = `
import json
import pandas as pd
import numpy as np
from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_bartlett_sphericity, calculate_kmo

def run_efa(data_json, variables_json, n_factors, rotation='varimax', method='minres'):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    # KMO and Bartlett tests
    kmo_all, kmo_model = calculate_kmo(X)
    chi2, p_value = calculate_bartlett_sphericity(X)
    
    fa = FactorAnalyzer(n_factors=n_factors, rotation=rotation, method=method)
    fa.fit(X)
    
    loadings = fa.loadings_
    loadings_dict = {}
    for i, var in enumerate(variables):
        loadings_dict[var] = [round(float(x), 6) for x in loadings[i]]
    
    ev, v = fa.get_factor_variance()
    
    communalities = fa.get_communalities()
    uniquenesses = fa.get_uniquenesses()
    
    comm_dict = {}
    uniq_dict = {}
    for i, var in enumerate(variables):
        comm_dict[var] = round(float(communalities[i]), 6)
        uniq_dict[var] = round(float(uniquenesses[i]), 6)
    
    eigenvalues = fa.get_eigenvalues()[0]
    
    return json.dumps({
        'loadings': loadings_dict,
        'eigenvalues': [round(float(x), 6) for x in eigenvalues],
        'variance': [round(float(x), 6) for x in ev],
        'cumulativeVariance': [round(float(sum(v[:i+1])), 6) for i in range(len(v))],
        'communalities': comm_dict,
        'uniquenesses': uniq_dict,
        'nFactors': n_factors,
        'rotation': rotation,
        'kmo': round(float(kmo_model), 6),
        'bartlettChi2': round(float(chi2), 6),
        'bartlettPValue': float(p_value)
    })
`;

export const PCA_PY = `
import json
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

def run_pca(data_json, variables_json, n_components=None, standardize=True):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    if standardize:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = X.values
    
    if n_components is None:
        n_components = min(len(variables), len(X_scaled))
    
    pca = PCA(n_components=n_components)
    transformed = pca.fit_transform(X_scaled)
    
    loadings = {}
    for i, var in enumerate(variables):
        loadings[var] = [round(float(x), 6) for x in pca.components_[:, i]]
    
    cum_var = np.cumsum(pca.explained_variance_ratio_)
    
    return json.dumps({
        'components': [[round(float(x), 6) for x in row] for row in transformed.tolist()],
        'explainedVariance': [round(float(x), 6) for x in pca.explained_variance_],
        'explainedVarianceRatio': [round(float(x), 6) for x in pca.explained_variance_ratio_],
        'cumulativeVarianceRatio': [round(float(x), 6) for x in cum_var],
        'loadings': loadings,
        'singularValues': [round(float(x), 6) for x in pca.singular_values_],
        'nComponents': n_components
    })
`;

export const MDS_PY = `
import json
import pandas as pd
import numpy as np
from sklearn.manifold import MDS
from sklearn.preprocessing import StandardScaler

def run_mds(data_json, variables_json, n_components=2, metric=True, max_iterations=300, random_state=42):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    mds = MDS(n_components=n_components, metric=metric, max_iter=max_iterations, random_state=random_state, normalized_stress='auto')
    coords = mds.fit_transform(X_scaled)
    
    return json.dumps({
        'coordinates': [[round(float(x), 6) for x in row] for row in coords.tolist()],
        'stress': round(float(mds.stress_), 6),
        'nComponents': n_components
    })
`;
