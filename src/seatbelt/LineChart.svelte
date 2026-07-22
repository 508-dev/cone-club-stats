<script>
  // Generic small multi-series line chart. series: [{ name, color, values: number[] }]
  // categories: string[] (x-axis labels, e.g. years) shared across all series.
  export let categories = [];
  export let series = [];
  export let title = '';
  export let yFormat = (v) => String(v);
  export let height = 220;

  let tableView = false;
  let hoverIdx = null;

  const width = 640;
  const padding = { top: 16, right: 16, bottom: 28, left: 44 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  $: allValues = series.flatMap((s) => s.values);
  $: maxV = Math.max(...allValues, 0);
  $: minV = Math.min(...allValues, 0);
  $: yScale = (v) => padding.top + plotH - ((v - minV) / (maxV - minV || 1)) * plotH;
  $: xScale = (i) => padding.left + (categories.length > 1 ? (i / (categories.length - 1)) * plotW : plotW / 2);
  $: ticks = 4;
  $: tickValues = Array.from({ length: ticks + 1 }, (_, i) => minV + ((maxV - minV) * i) / ticks);

  function pathFor(values) {
    return values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(v)}`).join(' ');
  }

  function handleMove(evt) {
    const rect = evt.currentTarget.getBoundingClientRect();
    const x = evt.clientX - rect.left;
    const relX = ((x - padding.left) / plotW) * (categories.length - 1);
    hoverIdx = Math.min(categories.length - 1, Math.max(0, Math.round(relX)));
  }
</script>

<div class="chart-card card">
  <div class="chart-header">
    {#if title}<h3>{title}</h3>{/if}
    <button class="toggle" on:click={() => (tableView = !tableView)}>
      {tableView ? 'Show chart' : 'Show table'}
    </button>
  </div>

  {#if series.length > 1}
    <ul class="legend">
      {#each series as s}
        <li><span class="swatch" style="background:{s.color}"></span>{s.name}</li>
      {/each}
    </ul>
  {/if}

  {#if tableView}
    <table>
      <thead>
        <tr>
          <th>Year</th>
          {#each series as s}<th>{s.name}</th>{/each}
        </tr>
      </thead>
      <tbody>
        {#each categories as cat, i}
          <tr>
            <td>{cat}</td>
            {#each series as s}<td>{yFormat(s.values[i])}</td>{/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {:else if categories.length === 0}
    <p class="empty">Loading…</p>
  {:else}
    <svg viewBox="0 0 {width} {height}" role="img" aria-label={title} on:mousemove={handleMove} on:mouseleave={() => (hoverIdx = null)}>
      {#each tickValues as tv}
        <line x1={padding.left} x2={width - padding.right} y1={yScale(tv)} y2={yScale(tv)} class="grid" />
        <text x={padding.left - 8} y={yScale(tv) + 4} class="axis-label" text-anchor="end">{yFormat(tv)}</text>
      {/each}

      {#each categories as cat, i}
        {#if i === 0 || i === categories.length - 1 || i === hoverIdx}
          <text x={xScale(i)} y={height - 8} class="axis-label" text-anchor="middle">{cat}</text>
        {/if}
      {/each}

      {#if hoverIdx !== null}
        <line x1={xScale(hoverIdx)} x2={xScale(hoverIdx)} y1={padding.top} y2={height - padding.bottom} class="hover-line" />
      {/if}

      {#each series as s}
        <path d={pathFor(s.values)} fill="none" stroke={s.color} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        {#each s.values as v, i}
          {#if i === categories.length - 1 || i === hoverIdx}
            <circle cx={xScale(i)} cy={yScale(v)} r="5" fill={s.color} stroke="var(--card-bg)" stroke-width="2" />
          {/if}
        {/each}
        <text x={xScale(categories.length - 1) + 6} y={yScale(s.values[s.values.length - 1]) + 4} class="end-label" fill="var(--fg)">
          {yFormat(s.values[s.values.length - 1])}
        </text>
      {/each}
    </svg>

    {#if hoverIdx !== null}
      <div class="tooltip">
        <strong>{categories[hoverIdx]}</strong>
        {#each series as s}
          <div><span class="swatch" style="background:{s.color}"></span>{s.name}: {yFormat(s.values[hoverIdx])}</div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .chart-card {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    position: relative;
  }
  .chart-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h3 {
    margin: 0;
    font-size: 0.95rem;
  }
  .toggle {
    font-size: 0.75rem;
    color: var(--muted);
    background: none;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }
  .legend {
    list-style: none;
    display: flex;
    gap: 1rem;
    margin: 0;
    padding: 0;
    font-size: 0.8rem;
    color: var(--fg);
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    display: inline-block;
  }
  svg {
    width: 100%;
    height: auto;
  }
  .empty {
    color: var(--muted);
    font-size: 0.8rem;
    padding: 2rem 0;
    text-align: center;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .hover-line {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .axis-label {
    fill: var(--muted);
    font-size: 10px;
  }
  .end-label {
    font-size: 11px;
    font-weight: 600;
  }
  .tooltip {
    position: absolute;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    pointer-events: none;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8rem;
  }
  th,
  td {
    text-align: right;
    padding: 0.3rem 0.5rem;
    border-bottom: 1px solid var(--border);
    font-variant-numeric: tabular-nums;
  }
  th:first-child,
  td:first-child {
    text-align: left;
  }
</style>
