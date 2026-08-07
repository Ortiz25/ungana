<script>
  import { CheckCircle2, Zap } from '@lucide/svelte';
  import { TL_TYPE_ICON, doneLabelForFrequency } from '$lib/data.js';

  let { item, completedIds, onStart, width = 140, height = 175 } = $props();

  const Icon = $derived(TL_TYPE_ICON[item.type]);
  const done = $derived(completedIds.has(item.id));
  // Says WHEN it re-unlocks (e.g. "Viewed today") rather than a flat
  // "Done" — a daily/weekly/monthly item that's already been claimed for
  // its current period still looks tappable otherwise, which is what let
  // someone re-open (and re-attempt to claim) it without realising.
  const badgeLabel = $derived(done ? doneLabelForFrequency(item.viewFrequency) : item.earnLabel);
</script>

<button
  onclick={() => onStart(item)}
  disabled={done}
  class="shrink-0 rounded-3xl overflow-hidden relative active:scale-95 transition-transform"
  style="width: {width}px; height: {height}px; opacity: {done ? 0.75 : 1};"
>
  {#if item.img}
    <img src={item.img} alt={item.title} class="w-full h-full object-cover" />
  {:else}
    <div class="w-full h-full" style="background: linear-gradient(135deg, #1D3C2A, #2E5A3E);"></div>
  {/if}
  <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.08) 55%, transparent 100%);"></div>

  <!-- earn badge -->
  <div class="absolute top-2.5 right-2.5 flex items-center gap-0.5 px-2 py-1 rounded-full" style="background: {done ? '#2E5A3E' : '#C45C38'};">
    {#if done}<CheckCircle2 size={9} color="#fff" />{:else}<Zap size={9} color="#fff" />{/if}
    <span class="text-[9px] font-bold text-white ml-0.5">{badgeLabel}</span>
  </div>

  <!-- type badge -->
  <div class="absolute top-2.5 left-2.5 w-6 h-6 rounded-lg flex items-center justify-center" style="background: rgba(0,0,0,0.55);">
    <Icon size={11} color="#fff" />
  </div>

  <!-- bottom info -->
  <div class="absolute bottom-0 left-0 right-0 p-2.5">
    <p class="text-[9px] font-semibold mb-0.5" style="color: #C4DAC0;">{item.category} · {item.duration}</p>
    <p class="text-xs font-bold text-white leading-tight line-clamp-2">{item.title}</p>
  </div>
</button>
