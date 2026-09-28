/**
 * Regenerate `e2e/fixtures/nist-strd.json` from the NIST Statistical Reference
 * Datasets (StRD).
 *
 * The StRD publishes datasets together with *certified* values computed in
 * extended precision, which makes them the standard yardstick for checking that
 * a statistics implementation is numerically correct rather than merely
 * self-consistent. The fixture is committed so the test suite stays offline and
 * deterministic; this script exists so anyone can reproduce it.
 *
 *   node scripts/fetch-nist-strd.mjs
 *
 * StRD is work of the U.S. National Institute of Standards and Technology and
 * is not subject to copyright protection in the United States.
 * https://www.itl.nist.gov/div898/strd/
 */

import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LLS_BASE = 'https://www.itl.nist.gov/div898/strd/lls/data/LINKS/DATA';
const ANOVA_BASE = 'https://www.itl.nist.gov/div898/strd/anova';

/**
 * `columns` is declared per dataset rather than parsed out of the header: the
 * "Data:" line is free-form prose in these files and differs between them.
 */
const DATASETS = [
  {
    name: 'Norris',
    procedure: 'linear-regression',
    url: `${LLS_BASE}/Norris.dat`,
    columns: ['y', 'x'],
    difficulty: 'Lower',
  },
  {
    name: 'Longley',
    procedure: 'linear-regression',
    url: `${LLS_BASE}/Longley.dat`,
    columns: ['y', 'x1', 'x2', 'x3', 'x4', 'x5', 'x6'],
    difficulty: 'Higher',
  },
  {
    name: 'SiRstv',
    procedure: 'anova-oneway',
    url: `${ANOVA_BASE}/SiRstv.dat`,
    columns: ['instrument', 'y'],
    difficulty: 'Lower',
  },
  {
    name: 'AtmWtAg',
    procedure: 'anova-oneway',
    url: `${ANOVA_BASE}/AtmWtAg.dat`,
    columns: ['instrument', 'y'],
    difficulty: 'Average',
  },
];

/** NIST writes exponents Fortran-style (`0.4297E-03`); parseFloat handles that. */
const num = (token) => Number.parseFloat(token);

/** Each file's header states the 1-based line ranges of its two blocks. */
function declaredRange(lines, label) {
  const header = lines.find((line) => line.includes(label) && line.includes('lines'));
  if (!header) throw new Error(`no "${label}" line range in header`);
  const match = header.match(/lines\s+(\d+)\s+to\s+(\d+)/);
  if (!match) throw new Error(`unparsable "${label}" line range: ${header}`);
  return { from: Number(match[1]), to: Number(match[2]) };
}

/**
 * The certified block is read from its declared start up to the start of the
 * data block, not to its declared end: in AtmWtAg.dat the header says the
 * certified values end at line 47 while the residual standard deviation is
 * actually on line 48. Reading to the data block tolerates that without
 * hard-coding a per-file correction, and the parsers below only pick up lines
 * they recognise anyway.
 */
function certifiedLinesOf(lines) {
  const certified = declaredRange(lines, 'Certified Values');
  const data = declaredRange(lines, 'Data ');
  return lines.slice(certified.from - 1, data.from - 1);
}

function dataLinesOf(lines) {
  const data = declaredRange(lines, 'Data ');
  return lines.slice(data.from - 1, data.to);
}

function parseRegression(certifiedLines) {
  const parameters = [];
  let residualStandardDeviation = null;
  let rSquared = null;
  const anova = {};

  certifiedLines.forEach((line, index) => {
    const parameter = line.match(/^\s*B(\d+)\s+(\S+)\s+(\S+)\s*$/);
    if (parameter) {
      parameters.push({
        index: Number(parameter[1]),
        estimate: num(parameter[2]),
        standardError: num(parameter[3]),
      });
      return;
    }
    if (/R-Squared/.test(line)) {
      rSquared = num(line.split(/\s+/).filter(Boolean).pop());
      return;
    }
    // "Residual" and "Standard Deviation <value>" sit on separate lines.
    if (/^\s*Standard Deviation/.test(line) && /Residual/.test(certifiedLines[index - 1] ?? '')) {
      residualStandardDeviation = num(line.split(/\s+/).filter(Boolean).pop());
      return;
    }
    const row = line.match(/^\s*(Regression|Residual|Total)\s+(\d+)\s+(\S+)(?:\s+(\S+))?(?:\s+(\S+))?\s*$/);
    if (row) {
      anova[row[1].toLowerCase()] = {
        df: Number(row[2]),
        sumOfSquares: num(row[3]),
        meanSquare: row[4] === undefined ? null : num(row[4]),
        fStatistic: row[5] === undefined ? null : num(row[5]),
      };
    }
  });

  if (!parameters.length) throw new Error('no certified parameters found');
  if (rSquared === null) throw new Error('no certified R-squared found');
  if (residualStandardDeviation === null) throw new Error('no certified residual SD found');
  return { parameters, rSquared, residualStandardDeviation, anova };
}

function parseAnova(certifiedLines) {
  let between = null;
  let within = null;
  let rSquared = null;
  let residualStandardDeviation = null;

  certifiedLines.forEach((line, index) => {
    const row = line.match(/^\s*(Between|Within)\s+\S+\s+(\d+)\s+(\S+)\s+(\S+)(?:\s+(\S+))?\s*$/);
    if (row) {
      const parsed = {
        df: Number(row[2]),
        sumOfSquares: num(row[3]),
        meanSquare: num(row[4]),
        fStatistic: row[5] === undefined ? null : num(row[5]),
      };
      if (row[1] === 'Between') between = parsed;
      else within = parsed;
      return;
    }
    if (/R-Squared/.test(line)) {
      rSquared = num(line.split(/\s+/).filter(Boolean).pop());
      return;
    }
    if (/^\s*Standard Deviation/.test(line) && /Residual/.test(certifiedLines[index - 1] ?? '')) {
      residualStandardDeviation = num(line.split(/\s+/).filter(Boolean).pop());
    }
  });

  if (!between || !within) throw new Error('no certified between/within rows found');
  if (rSquared === null) throw new Error('no certified R-squared found');
  return { between, within, rSquared, residualStandardDeviation };
}

function parseRows(dataLines, columns) {
  return dataLines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, rowIndex) => {
      const tokens = line.split(/\s+/);
      if (tokens.length !== columns.length) {
        throw new Error(
          `row ${rowIndex + 1}: expected ${columns.length} values, got ${tokens.length} (${line})`,
        );
      }
      return Object.fromEntries(columns.map((column, i) => [column, num(tokens[i])]));
    });
}

const fixtures = {};

for (const dataset of DATASETS) {
  const response = await fetch(dataset.url);
  if (!response.ok) throw new Error(`${dataset.name}: HTTP ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/);

  const certified =
    dataset.procedure === 'linear-regression'
      ? parseRegression(certifiedLinesOf(lines))
      : parseAnova(certifiedLinesOf(lines));

  fixtures[dataset.name] = {
    source: dataset.url,
    procedure: dataset.procedure,
    difficulty: dataset.difficulty,
    columns: dataset.columns,
    certified,
    rows: parseRows(dataLinesOf(lines), dataset.columns),
  };
  console.log(`${dataset.name}: ${fixtures[dataset.name].rows.length} rows, certified values parsed`);
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e', 'fixtures', 'nist-strd.json');
await writeFile(
  outPath,
  `${JSON.stringify(
    {
      $comment:
        'Generated by scripts/fetch-nist-strd.mjs from the NIST Statistical Reference Datasets. ' +
        'Do not edit by hand. NIST StRD is a work of the U.S. Government and is not subject to ' +
        'copyright protection in the United States.',
      generatedBy: 'scripts/fetch-nist-strd.mjs',
      fixtures,
    },
    null,
    2,
  )}\n`,
);
console.log(`wrote ${outPath}`);
