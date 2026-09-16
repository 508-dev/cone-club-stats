import { readFile, writeFile, mkdir, mkdtemp, copyFile, rename, rm, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { source, discoverResources, validateCsv, compareSummaries } from './data/taipei.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'dry-run': { type: 'boolean', default: false },
  catalog: { type: 'string' },
  'raw-dir': { type: 'string' },
} });
if ((values.catalog || values['raw-dir']) && !values['dry-run']) {
  throw new Error('Local catalog/raw overrides require --dry-run; they cannot publish source provenance');
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT' && fallback !== undefined) return fallback; throw error; }
}

async function download(url, destination) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      if (!response.body) throw new Error(`Empty response for ${url}`);
      await pipeline(Readable.fromWeb(response.body), createWriteStream(destination));
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Download attempt ${attempt} failed: ${error.message}`);
      await new Promise((done) => setTimeout(done, attempt * 1000));
    }
  }
}

const scratch = await mkdtemp(join(root, '.data-refresh-'));
const published = join(root, 'public/data');
const reportPath = process.env.DATA_REPORT_PATH || join(root, '.data-refresh-report.md');
try {
  const previous = await readJson(join(published, 'source.json'), null);
  const before = await readJson(join(published, 'yearly_summary.json'));
  const catalogPath = values.catalog || join(scratch, 'catalog.json');
  if (!values.catalog) await download(source.catalogUrl, catalogPath);
  const catalog = await readJson(catalogPath);
  const resources = discoverResources(catalog, before.map((row) => row.year - 1911));
  const rawDir = join(scratch, 'raw');
  const outputDir = join(scratch, 'output');
  await mkdir(rawDir);
  const checkedAt = new Date().toISOString();
  const validated = [];
  for (const resource of resources) {
    const filename = `taipei_${resource.rocYear}.csv`;
    const destination = join(rawDir, filename);
    console.log(`Checking ${resource.rocYear + 1911}…`);
    if (values['raw-dir']) await copyFile(resolve(values['raw-dir'], filename), destination);
    else await download(resource.url, destination);
    validated.push({ ...resource, ...await validateCsv(destination, resource.rocYear) });
  }
  const unchanged = previous && JSON.stringify(previous.resources) === JSON.stringify(validated);
  // Even unchanged sources are rebuilt: an adapter fix can change generated output.
  const build = spawnSync(process.execPath, ['scripts/build-data.mjs'], {
    cwd: root, stdio: 'inherit', env: { ...process.env, DATA_RAW_DIR: rawDir, DATA_OUT_DIR: outputDir },
  });
  if (build.status !== 0) throw new Error('Data build failed');
  const after = await readJson(join(outputDir, 'yearly_summary.json'));
  const comparison = compareSummaries(before, after);
  const warnings = [...comparison.warnings];
  for (const item of validated) {
    if (item.unknownContextValues) warnings.push(`${item.rocYear + 1911}: ${item.unknownContextValues} weather/lighting/collision/speed-limit values have no verified label; raw values are preserved and shown as unrecognized.`);
    if (item.missingContextValues) warnings.push(`${item.rocYear + 1911}: ${item.missingContextValues} condition fields are blank.`);
    if (item.missingIdentityFields) warnings.push(`${item.rocYear + 1911}: ${item.missingIdentityFields} location/district/party-sequence fields are blank; composite accident grouping may be ambiguous.`);
    if (item.missingCategoryFields) warnings.push(`${item.rocYear + 1911}: ${item.missingCategoryFields} category fields are blank and retain the adapter's existing unknown/missing handling.`);
    if (item.missingTimeFields) warnings.push(`${item.rocYear + 1911}: ${item.missingTimeFields} time fields are blank.`);
    if (item.missingCasualtyCounts) warnings.push(`${item.rocYear + 1911}: ${item.missingCasualtyCounts} casualty fields are blank. Totals sum recorded counts; blank values do not establish that there were no casualties.`);
    if (item.duplicatePartyKeys) warnings.push(`${item.rocYear + 1911}: ${item.duplicatePartyKeys} repeated accident/party keys need inspection; records were not silently deduplicated.`);
    if (item.invalidCoordinates) warnings.push(`${item.rocYear + 1911}: ${item.invalidCoordinates} party rows have invalid coordinates; these coordinates are excluded from mapping, while accidents remain in overall totals.`);
    if (item.outsideTaipei) warnings.push(`${item.rocYear + 1911}: ${item.outsideTaipei} party rows have coordinates outside the expected Taipei bounding box; inspect before interpreting them.`);
    const old = previous?.resources.find((r) => r.rocYear === item.rocYear);
    if (old && item.missingCoordinates / item.rows > old.missingCoordinates / old.rows + 0.05) warnings.push(`${item.rocYear + 1911}: missing-coordinate share increased by over 5 percentage points.`);
  }
  const newMeta = await readJson(join(outputDir, 'meta.json'));
  const oldMeta = await readJson(join(published, 'meta.json'));
  // A no-op rebuild must not generate a new commit solely for its timestamp.
  newMeta.generatedAt = oldMeta.generatedAt;
  await writeFile(join(outputDir, 'meta.json'), JSON.stringify(newMeta, null, 2));
  const provenance = unchanged ? previous : {
    id: source.id, title: source.title, landingPage: source.landingPage,
    publisher: source.publisher, license: source.license,
    sourceModifiedAt: catalog.result.modifiedDate,
    lastSuccessfulImportAt: checkedAt,
    coverageStart: validated.map((r) => r.coverageStart).sort()[0],
    coverageEnd: validated.map((r) => r.coverageEnd).sort().at(-1),
    resources: validated,
  };
  await writeFile(join(outputDir, 'source.json'), JSON.stringify(provenance, null, 2) + '\n');
  async function inventory(dir) {
    const result = [];
    for (const entry of await readdir(dir, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) result.push(resolve(entry.parentPath, entry.name).slice(dir.length + 1));
    }
    return result.sort();
  }
  const files = await inventory(outputDir);
  const oldFiles = await inventory(published);
  let changed = JSON.stringify(files) !== JSON.stringify(oldFiles);
  for (const file of files) {
    try { if (!(await readFile(join(outputDir, file))).equals(await readFile(join(published, file)))) changed = true; }
    catch (error) { if (error.code === 'ENOENT') changed = true; else throw error; }
  }
  if (changed) {
    newMeta.generatedAt = checkedAt;
    await writeFile(join(outputDir, 'meta.json'), JSON.stringify(newMeta, null, 2));
  }
  const report = `# Taipei data refresh\n\nSource: ${source.landingPage}\n\nChecked: ${checkedAt}${values['raw-dir'] ? ' (local snapshot verification; no remote CSV downloads)' : ''}\n\n${changed ? 'Validated snapshot differs from the published data.' : 'No data changes; published files left untouched.'}\n\nCoverage: ${provenance.coverageStart} through ${provenance.coverageEnd}.\n\n${comparison.table}\n\n## Review notes\n\n${warnings.length ? warnings.map((w) => '- ' + w).join('\n') : 'No threshold warnings.'}\n\nSchemas and known codes validated. Original CSVs are not included in the deployment. This PR requires review; it is not auto-merged.\n`;
  await writeFile(reportPath, report);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report, { flag: 'a' });
  if (changed && !values['dry-run']) {
    // Same-filesystem directory swap, with rollback if installing the snapshot fails.
    const backup = join(scratch, 'previous');
    await rename(published, backup);
    try { await rename(outputDir, published); }
    catch (error) { await rename(backup, published); throw error; }
  }
  console.log(`${values['dry-run'] ? 'Dry run complete' : 'Refresh complete'}: ${changed ? 'changes found' : 'no changes'}. Report: ${reportPath}`);
} catch (error) {
  const report = `# Taipei data refresh failed\n\n${error.message}\n\nPublished data was not replaced.\n`;
  await writeFile(reportPath, report);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, report, { flag: 'a' });
  throw error;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
