<script>
  import { onMount } from 'svelte';
  let source = null;
  onMount(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/source.json`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => { source = value; })
      .catch(() => {});
    return () => controller.abort();
  });
</script>

{#if source}
  <div class="coverage">
    <div>Source records: <time datetime={source.coverageStart}>{source.coverageStart}</time>–<time datetime={source.coverageEnd}>{source.coverageEnd}</time></div>
    <div>Imported: <time datetime={source.lastSuccessfulImportAt}>{source.lastSuccessfulImportAt.slice(0, 10)}</time></div>
    <div>Published annually. Map and equipment coverage varies by year.</div>
    <a href={source.landingPage} target="_blank" rel="noreferrer">Government source</a>
    · <a href="https://github.com/508-dev/cone-club-stats/actions/workflows/refresh-data.yml" target="_blank" rel="noreferrer">Latest update check</a>
  </div>
{/if}

<style>
  .coverage { font-size: 0.75rem; color: var(--muted); line-height: 1.6; }
  a { color: var(--accent); }
</style>
