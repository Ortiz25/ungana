<script>
  import { ShieldCheck, Eye, EyeOff, AlertTriangle, ChevronRight } from '@lucide/svelte';
  import { MOCK_COORDINATORS } from '$lib/data.js';

  let { onLogin, onBack } = $props();

  let id = $state('');
  let pin = $state('');
  let showPin = $state(false);
  let error = $state('');
  let loading = $state(false);

  function handleLogin() {
    error = '';
    const coord = MOCK_COORDINATORS.find((c) => c.id.toLowerCase() === id.trim().toLowerCase());
    if (!coord || pin !== '5678') {
      error = 'Invalid coordinator ID or PIN';
      return;
    }
    loading = true;
    setTimeout(() => {
      loading = false;
      onLogin(coord);
    }, 900);
  }
</script>

<div style="min-height: 100dvh; background: linear-gradient(160deg, #E8D4B0 0%, #DBC89A 100%);">
  <div class="flex flex-col items-center pt-10 pb-6 px-5">
    <div class="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style="background: #1D3C2A;">
      <ShieldCheck size={30} color="#C45C38" />
    </div>
    <p class="text-[10px] text-[#96B496] font-semibold uppercase tracking-widest mb-1">Coordinator Access</p>
    <h2 class="text-2xl font-bold text-[#1D3C2A] text-center" style="font-family: 'Playfair Display', serif;">Command Portal</h2>
    <p class="text-xs text-[#96B496] mt-1 text-center">For location coordinators only</p>
  </div>

  <div class="mx-4 rounded-3xl overflow-hidden shadow-lg" style="background: #2E5A3E;">
    <div class="px-5 pt-5 pb-1">
      <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold mb-3">Coordinator ID</p>
      <div class="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4" style="background: rgba(0,0,0,0.2);">
        <ShieldCheck size={16} color="#C4DAC0" />
        <input
          bind:value={id}
          placeholder="e.g. COORD-01"
          class="flex-1 bg-transparent text-sm font-semibold text-[#E8D4B0] outline-none placeholder:text-[#4A6842]"
        />
      </div>
      <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold mb-3">PIN</p>
      <div class="flex items-center gap-3 px-4 py-3 rounded-2xl mb-1" style="background: rgba(0,0,0,0.2);">
        <ShieldCheck size={16} color="#C4DAC0" />
        <input
          bind:value={pin}
          type={showPin ? 'text' : 'password'}
          placeholder="••••"
          class="flex-1 bg-transparent text-sm font-semibold text-[#E8D4B0] outline-none placeholder:text-[#4A6842]"
        />
        <button onclick={() => (showPin = !showPin)}>
          {#if showPin}<EyeOff size={16} color="#C4DAC0" />{:else}<Eye size={16} color="#C4DAC0" />{/if}
        </button>
      </div>
    </div>

    {#if error}
      <div class="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(184,80,56,0.32);">
        <AlertTriangle size={13} color="#B85038" />
        <p class="text-xs text-[#B85038]">{error}</p>
      </div>
    {/if}

    <div class="px-5 mt-3 pb-2 flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(196,92,56,0.08);">
      <p class="text-[10px] text-[#AECAAE]">Demo: ID <span class="font-bold text-[#C45C38]">COORD-01</span> · PIN <span class="font-bold text-[#C45C38]">5678</span></p>
    </div>

    <div class="px-5 pt-3 pb-5">
      <button
        onclick={handleLogin}
        disabled={loading}
        class="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
      >
        {#if loading}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Verifying…
        {:else}
          Access Portal <ChevronRight size={16} />
        {/if}
      </button>
    </div>
  </div>

  <p class="text-[10px] text-[#4A6842] text-center mt-4">
    Not a coordinator? <span class="text-[#AECAAE] font-semibold" onclick={onBack} style="cursor: pointer;" role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && onBack()}>Go back</span>
  </p>
</div>
