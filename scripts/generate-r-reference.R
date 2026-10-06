#!/usr/bin/env Rscript
#
# Generates e2e/fixtures/cross-check/r-reference.json: for each case, what R
# reports for the same procedure on the same CSV this SDK is given.
#
# Reading the committed CSVs rather than R's in-memory datasets is deliberate —
# it is the same bytes the browser test loads, so a disagreement cannot be an
# artefact of two different copies of the input.
#
# Three kinds of case come out of here, distinguished by `status`:
#
#   check                 R and this SDK should agree to 1e-9. A failure is a defect.
#   known-defect          A filed issue already explains the disagreement.
#   convention-pending    Both are right for their own definition of the statistic;
#                         which one this SDK should follow is not yet decided.
#
# The last two run as `it.fails` in the test, so the divergence stays executable
# instead of being absorbed into a looser tolerance. See
# docs/validation/cross-check-r-spss.md.
#
# Usage: Rscript scripts/generate-r-reference.R
# Needs: jsonlite, psych, e1071, car  (Debian: r-cran-{jsonlite,psych,e1071,car})

suppressPackageStartupMessages({
  library(jsonlite)
  library(e1071)
  library(car)
  library(psych)
})

DATA_DIR <- file.path("e2e", "fixtures", "cross-check", "data")
OUT      <- file.path("e2e", "fixtures", "cross-check", "r-reference.json")

read_fixture <- function(name) {
  read.csv(file.path(DATA_DIR, paste0(name, ".csv")),
           stringsAsFactors = FALSE, check.names = FALSE)
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

# ---------------------------------------------------------------- descriptives

usarrests <- read_fixture("USArrests")
vars <- c("Murder", "Assault", "UrbanPop", "Rape")

# `quantile(type = 7)` is R's default and pandas' `describe()` interpolation, so
# the quartiles are directly comparable; `sd()` and `var(ddof = 1)` likewise.
moment_stats <- function(df, vars, skew_type, kurt_type) {
  lapply(vars, function(v) {
    x <- df[[v]]
    q <- unname(quantile(x, c(.25, .5, .75), type = 7))
    list(variable = v, count = length(x), mean = mean(x), std = sd(x),
         min = min(x), max = max(x), q25 = q[1], q50 = q[2], q75 = q[3],
         skewness = e1071::skewness(x, type = skew_type),
         kurtosis = e1071::kurtosis(x, type = kurt_type))
  })
}

# type = 1 is the plain moment ratio g1/g2, which is what scipy returns with its
# default bias = TRUE — what this SDK calls today.
case("descriptives/USArrests/moments-g", "USArrests", "descriptives",
     list(variables = vars),
     list(statistics = moment_stats(usarrests, vars, 1, 1)))

# type = 2 is G1/G2, the sample-adjusted form SPSS DESCRIPTIVES prints and the
# one a reader of a paper will have in front of them. Only the two moment fields
# differ between this case and the one above.
case("descriptives/USArrests/moments-G-spss", "USArrests", "descriptives",
     list(variables = vars),
     list(statistics = moment_stats(usarrests, vars, 2, 2)),
     status = "convention-pending",
     note = paste("scipy.stats.skew/kurtosis default to bias=TRUE (g1/g2);",
                  "SPSS reports the sample-adjusted G1/G2. descriptive.ts:71"))

# ------------------------------------------------------------------ crosstabs

tooth <- read_fixture("ToothGrowth")
mtcars_df <- read_fixture("mtcars")

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

# 2 x 3: no continuity correction applies in either package, so this isolates the
# chi-square arithmetic from the Yates question below.
case("crosstabs/ToothGrowth/supp-x-dose", "ToothGrowth", "crosstabs",
     list(rowVariable = "supp", colVariable = "dose"),
     crosstab_stats(tooth, "supp", "dose", correct = FALSE))

# 2 x 2: scipy applies Yates by default, R and SPSS do not on the primary row.
case("crosstabs/mtcars/am-x-vs-pearson-spss", "mtcars", "crosstabs",
     list(rowVariable = "am", colVariable = "vs"),
     crosstab_stats(mtcars_df, "am", "vs", correct = FALSE),
     status = "convention-pending",
     note = paste("scipy.stats.chi2_contingency defaults to correction=TRUE, so a",
                  "2x2 reports Yates where SPSS reports uncorrected Pearson on the",
                  "primary row. descriptive.ts:88"))

# The Yates value itself, as a check that the corrected arithmetic is right.
case("crosstabs/mtcars/am-x-vs-yates", "mtcars", "crosstabs",
     list(rowVariable = "am", colVariable = "vs"),
     crosstab_stats(mtcars_df, "am", "vs", correct = TRUE))

# Category labels. `str()` on a float category yields "1.0" where R and SPSS both
# print "1" - the labels are what a reader of the crosstab sees, so this is a
# presentation defect rather than a convention difference. descriptive.ts:98-99.
case("crosstabs/ToothGrowth/supp-x-dose-labels", "ToothGrowth", "crosstabs",
     list(rowVariable = "supp", colVariable = "dose"),
     crosstab_labels(tooth, "supp", "dose"),
     status = "known-defect",
     note = paste("numeric categories are labelled '1.0' where R and SPSS label",
                  "them '1'; crosstab row/column headers only"))

case("crosstabs/mtcars/am-x-vs-labels", "mtcars", "crosstabs",
     list(rowVariable = "am", colVariable = "vs"),
     crosstab_labels(mtcars_df, "am", "vs"),
     status = "known-defect",
     note = paste("numeric categories are labelled '0.0'/'1.0' where R and SPSS",
                  "label them '0'/'1'"))

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

g_oj <- tooth$len[tooth$supp == "OJ"]
g_vc <- tooth$len[tooth$supp == "VC"]
lev_med  <- car::leveneTest(len ~ factor(supp), data = tooth, center = median)
lev_mean <- car::leveneTest(len ~ factor(supp), data = tooth, center = mean)

# scipy.stats.levene centres on the median (Brown-Forsythe) by default.
case("ttest-independent/ToothGrowth/len-by-supp", "ToothGrowth", "ttestIndependent",
     list(variable = "len", groupVariable = "supp",
          group1Value = "OJ", group2Value = "VC"),
     list(
       leveneTest = list(statistic = lev_med[1, "F value"], pValue = lev_med[1, "Pr(>F)"]),
       equalVariance   = ttest_arm(t.test(g_oj, g_vc, var.equal = TRUE),  g_oj, g_vc),
       unequalVariance = ttest_arm(t.test(g_oj, g_vc, var.equal = FALSE), g_oj, g_vc)))

# SPSS centres Levene on the mean. This is the consequential one: `equalVariance`
# is selected from `levene_p > 0.05` (compare-means.ts:33), so the choice of
# centre can change which t-test is reported, not only an auxiliary number.
case("ttest-independent/ToothGrowth/levene-mean-spss", "ToothGrowth", "ttestIndependent",
     list(variable = "len", groupVariable = "supp",
          group1Value = "OJ", group2Value = "VC"),
     list(leveneTest = list(statistic = lev_mean[1, "F value"],
                            pValue = lev_mean[1, "Pr(>F)"])),
     status = "convention-pending",
     note = paste("scipy.stats.levene defaults to center='median' (Brown-Forsythe);",
                  "SPSS T-TEST centres on the mean. compare-means.ts:32"))

# A case where the choice of centre is not cosmetic. On `hp ~ vs` the two
# centres fall on opposite sides of .05 (mean p = .0244, median p = .0526), so
# `equalVariance` - and therefore which of the two t-tests this SDK presents as
# the result - flips with the convention. Any suite that only ever tested a
# comfortably non-significant Levene would miss this entirely.
hp_v0 <- mtcars_df$hp[mtcars_df$vs == 0]
hp_v1 <- mtcars_df$hp[mtcars_df$vs == 1]
hp_med  <- car::leveneTest(hp ~ factor(vs), data = mtcars_df, center = median)
hp_mean <- car::leveneTest(hp ~ factor(vs), data = mtcars_df, center = mean)

case("ttest-independent/mtcars/hp-by-vs", "mtcars", "ttestIndependent",
     list(variable = "hp", groupVariable = "vs", group1Value = 0, group2Value = 1),
     list(
       leveneTest = list(statistic = hp_med[1, "F value"],
                         pValue = hp_med[1, "Pr(>F)"],
                         equalVariance = hp_med[1, "Pr(>F)"] > 0.05),
       equalVariance   = ttest_arm(t.test(hp_v0, hp_v1, var.equal = TRUE),  hp_v0, hp_v1),
       unequalVariance = ttest_arm(t.test(hp_v0, hp_v1, var.equal = FALSE), hp_v0, hp_v1)))

case("ttest-independent/mtcars/hp-by-vs-levene-mean-spss", "mtcars", "ttestIndependent",
     list(variable = "hp", groupVariable = "vs", group1Value = 0, group2Value = 1),
     list(leveneTest = list(statistic = hp_mean[1, "F value"],
                            pValue = hp_mean[1, "Pr(>F)"],
                            equalVariance = hp_mean[1, "Pr(>F)"] > 0.05)),
     status = "convention-pending",
     note = paste("Same centre question as above, but here it changes the reported",
                  "result: median-centred Levene keeps the equal-variance t-test,",
                  "mean-centred (SPSS) rejects it. compare-means.ts:32-33"))

sleep_df <- read_fixture("sleep")
tt_p <- t.test(sleep_df$drug1, sleep_df$drug2, paired = TRUE)
case("ttest-paired/sleep/drug1-vs-drug2", "sleep", "ttestPaired",
     list(variable1 = "drug1", variable2 = "drug2"),
     list(tStatistic = unname(tt_p$statistic),
          degreesOfFreedom = unname(tt_p$parameter),
          pValue = tt_p$p.value,
          meanDifference = unname(tt_p$estimate),
          stdDifference = sd(sleep_df$drug1 - sleep_df$drug2),
          confidenceInterval = unname(tt_p$conf.int[1:2]),
          mean1 = mean(sleep_df$drug1), mean2 = mean(sleep_df$drug2),
          n = nrow(sleep_df)))

# --------------------------------------------------------------------- ANOVA

iris_df <- read_fixture("iris")
fit_aov <- aov(Sepal.Length ~ factor(Species), data = iris_df)
s_aov   <- summary(fit_aov)[[1]]
ssb <- s_aov[["Sum Sq"]][1]; ssw <- s_aov[["Sum Sq"]][2]

case("anova-oneway/iris/SepalLength-by-Species", "iris", "anovaOneway",
     list(variable = "Sepal.Length", groupVariable = "Species"),
     list(fStatistic = s_aov[["F value"]][1],
          pValue = s_aov[["Pr(>F)"]][1],
          degreesOfFreedomBetween = s_aov[["Df"]][1],
          degreesOfFreedomWithin = s_aov[["Df"]][2],
          sumOfSquaresBetween = ssb, sumOfSquaresWithin = ssw,
          meanSquareBetween = s_aov[["Mean Sq"]][1],
          meanSquareWithin = s_aov[["Mean Sq"]][2],
          etaSquared = ssb / (ssb + ssw),
          groupStats = lapply(sort(unique(iris_df$Species)), function(g) {
            x <- iris_df$Sepal.Length[iris_df$Species == g]
            list(group = g, n = length(x), mean = mean(x), std = sd(x))
          })))

# Tukey. R labels a contrast "b-a" and reports b - a; statsmodels orders the pair
# the same way (lexicographic), so the sign convention lines up. The test matches
# on the pair rather than on position all the same.
#
# This is where the cross-check earned its keep: `posthocTukey` reads
# `pairwise_tukeyhsd(...).summary().data`, statsmodels' *display* table, which is
# formatted to four decimals. Every number it returns - mean difference, p-value,
# both confidence bounds - is therefore truncated. It is the same class of defect
# as #12 (output rounded before leaving Python), and removing the explicit
# `round(x, 6)` calls did not reach it, because here the rounding belongs to the
# object being read rather than to our own code. The unrounded values are on the
# result itself: `meandiffs`, `pvalues`, `confint`, `reject`.
tuk <- TukeyHSD(fit_aov)[["factor(Species)"]]
case("posthoc-tukey/iris/SepalLength-by-Species", "iris", "posthocTukey",
     list(variable = "Sepal.Length", groupVariable = "Species", alpha = 0.05),
     list(comparisons = lapply(rownames(tuk), function(rn) {
       parts <- strsplit(rn, "-", fixed = TRUE)[[1]]
       list(group1 = parts[2], group2 = parts[1],
            meanDifference = unname(tuk[rn, "diff"]),
            lowerCI = unname(tuk[rn, "lwr"]), upperCI = unname(tuk[rn, "upr"]),
            pValue = unname(tuk[rn, "p adj"]))
     })),
     status = "known-defect",
     note = paste("posthocTukey reads statsmodels' summary() display table, which",
                  "is formatted to 4 decimals, so every value is truncated.",
                  "Same class as #12. compare-means.ts:199-206"))

# -------------------------------------------------------- linear regression

# METHOD=ENTER: all three predictors, in the order given.
lm_fit <- lm(mpg ~ wt + hp + disp, data = mtcars_df)
lm_s   <- summary(lm_fit)
lm_ci  <- confint(lm_fit)
f      <- lm_s$fstatistic

case("linear-regression/mtcars/mpg~wt+hp+disp", "mtcars", "linearRegression",
     list(dependentVariable = "mpg",
          independentVariables = c("wt", "hp", "disp"),
          method = "enter"),
     list(rSquared = lm_s$r.squared,
          adjustedRSquared = lm_s$adj.r.squared,
          residualStdError = lm_s$sigma,
          fStatistic = unname(f[1]),
          fPValue = unname(pf(f[1], f[2], f[3], lower.tail = FALSE)),
          observations = nrow(mtcars_df),
          degreesOfFreedom = lm_fit$df.residual,
          durbinWatson = unname(car::durbinWatsonTest(lm_fit)$dw),
          coefficients = lapply(rownames(lm_s$coefficients), function(v) {
            list(variable = if (v == "(Intercept)") "const" else v,
                 coefficient = unname(lm_s$coefficients[v, 1]),
                 stdError = unname(lm_s$coefficients[v, 2]),
                 tStatistic = unname(lm_s$coefficients[v, 3]),
                 pValue = unname(lm_s$coefficients[v, 4]),
                 confidenceInterval = unname(lm_ci[v, 1:2]))
          })))

# The same model with `method` left unset. This SDK then defaults to stepwise and
# fits whatever subset passes its entry criterion, so it answers a question that
# was not asked (#13). SPSS's REGRESSION defaults to METHOD=ENTER and R's `lm`
# has no selection at all, which is why the default is the defect: the two cases
# differ only in that one field.
case("linear-regression/mtcars/mpg~wt+hp+disp-default-method", "mtcars", "linearRegression",
     list(dependentVariable = "mpg",
          independentVariables = c("wt", "hp", "disp")),
     list(coefficients = lapply(rownames(lm_s$coefficients), function(v) {
       list(variable = if (v == "(Intercept)") "const" else v,
            coefficient = unname(lm_s$coefficients[v, 1]),
            stdError = unname(lm_s$coefficients[v, 2]))
     })),
     status = "known-defect",
     note = "#13 - linearRegression defaults to stepwise and drops requested predictors")

# ------------------------------------------------------- logistic regression

# `confint.default`, not `confint`: the Wald interval statsmodels' `conf_int()`
# and SPSS both report. R's `confint.glm` would give a profile-likelihood
# interval, which is a different quantity and would fail for the right reason in
# the wrong place.
glm_fit <- glm(am ~ wt + hp, data = mtcars_df, family = binomial())
glm_s   <- summary(glm_fit)
glm_ci  <- confint.default(glm_fit)
ll_null <- as.numeric(logLik(update(glm_fit, . ~ 1)))
ll_full <- as.numeric(logLik(glm_fit))
n_glm      <- nrow(mtcars_df)
cox_snell  <- 1 - exp(2 * (ll_null - ll_full) / n_glm)
nagelkerke <- cox_snell / (1 - exp(2 * ll_null / n_glm))

case("logistic-binary/mtcars/am~wt+hp", "mtcars", "logisticBinary",
     list(dependentVariable = "am", independentVariables = c("wt", "hp")),
     list(logLikelihood = ll_full,
          aic = AIC(glm_fit), bic = BIC(glm_fit),
          observations = nrow(mtcars_df),
          # statsmodels' `prsquared`, which this SDK returns as `pseudoRSquared`,
          # is McFadden's. SPSS prints Cox & Snell and Nagelkerke and no McFadden
          # column at all, so the two cannot be compared value-for-value; the note
          # carries the SPSS pair so the README contract can name what we return.
          pseudoRSquared = 1 - ll_full / ll_null,
          llrPValue = pchisq(2 * (ll_full - ll_null), df = 2, lower.tail = FALSE),
          coefficients = lapply(rownames(glm_s$coefficients), function(v) {
            list(variable = if (v == "(Intercept)") "const" else v,
                 coefficient = unname(glm_s$coefficients[v, 1]),
                 stdError = unname(glm_s$coefficients[v, 2]),
                 zStatistic = unname(glm_s$coefficients[v, 3]),
                 pValue = unname(glm_s$coefficients[v, 4]),
                 oddsRatio = exp(unname(glm_s$coefficients[v, 1])),
                 confidenceInterval = unname(glm_ci[v, 1:2]))
          })),
     # R fits by IRLS with `epsilon = 1e-8` on the relative deviance change;
     # statsmodels fits by Newton-Raphson to its own tolerance. Neither is the
     # exact maximum, so the two land a convergence threshold apart rather than a
     # rounding error apart - measured worst case here is 4.9e-8, on the
     # intercept standard error, which is the most ill-conditioned entry of the
     # covariance matrix. 1e-6 is three orders tighter than any reporting
     # convention needs and does not depend on either solver's stopping rule.
     tolerance = list(relative = 1e-6),
     note = sprintf(paste("pseudoRSquared is McFadden's (statsmodels prsquared).",
                          "SPSS prints Cox & Snell %.6f and Nagelkerke %.6f instead."),
                    cox_snell, nagelkerke))

# ------------------------------------------------------------------- reliability

attitude_df <- read_fixture("attitude")
items <- names(attitude_df)
X <- as.matrix(attitude_df[items])
k <- length(items)
total <- rowSums(X)
alpha_of <- function(M) {
  kk <- ncol(M)
  (kk / (kk - 1)) * (1 - sum(apply(M, 2, var)) / var(rowSums(M)))
}
corr <- cor(X)
mean_r <- (sum(corr) - k) / (k * (k - 1))

case("cronbach-alpha/attitude/all-items", "attitude", "cronbachAlpha",
     list(items = items),
     list(alpha = alpha_of(X),
          standardizedAlpha = (k * mean_r) / (1 + (k - 1) * mean_r),
          interItemCorrelationMean = mean_r,
          nItems = k, nObservations = nrow(X),
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
