<script>
  import { UserCheck, ChevronRight, AlertTriangle, ArrowRight } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import { getSessionByUsername } from '$lib/api.js';

  // Shown when this browser has no way to know the device's MAC (no router
  // redirect param, nothing cached from a previous visit here) — e.g.
  // Android opens captive-portal logins in an isolated WebView with its own
  // storage, separate from the user's regular browser. `onFound` receives
  // the raw session-status payload; `onSkip` goes to the normal purchase flow.
  let { onFound, onSkip } = $props();

  let username = $state('');
  let loading = $state(false);
  let error = $state('');

  async function handleCheck() {
    if (!username.trim() || loading) return;
    loading = true;
    error = '';

    const result = await getSessionByUsername(username.trim());
    loading = false;

    if (!result.ok) {
      error = 'Could not reach the server — try again in a moment.';
      return;
    }
    if (!result.data?.found) {
      error = "No session found for that username. Check the spelling, or it's your first time.";
      return;
    }
    onFound(result.data);
  }
</script>

<ScreenBg class="items-center">
  <div class="flex flex-col items-center pt-6 pb-6">
    <UnganaLogoMark height={44} />
    <h1 class="text-xl font-bold text-[#1D3C2A] mt-3 text-center" style="font-family: 'Playfair Display', serif;">
      Check your session
    </h1>
    <p class="text-xs mt-1 text-center max-w-[260px]" style="color: #2E5A3E;">
      We couldn't tell which device this is — enter the username you set at checkout to pick up where you left off
    </p>
  </div>

  <div class="w-full rounded-3xl overflow-hidden shadow-xl mb-4" style="background: #2E5A3E;">
    <div class="px-5 pt-5 pb-2">
      <p class="text-xs text-[#C4DAC0] font-semibold mb-1.5 uppercase tracking-wider">Username</p>
      <div class="flex items-center gap-3 px-4 py-3 rounded-2xl" style="background: rgba(0,0,0,0.2);">
        <UserCheck size={16} color="#C4DAC0" />
        <input
          value={username}
          oninput={(e) => {
            username = e.currentTarget.value.replace(/\s/g, '').slice(0, 24);
            error = '';
          }}
          placeholder="e.g. swiftrunner42"
          class="flex-1 bg-transparent text-sm font-semibold text-[#E8D4B0] outline-none placeholder:text-[#4A6842]"
        />
      </div>
    </div>

    {#if error}
      <div class="mx-5 mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(184,80,56,0.22);">
        <AlertTriangle size={13} color="#F0A08A" />
        <p class="text-xs text-[#F0A08A]">{error}</p>
      </div>
    {/if}

    <div class="px-5 pt-4 pb-5">
      <button
        onclick={handleCheck}
        disabled={!username.trim() || loading}
        class="w-full py-4 rounded-2xl font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; opacity: {!username.trim() ? 0.6 : 1};"
      >
        {#if loading}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Checking…
        {:else}
          Check Session <ChevronRight size={16} />
        {/if}
      </button>
    </div>
  </div>

  <button
    onclick={onSkip}
    class="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 active:scale-95"
    style="background: rgba(46,90,62,0.1); border: 1.5px solid rgba(46,90,62,0.2); color: #1D3C2A;"
  >
    New here? Buy a package <ArrowRight size={15} />
  </button>

  <p class="text-[10px] text-[#9AB498] text-center mt-4">
    Didn't set a username? Reconnect to the Wi-Fi network to be recognised automatically.
  </p>
</ScreenBg>
