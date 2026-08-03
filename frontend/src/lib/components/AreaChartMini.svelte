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
    labelColor = '#AECAAE',
    labelSize = 9
  } = $props();

  const gid = 'og-' + Math.random().toString(36).slice(2, 9);

  const max = $derived(Math.max(1, ...data.map((d) => Number(d[yKey]) || 0)));
  const n = $derived(data.length);

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
  <div style="flex: 1; position: relative;">
    {#if showGrid}
      {#each [0, 25, 50, 75, 100] as g}
        <div style="position: absolute; left: 0; right: 0; top: {g}%; border-top: 1px dashed rgba(255,255,255,0.12);"></div>
      {/each}
    {/if}
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="display: block; position: relative;">
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
  {#if showXLabels && xKey}
    <div style="position: relative; height: 14px; margin-top: 2px;">
      {#each labelIdx as i}
        <span
          style="position: absolute; left: {xv(i)}%; transform: translateX(-50%); color: {labelColor}; font-size: {labelSize}px; white-space: nowrap;"
          >{data[i][xKey]}</span
        >
      {/each}
    </div>
  {/if}
</div>
