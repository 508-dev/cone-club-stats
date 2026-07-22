<script>
  import { onMount } from 'svelte';
  import L from 'leaflet';
  import Nav from '../shared/Nav.svelte';

  const YEARS = Array.from({ length: 10 }, (_, i) => 2016 + i); // geo coverage starts 2016
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
    const res = await fetch(`/data/heatmap/${y}.json`);
    const data = await res.json();
    cache.set(y, data);
    return data;
  }

  let fatalities = [];
  async function loadFatalities() {
    const res = await fetch('/data/fatalities.json');
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
      filtered.map((f) =>
        L.circleMarker([f.lat, f.lon], {
          radius: 5,
          color: '#7a1f1a',
          weight: 1,
          fillColor: '#b0413e',
          fillOpacity: 0.85,
        }).bindPopup(
          `<strong>${f.year}-${String(f.month).padStart(2, '0')}-${String(f.day).padStart(2, '0')}</strong><br/>` +
            `${f.district}<br/>` +
            `Deaths: ${f.deaths}, Injuries: ${f.injuries}<br/>` +
            `Involved: ${f.categories.join(', ')}`
        )
      )
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
    map = L.map(mapEl, { preferCanvas: true }).setView([25.0478, 121.5319], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const [metaRes] = await Promise.all([fetch('/data/meta.json'), loadFatalities()]);
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
        <option value="all">All years (2016–2025)</option>
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

    {#if meta}
      <p class="note">
        Source: Taipei City Police Traffic Division (data.taipei). Coordinates are only recorded
        from {meta.geoCoverageStartYear} onward; earlier accidents (2012–2015) aren't mapped here.
        Each grid cell is ~11m; heat intensity is the sum of the selected metric within a cell.
      </p>
    {/if}
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
</style>
