<script>
  import { WifiOff, RotateCcw, MessageCircle } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';

  let { pkg, phone, onBuyAgain } = $props();

  const rows = $derived([
    { label: 'Plan used', value: `${pkg.label} · ${pkg.duration}` },
    { label: 'Number', value: `+254 ${phone}` },
    { label: 'Amount paid', value: `${pkg.price.toLocaleString()} KES` },
    { label: 'Status', value: 'Completed ✓' }
  ]);
</script>

<ScreenBg class="items-center">
  <!-- Icon -->
  <div class="flex flex-col items-center mt-8 mb-6">
    <div
      class="w-24 h-24 rounded-full flex items-center justify-center mb-4"
      style="background: rgba(46,90,62,0.12); border: 2px solid rgba(46,90,62,0.25);"
    >
      <WifiOff size={44} color="#3C6A4A" strokeWidth={1.5} />
    </div>
    <div class="px-3 py-1 rounded-full mb-3" style="background: rgba(46,90,62,0.12); border: 1px solid rgba(46,90,62,0.2);">
      <span class="text-xs font-bold text-[#3C6A4A] uppercase tracking-widest">Session Ended</span>
    </div>
    <h2 class="text-2xl font-bold text-[#1D3C2A] text-center" style="font-family: 'Playfair Display', serif;">Your time is up</h2>
    <p class="text-sm text-[#3C6A4A] mt-1.5 text-center">Your {pkg.label} session has ended</p>
  </div>

  <!-- Summary card -->
  <div class="w-full rounded-3xl overflow-hidden shadow-xl mb-4" style="background: #2E5A3E;">
    <div class="px-5 pt-5 pb-4">
      <p class="text-xs text-[#C4DAC0] uppercase tracking-widest mb-3 font-semibold">Session Summary</p>
      {#each rows as row (row.label)}
        <div class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
          <span class="text-xs text-[#C4DAC0]">{row.label}</span>
          <span class="text-sm font-semibold text-[#E8D4B0] text-right">{row.value}</span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Prompt -->
  <div class="w-full rounded-2xl px-4 py-4 mb-5 text-center" style="background: rgba(46,90,62,0.1); border: 1px solid rgba(46,90,62,0.15);">
    <p class="text-sm font-semibold text-[#1D3C2A]">Would you like to buy another session?</p>
    <p class="text-xs text-[#3C6A4A] mt-1">Stay connected with a new plan</p>
  </div>

  <button
    onclick={onBuyAgain}
    class="w-full py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all active:scale-95 mb-3"
    style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
  >
    <RotateCcw size={18} />Buy Another Session
  </button>

  <button
    class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 mb-2"
    style="background: #1D3C2A; color: #E8D4B0;"
  >
    <MessageCircle size={16} />Contact Support
  </button>

  <p class="text-[10px] text-[#7A8868] text-center mt-3">swap.ungana.app</p>
</ScreenBg>
