import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parse } from 'csv-parse/sync';

export const cameraSource = JSON.parse(await readFile(new URL('./camera-source.json', import.meta.url), 'utf8'));

export function cameraResource(catalog) {
  if (catalog.success !== true || catalog.result?.datasetId !== cameraSource.datasetId) throw new Error('Unexpected camera catalog response');
  const matches = catalog.result.distribution?.filter((r) => r.resourceDescription === cameraSource.resourceDescription);
  if (matches?.length !== 1) throw new Error('Camera location resource missing or duplicated');
  const resource = matches[0];
  if (resource.resourceFormat?.toUpperCase() !== 'CSV') throw new Error('Camera resource is no longer CSV');
  const url = new URL(resource.resourceDownloadUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'data.taipei') throw new Error('Unexpected camera download host');
  const declared = resource.resourceCharacterEncoding?.toLowerCase().replaceAll('-', '');
  const encoding = ({ big5: 'big5', utf8: 'utf-8' })[declared];
  if (!encoding) throw new Error(`Unsupported camera encoding: ${resource.resourceCharacterEncoding}`);
  return { url: url.href, encoding };
}

export function prepareCameraSnapshot(catalog, bytes, previous, importedAt) {
  const resource = cameraResource(catalog);
  const text = new TextDecoder(resource.encoding, { fatal: true }).decode(bytes);
  const rows = parse(text, { bom: true, skip_empty_lines: true, columns(headers) {
    if (JSON.stringify(headers) !== JSON.stringify(cameraSource.headers)) throw new Error('Camera columns changed; review the adapter');
    return headers;
  } });
  if (!rows.length) throw new Error('Camera inventory is empty');
  const ids = new Set();
  const cameras = rows.map((row, i) => {
    const fail = (message) => { throw new Error(`Camera row ${i + 1}: ${message}`); };
    const id = row['編號'].trim();
    if (!id || ids.has(id)) fail('missing or duplicate camera ID');
    ids.add(id);
    const latText = row['緯度'].trim();
    const lonText = row['經度'].trim();
    const lat = Number(latText), lon = Number(lonText);
    if (!latText || !lonText || !Number.isFinite(lat) || !Number.isFinite(lon)
        || lat < 24.8 || lat > 25.3 || lon < 121.3 || lon > 121.8) fail('missing or implausible Taipei coordinates');
    if (row['縣市代碼'].trim() !== '63000') fail('unexpected city');
    if (!row['功能'].trim() || !row['設置路段'].trim()) fail('missing function or road');
    const rawSpeedLimit = row['速限-速度限制'].trim();
    const speedLimit = rawSpeedLimit === '\\' ? '' : rawSpeedLimit;
    return { id, lat, lon, function: row['功能'].trim(), road: row['設置路段'].trim(),
      location: row['設置地點'].trim(), district: row['轄區'].trim(),
      direction: row['拍攝方向'].trim(), speedLimit,
      ...(rawSpeedLimit === '\\' ? { speedLimitRaw: rawSpeedLimit } : {}) };
  }).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const unchangedSource = previous?.source.sha256 === sha256
    && previous.source.resourceUrl === resource.url && previous.source.encoding === resource.encoding;
  const snapshot = { source: unchangedSource ? previous.source : {
    id: cameraSource.id, title: cameraSource.title, landingPage: cameraSource.landingPage,
    publisher: cameraSource.publisher, license: cameraSource.license, cadence: cameraSource.cadence,
    resourceUrl: resource.url, encoding: resource.encoding, sha256,
    sourceModifiedAt: catalog.result.modifiedDate, lastSuccessfulImportAt: importedAt,
  }, cameras };
  const warnings = [];
  const beforeCount = previous?.cameras.length;
  if (beforeCount && Math.abs(cameras.length - beforeCount) > Math.max(5, beforeCount * 0.1)) warnings.push('Camera count changed by more than 10% (and 5); inspect additions/removals.');
  const missing = cameras.filter((c) => !c.location || !c.district || !c.direction || !c.speedLimit).length;
  if (missing) warnings.push(`${missing} camera records have missing optional detail fields.`);
  return { snapshot, changed: JSON.stringify(previous) !== JSON.stringify(snapshot), warnings, beforeCount };
}
