<script>
  import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight, ShieldCheck, User, Lock } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import { adminLogin } from '$lib/api.js';

  let { onLogin, onBack } = $props();

  let username = $state('');
  let password = $state('');
  let showPassword = $state(false);
  let error = $state('');
  let loading = $state(false);

  async function handleLogin() {
    if (!username.trim() || !password) {
      error = 'Enter your admin username and password';
      return;
    }
    error = '';
    loading = true;

    const result = await adminLogin(username.trim(), password);
    loading = false;

    if (result.ok && result.data?.success) {
      onLogin({ token: result.data.token, username: result.data.admin.username, role: result.data.admin.role, id: result.data.admin.id });
      return;
    }

    error = result.data?.message || 'Could not sign in — check your connection';
  }
</script>

<div
  class="flex flex-col px-5 pb-8 relative overflow-hidden"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 60%, #1D3C2A 100%);"
>
  <!-- Soft decorative glow behind the badge — same plain radial-gradient
       convention as PackageScreen's own header glow (no backdrop-filter,
       so it stays cheap and works in older captive-portal WebViews). -->
  <div
    class="pointer-events-none absolute"
    style="top: 64px; left: 50%; transform: translateX(-50%); width: 260px; height: 260px; border-radius: 9999px; background: radial-gradient(circle, rgba(196,92,56,0.22) 0%, transparent 70%);"
  ></div>

  <!-- Pinned to the actual viewport corner, not the centered column below —
       on a wide screen the card no longer spans edge-to-edge, so a back
       button living inside it would float awkwardly next to a lot of dead
       space instead of reading as "top-left of the page". -->
  <button
    onclick={onBack}
    class="absolute top-4 left-5 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform"
    style="background: rgba(255,255,255,0.18); z-index: 2;"
  >
    <ArrowLeft size={18} color="#C4DAC0" />
  </button>

  <!-- Full-bleed on a phone captive-portal viewport, capped at a sane
       reading width and centered everywhere wider (tablet/desktop) — same
       w-full max-w-md mx-auto convention as PackageScreen's own wrapper.
       The gradient background above stays full-viewport regardless. -->
  <div class="w-full max-w-md mx-auto flex flex-col relative" style="z-index: 1;">
    <div class="pt-4 pb-2">
      <div class="w-9 h-9"></div>
    </div>

    <div class="flex flex-col items-center pt-4 pb-8 fade-in-up">
      <UnganaLogoMark height={40} />
      <div
        class="mt-4 w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); box-shadow: 0 10px 30px rgba(196,92,56,0.4);"
      >
        <ShieldCheck size={28} color="#fff" />
      </div>
      <h1 class="text-2xl font-bold text-[#E8D4B0] mt-4 text-center" style="font-family: 'Playfair Display', serif;">Admin sign in</h1>
      <p class="text-sm text-[#C4DAC0] mt-1 text-center">Manage content, activators & coordinators</p>
    </div>

    <div
      class="rounded-3xl overflow-hidden mb-4 fade-in-up"
      style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.14); box-shadow: 0 20px 50px rgba(0,0,0,0.3); animation-delay: 0.08s;"
    >
      <div class="px-5 pt-5 pb-2 flex flex-col gap-3">
        <div>
          <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Username</p>
          <div class="admin-field flex items-center rounded-2xl overflow-hidden transition-colors" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
            <div class="px-4 py-3.5 border-r border-white/15 shrink-0">
              <User size={14} color="#C4DAC0" />
            </div>
            <input
              value={username}
              oninput={(e) => {
                username = e.currentTarget.value;
                error = '';
              }}
              placeholder="admin"
              class="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none"
            />
          </div>
        </div>

        <div>
          <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Password</p>
          <div class="admin-field flex items-center rounded-2xl overflow-hidden transition-colors" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
            <div class="px-4 py-3.5 border-r border-white/15 shrink-0">
              <Lock size={14} color="#C4DAC0" />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              oninput={(e) => {
                password = e.currentTarget.value;
                error = '';
              }}
              placeholder="••••••••"
              class="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none"
              onkeydown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <button onclick={() => (showPassword = !showPassword)} class="px-4 py-3.5 shrink-0" aria-label={showPassword ? 'Hide password' : 'Show password'}>
              {#if showPassword}<EyeOff size={16} color="#AECAAE" />{:else}<Eye size={16} color="#AECAAE" />{/if}
            </button>
          </div>
        </div>

        {#if error}
          <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(192,97,74,0.12); border: 1px solid rgba(192,97,74,0.25);">
            <AlertTriangle size={13} color="#B85038" />
            <p class="text-xs text-[#B85038]">{error}</p>
          </div>
        {/if}
      </div>

      <div class="px-5 pt-3 pb-5">
        <button
          onclick={handleLogin}
          disabled={loading}
          class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-95 flex items-center justify-center gap-2"
          style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; opacity: {loading ? 0.7 : 1}; box-shadow: 0 10px 30px rgba(196,92,56,0.35);"
        >
          {#if loading}
            <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Signing in…
          {:else}
            Sign In <ChevronRight size={16} />
          {/if}
        </button>
      </div>
    </div>

    <p class="text-[10px] text-[#4A6842] text-center mt-2 fade-in-up" style="animation-delay: 0.14s;">
      Admin accounts are provisioned via the backend CLI, not self-signup.
    </p>
  </div>
</div>

<style>
  .admin-field:focus-within {
    border-color: rgba(196,92,56,0.6) !important;
    background: rgba(255,255,255,0.22) !important;
  }
  .fade-in-up {
    animation: admin-login-fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  @keyframes admin-login-fade-in-up {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .fade-in-up {
      animation: none;
    }
  }
</style>
