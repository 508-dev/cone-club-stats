<script>
  import { onMount, mount, unmount } from 'svelte';
  import L from 'leaflet';
  import Nav from '../shared/Nav.svelte';
  import SourceCoverage from '../shared/SourceCoverage.svelte';
  import AccidentPopup from './AccidentPopup.svelte';

  $: YEARS = (meta?.sourceYearsRoc ?? []).map((y) => y + 1911)
    .filter((y) => y >= meta.geoCoverageStartYear);
  const METRICS = [
    { key: 2, label: 'All accidents' },
    { key: 3, label: 'Deaths' },
    { key: 4, label: 'Injuries' },
    { key: 5, label: 'Pedestrian-involved' },
  ];

  let year = 'all';
  let metricIdx = 0;
  let showFatalities = true;
  let mapEl;
  let map;
  let heatLayer;
  let fatalityLayer;
  let meta = null;
  let loading = true;
  let cellCount = 0;
  let totalForMetric = 0;
  let fatalitiesInView = 0;

  const cache = new Map();
  async function loadHeatmap(y) {
    if (cache.has(y)) return cache.get(y);
    const res = await fetch(`${import.meta.env.BASE_URL}data/heatmap/${y}.json`);
    const data = await res.json();
    cache.set(y, data);
    return data;
  }

  let fatalities = [];
  async function loadFatalities() {
    const res = await fetch(`${import.meta.env.BASE_URL}data/fatalities.json`);
    fatalities = await res.json();
  }

  function percentile(sortedArr, p) {
    if (!sortedArr.length) return 1;
    const idx = Math.min(sortedArr.length - 1, Math.floor(sortedArr.length * p));
    return sortedArr[idx];
  }

  function renderHeat(grid) {
    const metric = METRICS[metricIdx].key;
    const points = grid.filter((c) => c[metric] > 0).map((c) => [c[0], c[1], c[metric]]);
    totalForMetric = grid.reduce((sum, c) => sum + c[metric], 0);
    cellCount = points.length;
    if (heatLayer) map.removeLayer(heatLayer);
    // leaflet.heat accumulates every point within its blur radius, so with dense city-wide
    // data the naive per-point weight saturates the whole map at the default max of 1.
    // Scale `max` to the current metric/year's own distribution so hotspots stay visible.
    const weights = points.map((p) => p[2]).sort((a, b) => a - b);
    const heatMax = Math.max(1, percentile(weights, 0.97) * 3);
    heatLayer = L.heatLayer(points, {
      radius: 10,
      blur: 15,
      maxZoom: 17,
      max: heatMax,
      gradient: { 0.2: '#2b6cb0', 0.45: '#d69e2e', 0.7: '#dd6b20', 1: '#b0413e' },
    }).addTo(map);
  }

  function renderFatalities() {
    if (fatalityLayer) map.removeLayer(fatalityLayer);
    if (!showFatalities) {
      fatalitiesInView = 0;
      return;
    }
    const filtered = year === 'all' ? fatalities : fatalities.filter((f) => f.year === year);
    fatalitiesInView = filtered.length;
    fatalityLayer = L.layerGroup(
      filtered.map((f) => {
        let popupComponent;
        const marker = L.circleMarker([f.lat, f.lon], {
          radius: 8,
          color: '#7a1f1a',
          weight: 1,
          fillColor: '#b0413e',
          fillOpacity: 0.85,
        }).bindPopup(() => {
          if (popupComponent) unmount(popupComponent);
          const target = document.createElement('div');
          popupComponent = mount(AccidentPopup, { target, props: { accident: f } });
          return target;
        }, { className: 'accident-popup', maxWidth: 280, minWidth: 220 });
        marker.on('popupopen', () => marker.setStyle({ weight: 3, fillOpacity: 1 }));
        marker.on('popupclose', () => {
          marker.setStyle({ weight: 1, fillOpacity: 0.85 });
          if (popupComponent) unmount(popupComponent);
          popupComponent = null;
        });
        return marker;
      })
    ).addTo(map);
  }

  async function refresh() {
    loading = true;
    const grid = await loadHeatmap(year);
    renderHeat(grid);
    renderFatalities();
    loading = false;
  }

  onMount(async () => {
    map = L.map(mapEl, { renderer: L.canvas({ pane: 'accidents', tolerance: 8 }) }).setView([25.0478, 121.5319], 12);
    // Keep marker hit targets above the heat canvas, including after filter changes.
    map.createPane('accidents').style.zIndex = '450';
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const [metaRes] = await Promise.all([fetch(`${import.meta.env.BASE_URL}data/meta.json`), loadFatalities()]);
    meta = await metaRes.json();
    await refresh();
  });

  $: if (map) {
    year, metricIdx, showFatalities;
    refresh();
  }
</script>

<Nav active="map" />

<div class="layout">
  <aside class="card controls">
    <h2>Filters</h2>

    <label>
      Year
      <select bind:value={year}>
        <option value="all">All years{YEARS.length ? ` (${YEARS[0]}–${YEARS.at(-1)})` : ''}</option>
        {#each YEARS as y}
          <option value={y}>{y}</option>
        {/each}
      </select>
    </label>

    <label>
      Heatmap weight
      <select bind:value={metricIdx}>
        {#each METRICS as m, i}
          <option value={i}>{m.label}</option>
        {/each}
      </select>
    </label>

    <label class="checkbox">
      <input type="checkbox" bind:checked={showFatalities} />
      Show fatal-accident markers
    </label>

    <div class="stats">
      <div><span class="num">{totalForMetric.toLocaleString()}</span><span class="lbl">{METRICS[metricIdx].label.toLowerCase()} (weighted)</span></div>
      <div><span class="num">{cellCount.toLocaleString()}</span><span class="lbl">grid cells shown</span></div>
      {#if showFatalities}
        <div><span class="num">{fatalitiesInView.toLocaleString()}</span><span class="lbl">fatal-accident markers</span></div>
      {/if}
    </div>

    <p class="note marker-hint">Click or tap a red dot for accident details. Zoom in to separate nearby markers.</p>

    {#if meta}
      <p class="note">
        Source: Taipei City Police Traffic Division (data.taipei). Coordinates are only recorded
        from {meta.geoCoverageStartYear} onward; earlier accidents (2012–2015) aren't mapped here.
        Each grid cell is ~11m; heat intensity is the sum of the selected metric within a cell.
      </p>
    {/if}
    <SourceCoverage />
  </aside>

  <div class="map-wrap">
    <div class="map" bind:this={mapEl}></div>
    {#if loading}
      <div class="loading">Loading…</div>
    {/if}
  </div>
</div>

<style>
  .layout {
    display: flex;
    height: calc(100vh - 49px);
  }
  .controls {
    width: 280px;
    flex-shrink: 0;
    margin: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    overflow-y: auto;
  }
  .controls h2 {
    margin: 0;
    font-size: 1rem;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    font-size: 0.85rem;
    color: var(--muted);
  }
  label.checkbox {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }
  select {
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid var(--border);
    background: var(--bg);
    color: var(--fg);
  }
  .stats {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border-top: 1px solid var(--border);
    padding-top: 0.75rem;
  }
  .stats > div {
    display: flex;
    flex-direction: column;
  }
  .num {
    font-size: 1.4rem;
    font-weight: 600;
  }
  .lbl {
    font-size: 0.75rem;
    color: var(--muted);
  }
  .note {
    font-size: 0.75rem;
    color: var(--muted);
    line-height: 1.4;
  }
  .marker-hint {
    margin: 0;
  }
  :global(.accident-popup .leaflet-popup-content-wrapper),
  :global(.accident-popup .leaflet-popup-tip) {
    background: var(--card-bg);
    color: var(--fg);
  }
  :global(.accident-popup .leaflet-popup-content) {
    margin: 18px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  :global(.leaflet-container .accident-popup a.leaflet-popup-close-button) {
    width: 32px;
    height: 32px;
    line-height: 32px;
    color: var(--muted);
  }
  .map-wrap {
    position: relative;
    flex: 1;
    margin: 1rem 1rem 1rem 0;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border);
  }
  .map {
    width: 100%;
    height: 100%;
  }
  .loading {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    background: var(--card-bg);
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    z-index: 1000;
  }
  @media (max-width: 640px) {
    .layout {
      flex-direction: column;
      height: auto;
    }
    .controls {
      width: auto;
      max-height: 38svh;
      margin: 0.75rem;
    }
    .map-wrap {
      flex: none;
      height: 65svh;
      min-height: 360px;
      margin: 0 0.75rem 0.75rem;
    }
  }
</style>
