<script>
  // Hand-rolled replacement for recharts <AreaChart>.
  // Draws a smooth-ish area with a gradient fill under the line, optional
  // horizontal gridlines and x-axis labels. Responsive via viewBox +
  // preserveAspectRatio="none" with a non-scaling stroke so the line keeps
  // a constant width at any container size.
  let {
    data = [],
    yKey = 'earnings',
    xKey = null,
    color = '#C45C38',
    height = 140,
    showGrid = true,
    showXLabels = true,
    showYLabels = false,
    yAxisWidth = 30,
    labelColor = '#AECAAE',
    labelSize = 9
  } = $props();

  const gid = 'og-' + Math.random().toString(36).slice(2, 9);

  // The real max can be a small fraction (e.g. 0.4 KES for a low-volume
  // activator) — floor(1) only matters as a divide-by-zero guard for an
  // all-zero series, not as a "minimum scale" (that flattened everything
  // below 1 into looking identical, on top of not being labelled at all).
  const max = $derived(Math.max(0.0001, ...data.map((d) => Number(d[yKey]) || 0)));
  const n = $derived(data.length);

  // Compact axis labels: whole numbers as-is, sub-1 values to 1 decimal
  // (so 0.4 KES reads as "0.4" instead of rounding away to "0"), large
  // ones abbreviated.
  function formatAxisValue(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
    return v.toFixed(1);
  }

  // y in a 0..100 viewBox, leaving 6% headroom top and 2% bottom
  function yv(val) {
    return 98 - (val / max) * 92;
  }
  function xv(i) {
    return n <= 1 ? 0 : (i / (n - 1)) * 100;
  }

  const linePath = $derived(
    data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xv(i)} ${yv(Number(d[yKey]) || 0)}`).join(' ')
  );
  const areaPath = $derived(n > 0 ? `${linePath} L 100 100 L 0 100 Z` : '');

  // Show a subset of x labels to avoid clutter (first, last, and a few between)
  const labelIdx = $derived.by(() => {
    if (!xKey || n === 0) return [];
    if (n <= 7) return data.map((_, i) => i);
    const step = Math.ceil(n / 6);
    const idx = [];
    for (let i = 0; i < n; i += step) idx.push(i);
    if (idx[idx.length - 1] !== n - 1) idx.push(n - 1);
    return idx;
  });
</script>

<div style="height: {height}px; width: 100%; display: flex; flex-direction: column;">
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
      <!-- Absolutely positioned to exactly fill the relative parent, rather
           than relying on height: 100% resolving through a flex: 1 ancestor
           — that's percentage-of-indeterminate-height territory, and this
           SVG's viewBox="0 0 100 100" (a perfect square) is exactly what it
           falls back to when the percentage can't resolve: a square chart
           nearly 15x taller than the visible card, with all the real content
           rendered far below the fold and nothing visible in the card itself. -->
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="display: block; position: absolute; inset: 0; width: 100%; height: 100%;">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stop-color={color} stop-opacity="0.5" />
            <stop offset="95%" stop-color={color} stop-opacity="0" />
          </linearGradient>
        </defs>
        {#if areaPath}
          <path d={areaPath} fill="url(#{gid})" stroke="none" />
          <path d={linePath} fill="none" stroke={color} stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
        {/if}
      </svg>
    </div>
  </div>
  {#if showXLabels && xKey}
    <div style="display: flex;">
      {#if showYLabels}<div style="width: {yAxisWidth}px; flex-shrink: 0;"></div>{/if}
      <div style="flex: 1; min-width: 0; position: relative; height: 14px; margin-top: 2px;">
        {#each labelIdx as i}
          <span
            style="position: absolute; left: {xv(i)}%; transform: translateX(-50%); color: {labelColor}; font-size: {labelSize}px; white-space: nowrap;"
            >{data[i][xKey]}</span
          >
        {/each}
      </div>
    </div>
  {/if}
</div>
