<script>
  import { ArrowLeft, Eye, EyeOff, AlertTriangle, ChevronRight, ShieldCheck } from '@lucide/svelte';
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
      onLogin({ token: result.data.token, username: result.data.admin.username });
      return;
    }

    error = result.data?.message || 'Could not sign in — check your connection';
  }
</script>

<div
  class="flex flex-col px-5 pb-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 60%, #1D3C2A 100%);"
>
  <div class="pt-4 pb-2">
    <button
      onclick={onBack}
      class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
      style="background: rgba(255,255,255,0.18);"
    >
      <ArrowLeft size={18} color="#C4DAC0" />
    </button>
  </div>

  <div class="flex flex-col items-center pt-4 pb-8">
    <UnganaLogoMark height={44} />
    <div class="mt-4 px-3 py-1 rounded-full flex items-center gap-1.5" style="background: rgba(196,92,56,0.30); border: 1px solid rgba(196,92,56,0.3);">
      <ShieldCheck size={11} color="#C45C38" />
      <span class="text-[11px] font-bold text-[#C45C38] uppercase tracking-widest">Admin Panel</span>
    </div>
    <h1 class="text-2xl font-bold text-[#E8D4B0] mt-3 text-center" style="font-family: 'Playfair Display', serif;">Admin sign in</h1>
    <p class="text-sm text-[#C4DAC0] mt-1 text-center">Manage content, activators & coordinators</p>
  </div>

  <div class="rounded-3xl overflow-hidden mb-4" style="background: rgba(255,255,255,0.14); border: 1px solid rgba(255,255,255,0.1);">
    <div class="px-5 pt-5 pb-2 flex flex-col gap-3">
      <div>
        <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Username</p>
        <div class="flex items-center rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
          <input
            value={username}
            oninput={(e) => {
              username = e.currentTarget.value;
              error = '';
            }}
            placeholder="admin"
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none"
          />
        </div>
      </div>

      <div>
        <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Password</p>
        <div class="flex items-center rounded-2xl overflow-hidden" style="background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.1);">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            oninput={(e) => {
              password = e.currentTarget.value;
              error = '';
            }}
            placeholder="••••••••"
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#4A6842] text-sm outline-none"
            onkeydown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onclick={() => (showPassword = !showPassword)} class="px-4 py-3.5 shrink-0">
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
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; opacity: {loading ? 0.7 : 1};"
      >
        {#if loading}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Signing in…
        {:else}
          Sign In <ChevronRight size={16} />
        {/if}
      </button>
    </div>
  </div>

  <p class="text-[10px] text-[#4A6842] text-center mt-2">
    Admin accounts are provisioned via the backend CLI, not self-signup.
  </p>
</div>
