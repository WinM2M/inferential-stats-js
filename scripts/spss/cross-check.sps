* Encoding: UTF-8.
*
* Cross-check reference values from IBM SPSS Statistics.
*
* SPSS has no redistributable runtime, so this file is the one part of the
* validation suite a person runs by hand. It reads the same six CSVs the browser
* test reads, runs the SPSS counterpart of each procedure, and routes every
* output table to one OXML file that scripts/import-spss-reference.mjs turns into
* e2e/fixtures/cross-check/spss-reference.json.
*
* Step-by-step instructions, including what to send back: see
* docs/validation/spss-manual-run.md.
*
* The only thing to edit is the two paths below.

DEFINE !DATA () '/path/to/inferential-stats-js/e2e/fixtures/cross-check/data' !ENDDEFINE.
DEFINE !OUT  () '/path/to/spss-cross-check-output.xml' !ENDDEFINE.

* Every table in the session goes to one OXML file. OXML keeps the unrounded
* value in each cell's `number` attribute alongside the formatted text, so the
* reference values do not inherit the three decimals a pivot table prints.

OMS
  /SELECT TABLES
  /DESTINATION FORMAT=OXML OUTFILE=!OUT
  /TAG='crosscheck'.

* ------------------------------------------------------------------ USArrests
* descriptives. SKEWNESS and KURTOSIS here are SPSS's G1 and G2, which is the
* convention question recorded in the design document; EXAMINE supplies the
* quartiles, which DESCRIPTIVES does not print.

GET DATA /TYPE=TXT /FILE=!DATA + '/USArrests.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    caseLabel A30 Murder F8.4 Assault F8.4 UrbanPop F8.4 Rape F8.4.
DATASET NAME USArrests WINDOW=FRONT.

DESCRIPTIVES VARIABLES=Murder Assault UrbanPop Rape
  /STATISTICS=MEAN STDDEV MIN MAX SKEWNESS KURTOSIS.
EXAMINE VARIABLES=Murder Assault UrbanPop Rape
  /PLOT=NONE /STATISTICS=DESCRIPTIVES /PERCENTILES(25,50,75)=HAVERAGE
  /MISSING=LISTWISE.

* ---------------------------------------------------------------- ToothGrowth
* crosstabs (2 x 3) and the independent-samples t-test. The Levene row SPSS
* prints is centred on the group mean; see the design document.

GET DATA /TYPE=TXT /FILE=!DATA + '/ToothGrowth.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES= len F8.4 supp A4 dose F8.4.
DATASET NAME ToothGrowth WINDOW=FRONT.

CROSSTABS TABLES=supp BY dose
  /STATISTICS=CHISQ PHI /CELLS=COUNT EXPECTED ROW COLUMN TOTAL.
T-TEST GROUPS=supp('OJ' 'VC') /VARIABLES=len /CRITERIA=CI(.95).

* --------------------------------------------------------------------- mtcars
* 2 x 2 crosstab (the continuity-correction question), the t-test whose Levene
* centre changes which arm is reported, linear regression with METHOD=ENTER, and
* binary logistic regression.

GET DATA /TYPE=TXT /FILE=!DATA + '/mtcars.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    caseLabel A30 mpg F8.4 cyl F8.4 disp F8.4 hp F8.4 drat F8.4 wt F8.4
    qsec F8.4 vs F8.4 am F8.4 gear F8.4 carb F8.4.
DATASET NAME mtcars WINDOW=FRONT.

CROSSTABS TABLES=am BY vs
  /STATISTICS=CHISQ PHI /CELLS=COUNT EXPECTED ROW COLUMN TOTAL.
T-TEST GROUPS=vs(0 1) /VARIABLES=hp /CRITERIA=CI(.95).

REGRESSION
  /MISSING=LISTWISE
  /STATISTICS=COEFF OUTS CI(95) R ANOVA TOL
  /CRITERIA=PIN(.05) POUT(.10)
  /NOORIGIN
  /DEPENDENT=mpg
  /METHOD=ENTER wt hp disp
  /RESIDUALS=DURBIN.

LOGISTIC REGRESSION VARIABLES=am
  /METHOD=ENTER wt hp
  /PRINT=CI(95)
  /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).

* ---------------------------------------------------------------------- sleep
* paired-samples t-test. `sleep` is exported wide for exactly this.

GET DATA /TYPE=TXT /FILE=!DATA + '/sleep.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES= subjectId A4 drug1 F8.4 drug2 F8.4.
DATASET NAME sleep WINDOW=FRONT.

T-TEST PAIRS=drug1 WITH drug2 (PAIRED) /CRITERIA=CI(.95).

* ----------------------------------------------------------------------- iris
* one-way ANOVA and Tukey HSD. SPSS variable names avoid the periods R uses;
* the importer maps SepalLength back to Sepal.Length.

GET DATA /TYPE=TXT /FILE=!DATA + '/iris.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    SepalLength F8.4 SepalWidth F8.4 PetalLength F8.4 PetalWidth F8.4
    Species A12.
DATASET NAME iris WINDOW=FRONT.

ONEWAY SepalLength BY Species
  /STATISTICS DESCRIPTIVES HOMOGENEITY
  /MISSING ANALYSIS
  /POSTHOC=TUKEY ALPHA(0.05).

* ------------------------------------------------------------------- attitude
* reliability. /SUMMARY=TOTAL is what produces the item-total table this SDK
* returns as `itemAnalysis`.

GET DATA /TYPE=TXT /FILE=!DATA + '/attitude.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    rating F8.4 complaints F8.4 privileges F8.4 learning F8.4
    raises F8.4 critical F8.4 advance F8.4.
DATASET NAME attitude WINDOW=FRONT.

RELIABILITY
  /VARIABLES=rating complaints privileges learning raises critical advance
  /SCALE('all items') ALL
  /MODEL=ALPHA
  /STATISTICS=DESCRIPTIVE SCALE CORR
  /SUMMARY=TOTAL MEANS.

* Close the route and report the version that produced the file. The version
* string goes into the fixture's `source`, so a later disagreement can be traced
* to a specific SPSS build rather than to "SPSS".

OMSEND TAG='crosscheck'.
SHOW LICENSE.
