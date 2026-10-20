/**
 * Python code for dimension reduction functions.
 */

/**
 * Rotation helpers shared by EFA and PCA.
 *
 * Orthogonal rotation keeps the factors uncorrelated, so a single rotated
 * loading matrix says everything there is to say. Oblique rotation estimates
 * the correlations among factors instead, which splits the answer in three:
 * the pattern matrix (partial regression weights -- what the rotator returns),
 * the factor correlation matrix Phi, and the structure matrix S = P @ Phi
 * (plain variable-factor correlations).
 *
 * Three consequences the callers below depend on:
 *
 *   1. Communalities are h2 = diag(P Phi P') once the factors correlate, which
 *      is the same number the unrotated solution gives. `factor_analyzer`'s
 *      get_communalities() returns the row sums of squared pattern loadings,
 *      which is only the communality while the factors stay orthogonal.
 *   2. Rotation sums of squared loadings stop adding up to the extracted
 *      variance, so percent-of-variance and cumulative percent are left out
 *      for oblique rotation. This is SPSS's reading: its Total Variance
 *      Explained table prints only the Total column there. (R's psych reports
 *      an additive variant built on diag(Phi P' P); we follow SPSS because
 *      every other table in this SDK does.)
 *   3. A one-factor solution cannot be rotated. `factor_analyzer` does not
 *      guard this -- varimax raises "too many values to unpack" and promax
 *      silently returns a truncated matrix -- so we skip rotation there and
 *      report it through `rotationApplied`.
 */
export const ROTATION_PY = `
# factor_analyzer 0.3.1 is the newest release on PyPI that ships a wheel, so it
# is the version micropip resolves inside Pyodide -- the later ones are
# source-only and micropip cannot build them. That release still reaches for
# the numpy aliases SciPy used to re-export and dropped in 1.12: its rotator
# calls sp.diag, sp.dot and sp.sqrt, and factor_analyzer.py calls sp.sum.
# Without these names promax dies on "Module 'scipy' has no attribute 'diag'".
# Verified: 0.3.1 and 0.5.1 return the same rotated loadings and the same
# factor correlation matrix, so the old wheel is a packaging accident rather
# than a different estimator.
for _alias in ('diag', 'dot', 'sqrt', 'sum'):
    if not hasattr(sp, _alias):
        setattr(sp, _alias, getattr(np, _alias))

OBLIQUE_ROTATIONS = ('promax', 'oblimin')
ORTHOGONAL_ROTATIONS = ('varimax',)
SUPPORTED_ROTATIONS = ORTHOGONAL_ROTATIONS + OBLIQUE_ROTATIONS

def normalize_rotation(rotation):
    if rotation is None:
        return 'none'
    value = str(rotation).strip().lower()
    if value in ('', 'none', 'null', 'undefined'):
        return 'none'
    if value in SUPPORTED_ROTATIONS:
        return value
    raise ValueError(
        "Unsupported rotation '" + str(rotation) + "'. Supported rotations: "
        + ', '.join(SUPPORTED_ROTATIONS) + ', none'
    )

def is_oblique_rotation(rotation):
    return rotation in OBLIQUE_ROTATIONS

def matrix_to_lists(matrix):
    if matrix is None:
        return None
    return [[float(x) for x in row] for row in np.asarray(matrix, dtype=float).tolist()]

def matrix_to_dict(matrix, variables):
    if matrix is None:
        return None
    rows = np.asarray(matrix, dtype=float)
    result = {}
    for i, var in enumerate(variables):
        result[var] = [float(x) for x in rows[i].tolist()]
    return result

# ---------------------------------------------------------------------------
# Principal axis factoring
#
# factor_analyzer offers 'minres', 'ml' and 'principal'. The last one is named
# after principal *factor* analysis but does not do it: it runs a randomized
# SVD on the standardized data and reports item-component correlations, which
# is principal components. The step that makes PAF a common-factor method --
# replacing the correlation diagonal with communality estimates and iterating
# until they settle -- is absent.
#
# PAF is what psychology scales are usually extracted with, so we implement it
# here rather than mislabel PCA as PAF. The procedure is the textbook one and
# matches SPSS's "Principal Axis Factoring":
#
#   1. Start with squared multiple correlations (SMC) on the diagonal. SMC is
#      the share of an item's variance the other items can predict -- the
#      standard lower-bound estimate of its communality.
#   2. Eigen-decompose that reduced matrix, keep the top k, and read loadings
#      off as eigenvector * sqrt(eigenvalue).
#   3. Recompute communalities from those loadings, put them back on the
#      diagonal, and repeat until they stop moving.
#
# Negative eigenvalues are expected here (the reduced matrix is not positive
# definite) and are clamped to zero rather than square-rooted into NaN. SPSS
# does the same.
# ---------------------------------------------------------------------------

PAF_MAX_ITER = 50
PAF_TOLERANCE = 1e-6

def squared_multiple_correlations(corr):
    """SMC per variable: 1 - 1/diag(inv(R)). Falls back when R is singular."""
    try:
        inv = np.linalg.inv(corr)
    except np.linalg.LinAlgError:
        inv = np.linalg.pinv(corr)
    diag = np.diag(inv)
    with np.errstate(divide='ignore', invalid='ignore'):
        smc = 1.0 - 1.0 / diag
    smc = np.where(np.isfinite(smc), smc, 0.0)
    # A communality cannot be negative, and 1.0 would make the reduced matrix
    # the original one (= principal components) for that item.
    return np.clip(smc, 0.0, 0.999)

#: A communality this close to 1 means the item has no unique variance left --
#: a Heywood case. We clamp so the iteration can continue, but the clamp is
#: reported rather than hidden: it usually says the model asks for more factors
#: than the data carries, or that the sample is small.
PAF_COMMUNALITY_CEILING = 0.999

def paf_loadings(corr, n_factors):
    """Returns (loadings, converged, iterations, heywood_index_list)."""
    corr = np.asarray(corr, dtype=float)
    communalities = squared_multiple_correlations(corr)
    reduced = corr.copy()
    loadings = np.zeros((corr.shape[0], n_factors))
    converged = False
    iterations = 0
    heywood = set()

    for iterations in range(1, PAF_MAX_ITER + 1):
        np.fill_diagonal(reduced, communalities)
        eigenvalues, eigenvectors = np.linalg.eigh(reduced)
        order = np.argsort(eigenvalues)[::-1][:n_factors]
        top_values = np.clip(eigenvalues[order], 0.0, None)
        loadings = eigenvectors[:, order] * np.sqrt(top_values)
        updated = np.sum(loadings ** 2, axis=1)
        for index in np.where(updated >= PAF_COMMUNALITY_CEILING)[0]:
            heywood.add(int(index))
        if np.max(np.abs(updated - communalities)) < PAF_TOLERANCE:
            communalities = updated
            converged = True
            break
        communalities = np.clip(updated, 0.0, PAF_COMMUNALITY_CEILING)

    # Sign is arbitrary in an eigen-decomposition. SPSS reports the column so
    # that its dominant loadings are positive; without this the same data can
    # come back with every sign flipped between runs.
    for column in range(loadings.shape[1]):
        if np.sum(loadings[:, column]) < 0:
            loadings[:, column] = -loadings[:, column]
    return loadings, converged, iterations, sorted(heywood)
`;

export const EFA_PY = `
import json
import pandas as pd
import numpy as np
import scipy as sp
from factor_analyzer import FactorAnalyzer
from factor_analyzer.rotator import Rotator
from factor_analyzer.factor_analyzer import calculate_bartlett_sphericity, calculate_kmo
${ROTATION_PY}

def run_efa(data_json, variables_json, n_factors=None, rotation='varimax', method='minres', sort_by_size=True):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)

    rotation = normalize_rotation(rotation)
    oblique = is_oblique_rotation(rotation)

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

    # 'paf' is ours; factor_analyzer has no principal axis factoring. See
    # paf_loadings above for why we do not reach for its 'principal'.
    is_paf = str(method).strip().lower() == 'paf'
    corr_mtx_full = np.asarray(X.corr(), dtype=float)

    # Auto-select number of factors by Kaiser criterion (eigenvalue >= 1).
    # Kaiser reads the *unreduced* correlation matrix in both paths, so the two
    # agree on how many factors to keep.
    if is_paf:
        raw_eigenvalues = np.sort(np.linalg.eigvalsh(corr_mtx_full))[::-1]
    else:
        raw_eigenvalues = FactorAnalyzer(rotation=None, method=method).fit(X).get_eigenvalues()[0]
    valid_eigenvalues = [float(x) for x in raw_eigenvalues if np.isfinite(x)]
    auto_n_factors = sum(1 for x in valid_eigenvalues if x >= 1.0)
    if auto_n_factors <= 0:
        auto_n_factors = 1

    # The caller's n_factors used to be overwritten here, so asking for three
    # factors and getting Kaiser's answer looked like the analysis disagreeing
    # with you. Kaiser is the default, not the verdict: it is known to
    # over-extract, and deciding the number of factors from a scree plot or
    # from theory is ordinary practice. Honour the request when there is one.
    requested = None
    if n_factors is not None:
        try:
            requested = int(n_factors)
        except (TypeError, ValueError):
            requested = None
    if requested is not None and requested >= 1:
        n_factors = min(requested, len(variables))
    else:
        n_factors = min(auto_n_factors, len(variables))

    # A single factor has no second axis to rotate against, and factor_analyzer
    # does not refuse the request: it raises for varimax and truncates the
    # loadings for promax. Fit unrotated instead and say so in the output.
    rotation_applied = rotation != 'none' and n_factors > 1

    paf_converged = None
    paf_iterations = None
    heywood_items = None
    if is_paf:
        unrotated, paf_converged, paf_iterations, heywood_indices = paf_loadings(
            corr_mtx_full, n_factors
        )
        heywood_items = [variables[i] for i in heywood_indices if i < len(variables)]
        phi = None
        if rotation_applied:
            rotator = Rotator(method=rotation)
            loadings = rotator.fit_transform(unrotated)
            phi = getattr(rotator, 'phi_', None) if oblique else None
        else:
            loadings = unrotated
        fa = None
    else:
        fa = FactorAnalyzer(
            n_factors=n_factors,
            rotation=rotation if rotation_applied else None,
            method=method
        )
        fa.fit(X)
        loadings = fa.loadings_
        phi = getattr(fa, 'phi_', None) if (rotation_applied and oblique) else None

    loadings_dict = matrix_to_dict(loadings, variables)

    # SPSS-style "Sort by size": group variables by the factor they load on
    # most (ascending factor index) and, within a group, by descending absolute
    # loading. Under oblique rotation the dominant factor is read off the
    # pattern matrix -- the matrix SPSS sorts -- so the pattern and structure
    # tables keep one shared row order.
    loadings_arr = np.asarray(loadings, dtype=float)
    dominant_indices = np.argmax(np.abs(loadings_arr), axis=1)
    dominant_values = np.take_along_axis(
        np.abs(loadings_arr), dominant_indices.reshape(-1, 1), axis=1
    ).reshape(-1)
    if sort_by_size:
        order_keys = list(zip(
            dominant_indices.tolist(),
            (-dominant_values).tolist(),
            list(range(len(variables)))
        ))
        order_keys.sort()
        sorted_indices = [key[2] for key in order_keys]
    else:
        sorted_indices = list(range(len(variables)))

    sorted_loadings = []
    for idx in sorted_indices:
        sorted_loadings.append({
            'variable': variables[idx],
            'dominantComponent': int(dominant_indices[idx] + 1),
            'dominantLoading': float(dominant_values[idx]),
            'loadings': [float(x) for x in loadings_arr[idx].tolist()]
        })

    structure = (getattr(fa, 'structure_', None) if fa is not None else None) if phi is not None else None
    if structure is None and phi is not None:
        structure = np.asarray(loadings, dtype=float) @ np.asarray(phi, dtype=float)

    if is_paf:
        # SSL per factor, its share of the total number of variables, and the
        # running total -- the same three columns factor_analyzer returns.
        ssl = np.sum(np.asarray(loadings, dtype=float) ** 2, axis=0)
        variance_result = (ssl, ssl / float(len(variables)), np.cumsum(ssl / float(len(variables))))
    else:
        variance_result = fa.get_factor_variance()
    if isinstance(variance_result, tuple):
        ev = variance_result[0]
        v = variance_result[1] if len(variance_result) > 1 else variance_result[0]
        cumulative = variance_result[2] if len(variance_result) > 2 else None
    else:
        ev = variance_result
        v = variance_result
        cumulative = None

    if phi is not None:
        # h2 = diag(P Phi P'). get_communalities() sums the squared pattern
        # loadings, which undercounts once the factors correlate.
        P = np.asarray(loadings, dtype=float)
        communalities = np.sum(P * (P @ np.asarray(phi, dtype=float)), axis=1)
        uniquenesses = 1.0 - communalities
    elif is_paf:
        communalities = np.sum(np.asarray(loadings, dtype=float) ** 2, axis=1)
        uniquenesses = 1.0 - communalities
    else:
        communalities = fa.get_communalities()
        uniquenesses = fa.get_uniquenesses()

    comm_dict = {}
    uniq_dict = {}
    for i, var in enumerate(variables):
        comm_dict[var] = float(communalities[i])
        uniq_dict[var] = float(uniquenesses[i])

    eigenvalues = raw_eigenvalues

    return json.dumps({
        'loadings': loadings_dict,
        # 화면이 표를 적재량 크기순으로 세우는 근거. 행 순서만 담고 값은
        # loadings 와 같다 — 패턴과 구조가 같은 순서로 서야 나란히 읽힌다.
        'sortedLoadings': sorted_loadings,
        'sortBySize': bool(sort_by_size),
        'structureLoadings': matrix_to_dict(structure, variables),
        'factorCorrelation': matrix_to_lists(phi),
        'eigenvalues': [float(x) for x in eigenvalues],
        # 🔴 variance 는 **비율이 아니라 제곱적재합(SSL)** 이다. 고유값과 같은
        # 눈금이라 1 을 넘는 값이 정상이다. 이름이 비율처럼 읽히는 바람에
        # 화면이 100 을 곱해 「320%」를 찍을 뻔했다.
        'variance': [float(x) for x in ev],
        # 설명 분산 **비율** = SSL / 변수 수. 화면이 쓰는 것은 이쪽이다.
        # 계산은 늘 하고 있었는데 내보내지 않아서, 요인분석 결과가 통째로
        # 「그릴 수 없는 모양」으로 떨어지고 있었다.
        'explainedVarianceRatio': [float(x) for x in v],
        'cumulativeVariance': [float(x) for x in cumulative] if cumulative is not None else [float(sum(v[:i+1])) for i in range(len(v))],
        # 같은 값을 두 이름으로 낸다. 화면은 cumulativeVarianceRatio 를 보고,
        # 주성분분석 쪽도 그 이름을 쓴다 — 요인분석만 짧은 이름이라 누적 열이
        # 통째로 비어 있었다. 짧은 쪽은 쓰던 곳이 있을 수 있어 남긴다.
        'cumulativeVarianceRatio': [float(x) for x in cumulative] if cumulative is not None else [float(sum(v[:i+1])) for i in range(len(v))],
        # 표의 행 순서. 없으면 화면이 공통성 딕셔너리의 키 순서에 기댄다.
        'variables': list(variables),
        'communalities': comm_dict,
        'uniquenesses': uniq_dict,
        'nFactors': n_factors,
        'rotation': rotation,
        'rotationApplied': bool(rotation_applied),
        'rotationIsOblique': bool(rotation_applied and oblique),
        # 🔴 Reported, not swallowed. A PAF solution that did not converge is
        # unstable and will not reproduce, and a Heywood case usually means the
        # model asks for more factors than the data carries. SPSS warns on both;
        # a result that cannot be trusted should say so on its own.
        'converged': (bool(paf_converged) if paf_converged is not None else None),
        'iterations': (int(paf_iterations) if paf_iterations is not None else None),
        'heywoodItems': heywood_items,
        'kmo': float(kmo_model),
        'bartlettChi2': float(chi2),
        'bartlettPValue': float(p_value)
    })
`;

export const PCA_PY = `
import json
import pandas as pd
import numpy as np
import scipy as sp
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler
from factor_analyzer.rotator import Rotator
${ROTATION_PY}

def run_pca(data_json, variables_json, n_components=None, standardize=True, rotation='varimax', sort_by_size=True):
    df = pd.DataFrame(json.loads(data_json))
    variables = json.loads(variables_json)

    rotation = normalize_rotation(rotation)
    oblique = is_oblique_rotation(rotation)

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

    # One component has no second axis to rotate against. factor_analyzer
    # raises for varimax and truncates the matrix for promax rather than
    # refusing, so the guard has to live here.
    rotation_applied = rotation != 'none' and n_components > 1
    phi = None
    if rotation_applied:
        rotator = Rotator(method=rotation)
        rotated = rotator.fit_transform(raw_loadings)
        if oblique:
            phi = rotator.phi_
    else:
        rotated = raw_loadings

    rotated = np.asarray(rotated, dtype=float)
    structure = rotated @ np.asarray(phi, dtype=float) if phi is not None else None

    dominant_indices = np.argmax(np.abs(rotated), axis=1)
    dominant_values = np.take_along_axis(np.abs(rotated), dominant_indices.reshape(-1, 1), axis=1).reshape(-1)
    # SPSS-style "Sort by size": group variables by their dominant component
    # (ascending component index) and, within each group, sort by descending
    # absolute loading magnitude.  This is the canonical SPSS Factor / PCA
    # ordering described in Field (2018) and the SPSS Statistics manual.
    # Under oblique rotation the dominant component is read off the pattern
    # matrix, which is the matrix SPSS sorts.
    if sort_by_size:
        order_keys = list(zip(
            dominant_indices.tolist(),
            (-dominant_values).tolist(),
            list(range(len(variables)))
        ))
        order_keys.sort()
        sorted_indices = np.array([key[2] for key in order_keys], dtype=int)
    else:
        sorted_indices = np.arange(len(variables))

    # loadings keyed by ORIGINAL variable order (component matrix display)
    loadings = {}
    communalities = {}
    for idx in range(len(variables)):
        var = variables[idx]
        row = [float(x) for x in rotated[idx].tolist()]
        loadings[var] = row
        # Extraction communalities, read off the unrotated solution. They are
        # rotation-invariant: orthogonal rotation preserves the row sums of
        # squares, and under oblique rotation the same number is diag(P Phi P').
        communalities[var] = float(np.sum(np.square(raw_loadings[idx])))

    sorted_loadings = []
    for idx in sorted_indices:
        var = variables[idx]
        row = [float(x) for x in rotated[idx].tolist()]
        sorted_loadings.append({
            'variable': var,
            'dominantComponent': int(dominant_indices[idx] + 1),
            'dominantLoading': float(dominant_values[idx]),
            'loadings': row
        })

    cum_var = np.cumsum(pca.explained_variance_ratio_)

    # Total Variance Explained:
    # - Initial eigenvalues: every component from full unrotated PCA
    # - Extraction sums of squared loadings: selected (kept) components' eigenvalues
    # - Rotation sums of squared loadings: per-component sum of squared rotated loadings
    total_variance = float(np.sum(eigenvalues)) if len(eigenvalues) > 0 else 0.0
    initial_rows = []
    for i, ev in enumerate(eigenvalues):
        pct = (float(ev) / total_variance * 100.0) if total_variance > 0 else 0.0
        initial_rows.append({
            'component': i + 1,
            'eigenvalue': float(ev),
            'variancePercent': pct
        })
    # cumulative
    cum = 0.0
    for row in initial_rows:
        cum += row['variancePercent']
        row['cumulativePercent'] = cum

    extraction_rows = []
    cum = 0.0
    for i in range(n_components):
        ev = float(eigenvalues[i]) if i < len(eigenvalues) else 0.0
        pct = (ev / total_variance * 100.0) if total_variance > 0 else 0.0
        cum += pct
        extraction_rows.append({
            'component': i + 1,
            'eigenvalue': ev,
            'variancePercent': pct,
            'cumulativePercent': cum
        })

    rotation_rows = []
    if rotation_applied and n_components > 0:
        # sum of squared rotated loadings per component
        rot_ssq = np.sum(np.square(rotated), axis=0)
        cum = 0.0
        for i in range(n_components):
            ev = float(rot_ssq[i])
            row = {'component': i + 1, 'eigenvalue': ev}
            if oblique:
                # Correlated components overlap, so these sums do not add up to
                # the extracted variance. SPSS prints the Total column alone.
                row['variancePercent'] = None
                row['cumulativePercent'] = None
            else:
                pct = (ev / total_variance * 100.0) if total_variance > 0 else 0.0
                cum += pct
                row['variancePercent'] = pct
                row['cumulativePercent'] = cum
            rotation_rows.append(row)

    return json.dumps({
        'components': [[float(x) for x in row] for row in transformed.tolist()],
        'eigenvalues': [float(x) for x in eigenvalues],
        'explainedVariance': [float(x) for x in pca.explained_variance_],
        'explainedVarianceRatio': [float(x) for x in pca.explained_variance_ratio_],
        'cumulativeVarianceRatio': [float(x) for x in cum_var],
        'loadings': loadings,
        'structureLoadings': matrix_to_dict(structure, variables),
        'factorCorrelation': matrix_to_lists(phi),
        'communalities': communalities,
        'sortedLoadings': sorted_loadings,
        'totalVarianceExplained': {
            'initial': initial_rows,
            'extraction': extraction_rows,
            'rotation': rotation_rows
        },
        'rotation': rotation,
        'rotationApplied': bool(rotation_applied),
        'rotationIsOblique': bool(rotation_applied and oblique),
        'sortBySize': bool(sort_by_size),
        'singularValues': [float(x) for x in pca.singular_values_],
        'nComponents': n_components,
        'variables': list(variables)
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
        'coordinates': [[float(x) for x in row] for row in coords.tolist()],
        'stress': float(mds.stress_),
        'nComponents': n_components
    })
`;
