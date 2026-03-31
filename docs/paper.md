---
title: 'inferential-stats-js: A WebAssembly-based Serverless Engine for Advanced Statistical Analysis in the Browser'
tags:
  - JavaScript
  - TypeScript
  - WebAssembly
  - inferential statistics
  - Pyodide
  - Web Worker
authors:
  - name: Youngjune Kwon
    orcid: 0009-0002-9286-9629
    affiliation: 1
    corresponding: true
affiliations:
  - name: WinM2M Inc., South Korea
    index: 1
date: 31 March 2026
bibliography: paper.bib
---

# Summary

`inferential-stats-js` is a headless, client-side JavaScript SDK designed to perform advanced inferential statistics entirely within the web browser. Leveraging WebAssembly (WASM) and Pyodide [@pyodide], this library encapsulates the powerful Python data science ecosystem—including `pandas` [@pandas], `scipy` [@scipy], `scikit-learn` [@scikit-learn], and `statsmodels` [@statsmodels]—and exposes them via a lightweight, strongly-typed JSON API. By utilizing Web Workers and efficient binary data serialization, `inferential-stats-js` processes large datasets locally with zero server dependency, mitigating UI blocking, server costs, and data privacy concerns.

# Statement of Need

In the modern web development ecosystem, performing complex inferential statistics (e.g., Exploratory Factor Analysis with Varimax rotation, Post-hoc tests for ANOVA, or Multinomial Logistic Regression) is notoriously difficult due to the lack of robust mathematical algorithms in native JavaScript libraries. Typically, developers must rely on backend servers running Python or R. However, in fields such as psychology, sociology, and medical research, transferring sensitive human-subject survey data to external statistical servers poses severe privacy and compliance risks (e.g., GDPR, HIPAA). 

Furthermore, the landscape of social science research has long been dominated by commercial, desktop-based statistical software suites (e.g., SPSS, SAS). The prohibitively high licensing costs of these proprietary tools act as a significant barrier to entry for early-career researchers, independent scholars, and students. This financial hurdle not only stifles the influx of new research talent but also hinders the creation of flexible, accessible, and reproducible research environments.

`inferential-stats-js` addresses these critical gaps. By enabling complex psychometric evaluations entirely on the client-side, this SDK provides researchers with a highly secure, zero-latency environment. It democratizes access to high-level statistical computing by providing a free, open-source, browser-native alternative that seamlessly integrates into modern web frameworks (React, Vue) without the need for expensive proprietary software or backend infrastructure.

# Architecture and Implementation

Reimplementing complex linear algebra algorithms in native JavaScript is error-prone and lacks academic verifiability. Our approach solves this by reusing the battle-tested C-based Python ecosystem directly in the browser via WASM. To ensure production-level performance, the library employs a multi-threaded architecture:

1. **Web Worker Isolation:** All heavy matrix calculations and Python environment initializations are offloaded to an isolated Web Worker. This guarantees that the main browser UI thread remains responsive even when processing thousands of rows of survey data.
2. **Buffer-based Communication:** To prevent memory leaks and serialization bottlenecks (Out-Of-Memory exceptions) when transferring large JSON datasets between the main thread and the worker, data is serialized into lightweight binary formats (e.g., `ArrayBuffer`, `TypedArray`).
3. **Dynamic Package Loading and GC:** Required Python packages are dynamically loaded via `micropip` only when invoked, minimizing the initial network payload. Additionally, the worker rigorously manages Garbage Collection (GC) by explicitly destroying Python proxy objects post-computation to prevent memory leaks.

# Key Features and Validation

The SDK provides six core statistical modules encompassing descriptive statistics, mean comparisons (T-tests, ANOVA), regression models, classification (K-Means, Hierarchical), dimension reduction (PCA, MDS, EFA), and scale reliability (Cronbach's Alpha). 

To ensure absolute academic integrity, the computational outcomes of `inferential-stats-js` have been rigorously cross-validated against native Python 3.x environments. Using synthetic datasets injected with intentional correlations, the browser-computed metrics (e.g., p-values, F-statistics, Chi-Square, and Cramér's V) match the server-side Python outputs to the fourth decimal place, proving the mathematical reliability of the Pyodide bridge implementation.

# Acknowledgment of AI Assistance

The architecture design, statistical methodology, and overall requirements of this project were conceptualized and meticulously directed by the author. The actual implementation of the source code was actively assisted by AI coding agents under the author's strict prompt engineering and iterative supervision. The author has thoroughly validated all computational outcomes and takes full responsibility for the accuracy and integrity of the software.

# References