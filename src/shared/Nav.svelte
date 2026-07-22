<script>
  export let active = 'map';
</script>

<nav class="top">
  <span class="brand">Taipei Traffic Accidents</span>
  <a href="/index.html" class:active={active === 'map'}>Map</a>
  <a href="/seatbelt.html" class:active={active === 'seatbelt'}>Protective Equipment</a>
</nav>
