* Encoding: UTF-8.
*
* Cross-check reference values from IBM SPSS Statistics.
*
* SPSS has no redistributable runtime, so this file is the one part of the
* validation suite a person runs by hand. It reads the same six CSVs the browser
* test reads - each downloaded from the archive that publishes it and pinned by
* SHA-256 in e2e/fixtures/cross-check/data/provenance.json - runs the SPSS
* counterpart of each procedure, and routes every output table to one OXML file
* that scripts/import-spss-reference.mjs turns into
* e2e/fixtures/cross-check/spss-reference.json.
*
* Step-by-step instructions, including what to send back: see
* docs/validation/spss-manual-run.md.
*
* The only thing to edit is the two paths below.

DEFINE !DATA () '/path/to/inferential-stats-js/e2e/fixtures/cross-check/data' !ENDDEFINE.
DEFINE !OUT  () '/path/to/spss-cross-check-output.xml' !ENDDEFINE.

* The published files use a dot as the decimal separator regardless of locale.
SET DECIMAL=DOT.

* Every table in the session goes to one OXML file. OXML keeps the unrounded
* value in each cell's `number` attribute alongside the formatted text, so the
* reference values do not inherit the three decimals a pivot table prints.

OMS
  /SELECT TABLES
  /DESTINATION FORMAT=OXML OUTFILE=!OUT
  /TAG='crosscheck'.

* ----------------------------------------------------------------------- iris
* UCI Machine Learning Repository, dataset 53 (Fisher 1936).
* descriptives, one-way ANOVA, Tukey HSD. SKEWNESS and KURTOSIS here are SPSS's
* G1 and G2, which is the convention question recorded in the design document;
* EXAMINE supplies the quartiles, which DESCRIPTIVES does not print.

GET DATA /TYPE=TXT /FILE=!DATA + '/iris.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    sepal_length F8.4 sepal_width F8.4 petal_length F8.4 petal_width F8.4
    species A15.
DATASET NAME iris WINDOW=FRONT.

DESCRIPTIVES VARIABLES=sepal_length sepal_width petal_length petal_width
  /STATISTICS=MEAN STDDEV MIN MAX SKEWNESS KURTOSIS.
EXAMINE VARIABLES=sepal_length sepal_width petal_length petal_width
  /PLOT=NONE /STATISTICS=DESCRIPTIVES /PERCENTILES(25,50,75)=HAVERAGE
  /MISSING=LISTWISE.

ONEWAY sepal_length BY species
  /STATISTICS DESCRIPTIVES HOMOGENEITY
  /MISSING ANALYSIS
  /POSTHOC=TUKEY ALPHA(0.05).

* -------------------------------------------------------------------- auto-mpg
* UCI dataset 9 (Quinlan 1993, originally StatLib/CMU).
* 3 x 5 crosstab from the two discrete attributes, and linear regression with
* METHOD=ENTER. `horsepower` has 6 missing values, written as empty fields;
* /MISSING=LISTWISE drops those 6 cases so n = 392, which is what R's `lm` and
* the Python layer also do.

GET DATA /TYPE=TXT /FILE=!DATA + '/auto-mpg.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    mpg F8.4 cylinders F8.0 displacement F8.4 horsepower F8.4 weight F10.4
    acceleration F8.4 model_year F8.0 origin F8.0 car_name A40.
DATASET NAME autompg WINDOW=FRONT.

CROSSTABS TABLES=origin BY cylinders
  /STATISTICS=CHISQ PHI /CELLS=COUNT EXPECTED ROW COLUMN TOTAL.

REGRESSION
  /MISSING=LISTWISE
  /STATISTICS=COEFF OUTS CI(95) R ANOVA TOL
  /CRITERIA=PIN(.05) POUT(.10)
  /NOORIGIN
  /DEPENDENT=mpg
  /METHOD=ENTER weight horsepower displacement
  /RESIDUALS=DURBIN.

* ----------------------------------------------------------------------- wine
* UCI dataset 109 (Aeberhard, Coomans & de Vel 1992; data from Forina et al.).
* The independent-samples t-test whose Levene centring changes which arm is
* reported: on `proline` between cultivars 2 and 3 the mean-centred test rejects
* equality of variance and the median-centred test does not.

GET DATA /TYPE=TXT /FILE=!DATA + '/wine.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    cultivar F8.0 alcohol F8.4 malic_acid F8.4 ash F8.4 alcalinity_of_ash F8.4
    magnesium F8.4 total_phenols F8.4 flavanoids F8.4 nonflavanoid_phenols F8.4
    proanthocyanins F8.4 color_intensity F8.4 hue F8.4 od280_od315 F8.4
    proline F8.4.
DATASET NAME wine WINDOW=FRONT.

T-TEST GROUPS=cultivar(2 3) /VARIABLES=proline /CRITERIA=CI(.95).

* ------------------------------------------------------------------- haberman
* UCI dataset 43 (Haberman 1976).
* An independent-samples t-test away from the variance boundary, and a logistic
* regression whose outcome is coded 1/2 rather than 0/1 - SPSS models the higher
* value as the event, which is the behaviour being compared against.

GET DATA /TYPE=TXT /FILE=!DATA + '/haberman.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    age F8.0 operation_year F8.0 positive_nodes F8.0 survival_status F8.0.
DATASET NAME haberman WINDOW=FRONT.

T-TEST GROUPS=survival_status(1 2) /VARIABLES=age /CRITERIA=CI(.95).

LOGISTIC REGRESSION VARIABLES=survival_status
  /METHOD=ENTER age positive_nodes
  /PRINT=CI(95)
  /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).

* ------------------------------------------- breast cancer Wisconsin (original)
* UCI dataset 15 (Wolberg & Mangasarian 1990).
* Paired-samples t-test on two of the nine 1-10 gradings of the same specimen,
* and the reliability coefficient over all nine. `bare_nuclei` has 16 missing
* values, so RELIABILITY's case-processing table should report 683 valid of 699.

GET DATA /TYPE=TXT /FILE=!DATA + '/breast-cancer-wisconsin.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    sample_id F10.0 clump_thickness F8.0 uniformity_cell_size F8.0
    uniformity_cell_shape F8.0 marginal_adhesion F8.0 epithelial_cell_size F8.0
    bare_nuclei F8.0 bland_chromatin F8.0 normal_nucleoli F8.0 mitoses F8.0
    class F8.0.
DATASET NAME bcw WINDOW=FRONT.

T-TEST PAIRS=clump_thickness WITH uniformity_cell_size (PAIRED) /CRITERIA=CI(.95).

RELIABILITY
  /VARIABLES=clump_thickness uniformity_cell_size uniformity_cell_shape
             marginal_adhesion epithelial_cell_size bare_nuclei
             bland_chromatin normal_nucleoli mitoses
  /SCALE('nine items') ALL
  /MODEL=ALPHA
  /STATISTICS=DESCRIPTIVE SCALE CORR
  /SUMMARY=TOTAL MEANS.

* ------------------------------------------------------------------ SPECT heart
* UCI dataset 95 (Kurgan et al. 2001), published training split.
* Native 2 x 2 crosstab - the continuity-correction question - and a logistic
* regression on a properly 0/1-coded outcome.

GET DATA /TYPE=TXT /FILE=!DATA + '/spect-train.csv'
  /ENCODING='UTF8' /DELIMITERS=',' /QUALIFIER='"' /ARRANGEMENT=DELIMITED
  /FIRSTCASE=2 /VARIABLES=
    overall_diagnosis F8.0 f1 F8.0 f2 F8.0 f3 F8.0 f4 F8.0 f5 F8.0 f6 F8.0
    f7 F8.0 f8 F8.0 f9 F8.0 f10 F8.0 f11 F8.0 f12 F8.0 f13 F8.0 f14 F8.0
    f15 F8.0 f16 F8.0 f17 F8.0 f18 F8.0 f19 F8.0 f20 F8.0 f21 F8.0 f22 F8.0.
DATASET NAME spect WINDOW=FRONT.

CROSSTABS TABLES=overall_diagnosis BY f1
  /STATISTICS=CHISQ PHI /CELLS=COUNT EXPECTED ROW COLUMN TOTAL.

LOGISTIC REGRESSION VARIABLES=overall_diagnosis
  /METHOD=ENTER f1 f2
  /PRINT=CI(95)
  /CRITERIA=PIN(0.05) POUT(0.10) ITERATE(20) CUT(0.5).

* Close the route and report the version that produced the file. The version
* string goes into the fixture's `source`, so a later disagreement can be traced
* to a specific SPSS build rather than to "SPSS".

OMSEND TAG='crosscheck'.
SHOW LICENSE.
