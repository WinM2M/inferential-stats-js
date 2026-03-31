---
title: 'inferential-stats-js: A Client-Side JavaScript SDK for Inferential Statistical Analysis Using WebAssembly'
tags:
  - JavaScript
  - TypeScript
  - WebAssembly
  - statistics
  - inferential statistics
  - Pyodide
  - browser
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

`inferential-stats-js` is an open-source JavaScript/TypeScript SDK that performs
advanced inferential statistical analysis entirely within a web browser, requiring
no backend server. The library leverages WebAssembly through Pyodide
[@pyodide:2021] to execute a full CPython runtime in-browser, along with
established scientific Python libraries including pandas [@mckinney:2010; @pandas:zenodo], SciPy
[@virtanen:2020], statsmodels [@seabold:2010], scikit-learn [@pedregosa:2011; @buitinck:2013],
and factor\_analyzer [@biggs:2024]. All computation is offloaded to a dedicated
Web Worker to keep the main thread responsive, and data is transferred using the
Transferable Objects API for near-zero-copy performance. The SDK ships as both
ECMAScript Modules (ESM) and CommonJS formats with full TypeScript declarations,
and provides 16 analysis methods spanning descriptive statistics, mean comparisons,
regression, clustering, dimension reduction, and reliability analysis.

# Statement of need

Researchers, educators, and data analysts frequently need to perform inferential
statistical tests---such as t-tests, ANOVA, regression, and factor
analysis---on survey or experimental data. Traditionally, this requires either
commercial desktop software such as SPSS [@ibm:spss] or R-based solutions
[@rcoreteam:2024] that depend on server infrastructure.

Existing JavaScript statistics libraries such as `simple-statistics` and `jStat`
are limited to basic descriptive statistics and probability distributions; they
do not support advanced inferential methods such as exploratory factor analysis
(EFA), binary or multinomial logistic regression, hierarchical clustering, or
Cronbach's alpha reliability analysis. Server-side API approaches using Python
or R can provide the full analytical range, but they introduce network latency,
require server hosting costs, and---critically---necessitate transmitting
potentially sensitive respondent data to external infrastructure, raising
significant data privacy concerns. These limitations create a gap for web
developers who need to embed production-grade inferential statistics into
browser-based applications without backend dependencies.

`inferential-stats-js` addresses these challenges by executing all statistical
computation entirely within the user's browser. No data ever leaves the client
device, ensuring complete data privacy by design. The SDK resolves the three
core limitations of existing approaches simultaneously: (1) it provides the full
range of inferential methods absent from JavaScript libraries, (2) it eliminates
network latency and server hosting costs by running client-side, and (3) it
guarantees data privacy by keeping all computation local.

The primary target audience for this library is not statisticians, but rather
**web frontend developers building browser-based survey platforms, marketing
dashboards, CRM analytics tools, and educational assessment systems**. These
developers need to integrate professional-grade statistical widgets---such as
ANOVA result tables, regression summaries, or factor loading matrices---into
their applications without requiring Python expertise or provisioning backend
compute resources. The SDK's typed API and familiar async/await patterns are
designed to fit naturally into modern JavaScript/TypeScript workflows.

Beyond commercial web development, the library is also directly relevant to
**social science and psychology researchers** who collect and analyze sensitive
human-subject data. Institutional Review Boards (IRBs) increasingly require
that personally identifiable information (PII) be handled in accordance with
regulations such as the EU General Data Protection Regulation (GDPR) and the
U.S. Health Insurance Portability and Accountability Act (HIPAA). When
researchers use server-side analysis platforms, survey responses---which may
include health indicators, demographic information, or psychometric
scores---must traverse network infrastructure and reside on third-party servers,
creating compliance obligations around data processing agreements, encryption in
transit, and data residency. `inferential-stats-js` eliminates these risks
entirely: because all computation executes within the respondent's or
researcher's own browser, no data is transmitted to any external server at any
point. This zero-data-egress architecture makes the library particularly
suitable for pilot studies, classroom research exercises, and fieldwork contexts
where secure server infrastructure may be unavailable or prohibitively expensive
to provision.

# State of the field

Several JavaScript statistics libraries exist, but they occupy a different niche.
`simple-statistics` [@mf:2024] and `jStat` [@jstat:2024] provide basic
descriptive statistics and probability distributions but lack inferential methods
such as ANOVA with post-hoc tests, logistic regression, factor analysis, or
hierarchical clustering. `stdlib` [@stdlib:2024] offers a comprehensive numerical
computing library for JavaScript but requires assembling individual low-level
functions rather than providing a unified analysis-oriented API.

To illustrate the gap concretely: none of the existing JavaScript libraries
provide Varimax-rotated exploratory factor analysis, Tukey HSD or Games-Howell
post-hoc tests for one-way ANOVA, multinomial logistic regression, or
Ward-linkage hierarchical clustering with dendrogram data. These methods require
sophisticated numerical routines---eigenvalue decomposition, orthogonal rotation,
iteratively reweighted least squares, and agglomerative linkage
algorithms---that depend on a well-tested linear algebra and optimization
substrate. Reimplementing such routines from scratch in JavaScript would be both
error-prone and academically unverifiable: a novel JS implementation of Varimax
rotation, for example, would lack the citation trail and peer-reviewed
validation history that SciPy [@virtanen:2020] and statsmodels [@seabold:2010]
have accumulated over more than a decade. By contrast, executing these
established Python/C/Fortran implementations via WebAssembly preserves their
full numerical fidelity while making them accessible in the browser environment.

Server-side solutions using Python or R can provide the full range of inferential
statistics, but they require backend infrastructure, introduce network latency,
and necessitate transmitting potentially sensitive data over the network.
Browser-based R environments such as webR [@webr:2024] have emerged but do not
offer a packaged SDK with a typed API suitable for integration into production
web applications.

`inferential-stats-js` was built rather than contributing to existing projects
for two reasons. First, no existing JavaScript library provides all 16 of the
inferential analysis methods commonly found in SPSS in a single, typed, API-first
package. Second, by delegating computation to Python's mature scientific stack
via Pyodide---rather than reimplementing algorithms in JavaScript---the library
inherits decades of validation from SciPy, statsmodels, and scikit-learn, reducing
the risk of statistical implementation errors. The Web Worker architecture and
binary transfer protocol are novel contributions that enable this Python-in-browser
approach to remain performant for production use.

# Software design

The architecture of `inferential-stats-js` reflects three primary design
trade-offs.

**WebAssembly via Pyodide vs. native JavaScript implementations.** Reimplementing
16 statistical methods in JavaScript would have required extensive validation
against established reference implementations. Instead, the SDK delegates all
computation to Pyodide [@pyodide:2021], which runs a full CPython interpreter
compiled to WebAssembly. This allows direct use of pandas, SciPy, statsmodels,
scikit-learn, and factor\_analyzer---libraries that are themselves extensively
tested and widely cited in the scientific literature. The trade-off is an initial
loading cost (Pyodide runtime and Python packages), which is mitigated by
one-time initialization with progress event reporting.

**Web Worker isolation.** All Pyodide execution occurs inside a dedicated Web
Worker, ensuring that long-running computations (e.g., iterative clustering or
factor analysis) do not block the browser's main thread. This is critical for
maintaining responsive user interfaces during analysis.

**Binary transfer protocol.** Data is serialized into a columnar binary format
using TypedArrays (`Float64Array`, `Int32Array`, and dictionary-encoded strings)
and transferred to the Worker via the Transferable Objects API, which performs
near-zero-copy data transfer. This design avoids the overhead of JSON
serialization for large datasets while maintaining type safety through the
TypeScript bridge layer.

The SDK exposes a single `InferentialStats` class with 16 async analysis methods,
each accepting a strongly-typed input object and returning a typed
`AnalysisResult<T>`. Progress events are dispatched as `CustomEvent` instances
on a configurable `EventTarget`, enabling real-time progress bars during
initialization and computation.

**Known limitations and mitigations.** The Pyodide runtime and its bundled
Python packages (SciPy, statsmodels, scikit-learn, etc.) incur a one-time
initial download of approximately 20--30 MB of WebAssembly and data payloads.
On mobile devices, available memory may further constrain the size of datasets
that can be analyzed in-browser. However, after the initial load, all subsequent
analyses execute without network delay, and the Pyodide runtime and packages are
cached by the browser's standard HTTP caching mechanisms. For data transfer, the
SDK employs a columnar binary serialization protocol using `ArrayBuffer` and
`TypedArray` with the Transferable Objects API, minimizing memory duplication
and defending against browser memory limits. In practice, this architecture
provides sufficient performance for the data scales typical of social survey
research, marketing analytics, and educational assessment---commonly ranging
from hundreds to several thousand observations with tens of variables.

# Research impact statement

`inferential-stats-js` is currently at version 0.1.5 and is available on npm
as `@winm2m/inferential-stats-js`. The package enables a class of web applications
that was previously impractical: browser-based survey analysis tools that perform
SPSS-level inferential statistics without any server infrastructure, ensuring
that respondent data never leaves the client device.

The library includes a reproducible sample dataset of 2,000 simulated survey
responses (generated with a seeded PRNG) that exercises all 16 analysis methods,
along with a browser-based demo and a CodePen live example. A comprehensive test
suite with 82 tests verifies SDK functionality including serialization round-trips,
public API completeness, and all analysis method return types. To ensure
mathematical correctness, the SDK's output values (Chi-square statistics,
p-values, regression coefficients, factor loadings, etc.) were cross-validated
against native Python 3.x results produced in a local Jupyter Notebook
environment using the same sample dataset, confirming numerical agreement to
four decimal places across all 16 analysis methods. The package is
distributed with full TypeScript declarations, enabling type-safe integration in
production applications.

The combination of client-side execution, privacy preservation, and a familiar
statistical method set positions `inferential-stats-js` for adoption in
educational technology, health survey platforms, and social science research tools
where data sensitivity and deployment simplicity are primary concerns.

# AI usage disclosure

Generative AI tools were used in the development of this software and the
preparation of this manuscript. The following disclosure details the scope and
nature of AI assistance in accordance with JOSS policy.

**Tools and models used:**

- GitHub Copilot coding agent (based on large language models) for code generation
  during initial development
- Anthropic Claude Opus 4.6 for code review, documentation drafting, and
  manuscript preparation

**Scope of AI-assisted code generation:**

Analysis of the project's Git history reveals that 15 out of 26 commits (58%)
were authored by the GitHub Copilot coding agent (`copilot-swe-agent[bot]`),
spanning the following areas:

1. *Core SDK architecture:* TypeScript type definitions, binary
   serializer/deserializer for Web Worker communication, Pyodide Web Worker
   implementation, Python script templates for statistical analyses, and the
   main `InferentialStats` class (commits `54b4dab`--`847a938`)
2. *Documentation:* Initial comprehensive README with API documentation and
   mathematical formulas (commit `eec7d32`), and corrections to match actual
   data schema (commit `a49f9cb`)
3. *Test suite:* Jest test infrastructure with 82 tests covering bridge
   serialization, public API exports, and all 16 analysis methods (commit
   `8dca5b9`)
4. *Bug fixes:* TypedArray alignment fix for `Float64Array`/`Int32Array`
   constructed at unaligned offsets (PR \#1), and cross-origin Worker creation
   fix for CDN usage with fetch-to-Blob pipeline (PR \#2)

**Scope of AI-assisted manuscript preparation:**

The initial draft of this `paper.md` and `paper.bib` was generated using
Anthropic Claude Opus 4.6, based on analysis of the repository README, Git
commit history, pull request descriptions, and JOSS formatting guidelines.

**Human verification and oversight:**

The corresponding author (Youngjune Kwon) provided all architectural decisions,
defined the project scope and analysis method selection, designed the sample data
schema with intentional statistical associations, implemented demo features, and
reviewed and merged all AI-generated pull requests. All AI-generated code was
reviewed through GitHub's pull request workflow before merging. The author
maintains full responsibility for the accuracy, correctness, and originality
of all submitted materials.

# Acknowledgements

The authors acknowledge the Pyodide project for making browser-based Python
execution possible, and the developers of SciPy, statsmodels, scikit-learn,
pandas, and factor\_analyzer for the scientific computing foundations on which
this SDK is built.

# References
