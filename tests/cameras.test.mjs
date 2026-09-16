import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, cp, symlink, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { cameraSource, cameraResource, prepareCameraSnapshot } from '../scripts/data/cameras.mjs';

const catalog = { success: true, result: { datasetId: 130111, modifiedDate: '2026-03-10 16:46:13', distribution: [
  { resourceDescription: cameraSource.resourceDescription, resourceDownloadUrl: 'https://data.taipei/cameras/download',
    resourceFormat: 'CSV', resourceCharacterEncoding: 'BIG5' },
  { resourceDescription: 'Unrelated enforcement totals', resourceFormat: 'CSV' },
] } };
const bytes = await readFile(new URL('./fixtures/cameras-big5.csv', import.meta.url));
const importedAt = '2026-09-16T00:00:00Z';
const snapshot = () => prepareCameraSnapshot(catalog, bytes, null, importedAt);

function utf8Catalog() {
  const value = structuredClone(catalog);
  value.result.distribution[0].resourceCharacterEncoding = 'UTF-8';
  return value;
}
const text = new TextDecoder('big5', { fatal: true }).decode(bytes);

test('camera discovery selects inventory, rejects missing/duplicate resources, unknown formats and encodings', () => {
  assert.equal(cameraResource(catalog).encoding, 'big5');
  for (const edit of [
    (c) => { c.result.datasetId = 1; },
    (c) => { c.result.distribution = []; },
    (c) => { c.result.distribution.push(c.result.distribution[0]); },
    (c) => { c.result.distribution[0].resourceFormat = 'XML'; },
    (c) => { c.result.distribution[0].resourceCharacterEncoding = 'unknown'; },
    (c) => { c.result.distribution[0].resourceDownloadUrl = 'https://example.com/cameras'; },
  ]) { const value = structuredClone(catalog); edit(value); assert.throws(() => cameraResource(value)); }
});

test('Big5 camera records preserve directional speed limits, raw function and optional missing details', () => {
  const result = snapshot();
  assert.equal(result.snapshot.cameras.length, 2);
  assert.equal(result.snapshot.cameras[0].function, '測速');
  assert.equal(result.snapshot.cameras[0].direction, '南北雙向');
  assert.equal(result.snapshot.cameras[0].speedLimit, '50(往北)\n60(往南)');
  assert.equal(result.snapshot.cameras[1].speedLimit, '');
  assert.equal(result.snapshot.cameras[1].speedLimitRaw, '\\');
  assert.equal(result.warnings.length, 1);
  assert.match(result.snapshot.source.sha256, /^[a-f0-9]{64}$/);
});

test('camera snapshot no-op retains import time while changed records require review', () => {
  const previous = snapshot().snapshot;
  const repeated = prepareCameraSnapshot(catalog, bytes, previous, '2099-01-01T00:00:00Z');
  assert.equal(repeated.changed, false);
  assert.equal(repeated.snapshot.source.lastSuccessfulImportAt, importedAt);
  const changed = prepareCameraSnapshot(utf8Catalog(), Buffer.from(text.replace('測試路口', '新路口')), previous, '2026-09-17T00:00:00Z');
  assert.equal(changed.changed, true);
  assert.equal(changed.snapshot.cameras[0].location, '新路口');
});

test('invalid downloads, schema drift, duplicate IDs and bad coordinates stop imports', () => {
  for (const content of [
    '<html>Error</html>', text.replace('設置路段', 'renamed'),
    text.replace('25.04', ''), text.replace('121.53', '25.04'),
    text.replace('2,闖紅燈', '1,闖紅燈'), text.replace('63000', '64000'),
  ]) assert.throws(() => prepareCameraSnapshot(utf8Catalog(), Buffer.from(content), null, importedAt));
  assert.throws(() => prepareCameraSnapshot(utf8Catalog(), bytes, null, importedAt), /encoded data/);
});

test('standalone dry run preserves camera snapshot on success and failure', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'camera-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await cp(resolve('scripts'), join(dir, 'scripts'), { recursive: true });
  await symlink(resolve('node_modules'), join(dir, 'node_modules'), 'dir');
  await mkdir(join(dir, 'public/data'), { recursive: true });
  const published = JSON.stringify(snapshot().snapshot, null, 2) + '\n';
  await writeFile(join(dir, 'public/data/cameras.json'), published);
  await writeFile(join(dir, 'catalog.json'), JSON.stringify(catalog));
  await writeFile(join(dir, 'cameras.csv'), bytes);
  const run = () => spawnSync(process.execPath, ['scripts/refresh-cameras.mjs', '--dry-run', '--catalog', 'catalog.json', '--csv', 'cameras.csv'], { cwd: dir, encoding: 'utf8' });
  assert.equal(run().status, 0);
  assert.match(await readFile(join(dir, '.camera-refresh-report.md'), 'utf8'), /No changes/);
  await writeFile(join(dir, 'cameras.csv'), '<html>Error</html>');
  assert.notEqual(run().status, 0);
  assert.equal(await readFile(join(dir, 'public/data/cameras.json'), 'utf8'), published);
  assert.match(await readFile(join(dir, '.camera-refresh-report.md'), 'utf8'), /failed/);
});
