import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, mkdir, cp, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { source, discoverResources, validateCsv, compareSummaries } from '../scripts/data/taipei.mjs';

function catalog(years = [101, 102]) {
  return { success: true, result: { datasetId: 130110, distribution: years.map((year) => ({
    resourceDescription: `${year}年-臺北市死傷交通事故明細.csv`,
    resourceDownloadUrl: `https://data.taipei/api/dataset/example/resource/${year}/download`,
  })) } };
}
function csv(year, overrides = {}) {
  const schemaYear = Object.keys(source.schemas).map(Number).filter((y) => y <= year).at(-1);
  const headers = source.schemas[schemaYear];
  const row = { '發生年度': String(year), '發生月': '01', '發生日': '02', '發生時-Hours': '12', '發生分': '30',
    '區序': '01中正區', '肇事地點': '測試路', '死亡人數': '1', '受傷人數': '0', '2-30日死亡人數': '0',
    '當事人序號': '1', '車種': 'B01', '受傷程度': '1', '座標-X': '121.5', '座標-Y': '25.04', ...overrides };
  return '\uFEFF' + headers.join(',') + '\n' + headers.map((h) => row[h] ?? '').join(',') + '\n';
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'taipei-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('catalog discovers an added year, rejects removals, duplicates and foreign hosts', () => {
  assert.deepEqual(discoverResources(catalog([101, 102, 103]), [101, 102]).map((r) => r.rocYear), [101, 102, 103]);
  for (const years of [[], [101, 103], [101, 101]]) assert.throws(() => discoverResources(catalog(years)), /empty|duplicated|missing/);
  assert.throws(() => discoverResources(catalog([101]), [101, 102]), /missing/);
  const bad = catalog();
  bad.result.distribution[0].resourceDownloadUrl = 'https://example.com/data.csv';
  assert.throws(() => discoverResources(bad), /host/);
});

test('CSV validation catches schema drift, HTML errors, invalid dates and unknown codes', async (t) => {
  const file = join(await fixture(t), 'data.csv');
  for (const [text, message] of [
    ['<html>upstream unavailable</html>', /columns/],
    [csv(114).replace('肇事地點', 'new location column'), /columns/],
    [csv(114, { '發生月': '02', '發生日': '30' }), /date/],
    [csv(114, { '受傷程度': '999' }), /unrecognized/],
    [csv(114, { '死亡人數': '-1' }), /casualty/],
  ]) {
    await writeFile(file, text);
    await assert.rejects(validateCsv(file, 114), message);
  }
});

test('quality report preserves known missing values and exposes unusable coordinates and repeated party keys', async (t) => {
  const file = join(await fixture(t), 'data.csv');
  const data = csv(114, { '死亡人數': '', '座標-X': '25.04', '座標-Y': '121.5' });
  await writeFile(file, data + data.split('\n')[1] + '\n');
  const result = await validateCsv(file, 114);
  assert.equal(result.rows, 2);
  assert.equal(result.invalidCoordinates, 2);
  assert.equal(result.missingCasualtyCounts, 2);
  assert.equal(result.duplicatePartyKeys, 1);
  assert.equal(result.coverageEnd, '2025-01-02');
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
});

test('summary comparison reports large revisions and rejects lost years', () => {
  const before = [{ year: 2025, accidents: 100, deaths: 10, injuries: 120 }];
  assert.equal(compareSummaries(before, before).warnings.length, 0);
  assert.equal(compareSummaries(before, [{ ...before[0], accidents: 50 }]).warnings.length, 1);
  assert.throws(() => compareSummaries(before, []), /lost year/);
});

test('missing grouping and classification fields are reported', async (t) => {
  const file = join(await fixture(t), 'data.csv');
  await writeFile(file, csv(114, {
    '肇事地點': '', '區序': '', '當事人序號': '',
    '發生時-Hours': '', '發生分': '', '受傷程度': '',
  }));
  const result = await validateCsv(file, 114);
  assert.equal(result.missingIdentityFields, 3);
  assert.equal(result.missingTimeFields, 2);
  assert.ok(result.missingCategoryFields >= 1);
});

test('government filenames work and a year with no coordinates publishes an empty map layer', async (t) => {
  const dir = await fixture(t);
  const raw = join(dir, 'raw');
  const output = join(dir, 'output');
  await mkdir(raw);
  await writeFile(join(raw, '115年-臺北市死傷交通事故明細.csv'), csv(115, { '座標-X': '', '座標-Y': '' }));
  const run = () => spawnSync(process.execPath, ['scripts/build-data.mjs'], {
    cwd: resolve('.'), env: { ...process.env, DATA_RAW_DIR: raw, DATA_OUT_DIR: output }, encoding: 'utf8',
  });
  assert.equal(run().status, 0);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'heatmap/2026.json'), 'utf8')), []);
  assert.deepEqual(JSON.parse(await readFile(join(output, 'meta.json'), 'utf8')).sourceYearsRoc, [115]);
  await writeFile(join(raw, 'taipei_115.csv'), csv(115));
  assert.notEqual(run().status, 0, 'Duplicate annual files must not double-count a year');
  await rm(join(raw, 'taipei_115.csv'));
  await writeFile(join(raw, 'unrecognized.csv'), csv(114));
  assert.notEqual(run().status, 0, 'Unexpected files must not be silently ignored');
});

test('full dry-run stages all years, preserves published files on success/failure, and detects a no-op', async (t) => {
  const dir = await fixture(t);
  await cp(resolve('scripts'), join(dir, 'scripts'), { recursive: true });
  await symlink(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
  const raw = join(dir, 'raw');
  const output = join(dir, 'public/data');
  await mkdir(raw);
  await mkdir(output, { recursive: true });
  const years = [101, 102, 103, 104, 105];
  for (const year of years) await writeFile(join(raw, `taipei_${year}.csv`), csv(year));
  const build = spawnSync(process.execPath, ['scripts/build-data.mjs'], { cwd: dir,
    env: { ...process.env, DATA_RAW_DIR: raw, DATA_OUT_DIR: output }, encoding: 'utf8' });
  assert.equal(build.status, 0, build.stderr);
  const resources = [];
  for (const resource of discoverResources(catalog(years))) resources.push({ ...resource,
    ...await validateCsv(join(raw, `taipei_${resource.rocYear}.csv`), resource.rocYear) });
  await writeFile(join(output, 'source.json'), JSON.stringify({ resources, coverageStart: '2012-01-02', coverageEnd: '2016-01-02' }, null, 2) + '\n');
  const before = await readFile(join(output, 'meta.json'), 'utf8');
  await writeFile(join(dir, 'catalog.json'), JSON.stringify(catalog(years)));
  const run = () => spawnSync(process.execPath, ['scripts/refresh-data.mjs', '--dry-run', '--catalog', 'catalog.json', '--raw-dir', 'raw'], { cwd: dir, encoding: 'utf8' });
  const good = run();
  assert.equal(good.status, 0, good.stderr);
  assert.match(await readFile(join(dir, '.data-refresh-report.md'), 'utf8'), /No data changes/);
  assert.equal(await readFile(join(output, 'meta.json'), 'utf8'), before);
  await writeFile(join(raw, 'taipei_105.csv'), '<html>not data</html>');
  const bad = run();
  assert.notEqual(bad.status, 0);
  assert.equal(await readFile(join(output, 'meta.json'), 'utf8'), before);
  assert.match(await readFile(join(dir, '.data-refresh-report.md'), 'utf8'), /failed/);
});
