#!/usr/bin/env Rscript
#
# Writes the shared cross-check input to e2e/fixtures/cross-check/data/*.csv.
#
# These six tables ship with R under GPL-2 and are the canonical examples in its
# own documentation, so they are redistributable and already familiar. All three
# of this SDK, R and SPSS read *these* files rather than their own copy of the
# data, so no comparison can be confounded by a differently-rounded input.
#
# Written with 17 significant digits: a double round-trips exactly at 17, and the
# point of the exercise is to compare arithmetic, not parsers.
#
# Run once. Re-running must be a no-op; if it is not, the data changed and every
# committed reference value is stale.

suppressPackageStartupMessages(library(datasets))

out_dir <- file.path("e2e", "fixtures", "cross-check", "data")
dir.create(out_dir, recursive = TRUE, showWarnings = FALSE)

write_fixture <- function(name, df) {
  # Row names carry the case label in mtcars and USArrests; SPSS has no notion of
  # them, so promote to an ordinary first column where they are not just 1..n.
  if (!identical(rownames(df), as.character(seq_len(nrow(df))))) {
    df <- cbind(case = rownames(df), df)
  }
  path <- file.path(out_dir, paste0(name, ".csv"))
  utils::write.csv(df, path, row.names = FALSE, quote = TRUE, na = "")
  cat(sprintf("%-12s %3d x %2d  %s\n", name, nrow(df), ncol(df), path))
}

old <- options(digits = 17, scipen = 100)
on.exit(options(old))

write_fixture("iris", iris)
write_fixture("ToothGrowth", ToothGrowth)
# `sleep` ships long (one row per observation). `ttestPaired` — like SPSS's
# T-TEST PAIRS and R's t.test(paired = TRUE) on two vectors — takes the pair in
# one row, so reshape to wide here rather than in three places downstream.
sleep_wide <- data.frame(
  ID     = levels(sleep$ID),
  drug1  = sleep$extra[sleep$group == "1"][order(sleep$ID[sleep$group == "1"])],
  drug2  = sleep$extra[sleep$group == "2"][order(sleep$ID[sleep$group == "2"])]
)
write_fixture("sleep", sleep_wide)
write_fixture("mtcars", mtcars)
write_fixture("attitude", attitude)
write_fixture("USArrests", USArrests)
