<script>
  import { contextLabel, speedLimitLabel } from '../shared/accident-context.js';
  export let accident;

  const categoryLabels = {
    pedestrian: 'Pedestrian',
    passenger_other: 'Passenger / other person',
    bus_truck: 'Bus / truck',
    car: 'Car',
    motorcycle: 'Motorcycle',
    bicycle_slow: 'Bicycle / slow vehicle',
    other: 'Other vehicle',
  };

  $: date = `${accident.year}-${String(accident.month).padStart(2, '0')}-${String(accident.day).padStart(2, '0')}`;
  $: hasTime = Number.isInteger(accident.hour) && accident.hour >= 0 && accident.hour < 24
    && Number.isInteger(accident.minute) && accident.minute >= 0 && accident.minute < 60;
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex (Focus lets keyboard users scroll the bounded detail region.) -->
<section aria-label="Accident details" tabindex="0">
  <div class="eyebrow">Fatal traffic accident</div>
  <h3><time datetime={date}>{date}</time></h3>
  <div class="time">
    {#if hasTime}
      {String(accident.hour).padStart(2, '0')}:{String(accident.minute).padStart(2, '0')} · Taiwan time
    {:else}
      Time not recorded
    {/if}
  </div>

  <div class="location">
    <strong>{accident.district === 'unknown' ? 'District not recorded' : accident.district}</strong>
    <div>{accident.location || 'Street location not recorded'}</div>
  </div>

  <dl class="casualties">
    <div><dt>Deaths</dt><dd>{accident.deaths}</dd></div>
    <div><dt>Injuries</dt><dd>{accident.injuries}</dd></div>
  </dl>

  <h4>Road users involved</h4>
  <ul>
    {#each accident.categories as category}
      <li>{categoryLabels[category] || category.replaceAll('_', ' ')}</li>
    {/each}
  </ul>
  <h4>Recorded conditions</h4>
  <dl class="conditions">
    {#each [['weather', 'Weather'], ['lighting', 'Lighting'], ['collision', 'Collision type'], ['speedLimit', 'Posted speed limit']] as [field, label]}
      <div>
        <dt>{label}</dt>
        <dd>
          {#if accident.context?.[field]?.length}
            {accident.context[field].map((code) => field === 'speedLimit'
              ? speedLimitLabel(code) : contextLabel(field, code, accident.context.codebook)).join(' · ')}
          {:else}
            Not recorded
          {/if}
        </dd>
      </div>
    {/each}
  </dl>
  <div class="footnote">Speed limits are recorded road limits, not measured vehicle speeds.</div>
  <div class="footnote">Categories indicate involvement, not fault.</div>
</section>

<style>
  section { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; max-height: 50svh; overflow-y: auto; }
  .eyebrow { color: var(--accent); font-size: 11px; font-weight: 600; padding-right: 12px; }
  h3 { font-size: 20px; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
  .time, .footnote { color: var(--muted); font-size: 11px; }
  .location { margin: 14px 0; }
  .location strong { display: block; margin-bottom: 3px; }
  .casualties { display: flex; gap: 28px; padding: 10px 0; margin: 0 0 12px; border-block: 1px solid var(--border); }
  dt { color: var(--muted); font-size: 11px; }
  dd { margin: 0; font-size: 22px; font-weight: 600; }
  h4 { margin: 0 0 6px; font-size: 12px; }
  ul { display: flex; flex-wrap: wrap; gap: 5px; list-style: none; padding: 0; margin: 0 0 10px; }
  li { border: 1px solid var(--border); border-radius: 5px; padding: 3px 7px; font-size: 11px; }
  .conditions { margin: 0 0 10px; }
  .conditions > div { margin: 0 0 6px; }
  .conditions dd { font-size: 12px; font-weight: 400; }
</style>
