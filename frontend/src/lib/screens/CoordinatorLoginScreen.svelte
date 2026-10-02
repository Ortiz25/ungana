<script>
  import { ShieldCheck, Eye, EyeOff, AlertTriangle, ChevronRight, ArrowLeft } from '@lucide/svelte';
  import { MOCK_COORDINATORS } from '$lib/data.js';
  import { coordinatorLogin } from '$lib/api.js';

  // Same flag as ActivatorLoginScreen/PaymentScreen — gates the
  // "backend unreachable → accept PIN 5678" fallback and its hint.
  const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';

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
      error = 'Enter your PIN';
      return;
    }
    error = '';
    loading = true;

    const result = await coordinatorLogin(`+254${phone}`, pin);
    loading = false;

    if (result.ok && result.data?.success) {
      const c = result.data.coordinator;
      onLogin({ id: c.id, name: c.name, area: c.territory, token: result.data.token });
      return;
    }

    if (result.ok) {
      // Backend reachable, credentials genuinely rejected.
      error = result.data?.message || 'Invalid phone or PIN';
      return;
    }

    // Backend unreachable — fall back to local demo validation, but only in
    // demo mode; a real deployment should never accept a hardcoded PIN.
    if (DEMO_MODE && pin === '5678') {
      onLogin({ ...MOCK_COORDINATORS[0], token: undefined });
    } else if (DEMO_MODE) {
      error = 'Incorrect PIN. Try 5678 for this demo.';
    } else {
      error = 'Could not reach the server — try again in a moment.';
    }
  }
</script>

<div class="relative" style="min-height: 100dvh; background: linear-gradient(160deg, #E8D4B0 0%, #DBC89A 100%);">
  <!-- Pinned to the actual viewport corner, not the centered column below —
       same treatment as AdminLoginScreen/ActivatorLoginScreen, so a wide
       screen doesn't leave it floating next to dead space beside a card
       that no longer spans edge-to-edge. -->
  <button
    onclick={onBack}
    class="absolute top-4 left-5 w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
    style="background: rgba(29,60,42,0.12); z-index: 2;"
  >
    <ArrowLeft size={18} color="#1D3C2A" />
  </button>

  <!-- Full-bleed on a phone captive-portal viewport, capped at a sane
       reading width and centered everywhere wider (tablet/desktop) — same
       w-full max-w-md mx-auto convention as the other login screens. -->
  <div class="w-full max-w-md mx-auto flex flex-col px-5">
    <div class="flex flex-col items-center pt-10 pb-6">
      <div class="w-16 h-16 rounded-3xl flex items-center justify-center mb-4" style="background: #1D3C2A;">
        <ShieldCheck size={30} color="#C45C38" />
      </div>
      <p class="text-[10px] text-[#96B496] font-semibold uppercase tracking-widest mb-1">Coordinator Access</p>
      <h2 class="text-2xl font-bold text-[#1D3C2A] text-center" style="font-family: 'Playfair Display', serif;">Command Portal</h2>
      <p class="text-xs text-[#96B496] mt-1 text-center">For location coordinators only</p>
    </div>

    <div class="rounded-3xl overflow-hidden shadow-lg" style="background: #2E5A3E;">
      <div class="px-5 pt-5 pb-1">
        <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold mb-3">Phone Number</p>
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4" style="background: rgba(0,0,0,0.2);">
          <span class="text-[#C4DAC0] font-semibold text-sm">+254</span>
          <input
            value={phone}
            oninput={(e) => {
              phone = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 9);
              error = '';
            }}
            placeholder="700 000 000"
            class="flex-1 bg-transparent text-sm font-semibold text-[#E8D4B0] outline-none placeholder:text-[#4A6842]"
          />
        </div>
        <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold mb-3">PIN</p>
        <div class="flex items-center gap-3 px-4 py-3 rounded-2xl mb-1" style="background: rgba(0,0,0,0.2);">
          <ShieldCheck size={16} color="#C4DAC0" />
          <input
            value={pin}
            type={showPin ? 'text' : 'password'}
            oninput={(e) => {
              pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6);
              error = '';
            }}
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

      {#if DEMO_MODE}
        <div class="px-5 mt-3 pb-2 flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(196,92,56,0.08);">
          <p class="text-[10px] text-[#AECAAE]">Demo (offline only): any phone + PIN <span class="font-bold text-[#C45C38]">5678</span></p>
        </div>
      {/if}

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

    <p class="text-[10px] text-[#4A6842] text-center mt-4 pb-8">Not a coordinator? Use the back button above.</p>
  </div>
</div>
