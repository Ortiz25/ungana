<script>
  import { CircleX, RotateCcw, Home, MessageCircle } from '@lucide/svelte';
  import DemoBadge from '$lib/components/DemoBadge.svelte';

  let { pkg, phone, mode = 'simulation', reason, onRetry, onHome } = $props();

  const rows = $derived([
    { label: 'Plan', value: `${pkg.label} · ${pkg.duration}` },
    { label: 'Phone', value: `+254 ${phone}` },
    { label: 'Amount', value: `${pkg.price.toLocaleString()} KES` },
    { label: 'Status', value: 'Not charged' }
  ]);
</script>

<div
  class="flex flex-col items-center px-5 pb-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #2C1A12 0%, #3E2418 100%);"
>
  <!-- Error icon -->
  <div class="flex flex-col items-center mt-10 mb-6">
    <div
      class="w-24 h-24 rounded-full flex items-center justify-center mb-4"
      style="background: rgba(184,80,56,0.25); border: 2px solid rgba(184,80,56,0.4); box-shadow: 0 0 40px rgba(184,80,56,0.3);"
    >
      <CircleX size={44} color="#B85038" strokeWidth={1.5} />
    </div>
    <div class="px-3 py-1 rounded-full mb-3" style="background: rgba(184,80,56,0.30); border: 1px solid rgba(184,80,56,0.3);">
      <span class="text-xs font-bold text-[#C0614A] uppercase tracking-widest">Payment Failed</span>
    </div>
    <h2 class="text-2xl font-bold text-[#E8D4B0] text-center" style="font-family: 'Playfair Display', serif;">
      Payment unsuccessful
    </h2>
    <p class="text-sm text-[#C4A870] mt-2 text-center max-w-[280px]">
      {reason?.detail ?? 'The M-PESA prompt could not be completed.'}
    </p>
  </div>

  <!-- Attempt summary -->
  <div class="w-full rounded-3xl overflow-hidden shadow-xl mb-4" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);">
    <div class="px-5 pt-5 pb-3">
      <p class="text-xs text-[#C4A870] uppercase tracking-widest mb-3 font-semibold">Attempt Details</p>
      {#each rows as row (row.label)}
        <div class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
          <span class="text-xs text-[#C4A870]">{row.label}</span>
          <span class="text-sm font-semibold text-[#E8D4B0] text-right max-w-[55%]">{row.value}</span>
        </div>
      {/each}
    </div>
  </div>

  <div
    class="w-full rounded-2xl px-4 py-3 flex items-center gap-3 mb-5"
    style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);"
  >
    <div class="w-2 h-2 rounded-full bg-[#C45C38] shrink-0"></div>
    <p class="text-xs text-[#C4A870]">You have not been charged. You can try again or contact support.</p>
  </div>

  <button
    onclick={onRetry}
    class="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 mb-3"
    style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; letter-spacing: 0.03em;"
  >
    <RotateCcw size={17} />Try Again
  </button>
  <button
    onclick={onHome}
    class="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 mb-3"
    style="background: rgba(255,255,255,0.14); color: #E8D4B0;"
  >
    <Home size={16} />Back to Home
  </button>
  <button
    class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
    style="background: rgba(255,255,255,0.08); color: #C4A870;"
  >
    <MessageCircle size={16} />Contact Ungana Support
  </button>
  {#if mode !== 'active'}<DemoBadge />{/if}
</div>
