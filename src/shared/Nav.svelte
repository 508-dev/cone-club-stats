<script>
  export let active = 'map';
</script>

<nav class="top">
  <span class="brand">Taipei Traffic Accidents</span>
  <a href={`${import.meta.env.BASE_URL}index.html`} class:active={active === 'map'}>Map</a>
  <a href={`${import.meta.env.BASE_URL}seatbelt.html`} class:active={active === 'seatbelt'}>Protective Equipment</a>
</nav>
