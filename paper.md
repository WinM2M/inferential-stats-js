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
established scientific Python libraries including pandas [@mckinney:2010], SciPy
[@virtanen:2020], statsmodels [@seabold:2010], scikit-learn [@pedregosa:2011],
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
[@rcoreteam:2024] that depend on server infrastructure. These approaches raise
concerns about data privacy (particularly with sensitive survey data), impose
licensing costs, and create barriers for deployment in resource-constrained
educational or fieldwork settings where reliable internet connectivity or
server access cannot be guaranteed.

`inferential-stats-js` addresses these challenges by executing all statistical
computation within the user's browser. No data ever leaves the client device,
ensuring complete data privacy. The library is designed for web application
developers who need to embed SPSS-equivalent statistical capabilities into
browser-based tools---such as online survey platforms, educational dashboards,
or research data portals---without provisioning backend compute resources.

The target audience includes: (1) web developers building analytics features
into browser applications, (2) researchers in the social and behavioral sciences
who need accessible, privacy-preserving statistical tools, and (3) educators
creating interactive statistics learning environments.

# State of the field

Several JavaScript statistics libraries exist, but they occupy a different niche.
`simple-statistics` [@mf:2024] and `jStat` [@jstat:2024] provide basic
descriptive statistics and probability distributions but lack inferential methods
such as ANOVA with post-hoc tests, logistic regression, factor analysis, or
hierarchical clustering. `stdlib` [@stdlib:2024] offers a comprehensive numerical
computing library for JavaScript but requires assembling individual low-level
functions rather than providing a unified analysis-oriented API.

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

# Research impact statement

`inferential-stats-js` is currently at version 0.1.5 and is available on npm
as `@winm2m/inferential-stats-js`. The package enables a class of web applications
that was previously impractical: browser-based survey analysis tools that perform
SPSS-level inferential statistics without any server infrastructure, ensuring
that respondent data never leaves the client device.

The library includes a reproducible sample dataset of 2,000 simulated survey
responses (generated with a seeded PRNG) that exercises all 16 analysis methods,
along with a browser-based demo and a CodePen live example. A comprehensive test
suite with 77 tests verifies SDK functionality including serialization round-trips,
public API completeness, and all analysis method return types. The package is
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
3. *Test suite:* Jest test infrastructure with 77 tests covering bridge
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
