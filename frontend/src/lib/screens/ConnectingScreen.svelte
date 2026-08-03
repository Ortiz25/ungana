<script>
  import { Wifi, CheckCircle2 } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';

  let { onConnected } = $props();

  let dots = $state(0);

  $effect(() => {
    const d = setInterval(() => (dots = (dots + 1) % 4), 400);
    const t = setTimeout(onConnected, 3000);
    return () => {
      clearInterval(d);
      clearTimeout(t);
    };
  });

  const steps = ['Payment verified', 'Allocating session', 'Connecting to network'];
</script>

<div
  class="flex flex-col items-center justify-center px-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 100%);"
>
  <div class="flex flex-col items-center gap-6">
    <!-- Pulsing rings -->
    <div class="relative flex items-center justify-center" style="width: 140px; height: 140px;">
      {#each [1, 0.6, 0.35] as o, i (i)}
        <div
          class="absolute rounded-full border-2 border-[#C45C38]"
          style="width: {60 + i * 36}px; height: {60 + i * 36}px; opacity: {o}; animation: ping-ring {1.2 + i * 0.3}s ease-out infinite;"
        ></div>
      {/each}
      <div
        class="w-16 h-16 rounded-full flex items-center justify-center z-10"
        style="background: rgba(196,92,56,0.30); border: 2px solid #C45C38;"
      >
        <Wifi size={28} color="#C45C38" />
      </div>
    </div>

    <UnganaLogoMark height={36} />

    <div class="text-center">
      <p class="text-xl font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">
        Connecting you{'.'.repeat(dots)}
      </p>
      <p class="text-sm text-[#C4DAC0] mt-2">Setting up your internet session</p>
    </div>

    <div class="flex flex-col gap-2 w-full">
      {#each steps as step, i (step)}
        <div class="flex items-center gap-3">
          <div
            class="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style="background: {i < 2 ? 'rgba(196,92,56,0.25)' : 'rgba(255,255,255,0.18)'};"
          >
            {#if i < 2}
              <CheckCircle2 size={12} color="#C45C38" />
            {:else}
              <div class="w-2 h-2 rounded-full bg-[#C4DAC0] animate-pulse"></div>
            {/if}
          </div>
          <span class="text-xs" style="color: {i < 2 ? '#C4DAC0' : '#96B496'};">{step}</span>
        </div>
      {/each}
    </div>
  </div>
</div>
