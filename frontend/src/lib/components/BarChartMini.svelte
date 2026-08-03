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
    labelColor = '#AECAAE',
    labelSize = 9
  } = $props();

  const max = $derived(Math.max(1, ...data.map((d) => Number(d[yKey]) || 0)));
</script>

<div style="height: {height}px; width: 100%; display: flex; flex-direction: column;">
  <div style="flex: 1; position: relative; display: flex; align-items: flex-end;">
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
  {#if showXLabels && xKey}
    <div style="display: flex; margin-top: 4px;">
      {#each data as d, i (i)}
        <div style="flex: 1; text-align: center; color: {labelColor}; font-size: {labelSize}px;">{d[xKey]}</div>
      {/each}
    </div>
  {/if}
</div>
