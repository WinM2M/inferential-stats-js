---
title: 'inferential-stats-js: SPSS-level inferential statistics in the browser, with no server and no data upload'
tags:
  - JavaScript
  - TypeScript
  - WebAssembly
  - statistics
  - survey research
  - privacy
authors:
  # TODO(제출 전): ORCID 필수. https://orcid.org 에서 발급받아 `orcid:` 줄을 추가할 것.
  - name: Youngjune Kwon
    affiliation: 1
affiliations:
  - name: WinM2M Inc., Republic of Korea
    index: 1
date: 31 August 2026
bibliography: paper.bib
---

# Summary

`inferential-stats-js` runs a working set of inferential statistics — t-tests, one-way
ANOVA with Tukey post hoc, cross-tabulation with chi-square, linear and logistic
regression, k-means and hierarchical clustering, PCA, exploratory factor analysis,
multidimensional scaling, and Cronbach's alpha — entirely inside a web browser. It ships
as a headless TypeScript SDK: it computes and returns results, and leaves presentation to
whatever is embedding it.

The computation is done by SciPy, statsmodels, scikit-learn and pandas, executed through
Pyodide [@pyodide] in a Web Worker. The Python scientific stack is what researchers
already trust; the contribution here is not a reimplementation of it but a path by which
it can be used from a page with no server behind it. The SDK also reads SPSS `.sav`
files, so an analysis can begin from the file a researcher already has.

Because there is no server, the data never leaves the machine it was collected on. That
is a property of the architecture rather than a promise in a privacy policy.

# Statement of need

Survey researchers who need more than descriptive statistics generally face one of three
situations. They buy a licence for desktop software such as SPSS or Stata. They learn R
or Python, which is a reasonable answer for some and a barrier for many. Or they paste
their data into a web calculator, which means uploading it to somebody else's server.

The third option is the one that scales worst against the constraints researchers
actually work under. Human-subjects data is frequently governed by ethics approvals and
institutional data-handling rules that make uploading responses to an unaffiliated
service either awkward or impossible. The available free web calculators are also thin:
most implement a single test, report a statistic and a p-value, and stop short of the
assumption checks and effect sizes a paper needs.

`inferential-stats-js` addresses that gap by moving the computation to the client. A page
that embeds it can offer the analyses above without operating any statistical
infrastructure, and without ever receiving the respondent data. For a researcher this
removes the upload question entirely; for a tool builder it removes the server.

The design decision that follows from this is that the library is headless. Statistical
software tends to arrive welded to an interface, which makes it hard to place inside an
existing research workflow. Keeping computation and presentation apart is what allows the
same engine to serve a public single-purpose calculator, an embedded analysis panel, and a
programmatic pipeline without forking.

# Implementation notes

Analyses run in a Web Worker so that a long computation does not freeze the page, and
progress events are emitted for the initial Pyodide download, which is substantial and
therefore deferred until the first analysis is actually requested. Results are returned
as structured objects — statistic, degrees of freedom, p-value, effect size, and the
assumption tests that belong with each procedure, such as Levene's test alongside an
independent-samples t-test — rather than as formatted text, so that an embedder can render
them as APA tables, feed them into a report, or assert on them in a test.

# Research applications

The library is the statistical engine of Proveri (<https://proveri.ai>), a survey research
platform, where it powers both a set of publicly available calculators and the analysis
workspace used inside the product. Surveys run on that platform are analysed by this
package.

Among those, the Ministry of the Interior and Safety of the Republic of Korea is using
the platform for a satisfaction study of foreign correspondents invited to Korea. That
deployment is a funded public-sector survey rather than a demonstration, and the responses
it collects are analysed by this library.

# Acknowledgements

The statistical computation rests on SciPy [@scipy], statsmodels [@statsmodels],
scikit-learn [@scikit-learn], pandas [@pandas] and NumPy [@numpy], made available in the browser by
Pyodide [@pyodide].

# References
