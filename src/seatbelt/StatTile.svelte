<script>
  export let label;
  export let value;
  export let sub = '';
</script>

<div class="tile card">
  <span class="value">{value}</span>
  <span class="label">{label}</span>
  {#if sub}<span class="sub">{sub}</span>{/if}
</div>

<style>
  .tile {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 200px;
  }
  .value {
    font-size: 2.2rem;
    font-weight: 600;
    line-height: 1.1;
  }
  .label {
    font-size: 0.85rem;
    color: var(--muted);
  }
  .sub {
    font-size: 0.75rem;
    color: var(--muted);
  }
</style>
