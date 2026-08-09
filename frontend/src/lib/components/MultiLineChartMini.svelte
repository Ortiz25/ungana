<script>
  // Multi-series sibling of AreaChartMini — one line per series (no fill,
  // area shading from several overlapping series reads as noise rather
  // than signal), sharing a single y-scale across all of them so line
  // heights stay comparable. Same hand-rolled SVG conventions as the other
  // *Mini chart components: viewBox="0 0 100 100", non-scaling stroke.
  let {
    days = [],
    series = [], // [{ siteId, siteName, data: number[] }] — data[i] aligns with days[i]
    colors = ['#C45C38', '#5B8ED6', '#4E8050', '#CC8830', '#B565A7', '#5AAFAE'],
    height = 160,
    showGrid = true,
    showXLabels = true,
    showYLabels = true,
    showLegend = true,
    yAxisWidth = 32,
    labelColor = '#AECAAE',
    labelSize = 9
  } = $props();

  const n = $derived(days.length);
  const max = $derived(Math.max(0.0001, ...series.flatMap((s) => s.data.map((v) => Number(v) || 0))));

  function formatAxisValue(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
    return v.toFixed(1);
  }

  function yv(val) {
    return 98 - (val / max) * 92;
  }
  function xv(i) {
    return n <= 1 ? 0 : (i / (n - 1)) * 100;
  }

  function linePath(data) {
    return data.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xv(i)} ${yv(Number(v) || 0)}`).join(' ');
  }

  const labelIdx = $derived.by(() => {
    if (n === 0) return [];
    if (n <= 7) return days.map((_, i) => i);
    const step = Math.ceil(n / 6);
    const idx = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  });

  function formatDay(dateStr) {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
</script>

<div style="width: 100%; display: flex; flex-direction: column;">
  <div style="height: {height}px; display: flex; flex-direction: column;">
    <div style="flex: 1; min-height: 0; display: flex;">
      {#if showYLabels}
        <div style="position: relative; width: {yAxisWidth}px; flex-shrink: 0;">
          {#each [0, 25, 50, 75, 100] as g}
            <span
              style="position: absolute; right: 4px; top: {g}%; transform: translateY(-50%); color: {labelColor}; font-size: {labelSize}px; white-space: nowrap;"
              >{formatAxisValue(max * (1 - g / 100))}</span
            >
          {/each}
        </div>
      {/if}
      <div style="flex: 1; min-height: 0; position: relative;">
        {#if showGrid}
          {#each [0, 25, 50, 75, 100] as g}
            <div style="position: absolute; left: 0; right: 0; top: {g}%; border-top: 1px dashed rgba(255,255,255,0.12);"></div>
          {/each}
        {/if}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="display: block; position: absolute; inset: 0; width: 100%; height: 100%;">
          {#each series as s, i (s.siteId ?? i)}
            <path
              d={linePath(s.data)}
              fill="none"
              stroke={colors[i % colors.length]}
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
            />
          {/each}
        </svg>
      </div>
    </div>
    {#if showXLabels && n > 0}
      <div style="display: flex;">
        {#if showYLabels}<div style="width: {yAxisWidth}px; flex-shrink: 0;"></div>{/if}
        <div style="flex: 1; min-width: 0; position: relative; height: 14px; margin-top: 2px;">
          {#each labelIdx as i}
            <span
              style="position: absolute; left: {xv(i)}%; transform: translateX(-50%); color: {labelColor}; font-size: {labelSize}px; white-space: nowrap;"
              >{formatDay(days[i])}</span
            >
          {/each}
        </div>
      </div>
    {/if}
  </div>

  {#if showLegend && series.length > 0}
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; padding-left: {showYLabels ? yAxisWidth : 0}px;">
      {#each series as s, i (s.siteId ?? i)}
        <div style="display: flex; align-items: center; gap: 5px;">
          <span style="width: 8px; height: 8px; border-radius: 50%; background: {colors[i % colors.length]}; flex-shrink: 0;"></span>
          <span style="font-size: {labelSize}px; color: {labelColor};">{s.siteName}</span>
        </div>
      {/each}
    </div>
  {/if}
</div>
