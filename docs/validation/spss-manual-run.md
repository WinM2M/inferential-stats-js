# Producing the SPSS reference values

Tier 3 of the validation suite (see `cross-check-r-spss.md`) is the one part that
cannot be automated: IBM SPSS Statistics is proprietary and has no redistributable
runtime, so no CI job can produce its output. Instead a licence holder runs one
syntax file once, and the result is frozen into a committed fixture that everyone
else's test run reads.

This is the whole procedure. It takes a few minutes and needs doing again only
when a case is added or an SPSS release changes a documented default.

## What you need

- IBM SPSS Statistics, any licensed edition, version 25 or later.
- A checkout of this repository.
- `e2e/fixtures/cross-check/data/*.csv` present. They are committed; if they are
  not there, run `Rscript scripts/export-cross-check-data.R`.

## Steps

1. Open `scripts/spss/cross-check.sps` in the SPSS Syntax Editor.

2. Edit the two paths at the top, and nothing else:

   ```spss
   DEFINE !DATA () '/path/to/inferential-stats-js/e2e/fixtures/cross-check/data' !ENDDEFINE.
   DEFINE !OUT  () '/path/to/spss-cross-check-output.xml' !ENDDEFINE.
   ```

   `!DATA` is the directory holding the six CSVs. `!OUT` is where the machine-
   readable output is written — anywhere you can find it; it does not go in the
   repository.

   On Windows, forward slashes work in SPSS syntax and avoid the escaping
   question entirely: `'C:/Users/you/inferential-stats-js/e2e/fixtures/cross-check/data'`.

3. Run the whole file: **Run → All**.

4. Two things to check before sending anything back.

   - The Output Viewer shows tables and **no red error text**. A path typo
     surfaces here as a file-not-found on the first `GET DATA`.
   - The file at `!OUT` exists and is more than a few kilobytes.

5. Note the version string. The last command is `SHOW LICENSE`, and the Output
   Viewer header also carries it (for example `IBM SPSS Statistics 29.0.1.0`).
   It goes into the fixture's `source` field, so a disagreement years from now
   can be traced to a build rather than to "SPSS".

6. Send back the XML file from `!OUT`, plus that version string.

That is everything. The import side — turning the XML into
`e2e/fixtures/cross-check/spss-reference.json` — happens in the repository and
needs no SPSS.

## Why OXML and not a copied pivot table

The syntax routes output through OMS to OXML rather than asking anyone to read
numbers off the screen, for two reasons.

A pivot table prints three decimals by default. Transcribing from it caps the
achievable agreement at about 5e-4 regardless of how exactly SPSS computed the
value, which turns a sharp comparison into a blunt one. OXML keeps the unrounded
double in each cell's `number` attribute next to the formatted `text`, so the
reference value arrives at full precision and the tolerance can be set by the
arithmetic rather than by the display.

The second reason is that transcription is a step where a human can silently
introduce the error the suite exists to detect.

## If a procedure errors out

The likely causes, in order:

- **Path.** `!DATA` must be the directory, with no trailing slash. The first
  `GET DATA` is the one that fails.
- **Decimal comma.** On a locale where SPSS writes decimals with a comma, add
  `SET DECIMAL=DOT.` as the first line. The CSVs use a dot, and `GET DATA` reads
  them under the session's decimal setting.
- **A procedure your licence does not include.** `REGRESSION`, `LOGISTIC
  REGRESSION`, `ONEWAY`, `RELIABILITY`, `CROSSTABS` and `T-TEST` are all in
  Statistics Base. If one is unavailable, comment out that block and send what
  ran — a partial fixture is useful, and the importer records which cases are
  absent rather than assuming agreement.

## What happens to the file

`scripts/import-spss-reference.mjs` reads the OXML and writes
`e2e/fixtures/cross-check/spss-reference.json` in the schema
`cross-check-r-spss.md` specifies, which is the same schema the R fixture uses —
so `e2e/cross-check.browser.test.ts` gains the SPSS tier without a new test body.

That importer is written against the first real export rather than ahead of it.
OXML's element names and the exact table layout vary a little by procedure and by
SPSS version, and a parser guessed from the documentation would be a parser nobody
has run. The XML from step 6 is what it gets built and tested against.
