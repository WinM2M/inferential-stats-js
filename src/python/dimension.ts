/**
 * Python code for dimension reduction functions.
 */

export const EFA_PY = `
import json
import pandas as pd
import numpy as np
import scipy as sp
from factor_analyzer import FactorAnalyzer
from factor_analyzer.factor_analyzer import calculate_bartlett_sphericity, calculate_kmo

def run_efa(data_json, variables_json, n_factors=None, rotation='varimax', method='minres'):
    if not hasattr(sp, 'sum'):
        sp.sum = np.sum
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    # KMO and Bartlett tests
    kmo_result = calculate_kmo(X)
    if isinstance(kmo_result, tuple):
        kmo_all = kmo_result[0]
        kmo_model = kmo_result[1] if len(kmo_result) > 1 else kmo_result[0]
    else:
        kmo_all = kmo_result
        kmo_model = kmo_result
    chi2, p_value = calculate_bartlett_sphericity(X)
    
    # Auto-select number of factors by Kaiser criterion (eigenvalue >= 1)
    raw_eigenvalues = FactorAnalyzer(rotation=None, method=method).fit(X).get_eigenvalues()[0]
    valid_eigenvalues = [float(x) for x in raw_eigenvalues if np.isfinite(x)]
    auto_n_factors = sum(1 for x in valid_eigenvalues if x >= 1.0)
    if auto_n_factors <= 0:
        auto_n_factors = 1
    n_factors = min(auto_n_factors, len(variables))

    fa = FactorAnalyzer(n_factors=n_factors, rotation=rotation, method=method)
    fa.fit(X)
    
    loadings = fa.loadings_
    loadings_dict = {}
    for i, var in enumerate(variables):
        loadings_dict[var] = [round(float(x), 6) for x in loadings[i]]
    
    variance_result = fa.get_factor_variance()
    if isinstance(variance_result, tuple):
        ev = variance_result[0]
        v = variance_result[1] if len(variance_result) > 1 else variance_result[0]
        cumulative = variance_result[2] if len(variance_result) > 2 else None
    else:
        ev = variance_result
        v = variance_result
        cumulative = None
    
    communalities = fa.get_communalities()
    uniquenesses = fa.get_uniquenesses()
    
    comm_dict = {}
    uniq_dict = {}
    for i, var in enumerate(variables):
        comm_dict[var] = round(float(communalities[i]), 6)
        uniq_dict[var] = round(float(uniquenesses[i]), 6)
    
    eigenvalues = raw_eigenvalues
    
    return json.dumps({
        'loadings': loadings_dict,
        'eigenvalues': [round(float(x), 6) for x in eigenvalues],
        'variance': [round(float(x), 6) for x in ev],
        'cumulativeVariance': [round(float(x), 6) for x in cumulative] if cumulative is not None else [round(float(sum(v[:i+1])), 6) for i in range(len(v))],
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
from factor_analyzer.rotator import Rotator

def run_pca(data_json, variables_json, n_components=None, standardize=True, rotation='varimax', sort_by_size=True):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    if standardize:
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)
    else:
        X_scaled = X.values
    
    full_pca = PCA(n_components=min(len(variables), len(X_scaled)))
    full_pca.fit(X_scaled)
    eigenvalues = [float(x) for x in full_pca.explained_variance_]

    if n_components is None:
        auto_n = sum(1 for value in eigenvalues if value >= 1.0)
        if auto_n <= 0:
            auto_n = 1
        n_components = min(auto_n, len(variables), len(X_scaled))
    else:
        n_components = min(int(n_components), len(variables), len(X_scaled))

    pca = PCA(n_components=n_components)
    transformed = pca.fit_transform(X_scaled)

    raw_loadings = pca.components_.T * np.sqrt(pca.explained_variance_)
    if rotation == 'varimax':
        rotated = Rotator(method='varimax').fit_transform(raw_loadings)
    else:
        rotated = raw_loadings

    dominant_indices = np.argmax(np.abs(rotated), axis=1)
    dominant_values = np.take_along_axis(np.abs(rotated), dominant_indices.reshape(-1, 1), axis=1).reshape(-1)
    sorted_indices = np.argsort(-dominant_values) if sort_by_size else np.arange(len(variables))

    loadings = {}
    communalities = {}
    sorted_loadings = []
    for idx in sorted_indices:
        var = variables[idx]
        row = [round(float(x), 6) for x in rotated[idx].tolist()]
        loadings[var] = row
        communalities[var] = round(float(np.sum(np.square(rotated[idx]))), 6)
        sorted_loadings.append({
            'variable': var,
            'dominantComponent': int(dominant_indices[idx] + 1),
            'dominantLoading': round(float(dominant_values[idx]), 6),
            'loadings': row
        })
    
    cum_var = np.cumsum(pca.explained_variance_ratio_)
    
    return json.dumps({
        'components': [[round(float(x), 6) for x in row] for row in transformed.tolist()],
        'eigenvalues': [round(float(x), 6) for x in eigenvalues],
        'explainedVariance': [round(float(x), 6) for x in pca.explained_variance_],
        'explainedVarianceRatio': [round(float(x), 6) for x in pca.explained_variance_ratio_],
        'cumulativeVarianceRatio': [round(float(x), 6) for x in cum_var],
        'loadings': loadings,
        'communalities': communalities,
        'sortedLoadings': sorted_loadings,
        'rotation': rotation,
        'sortBySize': bool(sort_by_size),
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
