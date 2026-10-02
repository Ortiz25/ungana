<script>
  import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import { ACTIVATORS } from '$lib/data.js';
  import { activatorLogin } from '$lib/api.js';

  // Same flag as PaymentScreen's "simulate a failed payment" toggle — gates
  // the "backend unreachable → accept PIN 1234" fallback below (and its
  // hint) rather than a separate flag, since both are "things that only
  // belong in an offline demo/pitch, never a real deployment".
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
      error = 'Enter your 4-digit PIN';
      return;
    }
    error = '';
    loading = true;

    const result = await activatorLogin(`+254${phone}`, pin);
    loading = false;

    if (result.ok && result.data?.success) {
      const a = result.data.activator;
      onLogin({
        id: a.code,
        name: a.name,
        area: a.territory,
        mpesaNumber: a.mpesaNumber,
        sessions: 0,
        token: result.data.token,
        commissionRate: a.commissionRate,
        dailyTargetKes: a.dailyTargetKes,
        weeklyTargetKes: a.weeklyTargetKes,
        notificationPrefs: a.notificationPrefs
      });
      return;
    }

    if (result.ok) {
      // Backend reachable, credentials genuinely rejected.
      error = result.data?.message || 'Invalid phone or PIN';
      return;
    }

    // Backend unreachable — fall back to local demo validation, but only in
    // demo mode; a real deployment should never accept a hardcoded PIN.
    if (DEMO_MODE && pin === '1234') {
      onLogin(ACTIVATORS[1]); // James Mwangi
    } else if (DEMO_MODE) {
      error = 'Incorrect PIN. Try 1234 for this demo.';
    } else {
      error = 'Could not reach the server — try again in a moment.';
    }
  }
</script>

<div
  class="flex flex-col px-5 pb-8 relative"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 60%, #1D3C2A 100%);"
>
  <!-- Pinned to the actual viewport corner, not the centered column below —
       see AdminLoginScreen's own comment on why (same treatment, same
       reasoning: a wide screen leaves dead space next to a card that no
       longer spans edge-to-edge). -->
  <button
    onclick={onBack}
    class="absolute top-4 left-5 w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
    style="background: rgba(255,255,255,0.18); z-index: 2;"
  >
    <ArrowLeft size={18} color="#C4DAC0" />
  </button>

  <!-- Full-bleed on a phone captive-portal viewport, capped at a sane
       reading width and centered everywhere wider (tablet/desktop) — same
       w-full max-w-md mx-auto convention as PackageScreen's own wrapper. -->
  <div class="w-full max-w-md mx-auto flex flex-col">
    <!-- Back button spacer — reserves the same vertical rhythm the
         absolutely-positioned button above no longer occupies in flow. -->
    <div class="pt-4 pb-2">
      <div class="w-9 h-9"></div>
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
        {#if DEMO_MODE}
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(196,92,56,0.08);">
            <p class="text-[10px] text-[#AECAAE]">Demo: any phone + PIN <span class="font-bold text-[#C45C38]">1234</span></p>
          </div>
        {/if}
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
</div>
