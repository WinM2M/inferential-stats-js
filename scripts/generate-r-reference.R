#!/usr/bin/env Rscript
#
# Generates e2e/fixtures/cross-check/r-reference.json: for each case, what R
# reports for the same procedure on the same CSV this SDK is given.
#
# The CSVs come from scripts/fetch-cross-check-data.mjs, which downloads them
# from the archives that publish them (NIST, UCI) and pins each file's SHA-256.
# Reading those files rather than R's own bundled copies is deliberate: the
# copies differ. UCI's iris.data carries two documented transcription errors
# against Fisher's 1936 table that R's built-in `iris` does not, so a reference
# generated from `datasets::iris` would be a reference for a different table.
#
# Three kinds of case come out of here, distinguished by `status`:
#
#   check                 R and this SDK should agree to the fixture tolerance.
#                         A failure is a defect.
#   known-defect          A filed issue or a recorded finding already explains
#                         the disagreement.
#   convention-pending    Both are right for their own definition of the
#                         statistic; which one this SDK should follow is not yet
#                         decided.
#
# The last two run as `it.fails` in the test, so the divergence stays executable
# instead of being absorbed into a looser tolerance. See
# docs/validation/cross-check-r-spss.md.
#
# Usage: Rscript scripts/generate-r-reference.R
# Needs: jsonlite, car  (Debian: r-cran-jsonlite, r-cran-car)
#        e1071 for the two skewness/kurtosis conventions

suppressPackageStartupMessages({
  library(jsonlite)
  library(e1071)
  library(car)
})

DATA_DIR <- file.path("e2e", "fixtures", "cross-check", "data")
OUT      <- file.path("e2e", "fixtures", "cross-check", "r-reference.json")

read_fixture <- function(name) {
  read.csv(file.path(DATA_DIR, paste0(name, ".csv")),
           stringsAsFactors = FALSE, check.names = FALSE, na.strings = "")
}

cases <- list()
# `tolerance` overrides the fixture default for one case. Needed because the
# default is set by floating-point association order, which only bounds the
# closed-form procedures. A model fitted iteratively agrees only as closely as
# the two packages' convergence criteria allow, and that is a different number.
case <- function(id, dataset, procedure, input, expected,
                 status = "check", note = NULL, tolerance = NULL) {
  cases[[length(cases) + 1]] <<- list(
    id = id, dataset = dataset, procedure = procedure,
    input = input, status = status,
    note = if (is.null(note)) NA else note,
    tolerance = if (is.null(tolerance)) NA else tolerance,
    expected = expected
  )
}

iris_df   <- read_fixture("iris")
autompg   <- read_fixture("auto-mpg")
wine      <- read_fixture("wine")
haberman  <- read_fixture("haberman")
bcw       <- read_fixture("breast-cancer-wisconsin")
spect     <- read_fixture("spect-train")

# ---------------------------------------------------------------- descriptives

iris_vars <- c("sepal_length", "sepal_width", "petal_length", "petal_width")

# `quantile(type = 7)` is R's default and pandas' `describe()` interpolation, so
# the quartiles are directly comparable; `sd()` and `var(ddof = 1)` likewise.
moment_stats <- function(df, vars, moment_type) {
  lapply(vars, function(v) {
    x <- df[[v]][!is.na(df[[v]])]
    q <- unname(quantile(x, c(.25, .5, .75), type = 7))
    list(variable = v, count = length(x), mean = mean(x), std = sd(x),
         min = min(x), max = max(x), q25 = q[1], q50 = q[2], q75 = q[3],
         skewness = e1071::skewness(x, type = moment_type),
         kurtosis = e1071::kurtosis(x, type = moment_type))
  })
}

# type = 1 is the plain moment ratio g1/g2, which is what scipy returns with its
# default bias = TRUE - what this SDK calls today.
case("descriptives/iris/moments-g", "iris", "descriptives",
     list(variables = iris_vars),
     list(statistics = moment_stats(iris_df, iris_vars, 1)))

# type = 2 is G1/G2, the sample-adjusted form SPSS DESCRIPTIVES prints and the
# one a reader of a paper will have in front of them. Only the two moment fields
# differ between this case and the one above.
case("descriptives/iris/moments-G-spss", "iris", "descriptives",
     list(variables = iris_vars),
     list(statistics = moment_stats(iris_df, iris_vars, 2)),
     status = "convention-pending",
     note = paste("scipy.stats.skew/kurtosis default to bias=TRUE (g1/g2);",
                  "SPSS reports the sample-adjusted G1/G2. descriptive.ts:71"))

# ------------------------------------------------------------------ crosstabs

crosstab_stats <- function(df, rv, cv, correct) {
  tab <- table(df[[rv]], df[[cv]])
  cs  <- suppressWarnings(chisq.test(tab, correct = correct))
  n   <- sum(tab)
  k   <- min(dim(tab)) - 1
  list(chiSquare = unname(cs$statistic),
       degreesOfFreedom = unname(cs$parameter),
       pValue = cs$p.value,
       cramersV = sqrt(unname(cs$statistic) / (n * k)))
}

crosstab_labels <- function(df, rv, cv) {
  tab <- table(df[[rv]], df[[cv]])
  list(rowLabels = rownames(tab), colLabels = colnames(tab))
}

# One case per claim. Folding the labels in with the statistics would mean a
# single `it.fails` covering both, and a chi-square that drifted while the label
# defect was open would be reported as "still failing" rather than as a new
# failure.

# 3 x 5, from the two discrete attributes of auto-mpg. No continuity correction
# applies in any package above 2 x 2, so this isolates the chi-square arithmetic
# from the Yates question below.
case("crosstabs/auto-mpg/origin-x-cylinders", "auto-mpg", "crosstabs",
     list(rowVariable = "origin", colVariable = "cylinders"),
     crosstab_stats(autompg, "origin", "cylinders", correct = FALSE))

# 2 x 2. Every attribute of the SPECT training split is binary, so this is a
# native 2 x 2 with nothing binned or filtered. scipy applies Yates here by
# default; R and SPSS put the uncorrected Pearson statistic on the primary row.
case("crosstabs/spect/diagnosis-x-f1-pearson-spss", "spect-train", "crosstabs",
     list(rowVariable = "overall_diagnosis", colVariable = "f1"),
     crosstab_stats(spect, "overall_diagnosis", "f1", correct = FALSE),
     status = "convention-pending",
     note = paste("scipy.stats.chi2_contingency defaults to correction=TRUE, so a",
                  "2x2 reports Yates where SPSS reports uncorrected Pearson on the",
                  "primary row. descriptive.ts:88"))

# The Yates value itself, as a check that the corrected arithmetic is right.
case("crosstabs/spect/diagnosis-x-f1-yates", "spect-train", "crosstabs",
     list(rowVariable = "overall_diagnosis", colVariable = "f1"),
     crosstab_stats(spect, "overall_diagnosis", "f1", correct = TRUE))

# Category labels. These are the row and column headers a reader of the crosstab
# sees. They used to carry a trailing ".0" because the bridge marshals every
# numeric column as a Float64Array (bridge/columnar-serializer.ts:49) and an
# integer-coded category therefore arrived in Python as a float; #19 added
# `category_label` to format it the way R and SPSS do.
case("crosstabs/auto-mpg/origin-x-cylinders-labels", "auto-mpg", "crosstabs",
     list(rowVariable = "origin", colVariable = "cylinders"),
     crosstab_labels(autompg, "origin", "cylinders"))

case("crosstabs/spect/diagnosis-x-f1-labels", "spect-train", "crosstabs",
     list(rowVariable = "overall_diagnosis", colVariable = "f1"),
     crosstab_labels(spect, "overall_diagnosis", "f1"))

# ------------------------------------------------------------------- t-tests

ttest_arm <- function(tt, g1, g2) {
  list(tStatistic = unname(tt$statistic),
       degreesOfFreedom = unname(tt$parameter),
       pValue = tt$p.value,
       meanDifference = unname(tt$estimate[1] - tt$estimate[2]),
       confidenceInterval = unname(tt$conf.int[1:2]),
       group1Mean = mean(g1), group1Std = sd(g1), group1N = length(g1),
       group2Mean = mean(g2), group2Std = sd(g2), group2N = length(g2))
}

# Baseline, comfortably away from the variance-equality boundary.
hab_s1 <- haberman$age[haberman$survival_status == 1]
hab_s2 <- haberman$age[haberman$survival_status == 2]
hab_med <- car::leveneTest(age ~ factor(survival_status), data = haberman, center = median)

case("ttest-independent/haberman/age-by-survival", "haberman", "ttestIndependent",
     list(variable = "age", groupVariable = "survival_status",
          group1Value = 1, group2Value = 2),
     list(
       leveneTest = list(statistic = hab_med[1, "F value"],
                         pValue = hab_med[1, "Pr(>F)"],
                         equalVariance = hab_med[1, "Pr(>F)"] > 0.05),
       equalVariance   = ttest_arm(t.test(hab_s1, hab_s2, var.equal = TRUE),  hab_s1, hab_s2),
       unequalVariance = ttest_arm(t.test(hab_s1, hab_s2, var.equal = FALSE), hab_s1, hab_s2)))

# The case where the choice of centre is not cosmetic. Across all six datasets
# here, `proline` between wine cultivars 2 and 3 is the one place where the two
# centres fall on opposite sides of .05 (mean p = .0403, median p = .0824), so
# `equalVariance` - and therefore which of the two t-tests this SDK presents as
# the result - flips with the convention. A suite that only ever tested a
# comfortably non-significant Levene would miss this entirely.
wine_23 <- wine[wine$cultivar %in% c(2, 3), ]
wine_c2 <- wine_23$proline[wine_23$cultivar == 2]
wine_c3 <- wine_23$proline[wine_23$cultivar == 3]
wine_med  <- car::leveneTest(proline ~ factor(cultivar), data = wine_23, center = median)
wine_mean <- car::leveneTest(proline ~ factor(cultivar), data = wine_23, center = mean)

case("ttest-independent/wine/proline-by-cultivar-2v3", "wine", "ttestIndependent",
     list(variable = "proline", groupVariable = "cultivar",
          group1Value = 2, group2Value = 3),
     list(
       leveneTest = list(statistic = wine_med[1, "F value"],
                         pValue = wine_med[1, "Pr(>F)"],
                         equalVariance = wine_med[1, "Pr(>F)"] > 0.05),
       equalVariance   = ttest_arm(t.test(wine_c2, wine_c3, var.equal = TRUE),  wine_c2, wine_c3),
       unequalVariance = ttest_arm(t.test(wine_c2, wine_c3, var.equal = FALSE), wine_c2, wine_c3)))

case("ttest-independent/wine/proline-levene-mean-spss", "wine", "ttestIndependent",
     list(variable = "proline", groupVariable = "cultivar",
          group1Value = 2, group2Value = 3),
     list(leveneTest = list(statistic = wine_mean[1, "F value"],
                            pValue = wine_mean[1, "Pr(>F)"],
                            equalVariance = wine_mean[1, "Pr(>F)"] > 0.05)),
     status = "convention-pending",
     note = paste("scipy.stats.levene defaults to center='median' (Brown-Forsythe);",
                  "SPSS T-TEST centres on the mean. Here that changes the reported",
                  "result: median-centred keeps the equal-variance t-test,",
                  "mean-centred rejects it. compare-means.ts:32-33"))

# Paired. The nine cytological attributes of the Wisconsin data are graded 1-10
# on one scale and measured on the same specimen, so two of them are a genuine
# paired design - not two unrelated columns put side by side.
bcw_pair <- bcw[!is.na(bcw$clump_thickness) & !is.na(bcw$uniformity_cell_size), ]
tt_p <- t.test(bcw_pair$clump_thickness, bcw_pair$uniformity_cell_size, paired = TRUE)
case("ttest-paired/breast-cancer-wisconsin/clump-vs-cell-size",
     "breast-cancer-wisconsin", "ttestPaired",
     list(variable1 = "clump_thickness", variable2 = "uniformity_cell_size"),
     list(tStatistic = unname(tt_p$statistic),
          degreesOfFreedom = unname(tt_p$parameter),
          pValue = tt_p$p.value,
          meanDifference = unname(tt_p$estimate),
          stdDifference = sd(bcw_pair$clump_thickness - bcw_pair$uniformity_cell_size),
          confidenceInterval = unname(tt_p$conf.int[1:2]),
          mean1 = mean(bcw_pair$clump_thickness),
          mean2 = mean(bcw_pair$uniformity_cell_size),
          n = nrow(bcw_pair)))

# --------------------------------------------------------------------- ANOVA

fit_aov <- aov(sepal_length ~ factor(species), data = iris_df)
s_aov   <- summary(fit_aov)[[1]]
ssb <- s_aov[["Sum Sq"]][1]; ssw <- s_aov[["Sum Sq"]][2]

case("anova-oneway/iris/sepal-length-by-species", "iris", "anovaOneway",
     list(variable = "sepal_length", groupVariable = "species"),
     list(fStatistic = s_aov[["F value"]][1],
          pValue = s_aov[["Pr(>F)"]][1],
          degreesOfFreedomBetween = s_aov[["Df"]][1],
          degreesOfFreedomWithin = s_aov[["Df"]][2],
          sumOfSquaresBetween = ssb, sumOfSquaresWithin = ssw,
          meanSquareBetween = s_aov[["Mean Sq"]][1],
          meanSquareWithin = s_aov[["Mean Sq"]][2],
          etaSquared = ssb / (ssb + ssw),
          groupStats = lapply(sort(unique(iris_df$species)), function(g) {
            x <- iris_df$sepal_length[iris_df$species == g]
            list(group = g, n = length(x), mean = mean(x), std = sd(x))
          })))

# Tukey. R labels a contrast "b-a" and reports b - a; statsmodels orders the pair
# the same way (lexicographic), so the sign convention lines up. The test matches
# on the pair rather than on position all the same.
#
# This is where the cross-check earned its keep. `posthocTukey` used to read
# `pairwise_tukeyhsd(...).summary().data`, statsmodels' *display* table, which is
# formatted to four decimals; every value it returned was truncated and a p-value
# small enough to print as 0.0000 came back as exactly 0. That is the same class
# of defect as #12, and removing the explicit `round(x, 6)` calls did not reach
# it, because the rounding belonged to the object being read rather than to our
# own code. #18 switched the extraction to `meandiffs`, `pvalues`, `confint` and
# `reject`, which carry the unrounded quantities.
tuk <- TukeyHSD(fit_aov)[["factor(species)"]]
case("posthoc-tukey/iris/sepal-length-by-species", "iris", "posthocTukey",
     list(variable = "sepal_length", groupVariable = "species", alpha = 0.05),
     list(comparisons = lapply(rownames(tuk), function(rn) {
       # A contrast is named "<later>-<earlier>", and the level names themselves
       # contain hyphens here ("Iris-setosa"), so the name cannot be split on the
       # separator. Match the known levels instead.
       levels_ <- sort(unique(iris_df$species))
       later <- levels_[vapply(levels_, function(l)
         startsWith(rn, paste0(l, "-")) && substring(rn, nchar(l) + 2) %in% levels_,
         logical(1))][1]
       earlier <- substring(rn, nchar(later) + 2)
       list(group1 = earlier, group2 = later,
            meanDifference = unname(tuk[rn, "diff"]),
            lowerCI = unname(tuk[rn, "lwr"]), upperCI = unname(tuk[rn, "upr"]),
            pValue = unname(tuk[rn, "p adj"]))
     })),
     # The absolute leg is for the p-values only. statsmodels reaches the
     # studentized range distribution through `psturng` and R through `ptukey`,
     # two different implementations, and they diverge in the far tail: the three
     # certified-small p-values here are 2.2e-14, 2.4e-14 and 8.3e-9, and the
     # absolute gaps are 1.9e-14, 9.7e-15 and 3.4e-15 - at the double-precision
     # floor for quantities that size. This is not output rounding (#18 fixed
     # that; the mean differences and all six confidence bounds now agree to
     # better than 1e-9) and not a defect in either package.
     #
     # 1e-13 absolute is *tighter* than the relative leg for every quantity
     # above about 1e-4, because expectCloseTo accepts either bound: at 0.686 a
     # 1e-9 relative bound already allows 6.9e-10. So this loosens nothing
     # except the tail it is aimed at.
     tolerance = list(relative = 1e-9, absolute = 1e-13))

# -------------------------------------------------------- linear regression
#
# auto-mpg has 6 missing `horsepower` values, so this also checks that all three
# packages drop the same 6 cases: R's `lm` is listwise by default, SPSS's
# REGRESSION is told /MISSING=LISTWISE, and the Python layer drops rows with any
# NA among the model's variables. n = 392 rather than 398 everywhere, or the
# comparison fails on `observations` before it reaches a coefficient.

lm_fit <- lm(mpg ~ weight + horsepower + displacement, data = autompg)
lm_s   <- summary(lm_fit)
lm_ci  <- confint(lm_fit)
f      <- lm_s$fstatistic

lm_coefficients <- function(fields) {
  lapply(rownames(lm_s$coefficients), function(v) {
    full <- list(variable = if (v == "(Intercept)") "const" else v,
                 coefficient = unname(lm_s$coefficients[v, 1]),
                 stdError = unname(lm_s$coefficients[v, 2]),
                 tStatistic = unname(lm_s$coefficients[v, 3]),
                 pValue = unname(lm_s$coefficients[v, 4]),
                 confidenceInterval = unname(lm_ci[v, 1:2]))
    full[fields]
  })
}

case("linear-regression/auto-mpg/mpg~weight+hp+displacement", "auto-mpg", "linearRegression",
     list(dependentVariable = "mpg",
          independentVariables = c("weight", "horsepower", "displacement"),
          method = "enter"),
     list(rSquared = lm_s$r.squared,
          adjustedRSquared = lm_s$adj.r.squared,
          residualStdError = lm_s$sigma,
          fStatistic = unname(f[1]),
          fPValue = unname(pf(f[1], f[2], f[3], lower.tail = FALSE)),
          observations = nobs(lm_fit),
          degreesOfFreedom = lm_fit$df.residual,
          durbinWatson = unname(car::durbinWatsonTest(lm_fit)$dw),
          coefficients = lm_coefficients(c("variable", "coefficient", "stdError",
                                           "tStatistic", "pValue",
                                           "confidenceInterval"))))

# The same model with `method` left unset. This SDK then defaults to stepwise and
# fits whatever subset passes its entry criterion, so it answers a question that
# was not asked (#13). SPSS's REGRESSION defaults to METHOD=ENTER and R's `lm`
# has no selection at all, which is why the default is the defect: the two cases
# differ only in that one field.
case("linear-regression/auto-mpg/default-method", "auto-mpg", "linearRegression",
     list(dependentVariable = "mpg",
          independentVariables = c("weight", "horsepower", "displacement")),
     list(coefficients = lm_coefficients(c("variable", "coefficient", "stdError"))),
     status = "known-defect",
     note = "#13 - linearRegression defaults to stepwise and drops requested predictors")

# ------------------------------------------------------- logistic regression
#
# `confint.default`, not `confint`: the Wald interval statsmodels' `conf_int()`
# and SPSS both report. R's `confint.glm` would give a profile-likelihood
# interval, which is a different quantity and would fail for the right reason in
# the wrong place.

logistic_expected <- function(fit, n, k) {
  s  <- summary(fit)
  ci <- confint.default(fit)
  ll_full <- as.numeric(logLik(fit))
  ll_null <- as.numeric(logLik(update(fit, . ~ 1)))
  list(logLikelihood = ll_full,
       aic = AIC(fit), bic = BIC(fit),
       observations = n,
       # statsmodels' `prsquared`, which this SDK returns as `pseudoRSquared`, is
       # McFadden's. SPSS prints Cox & Snell and Nagelkerke and no McFadden
       # column at all, so the two cannot be compared value-for-value; the note
       # carries the SPSS pair so the README contract can name what we return.
       pseudoRSquared = 1 - ll_full / ll_null,
       llrPValue = pchisq(2 * (ll_full - ll_null), df = k, lower.tail = FALSE),
       coefficients = lapply(rownames(s$coefficients), function(v) {
         list(variable = if (v == "(Intercept)") "const" else v,
              coefficient = unname(s$coefficients[v, 1]),
              stdError = unname(s$coefficients[v, 2]),
              zStatistic = unname(s$coefficients[v, 3]),
              pValue = unname(s$coefficients[v, 4]),
              oddsRatio = exp(unname(s$coefficients[v, 1])),
              confidenceInterval = unname(ci[v, 1:2]))
       }))
}

spss_pseudo_note <- function(fit, n) {
  ll_full <- as.numeric(logLik(fit))
  ll_null <- as.numeric(logLik(update(fit, . ~ 1)))
  cox <- 1 - exp(2 * (ll_null - ll_full) / n)
  sprintf(paste("pseudoRSquared is McFadden's (statsmodels prsquared).",
                "SPSS prints Cox & Snell %.6f and Nagelkerke %.6f instead."),
          cox, cox / (1 - exp(2 * ll_null / n)))
}

# A 0/1-coded outcome, which is what statsmodels' Logit expects.
spect_fit <- glm(overall_diagnosis ~ f1 + f2, data = spect, family = binomial())
case("logistic-binary/spect/diagnosis~f1+f2", "spect-train", "logisticBinary",
     list(dependentVariable = "overall_diagnosis",
          independentVariables = c("f1", "f2")),
     logistic_expected(spect_fit, nrow(spect), 2),
     # R fits by IRLS with `epsilon = 1e-8` on the relative deviance change;
     # statsmodels fits by Newton-Raphson to its own tolerance. Neither stops at
     # the exact maximum, so the two land a convergence threshold apart rather
     # than a rounding error apart. A confidence bound is the worst of them
     # because it is coefficient +/- 1.96 * se and carries both errors. 1e-5
     # keeps headroom over that without reaching any reporting convention. The
     # absolute leg carries the bounds that straddle zero, where a relative
     # error is inflated by the small denominator rather than by the fit: the
     # worst quantity here is a confidence bound of -0.087, off by 4.9e-7.
     tolerance = list(relative = 1e-5, absolute = 1e-5),
     note = spss_pseudo_note(spect_fit, nrow(spect)))

# A 1/2-coded outcome, which is how survey and registry data normally arrive -
# Haberman's `survival_status` is 1 = survived, 2 = died. SPSS LOGISTIC
# REGRESSION and R's `glm(factor(y) ~ .)` both accept any two-valued outcome and
# model the higher value as the event; the reference here is that fit.
#
# This SDK used to produce no result at all: the Python layer coerced the column
# with `pd.to_numeric` and handed it to `sm.Logit`, which rejected it with
# `ValueError: endog must be in the unit interval.` #20 encodes the higher of the
# two observed values as the event and reports the encoding, so the case now also
# checks `eventValue` and `referenceValue`.
hab_fit <- glm(factor(survival_status) ~ age + positive_nodes,
               data = haberman, family = binomial())
case("logistic-binary/haberman/survival~age+nodes", "haberman", "logisticBinary",
     list(dependentVariable = "survival_status",
          independentVariables = c("age", "positive_nodes")),
     c(logistic_expected(hab_fit, nrow(haberman), 2),
       list(eventValue = 2, referenceValue = 1)),
     tolerance = list(relative = 1e-5, absolute = 1e-5),
     note = spss_pseudo_note(hab_fit, nrow(haberman)))

# ------------------------------------------------------------------- reliability
#
# The nine cytological attributes, all graded 1-10. `bare_nuclei` has 16 missing
# values, so listwise deletion takes n from 699 to 683 - which is the point of
# including them: `caseProcessing` has to report the same split.

items <- c("clump_thickness", "uniformity_cell_size", "uniformity_cell_shape",
           "marginal_adhesion", "epithelial_cell_size", "bare_nuclei",
           "bland_chromatin", "normal_nucleoli", "mitoses")
complete <- bcw[stats::complete.cases(bcw[items]), items]
X <- as.matrix(complete)
k <- length(items)
total <- rowSums(X)
alpha_of <- function(M) {
  kk <- ncol(M)
  (kk / (kk - 1)) * (1 - sum(apply(M, 2, var)) / var(rowSums(M)))
}
corr <- cor(X)
mean_r <- (sum(corr) - k) / (k * (k - 1))

case("cronbach-alpha/breast-cancer-wisconsin/nine-items",
     "breast-cancer-wisconsin", "cronbachAlpha",
     list(items = items),
     list(alpha = alpha_of(X),
          standardizedAlpha = (k * mean_r) / (1 + (k - 1) * mean_r),
          interItemCorrelationMean = mean_r,
          nItems = k, nObservations = nrow(X),
          caseProcessing = list(valid = nrow(X),
                                excluded = nrow(bcw) - nrow(X),
                                total = nrow(bcw)),
          scaleStatistics = list(nItems = k, mean = mean(total), std = sd(total),
                                 minimum = min(total), maximum = max(total)),
          itemAnalysis = lapply(items, function(it) {
            rest <- rowSums(X[, setdiff(items, it), drop = FALSE])
            list(item = it,
                 itemMean = mean(X[, it]), itemStd = sd(X[, it]),
                 scaleMeanIfItemDeleted = mean(rest),
                 scaleStdIfItemDeleted = sd(rest),
                 correctedItemTotalCorrelation = cor(X[, it], rest),
                 alphaIfItemDeleted = alpha_of(X[, setdiff(items, it), drop = FALSE]))
          })))

# ------------------------------------------------------------------- emit

fixture <- list(
  source = R.version.string,
  generatedAt = format(Sys.Date(), "%Y-%m-%d"),
  generator = "scripts/generate-r-reference.R",
  # The default, for procedures with a closed-form solution: R and this SDK run
  # the same estimator on the same bytes, so what separates them is
  # floating-point association order, and the NIST work showed this codebase
  # holds nine digits on well-conditioned problems. Iteratively fitted models
  # override it per case.
  tolerance = list(relative = 1e-9),
  cases = cases
)

# digits = NA writes the shortest decimal that round-trips the double, so the
# fixture carries the full value rather than a 7-digit print of it.
write(toJSON(fixture, auto_unbox = TRUE, digits = NA, null = "null",
             na = "null", pretty = 2), OUT)

cat(sprintf("%d cases -> %s\n", length(cases), OUT))
for (cse in cases) {
  cat(sprintf("  %-20s %s\n",
              if (cse$status == "check") "" else paste0("[", cse$status, "]"),
              cse$id))
}
