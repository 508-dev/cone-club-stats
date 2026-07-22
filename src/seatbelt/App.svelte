<script>
  import { onMount } from 'svelte';
  import Nav from '../shared/Nav.svelte';
  import StatTile from './StatTile.svelte';
  import LineChart from './LineChart.svelte';
  import StackedBar from './StackedBar.svelte';

  const CATEGORY_LABEL = {
    motorcycle: 'Motorcycle',
    car: 'Car',
    bicycle_slow: 'Bicycle / slow vehicle',
    pedestrian: 'Pedestrian',
    bus_truck: 'Bus / truck',
    passenger_other: 'Passenger / other',
    other: 'Other',
  };
  const CATEGORY_ORDER = ['motorcycle', 'car', 'bicycle_slow', 'bus_truck', 'passenger_other', 'pedestrian', 'other'];

  let peStats = [];
  let yearlySummary = [];
  let meta = null;
  let colors = { s1: '#2a78d6', s2: '#eb6834', s3: '#1baf7a' };

  let motoNonCompliancePct = null;
  let carNonCompliancePct = null;
  let motoKnownN = 0;
  let carKnownN = 0;
  let totalFatalitiesAnalyzed = 0;
  let peYears = [];
  let motoLine = [];
  let carLine = [];
  let barRows = [];

  onMount(async () => {
    const style = getComputedStyle(document.documentElement);
    colors = {
      s1: style.getPropertyValue('--series-1').trim(),
      s2: style.getPropertyValue('--series-2').trim(),
      s3: style.getPropertyValue('--series-3').trim(),
    };

    const [peRes, ySumRes, metaRes] = await Promise.all([
      fetch('/data/protective_equipment_stats.json'),
      fetch('/data/yearly_summary.json'),
      fetch('/data/meta.json'),
    ]);
    peStats = await peRes.json();
    yearlySummary = await ySumRes.json();
    meta = await metaRes.json();

    const peStartYear = meta.protectiveEquipmentCoverageStartYear;
    peYears = [...new Set(peStats.map((r) => r.year))].filter((y) => y >= peStartYear).sort((a, b) => a - b);

    // --- KPIs + trend lines for motorcycle (helmet) and car (seatbelt)
    function pctNotWorn(rows) {
      const wore = rows.reduce((a, r) => a + r.fatalWore, 0);
      const notWore = rows.reduce((a, r) => a + r.fatalNotWore, 0);
      const known = wore + notWore;
      return { pct: known > 0 ? (notWore / known) * 100 : null, n: known };
    }

    const motoRows = peStats.filter((r) => r.category === 'motorcycle' && r.year >= peStartYear);
    const carRows = peStats.filter((r) => r.category === 'car' && r.year >= peStartYear);
    const motoResult = pctNotWorn(motoRows);
    const carResult = pctNotWorn(carRows);
    motoNonCompliancePct = motoResult.pct;
    carNonCompliancePct = carResult.pct;
    motoKnownN = motoResult.n;
    carKnownN = carResult.n;
    totalFatalitiesAnalyzed = peStats
      .filter((r) => r.year >= peStartYear)
      .reduce((a, r) => a + r.fatalWore + r.fatalNotWore + r.fatalUnknown, 0);

    motoLine = peYears.map((y) => pctNotWorn(motoRows.filter((r) => r.year === y)).pct ?? 0);
    carLine = peYears.map((y) => pctNotWorn(carRows.filter((r) => r.year === y)).pct ?? 0);

    // --- Stacked bar: fatal + injured combined, by category, across the full PE-coverage window
    barRows = CATEGORY_ORDER.map((cat) => {
      const rows = peStats.filter((r) => r.category === cat && r.year >= peStartYear);
      const wore = rows.reduce((a, r) => a + r.fatalWore + r.injuredWore, 0);
      const notWore = rows.reduce((a, r) => a + r.fatalNotWore + r.injuredNotWore, 0);
      const unknown = rows.reduce((a, r) => a + r.fatalUnknown + r.injuredUnknown, 0);
      return {
        label: CATEGORY_LABEL[cat],
        segments: [
          { name: 'Wore', color: colors.s1, value: wore },
          { name: 'Did not wear', color: colors.s2, value: notWore },
          { name: 'Unknown', color: colors.s3, value: unknown },
        ],
      };
    }).filter((r) => r.segments.reduce((a, s) => a + s.value, 0) > 0);
  });

  $: yearlyYears = yearlySummary.map((r) => r.year);
  $: yearlyAccidents = yearlySummary.map((r) => r.accidents);
  $: yearlyDeaths = yearlySummary.map((r) => r.deaths);
  $: yearlyInjuries = yearlySummary.map((r) => r.injuries);
</script>

<Nav active="seatbelt" />

<div class="page">
  <section class="kpis">
    <StatTile
      label="Fatalities analyzed"
      value={totalFatalitiesAnalyzed.toLocaleString()}
      sub={meta ? `Taipei, ${meta.protectiveEquipmentCoverageStartYear}–2025` : ''}
    />
    <StatTile
      label="Motorcyclist deaths without a helmet"
      value={motoNonCompliancePct !== null ? `${motoNonCompliancePct.toFixed(0)}%` : '—'}
      sub={`of ${motoKnownN} fatalities with known status`}
    />
    <StatTile
      label="Car-occupant deaths without a seatbelt"
      value={carNonCompliancePct !== null ? `${carNonCompliancePct.toFixed(0)}%` : '—'}
      sub={`of ${carKnownN} fatalities with known status — small sample, read with caution`}
    />
  </section>

  {#if peYears.length > 0}
    <section class="charts">
      <LineChart
        title="Fatalities not wearing helmet/seatbelt, by year"
        categories={peYears}
        series={[
          { name: 'Motorcycle (helmet)', color: colors.s1, values: motoLine },
          { name: 'Car (seatbelt)', color: colors.s2, values: carLine },
        ]}
        yFormat={(v) => `${v.toFixed(0)}%`}
      />

      <StackedBar
        title="Protective-equipment status among deaths & injuries, by category"
        rows={barRows}
      />
    </section>
  {/if}

  <section class="charts small-multiples">
    <LineChart title="Accidents / year (Taipei, all A1+A2)" categories={yearlyYears} series={[{ name: 'Accidents', color: colors.s1, values: yearlyAccidents }]} yFormat={(v) => Math.round(v).toLocaleString()} height={160} />
    <LineChart title="Deaths / year" categories={yearlyYears} series={[{ name: 'Deaths', color: colors.s1, values: yearlyDeaths }]} yFormat={(v) => Math.round(v).toLocaleString()} height={160} />
    <LineChart title="Injuries / year" categories={yearlyYears} series={[{ name: 'Injuries', color: colors.s1, values: yearlyInjuries }]} yFormat={(v) => Math.round(v).toLocaleString()} height={160} />
  </section>

  {#if meta}
    <p class="note">
      Source: Taipei City Police Traffic Division (data.taipei), 2012–2025. Protective-equipment
      ("wore helmet/seatbelt") is only recorded from {meta.protectiveEquipmentCoverageStartYear}
      onward — earlier years aren't included in the compliance figures above. "Known status"
      excludes records coded unknown or not-applicable (e.g. pedestrians). Category is the
      involved person's own vehicle type, not necessarily who was at fault.
    </p>
  {/if}
</div>

<style>
  .page {
    max-width: 1000px;
    margin: 0 auto;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .kpis {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .small-multiples {
    grid-template-columns: repeat(3, 1fr);
  }
  @media (max-width: 800px) {
    .charts {
      grid-template-columns: 1fr;
    }
  }
  .note {
    font-size: 0.8rem;
    color: var(--muted);
    line-height: 1.5;
    border-top: 1px solid var(--border);
    padding-top: 1rem;
  }
</style>
