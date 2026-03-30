import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Seeded LCG pseudo-random number generator for reproducibility
function createRNG(seed) {
  let state = seed;
  return function () {
    state = (state * 1664525 + 1013904223) & 0xffffffff;
    return (state >>> 0) / 0x100000000;
  };
}

const random = createRNG(42);

function weightedPick(options, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < options.length; i++) {
    r -= weights[i];
    if (r <= 0) return options[i];
  }
  return options[options.length - 1];
}

function randomInt(min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 1) {
  const val = random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

// Likert scale with a slight positive skew (more 3s and 4s)
function likert() {
  return weightedPick([1, 2, 3, 4, 5], [5, 12, 30, 35, 18]);
}

const genders = ['Male', 'Female', 'Other'];
const genderWeights = [45, 45, 10];

const ageGroups = ['20s', '30s', '40s', '50s', '60s'];
const ageWeights = [25, 30, 22, 15, 8];

const nationalities = ['US', 'UK', 'KR', 'JP', 'DE', 'FR', 'BR', 'IN'];
const nationalityWeights = [25, 18, 10, 10, 10, 9, 9, 9];

const musicGenres = ['Pop', 'Rock', 'Jazz', 'Classical', 'Hip-Hop', 'R&B', 'Electronic', 'Country'];
const musicWeights = [22, 18, 8, 7, 18, 10, 12, 5];

const movieGenres = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary'];
const movieWeights = [20, 18, 15, 10, 12, 8, 12, 5];

const artGenres = ['Painting', 'Sculpture', 'Photography', 'Digital Art', 'Illustration', 'Mixed Media'];
const artWeights = [25, 10, 22, 20, 15, 8];

const TOTAL_ROWS = 2000;
const data = [];

for (let i = 1; i <= TOTAL_ROWS; i++) {
  data.push({
    id: i,
    gender: weightedPick(genders, genderWeights),
    age_group: weightedPick(ageGroups, ageWeights),
    nationality: weightedPick(nationalities, nationalityWeights),
    favorite_music: weightedPick(musicGenres, musicWeights),
    favorite_movie: weightedPick(movieGenres, movieWeights),
    favorite_art: weightedPick(artGenres, artWeights),
    music_satisfaction: likert(),
    movie_satisfaction: likert(),
    art_satisfaction: likert(),
    weekly_hours_music: randomFloat(0, 30),
    weekly_hours_movie: randomFloat(0, 20),
    monthly_art_visits: randomInt(0, 10),
  });
}

const docsDir = path.resolve(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const outputPath = path.join(docsDir, 'sample-survey-data.json');
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`Generated ${data.length} rows -> ${outputPath}`);
