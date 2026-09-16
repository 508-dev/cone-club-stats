import { createReadStream } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse';

export const source = JSON.parse(await readFile(new URL('./taipei-source.json', import.meta.url), 'utf8'));

export function discoverResources(catalog, previousYears = []) {
  if (catalog.success !== true || catalog.result?.datasetId !== source.datasetId) {
    throw new Error('Unexpected Taipei catalog response');
  }
  const resources = catalog.result.distribution.map((resource) => {
    const match = resource.resourceDescription?.match(/^(\d{3})年.*\.csv$/i);
    if (!match) throw new Error(`Unrecognized resource: ${resource.resourceDescription}`);
    const url = new URL(resource.resourceDownloadUrl);
    if (url.protocol !== 'https:' || url.hostname !== 'data.taipei') {
      throw new Error(`Unexpected download host: ${url.hostname}`);
    }
    return { rocYear: Number(match[1]), url: url.href };
  }).sort((a, b) => a.rocYear - b.rocYear);
  const years = resources.map((r) => r.rocYear);
  if (!years.length || years[0] !== source.firstRocYear || new Set(years).size !== years.length
      || years.some((y, i) => y !== source.firstRocYear + i)
      || previousYears.some((y) => !years.includes(y))) {
    throw new Error('Catalog is empty, duplicated, or missing previously published years');
  }
  return resources;
}

export async function validateCsv(path, rocYear) {
  const schemaYear = Object.keys(source.schemas).map(Number).filter((y) => y <= rocYear).at(-1);
  const expected = source.schemas[schemaYear];
  let rows = 0;
  let missingCoordinates = 0;
  let outsideTaipei = 0;
  let invalidCoordinates = 0;
  let missingCasualtyCounts = 0;
  let duplicatePartyKeys = 0;
  let missingIdentityFields = 0;
  let missingCategoryFields = 0;
  let missingTimeFields = 0;
  const partyKeys = new Set();
  let coverageStart;
  let coverageEnd;
  const hash = createHash('sha256');
  const input = createReadStream(path);
  input.on('data', (chunk) => hash.update(chunk));
  const parser = input.pipe(parse({
    bom: true,
    skip_empty_lines: true,
    columns(headers) {
      if (!expected || JSON.stringify(headers) !== JSON.stringify(expected)) {
        throw new Error(`${rocYear}: CSV columns changed; review the adapter and schema registry`);
      }
      return headers;
    },
  }));
  input.on('error', (error) => parser.destroy(error));
  try {
    for await (const row of parser) {
      rows++;
      const fail = (message) => { throw new Error(`${rocYear}, row ${rows}: ${message}`); };
      if (Number(row['發生年度']) !== rocYear) fail('year does not match resource');
      const year = rocYear + 1911;
      const month = Number(row['發生月']);
      const day = Number(row['發生日']);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) fail('invalid date');
      const iso = date.toISOString().slice(0, 10);
      const hour = row['發生時-Hours'] ?? row['發生時'];
      for (const [value, max] of [[hour, 23], [row['發生分'], 59]]) {
        if (!value) missingTimeFields++;
        if (value && (!/^\d+$/.test(value) || Number(value) > max)) fail('invalid time');
      }
      for (const field of ['肇事地點', '當事人序號', '區序']) if (!row[field]) missingIdentityFields++;
      const partyKey = JSON.stringify([iso, hour, row['發生分'], row['肇事地點'], row['當事人序號']]);
      if (partyKeys.has(partyKey)) duplicatePartyKeys++;
      partyKeys.add(partyKey);
      coverageStart = !coverageStart || iso < coverageStart ? iso : coverageStart;
      coverageEnd = !coverageEnd || iso > coverageEnd ? iso : coverageEnd;
      for (const field of ['死亡人數', '受傷人數', '2-30日死亡人數']) {
        if (!(field in row)) continue;
        if (row[field] === '') { missingCasualtyCounts++; continue; }
        if (!/^\d+$/.test(row[field])) fail(`invalid casualty count: ${field}`);
      }
      for (const [field, codes] of Object.entries(source.knownCodes)) {
        if (field in row && !row[field]) missingCategoryFields++;
        if (row[field] && !codes.includes(row[field])) fail(`unrecognized ${field} code: ${row[field]}`);
      }
      if (rocYear >= 105) {
        const lon = Number(row['座標-X']);
        const lat = Number(row['座標-Y']);
        if (!Number.isFinite(lon) || !Number.isFinite(lat) || Math.abs(lon) > 180 || Math.abs(lat) > 90) invalidCoordinates++;
        else if (!lon || !lat) missingCoordinates++;
        else if (lon < 121.3 || lon > 121.8 || lat < 24.8 || lat > 25.3) outsideTaipei++;
      }
    }
    if (!rows) throw new Error(`${rocYear}: empty CSV`);
    return { rocYear, sha256: hash.digest('hex'), rows, missingCoordinates, invalidCoordinates, outsideTaipei,
      missingCasualtyCounts, duplicatePartyKeys, missingIdentityFields, missingCategoryFields, missingTimeFields,
      coverageStart, coverageEnd };
  } finally {
    input.destroy();
    parser.destroy();
  }
}

export function compareSummaries(before, after) {
  const lines = ['| Year | Accidents before → after | Deaths before → after | Injuries before → after |', '| --- | --- | --- | --- |'];
  const warnings = [];
  for (const old of before) {
    if (!after.some((row) => row.year === old.year)) throw new Error(`Build lost year ${old.year}`);
  }
  for (const row of after) {
    for (const key of ['accidents', 'deaths', 'injuries']) {
      if (!Number.isSafeInteger(row[key]) || row[key] < 0) throw new Error(`Invalid summary: ${row.year} ${key}`);
    }
    const old = before.find((r) => r.year === row.year);
    lines.push(`| ${row.year} | ${old?.accidents ?? 'new'} → ${row.accidents} | ${old?.deaths ?? 'new'} → ${row.deaths} | ${old?.injuries ?? 'new'} → ${row.injuries} |`);
    if (old) for (const key of ['accidents', 'deaths', 'injuries']) {
      if (Math.abs(row[key] - old[key]) > Math.max(5, old[key] * 0.1)) warnings.push(`${row.year}: ${key} changed by more than 10% (and 5).`);
    }
  }
  return { table: lines.join('\n'), warnings };
}
