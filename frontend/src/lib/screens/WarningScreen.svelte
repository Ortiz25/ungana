<script>
  import { AlertTriangle, WifiOff, Clock, RotateCcw } from '@lucide/svelte';
  import DemoBadge from '$lib/components/DemoBadge.svelte';
  import { formatTime } from '$lib/data.js';

  let { pkg, remaining, onExtend, onDismiss } = $props();

  let secs = $state(remaining);

  // Read `remaining` (a prop, not the reactive `secs`) in setup so this effect
  // runs once on mount instead of re-subscribing to `secs` every tick.
  $effect(() => {
    if (remaining <= 0) {
      onDismiss();
      return;
    }
    const t = setInterval(() => {
      if (secs - 1 <= 0) {
        clearInterval(t);
        onDismiss();
        secs = 0;
        return;
      }
      secs = secs - 1;
    }, 1000);
    return () => clearInterval(t);
  });

  const rows = [
    { icon: WifiOff, text: 'Internet access will stop' },
    { icon: Clock, text: 'Your session will be archived' },
    { icon: RotateCcw, text: 'You can buy a new session anytime' }
  ];
</script>

<div
  class="flex flex-col items-center px-5 pb-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #2C1A12 0%, #3E2418 100%);"
>
  <!-- Warning icon -->
  <div class="flex flex-col items-center mt-10 mb-6">
    <div
      class="w-24 h-24 rounded-full flex items-center justify-center mb-4"
      style="background: rgba(196,92,56,0.30); border: 2px solid rgba(196,92,56,0.4); box-shadow: 0 0 40px rgba(196,92,56,0.35);"
    >
      <AlertTriangle size={44} color="#C45C38" strokeWidth={1.5} />
    </div>
    <div class="px-3 py-1 rounded-full mb-3" style="background: rgba(196,92,56,0.30); border: 1px solid rgba(196,92,56,0.3);">
      <span class="text-xs font-bold text-[#C45C38] uppercase tracking-widest">Time Running Out</span>
    </div>
    <h2 class="text-2xl font-bold text-[#E8D4B0] text-center" style="font-family: 'Playfair Display', serif;">
      Your session is<br />about to end
    </h2>
    <p class="text-sm text-[#C4A870] mt-2 text-center">Don't lose your connection</p>
  </div>

  <!-- Countdown -->
  <div class="w-full rounded-3xl overflow-hidden mb-5" style="background: rgba(196,92,56,0.1); border: 2px solid rgba(196,92,56,0.3);">
    <div class="flex flex-col items-center py-6">
      <span class="text-5xl font-bold text-[#C45C38]" style="font-family: 'Inter', sans-serif; letter-spacing: -2px;">
        {formatTime(secs)}
      </span>
      <p class="text-xs text-[#C4A870] mt-2 uppercase tracking-widest">time remaining</p>
      <div class="w-40 h-1.5 rounded-full mt-4 overflow-hidden" style="background: rgba(255,255,255,0.1);">
        <div class="h-full rounded-full bg-[#C45C38]" style="width: {(secs / remaining) * 100}%; transition: width 0.9s linear;"></div>
      </div>
    </div>
  </div>

  <!-- What happens -->
  <div class="w-full rounded-2xl px-4 py-4 mb-5" style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);">
    <p class="text-xs font-semibold text-[#C4A870] uppercase tracking-wider mb-3">When time runs out</p>
    {#each rows as row (row.text)}
      {@const Icon = row.icon}
      <div class="flex items-center gap-3 mb-2.5 last:mb-0">
        <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
          <Icon size={14} color="#C45C38" />
        </div>
        <p class="text-sm text-[#C4A870]">{row.text}</p>
      </div>
    {/each}
  </div>

  <button
    onclick={onExtend}
    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 mb-3"
    style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; letter-spacing: 0.03em;"
  >
    Extend Now — Stay Connected
  </button>
  <button
    onclick={onDismiss}
    class="w-full py-3.5 rounded-2xl font-semibold text-sm active:scale-95"
    style="background: rgba(255,255,255,0.14); color: #9A8060;"
  >
    Let it expire
  </button>
  <DemoBadge />
</div>
