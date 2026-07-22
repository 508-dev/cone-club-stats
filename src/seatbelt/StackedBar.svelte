<script>
  // Horizontal stacked bar. rows: [{ label, segments: [{name, color, value}] }]
  export let rows = [];
  export let title = '';

  let tableView = false;
  let hover = null; // { rowIdx, segIdx }

  $: segmentNames = rows[0]?.segments.map((s) => s.name) ?? [];
  $: maxTotal = Math.max(...rows.map((r) => r.segments.reduce((a, s) => a + s.value, 0)), 1);
</script>

<div class="chart-card card">
  <div class="chart-header">
    {#if title}<h3>{title}</h3>{/if}
    <button class="toggle" on:click={() => (tableView = !tableView)}>
      {tableView ? 'Show chart' : 'Show table'}
    </button>
  </div>

  <ul class="legend">
    {#each rows[0]?.segments ?? [] as s}
      <li><span class="swatch" style="background:{s.color}"></span>{s.name}</li>
    {/each}
  </ul>

  {#if tableView}
    <table>
      <thead>
        <tr>
          <th>Category</th>
          {#each segmentNames as name}<th>{name}</th>{/each}
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as row}
          <tr>
            <td>{row.label}</td>
            {#each row.segments as s}<td>{s.value}</td>{/each}
            <td>{row.segments.reduce((a, s) => a + s.value, 0)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <div class="bars">
      {#each rows as row, rowIdx}
        {@const total = row.segments.reduce((a, s) => a + s.value, 0)}
        <div class="bar-row">
          <span class="row-label">{row.label}</span>
          <div class="track">
            {#each row.segments as seg, segIdx}
              {@const pct = (seg.value / maxTotal) * 100}
              {#if pct > 0}
                <div
                  class="segment"
                  role="presentation"
                  style="width:{pct}%; background:{seg.color}"
                  on:mouseenter={() => (hover = { rowIdx, segIdx })}
                  on:mouseleave={() => (hover = null)}
                ></div>
              {/if}
            {/each}
          </div>
          <span class="row-total">{total.toLocaleString()}</span>
        </div>
      {/each}
    </div>
    {#if hover}
      <div class="tooltip">
        <strong>{rows[hover.rowIdx].label}</strong>
        <div>{rows[hover.rowIdx].segments[hover.segIdx].name}: {rows[hover.rowIdx].segments[hover.segIdx].value}</div>
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
  .bars {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 110px 1fr 60px;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
  }
  .row-label {
    color: var(--muted);
  }
  .row-total {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .track {
    display: flex;
    height: 18px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    gap: 2px;
  }
  .segment {
    height: 100%;
  }
  .tooltip {
    position: absolute;
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.4rem 0.6rem;
    font-size: 0.75rem;
    pointer-events: none;
    right: 1rem;
    top: 2.5rem;
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
