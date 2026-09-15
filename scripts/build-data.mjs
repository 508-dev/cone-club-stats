// Reads raw/taipei/*.csv (Taipei City Police 死傷交通事故資料, one file per ROC year),
// normalizes the schema (which changes across years — see FIELD_ALIASES below), and
// writes small pre-aggregated JSON files into public/data/ for the frontend to fetch.
//
// Run with `npm run build:data`. Raw CSVs are never checked into version control;
// re-download them into raw/taipei/ before running this if the directory is empty.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import {
  PROTECTIVE_EQUIPMENT,
  INJURY_SEVERITY,
  vehicleCategory,
  isFatal,
  drinkingStatus,
  districtName,
} from './codes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW_DIR = join(__dirname, '..', 'raw', 'taipei');
const OUT_DIR = join(__dirname, '..', 'public', 'data');
mkdirSync(OUT_DIR, { recursive: true });

// Column names vary by year; try each alias in order and take the first present.
const FIELD_ALIASES = {
  rocYear: ['發生年度'],
  month: ['發生月'],
  day: ['發生日'],
  hour: ['發生時-Hours', '發生時'],
  minute: ['發生分'],
  districtRaw: ['區序'],
  location: ['肇事地點'],
  deaths: ['死亡人數'],
  deaths2to30: ['2-30日死亡人數'],
  injuries: ['受傷人數'],
  partySeq: ['當事人序號'],
  vehicle: ['車種'],
  gender: ['性別'],
  age: ['年齡'],
  injurySeverity: ['受傷程度'],
  protectiveEquipment: ['保護裝置', '安全帽'],
  drinking: ['飲酒情形'],
  lon: ['座標-X'],
  lat: ['座標-Y'],
};

function getField(row, key) {
  for (const alias of FIELD_ALIASES[key]) {
    if (row[alias] !== undefined && row[alias] !== '') return row[alias];
  }
  return undefined;
}

const accidentGroups = new Map(); // accidentKey -> aggregate
const partyRecords = []; // one entry per person involved, for seatbelt stats
const yearlySummary = new Map(); // ceYear -> { accidents:Set, deaths, injuries }

const files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.csv'));
console.log(`Found ${files.length} CSV files in ${RAW_DIR}`);

for (const file of files) {
  const rocYear = Number(file.match(/(\d+)/)[1]);
  const ceYear = rocYear + 1911;
  const raw = readFileSync(join(RAW_DIR, file));
  const rows = parse(raw, { columns: true, bom: true, skip_empty_lines: true });

  if (!yearlySummary.has(ceYear)) {
    yearlySummary.set(ceYear, { accidentKeys: new Set(), deaths: 0, injuries: 0 });
  }
  const ySummary = yearlySummary.get(ceYear);

  for (const row of rows) {
    const month = getField(row, 'month');
    const day = getField(row, 'day');
    const hour = getField(row, 'hour');
    const minute = getField(row, 'minute');
    const location = getField(row, 'location') ?? '';
    const accidentKey = `${ceYear}-${month}-${day}-${hour}-${minute}-${location}`;

    const deaths = Number(getField(row, 'deaths') ?? 0) + Number(getField(row, 'deaths2to30') ?? 0);
    const injuries = Number(getField(row, 'injuries') ?? 0);
    const lon = Number(getField(row, 'lon'));
    const lat = Number(getField(row, 'lat'));
    const district = districtName(getField(row, 'districtRaw'));
    const vehicle = getField(row, 'vehicle');
    const category = vehicleCategory(vehicle);

    ySummary.accidentKeys.add(accidentKey);
    // deaths/injuries are repeated on every party row of the same accident;
    // Math.max across the group avoids double counting.
    if (!accidentGroups.has(accidentKey)) {
      accidentGroups.set(accidentKey, {
        year: ceYear,
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: minute == null ? null : Number(minute),
        location,
        district,
        lat: Number.isFinite(lat) && lat !== 0 ? lat : null,
        lon: Number.isFinite(lon) && lon !== 0 ? lon : null,
        deaths: 0,
        injuries: 0,
        categories: new Set(),
      });
    }
    const acc = accidentGroups.get(accidentKey);
    acc.deaths = Math.max(acc.deaths, deaths);
    acc.injuries = Math.max(acc.injuries, injuries);
    acc.categories.add(category);
    if (acc.lat == null && Number.isFinite(lat) && lat !== 0) acc.lat = lat;
    if (acc.lon == null && Number.isFinite(lon) && lon !== 0) acc.lon = lon;

    const severityRaw = getField(row, 'injurySeverity');
    const severity = INJURY_SEVERITY[severityRaw] ?? 'unknown';
    const peRaw = getField(row, 'protectiveEquipment');
    const peInfo = PROTECTIVE_EQUIPMENT[peRaw];

    partyRecords.push({
      year: ceYear,
      district,
      category,
      severity,
      fatal: isFatal(severityRaw),
      protectiveEquipmentCode: peRaw ?? null,
      wore: peInfo ? peInfo.wore : null, // true/false/null(unknown or n/a)
      drinking: drinkingStatus(getField(row, 'drinking')),
      age: Number(getField(row, 'age')) || null,
    });
  }

  // total deaths/injuries per year = sum of per-accident maxes computed after grouping,
  // done in the pass below once all files are read (accidentGroups spans all years).
}

// Now that all files are parsed, compute per-year deaths/injuries from the deduped accidents.
for (const acc of accidentGroups.values()) {
  const s = yearlySummary.get(acc.year);
  s.deaths += acc.deaths;
  s.injuries += acc.injuries;
}

// --- Output 1a: heatmap/{year}.json + heatmap/all.json — gridded density data.
// Raw per-accident points (233k+ across 2016-2025) are far too large to ship as JSON
// (~32MB). Instead, bin into a ~11m grid (4 decimal places) and sum counts per cell;
// this is both smaller and exactly what a Leaflet.heat weighted layer wants.
// Coordinates only exist from ROC 105 (CE 2016) onward; earlier years have none.
const GRID_PRECISION = 4; // decimal places, ~11m at Taipei's latitude
const geocoded = [...accidentGroups.values()].filter((a) => a.lat && a.lon);

function buildGrid(records) {
  const cells = new Map();
  for (const a of records) {
    const glat = Number(a.lat.toFixed(GRID_PRECISION));
    const glon = Number(a.lon.toFixed(GRID_PRECISION));
    const key = `${glat}|${glon}`;
    if (!cells.has(key)) {
      cells.set(key, { lat: glat, lon: glon, count: 0, deaths: 0, injuries: 0, pedestrian: 0 });
    }
    const cell = cells.get(key);
    cell.count += 1;
    cell.deaths += a.deaths;
    cell.injuries += a.injuries;
    if (a.categories.has('pedestrian')) cell.pedestrian += 1;
  }
  // Array-of-arrays instead of array-of-objects keeps the JSON much smaller.
  return [...cells.values()].map((c) => [c.lat, c.lon, c.count, c.deaths, c.injuries, c.pedestrian]);
}

mkdirSync(join(OUT_DIR, 'heatmap'), { recursive: true });
const byYear = new Map();
for (const a of geocoded) {
  if (!byYear.has(a.year)) byYear.set(a.year, []);
  byYear.get(a.year).push(a);
}
for (const [year, records] of byYear) {
  const grid = buildGrid(records);
  writeFileSync(join(OUT_DIR, 'heatmap', `${year}.json`), JSON.stringify(grid));
}
const allGrid = buildGrid(geocoded);
writeFileSync(join(OUT_DIR, 'heatmap', 'all.json'), JSON.stringify(allGrid));
console.log(
  `heatmap/: ${byYear.size} yearly files + all.json (${allGrid.length} cells from ${geocoded.length} accidents)`
);

// --- Output 1b: fatalities.json — full-precision points for accidents with >=1 death.
// This set is small (~1-2k total across 2016-2025) so no aggregation is needed; it's
// meant for individual markers/popups rather than a density layer.
const fatalities = geocoded
  .filter((a) => a.deaths > 0)
  .map((a) => ({
    year: a.year,
    month: a.month,
    day: a.day,
    hour: a.hour,
    minute: a.minute,
    location: a.location,
    district: a.district,
    lat: a.lat,
    lon: a.lon,
    deaths: a.deaths,
    injuries: a.injuries,
    categories: [...a.categories],
  }));
writeFileSync(join(OUT_DIR, 'fatalities.json'), JSON.stringify(fatalities));
console.log(`fatalities.json: ${fatalities.length} fatal accidents`);

// --- Output 2: yearly_summary.json — full 2012-2025 trend, no geo/PE required.
const yearlySummaryOut = [...yearlySummary.entries()]
  .map(([year, s]) => ({ year, accidents: s.accidentKeys.size, deaths: s.deaths, injuries: s.injuries }))
  .sort((a, b) => a.year - b.year);
writeFileSync(join(OUT_DIR, 'yearly_summary.json'), JSON.stringify(yearlySummaryOut));
console.log(`yearly_summary.json: ${yearlySummaryOut.length} years`);

// --- Output 3: protective_equipment_stats.json — seatbelt/helmet usage among fatalities
// and injuries, by year and vehicle category. Only years with the PE column populated
// will show up here (ROC 109+ / CE 2020+); earlier years simply have wore=null throughout.
const peByYearCategory = new Map();
for (const p of partyRecords) {
  if (!p.fatal && p.severity !== 'injured') continue; // only fatal + injured are interesting
  const key = `${p.year}|${p.category}`;
  if (!peByYearCategory.has(key)) {
    peByYearCategory.set(key, {
      year: p.year,
      category: p.category,
      fatalWore: 0,
      fatalNotWore: 0,
      fatalUnknown: 0,
      injuredWore: 0,
      injuredNotWore: 0,
      injuredUnknown: 0,
    });
  }
  const bucket = peByYearCategory.get(key);
  const woreKey = p.wore === true ? 'Wore' : p.wore === false ? 'NotWore' : 'Unknown';
  bucket[(p.fatal ? 'fatal' : 'injured') + woreKey] += 1;
}
const protectiveEquipmentStats = [...peByYearCategory.values()].sort(
  (a, b) => a.year - b.year || a.category.localeCompare(b.category)
);
writeFileSync(join(OUT_DIR, 'protective_equipment_stats.json'), JSON.stringify(protectiveEquipmentStats));
console.log(`protective_equipment_stats.json: ${protectiveEquipmentStats.length} year/category rows`);

// --- Output 4: meta.json — data-coverage caveats the frontend should surface to users.
const meta = {
  generatedAt: new Date().toISOString(),
  sourceYearsRoc: [...new Set(files.map((f) => Number(f.match(/(\d+)/)[1])))].sort((a, b) => a - b),
  geoCoverageStartYear: 2016, // ROC 105
  protectiveEquipmentCoverageStartYear: 2020, // ROC 109
  notes: [
    'Deaths/injuries counts are per-accident (deduplicated across party rows) unless noted otherwise.',
    'Protective-equipment ("wore") is per-person, only recorded from CE 2020 onward.',
    'Coordinates are only recorded from CE 2016 onward; earlier accidents are excluded from accidents.json.',
  ],
};
writeFileSync(join(OUT_DIR, 'meta.json'), JSON.stringify(meta, null, 2));
console.log('meta.json written');
