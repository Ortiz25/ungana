<script>
  import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import { ACTIVATORS } from '$lib/data.js';
  import { activatorLogin } from '$lib/api.js';

  let { onLogin, onBack } = $props();

  let phone = $state('');
  let pin = $state('');
  let showPin = $state(false);
  let error = $state('');
  let loading = $state(false);

  async function handleLogin() {
    if (phone.length < 9) {
      error = 'Enter a valid phone number';
      return;
    }
    if (pin.length < 4) {
      error = 'Enter your 4-digit PIN';
      return;
    }
    error = '';
    loading = true;

    const result = await activatorLogin(`+254${phone}`, pin);
    loading = false;

    if (result.ok && result.data?.success) {
      const a = result.data.activator;
      onLogin({ id: a.code, name: a.name, area: a.territory, sessions: 0, token: result.data.token, commissionRate: a.commissionRate });
      return;
    }

    if (result.ok) {
      // Backend reachable, credentials genuinely rejected.
      error = result.data?.message || 'Invalid phone or PIN';
      return;
    }

    // Backend unreachable — fall back to local demo validation.
    if (pin === '1234') {
      onLogin(ACTIVATORS[1]); // James Mwangi
    } else {
      error = 'Incorrect PIN. Try 1234 for this demo.';
    }
  }
</script>

<div
  class="flex flex-col px-5 pb-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 60%, #1D3C2A 100%);"
>
  <!-- Back -->
  <div class="pt-4 pb-2">
    <button
      onclick={onBack}
      class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
      style="background: rgba(255,255,255,0.18);"
    >
      <ArrowLeft size={18} color="#C4DAC0" />
    </button>
  </div>

  <!-- Header -->
  <div class="flex flex-col items-center pt-4 pb-8">
    <UnganaLogoMark height={44} />
    <div class="mt-4 px-3 py-1 rounded-full" style="background: rgba(196,92,56,0.30); border: 1px solid rgba(196,92,56,0.3);">
      <span class="text-[11px] font-bold text-[#C45C38] uppercase tracking-widest">Activator Portal</span>
    </div>
    <h1 class="text-2xl font-bold text-[#E8D4B0] mt-3 text-center" style="font-family: 'Playfair Display', serif;">Welcome back</h1>
    <p class="text-sm text-[#C4DAC0] mt-1 text-center">Sign in to view your earnings and users</p>
  </div>

  <!-- Form card -->
  <div class="rounded-3xl overflow-hidden mb-4" style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.1);">
    <div class="px-5 pt-5 pb-2 flex flex-col gap-3">
      <!-- Phone -->
      <div>
        <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Phone Number</p>
        <div class="flex items-center rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
          <div class="px-4 py-3.5 border-r shrink-0" style="border-color: rgba(255,255,255,0.1);">
            <span class="text-[#C4DAC0] font-semibold text-sm">+254</span>
          </div>
          <input
            type="tel"
            value={phone}
            oninput={(e) => {
              phone = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 9);
              error = '';
            }}
            placeholder="700 000 000"
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none"
          />
        </div>
      </div>

      <!-- PIN -->
      <div>
        <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">4-Digit PIN</p>
        <div class="flex items-center rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
          <input
            type={showPin ? 'text' : 'password'}
            value={pin}
            oninput={(e) => {
              pin = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 4);
              error = '';
            }}
            placeholder="••••"
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none tracking-widest"
          />
          <button onclick={() => (showPin = !showPin)} class="px-4 py-3.5 shrink-0">
            {#if showPin}<EyeOff size={16} color="#AECAAE" />{:else}<Eye size={16} color="#AECAAE" />{/if}
          </button>
        </div>
      </div>

      <!-- Error -->
      {#if error}
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(192,97,74,0.12); border: 1px solid rgba(192,97,74,0.25);">
          <AlertTriangle size={13} color="#B85038" />
          <p class="text-xs text-[#B85038]">{error}</p>
        </div>
      {/if}

      <!-- Demo hint -->
      <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(196,92,56,0.08);">
        <p class="text-[10px] text-[#AECAAE]">Demo: any phone + PIN <span class="font-bold text-[#C45C38]">1234</span></p>
      </div>
    </div>

    <!-- Sign in button -->
    <div class="px-5 pt-3 pb-5">
      <button
        onclick={handleLogin}
        disabled={loading}
        class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
      >
        {#if loading}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Signing in…
        {:else}
          Sign In <ChevronRight size={16} />
        {/if}
      </button>
    </div>
  </div>

  <!-- Footer -->
  <p class="text-[10px] text-[#4A6842] text-center mt-2">
    Activator access only · Not a user? <span class="text-[#AECAAE] font-semibold" onclick={onBack} style="cursor: pointer;" role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && onBack()}>Go back</span>
  </p>
</div>
