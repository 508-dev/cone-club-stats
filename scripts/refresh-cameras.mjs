import { readFile, writeFile, mkdtemp, rename, rm } from 'node:fs/promises';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { cameraSource, cameraResource, prepareCameraSnapshot } from './data/cameras.mjs';
import { download } from './data/download.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: {
  'dry-run': { type: 'boolean', default: false }, catalog: { type: 'string' }, csv: { type: 'string' },
} });
if ((values.catalog || values.csv) && !values['dry-run']) throw new Error('Local camera overrides require --dry-run');
const scratch = await mkdtemp(join(root, '.data-refresh-'));
const published = join(root, 'public/data/cameras.json');
const reportPath = process.env.DATA_REPORT_PATH || join(root, '.camera-refresh-report.md');
async function report(text) {
  await writeFile(reportPath, text, { flag: process.env.DATA_REPORT_PATH ? 'a' : 'w' });
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, text, { flag: 'a' });
}
try {
  const catalogPath = values.catalog || join(scratch, 'catalog.json');
  if (!values.catalog) await download(cameraSource.catalogUrl, catalogPath);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const resource = cameraResource(catalog);
  const csvPath = values.csv || join(scratch, 'cameras.csv');
  if (!values.csv) await download(resource.url, csvPath);
  let previous = null;
  try { previous = JSON.parse(await readFile(published, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = prepareCameraSnapshot(catalog, await readFile(csvPath), previous, new Date().toISOString());
  await report(`\n## Fixed enforcement camera refresh\n\nSource: ${cameraSource.landingPage}\n\n${result.beforeCount ?? 'No prior snapshot'} → ${result.snapshot.cameras.length} camera locations. ${result.changed ? 'Snapshot changed.' : 'No changes; published file untouched.'}${values.csv ? ' Local CSV verification only.' : ''}\n\nCurrent inventory, updated irregularly; installation dates are not supplied.\n\n${result.warnings.map((w) => '- ' + w).join('\n')}\n`);
  if (result.changed && !values['dry-run']) {
    const staged = join(scratch, 'cameras.json');
    await writeFile(staged, JSON.stringify(result.snapshot, null, 2) + '\n');
    await rename(staged, published);
  }
  console.log(`Camera ${values['dry-run'] ? 'dry run' : 'refresh'} complete: ${result.changed ? 'changes found' : 'no changes'}`);
} catch (error) {
  await report(`\n## Fixed enforcement camera refresh failed\n\n${error.message}\n\nPrevious camera snapshot was not replaced.\n`);
  throw error;
} finally {
  await rm(scratch, { recursive: true, force: true });
}
