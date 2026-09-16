<script>
  export let camera;
  export let source;
</script>

<section aria-label="Camera details">
  <div class="eyebrow">Fixed enforcement camera</div>
  <h3>{camera.road}</h3>
  <div>{camera.location || 'Location detail not recorded'}</div>
  <dl>
    {#each [['function', 'Enforcement'], ['district', 'District'], ['direction', 'Recorded direction'], ['speedLimit', 'Posted speed limit (km/h)']] as [field, label]}
      <div><dt>{label}</dt><dd>{camera[field] || 'Not recorded'}</dd></div>
    {/each}
  </dl>
  <p>Current inventory, independent of the accident year. Installation dates are not supplied.</p>
  <div class="source">Imported {source.lastSuccessfulImportAt.slice(0, 10)} · <a href={source.landingPage} target="_blank" rel="noreferrer">Government source</a></div>
</section>

<style>
  section { font-size: 13px; line-height: 1.45; overflow-wrap: anywhere; max-height: 50svh; overflow-y: auto; }
  .eyebrow { color: var(--series-1); font-size: 11px; font-weight: 600; padding-right: 12px; }
  h3 { margin: 5px 0; font-size: 17px; white-space: pre-line; }
  dl { margin: 14px 0; }
  dl > div { margin-bottom: 8px; }
  dt, p, .source { color: var(--muted); font-size: 11px; }
  dd { margin: 2px 0 0; white-space: pre-line; }
  p { margin: 10px 0; }
  a { color: var(--series-1); }
</style>
