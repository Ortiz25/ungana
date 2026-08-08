<script>
  // Hand-rolled replacement for recharts <BarChart>.
  // Renders evenly distributed rounded-top bars, optional dashed gridlines
  // and optional x-axis labels. Responsive to width (flex layout).
  let {
    data = [],
    yKey = 'earnings',
    xKey = null,
    color = '#C45C38',
    barSize = 16,
    height = 140,
    radius = 4,
    opacity = 1,
    showXLabels = true,
    showGrid = false,
    showYLabels = false,
    yAxisWidth = 30,
    labelColor = '#AECAAE',
    labelSize = 9
  } = $props();

  // Same reasoning as AreaChartMini: a floor of 1 flattened small real
  // values (e.g. 0.4 KES) toward zero-looking bars instead of scaling
  // them to their own actual peak, and there was no labelling to show
  // what the bars meant numerically either way.
  const max = $derived(Math.max(0.0001, ...data.map((d) => Number(d[yKey]) || 0)));

  function formatAxisValue(v) {
    if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k`;
    if (v >= 10 || Number.isInteger(v)) return String(Math.round(v));
    return v.toFixed(1);
  }
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
    <div style="flex: 1; min-height: 0; position: relative; display: flex; align-items: flex-end;">
      {#if showGrid}
        {#each [0, 25, 50, 75] as g}
          <div
            style="position: absolute; left: 0; right: 0; top: {g}%; border-top: 1px dashed rgba(255,255,255,0.12);"
          ></div>
        {/each}
      {/if}
      {#each data as d, i (i)}
        <div style="flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;">
          <div
            style="width: {barSize}px; height: {((Number(d[yKey]) || 0) / max) * 100}%; background: {color}; opacity: {opacity}; border-radius: {radius}px {radius}px 0 0;"
          ></div>
        </div>
      {/each}
    </div>
  </div>
  {#if showXLabels && xKey}
    <div style="display: flex; margin-top: 4px;">
      {#if showYLabels}<div style="width: {yAxisWidth}px; flex-shrink: 0;"></div>{/if}
      {#each data as d, i (i)}
        <div style="flex: 1; text-align: center; color: {labelColor}; font-size: {labelSize}px;">{d[xKey]}</div>
      {/each}
    </div>
  {/if}
</div>
