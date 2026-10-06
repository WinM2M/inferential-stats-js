/**
 * Download the cross-check input data from its official publishers and write it
 * to `e2e/fixtures/cross-check/data/`.
 *
 *   node scripts/fetch-cross-check-data.mjs
 *
 * Every dataset here is retrieved from the archive that publishes it, not from a
 * copy bundled with some statistics package. That matters for two reasons.
 *
 * Provenance: a reference value is only as good as the agreement that the SDK,
 * R and SPSS were given the same numbers. Taking the data from a package's own
 * copy means trusting that package's transcription of it, and the copies do
 * differ — UCI's `iris.data` carries two documented transcription errors
 * relative to Fisher's 1936 table (the 35th and 38th samples), while R's
 * built-in `iris` follows the paper. Neither is "wrong"; they are different
 * tables, and a cross-check that mixed them would be comparing two datasets.
 *
 * Verifiability: the download URL and SHA-256 below let anyone confirm that the
 * committed CSV is the published file and nothing else.
 *
 * The normalised CSVs are committed, so neither this script nor a network
 * connection is needed to run the test suite — the same arrangement
 * `fetch-nist-strd.mjs` uses. Run this to reproduce or refresh them.
 *
 * On a SHA-256 mismatch the script stops without writing. That means the
 * publisher changed the file: re-pin the digest in the same commit that
 * regenerates `r-reference.json`, so the data and the reference values can
 * never drift apart silently.
 */

import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const UCI = 'https://archive.ics.uci.edu/ml/machine-learning-databases';

/**
 * `columns` is declared here rather than read from the files: these archives
 * ship attribute names in a separate free-form `.names` document, not as a
 * header row. The names below are transcribed from those documents, snake-cased
 * so they are usable as identifiers in all three of JavaScript, R and SPSS.
 */
const DATASETS = [
  {
    name: 'iris',
    url: `${UCI}/iris/iris.data`,
    sha256: '6f608b71a7317216319b4d27b4d9bc84e6abd734eda7872b71a458569e2656c0',
    format: 'csv',
    columns: ['sepal_length', 'sepal_width', 'petal_length', 'petal_width', 'species'],
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/53/iris',
    citation:
      'Fisher, R. A. (1936). The use of multiple measurements in taxonomic problems. ' +
      'Annals of Eugenics 7(2), 179-188. Donated to UCI by Michael Marshall.',
    note:
      'UCI documents two transcription errors against Fisher: the 35th sample should be ' +
      '4.9,3.1,1.5,0.2 and the 38th 4.9,3.6,1.4,0.1. The file is used exactly as published, ' +
      "errors included, because the reference values are computed from this file. R's " +
      'built-in `iris` differs here.',
    usedFor: ['anovaOneway', 'posthocTukey', 'descriptives'],
  },
  {
    name: 'auto-mpg',
    url: `${UCI}/auto-mpg/auto-mpg.data`,
    sha256: '48b830e11feee5572525f8f1691ddb9d38d3d7b7063edcd8fca672c2a5e17d8d',
    // Fixed-ish whitespace columns, then a tab and a double-quoted car name.
    format: 'auto-mpg',
    columns: [
      'mpg', 'cylinders', 'displacement', 'horsepower', 'weight',
      'acceleration', 'model_year', 'origin', 'car_name',
    ],
    naToken: '?',
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/9/auto+mpg',
    citation:
      'Quinlan, R. (1993). Combining instance-based and model-based learning. ICML, 236-243. ' +
      'Originally from the StatLib library, Carnegie Mellon University; used in the 1983 ' +
      'American Statistical Association Exposition.',
    note:
      '`horsepower` has 6 missing values written as "?". They are kept as empty CSV fields so ' +
      'that listwise deletion is exercised in all three packages rather than hidden.',
    usedFor: ['linearRegression', 'crosstabs'],
  },
  {
    name: 'wine',
    url: `${UCI}/wine/wine.data`,
    sha256: '6be6b1203f3d51df0b553a70e57b8a723cd405683958204f96d23d7cd6aea659',
    format: 'csv',
    columns: [
      'cultivar', 'alcohol', 'malic_acid', 'ash', 'alcalinity_of_ash', 'magnesium',
      'total_phenols', 'flavanoids', 'nonflavanoid_phenols', 'proanthocyanins',
      'color_intensity', 'hue', 'od280_od315', 'proline',
    ],
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/109/wine',
    citation:
      'Aeberhard, S., Coomans, D., & de Vel, O. (1992). The classification performance of RDA. ' +
      'Tech. Rep. 92-01, James Cook University of North Queensland. Data from Forina, M. et al., ' +
      'PARVUS, Institute of Pharmaceutical and Food Analysis and Technologies, Genoa.',
    note:
      'Thirteen chemical measurements on wines from three cultivars. Carried because it is the ' +
      'only dataset among these where the mean-centred and median-centred Levene tests fall on ' +
      'opposite sides of .05, which is what makes that convention difference observable rather ' +
      'than merely arithmetic.',
    usedFor: ['ttestIndependent'],
  },
  {
    name: 'haberman',
    url: `${UCI}/haberman/haberman.data`,
    sha256: 'b4b7a32586a5668f9f4d6dc8be9d1bc8cd4822523affb1f6b5bfc350681ef3e2',
    format: 'csv',
    columns: ['age', 'operation_year', 'positive_nodes', 'survival_status'],
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/43/haberman+s+survival',
    citation:
      'Haberman, S. J. (1976). Generalized residuals for log-linear models. Proceedings of the ' +
      '9th International Biometrics Conference, Boston, 104-122. Survival of patients after ' +
      'surgery for breast cancer, University of Chicago Billings Hospital, 1958-1970.',
    note: '`survival_status`: 1 = survived 5 years or longer, 2 = died within 5 years.',
    usedFor: ['logisticBinary', 'ttestIndependent'],
  },
  {
    name: 'breast-cancer-wisconsin',
    url: `${UCI}/breast-cancer-wisconsin/breast-cancer-wisconsin.data`,
    sha256: '402c585309c399237740f635ef9919dc512cca12cbeb20de5e563a4593f22b64',
    format: 'csv',
    columns: [
      'sample_id', 'clump_thickness', 'uniformity_cell_size', 'uniformity_cell_shape',
      'marginal_adhesion', 'epithelial_cell_size', 'bare_nuclei', 'bland_chromatin',
      'normal_nucleoli', 'mitoses', 'class',
    ],
    naToken: '?',
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/15/breast+cancer+wisconsin+original',
    citation:
      'Wolberg, W. H., & Mangasarian, O. L. (1990). Multisurface method of pattern separation ' +
      'for medical diagnosis applied to breast cytology. PNAS 87, 9193-9196. ' +
      'University of Wisconsin Hospitals, Madison.',
    note:
      'The nine cytological attributes are all graded 1-10 on the same scale, which is what makes ' +
      'them usable as a commensurable item set for a reliability coefficient. `bare_nuclei` has ' +
      '16 missing values written as "?".',
    usedFor: ['cronbachAlpha', 'ttestPaired'],
  },
  {
    name: 'spect-train',
    url: `${UCI}/spect/SPECT.train`,
    sha256: '0fd0258bfc8eb986623a45890676465ee92e738a95fdc01a6aef893d9c920115',
    format: 'csv',
    columns: [
      'overall_diagnosis',
      ...Array.from({ length: 22 }, (_, i) => `f${i + 1}`),
    ],
    publisher: 'UCI Machine Learning Repository',
    landing: 'https://archive.ics.uci.edu/dataset/95/spect+heart',
    citation:
      'Kurgan, L. A., Cios, K. J., Tadeusiewicz, R., Ogiela, M., & Goodenday, L. S. (2001). ' +
      'Knowledge discovery approach to automated cardiac SPECT diagnosis. Artificial ' +
      'Intelligence in Medicine 23(2), 149-169.',
    note:
      'The published training split, used as published rather than recombined with SPECT.test: ' +
      'every one of its 23 attributes is binary, which is what supplies a 2 x 2 contingency ' +
      'table without binning or filtering anything.',
    usedFor: ['crosstabs'],
  },
];

const splitCsvLine = (line) => line.split(',').map((f) => f.trim());

/**
 * auto-mpg.data is whitespace-separated for its eight numeric fields and then
 * carries a tab and a quoted car name, which contains spaces. Splitting the
 * name off first keeps the numeric split unambiguous.
 */
function splitAutoMpgLine(line) {
  const quote = line.indexOf('"');
  const head = quote === -1 ? line : line.slice(0, quote);
  const name = quote === -1 ? '' : line.slice(quote + 1, line.lastIndexOf('"'));
  return [...head.trim().split(/\s+/), name];
}

const csvField = (value) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const outDir = join(root, 'e2e', 'fixtures', 'cross-check', 'data');
  await mkdir(outDir, { recursive: true });

  const provenance = [];

  for (const dataset of DATASETS) {
    const response = await fetch(dataset.url);
    if (!response.ok) throw new Error(`${dataset.name}: HTTP ${response.status} for ${dataset.url}`);
    const body = Buffer.from(await response.arrayBuffer());
    const digest = createHash('sha256').update(body).digest('hex');

    if (dataset.sha256 && dataset.sha256 !== digest) {
      throw new Error(
        `${dataset.name}: SHA-256 mismatch.\n` +
          `  pinned   ${dataset.sha256}\n` +
          `  received ${digest}\n` +
          'The publisher changed the file. Re-pin the digest and regenerate ' +
          'r-reference.json in the same commit.',
      );
    }

    const split = dataset.format === 'auto-mpg' ? splitAutoMpgLine : splitCsvLine;
    const rows = body
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const fields = split(line);
        if (fields.length !== dataset.columns.length) {
          throw new Error(
            `${dataset.name} row ${index + 1}: expected ${dataset.columns.length} fields, ` +
              `got ${fields.length} (${line})`,
          );
        }
        // A missing value becomes an empty field, which is what `read.csv(na = "")`,
        // SPSS's GET DATA and the browser test's parser all read as missing.
        return fields.map((field) => (dataset.naToken && field === dataset.naToken ? '' : field));
      });

    const csv = [
      dataset.columns.map(csvField).join(','),
      ...rows.map((row) => row.map(csvField).join(',')),
    ].join('\n');
    await writeFile(join(outDir, `${dataset.name}.csv`), `${csv}\n`);

    provenance.push({
      name: dataset.name,
      publisher: dataset.publisher,
      landing: dataset.landing,
      url: dataset.url,
      sha256: digest,
      rows: rows.length,
      columns: dataset.columns,
      citation: dataset.citation,
      ...(dataset.note ? { note: dataset.note } : {}),
      usedFor: dataset.usedFor,
    });

    const pinned = dataset.sha256 ? 'digest verified' : `digest ${digest.slice(0, 16)}… (unpinned)`;
    console.log(`${dataset.name.padEnd(26)} ${String(rows.length).padStart(4)} rows  ${pinned}`);
  }

  await writeFile(
    join(outDir, 'provenance.json'),
    `${JSON.stringify(
      {
        $comment:
          'Generated by scripts/fetch-cross-check-data.mjs. Do not edit by hand. Records where ' +
          'each cross-check dataset came from and the SHA-256 of the file as published, so the ' +
          'committed CSVs can be verified against their source.',
        generatedBy: 'scripts/fetch-cross-check-data.mjs',
        retrievedAt: new Date().toISOString().slice(0, 10),
        datasets: provenance,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`wrote ${join(outDir, 'provenance.json')}`);
  console.log('\nPin the digests in DATASETS, then regenerate: npm run generate-r-reference');
}

await main();
