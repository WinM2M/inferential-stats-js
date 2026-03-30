// K-Means Cluster
export interface KMeansInput {
  data: Record<string, unknown>[];
  variables: string[];
  k: number;
  maxIterations?: number;
  randomState?: number;
}

export interface ClusterCenter {
  cluster: number;
  center: Record<string, number>;
}

export interface KMeansOutput {
  labels: number[];
  centers: ClusterCenter[];
  inertia: number;
  iterations: number;
  clusterSizes: Record<number, number>;
}

// Hierarchical Cluster
export interface HierarchicalClusterInput {
  data: Record<string, unknown>[];
  variables: string[];
  method?: 'ward' | 'complete' | 'average' | 'single';
  metric?: 'euclidean' | 'cityblock' | 'cosine';
  nClusters?: number;
  distanceThreshold?: number;
}

export interface HierarchicalClusterOutput {
  labels: number[];
  nClusters: number;
  linkageMatrix: number[][];
  clusterSizes: Record<number, number>;
  dendrogramData: {
    icoord: number[][];
    dcoord: number[][];
    leaves: number[];
  };
}
