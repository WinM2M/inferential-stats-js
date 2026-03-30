/**
 * Python code for classification/clustering functions.
 */

export const KMEANS_PY = `
import json
import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

def run_kmeans(data_json, variables_json, k, max_iterations=300, random_state=42):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    model = KMeans(n_clusters=k, max_iter=max_iterations, random_state=random_state, n_init=10)
    labels = model.fit_predict(X_scaled)
    
    # Transform centers back to original scale
    centers_original = scaler.inverse_transform(model.cluster_centers_)
    
    centers = []
    for i in range(k):
        center = {}
        for j, var in enumerate(variables):
            center[var] = round(float(centers_original[i, j]), 6)
        centers.append({'cluster': i, 'center': center})
    
    unique, counts = np.unique(labels, return_counts=True)
    cluster_sizes = {int(u): int(c) for u, c in zip(unique, counts)}
    
    return json.dumps({
        'labels': [int(l) for l in labels],
        'centers': centers,
        'inertia': round(float(model.inertia_), 6),
        'iterations': int(model.n_iter_),
        'clusterSizes': cluster_sizes
    })
`;

export const HIERARCHICAL_CLUSTER_PY = `
import json
import pandas as pd
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster, dendrogram
from sklearn.preprocessing import StandardScaler

def run_hierarchical_cluster(data_json, variables_json, method='ward', metric='euclidean', n_clusters=None, distance_threshold=None):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)
    
    X = df[variables].apply(pd.to_numeric, errors='coerce').dropna()
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    Z = linkage(X_scaled, method=method, metric=metric)
    
    if n_clusters is not None:
        labels = fcluster(Z, t=n_clusters, criterion='maxclust')
    elif distance_threshold is not None:
        labels = fcluster(Z, t=distance_threshold, criterion='distance')
    else:
        labels = fcluster(Z, t=3, criterion='maxclust')
    
    labels = labels - 1  # 0-indexed
    
    unique, counts = np.unique(labels, return_counts=True)
    cluster_sizes = {int(u): int(c) for u, c in zip(unique, counts)}
    
    # Dendrogram data (truncated for large datasets)
    trunc = min(30, len(X_scaled))
    dend = dendrogram(Z, truncate_mode='lastp', p=trunc, no_plot=True)
    
    return json.dumps({
        'labels': [int(l) for l in labels],
        'nClusters': len(unique),
        'linkageMatrix': [[round(float(x), 6) for x in row] for row in Z.tolist()],
        'clusterSizes': cluster_sizes,
        'dendrogramData': {
            'icoord': [[round(float(x), 4) for x in row] for row in dend['icoord']],
            'dcoord': [[round(float(x), 4) for x in row] for row in dend['dcoord']],
            'leaves': [int(x) for x in dend['leaves']]
        }
    })
`;
