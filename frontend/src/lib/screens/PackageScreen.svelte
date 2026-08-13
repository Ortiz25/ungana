<script>
  import { onMount } from 'svelte';
  import { ChevronRight, Clock, CheckCircle2, Zap, UserCheck, ShieldCheck } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import ActivatorDropdown from '$lib/components/ActivatorDropdown.svelte';
  import { PACKAGES, ACTIVATORS } from '$lib/data.js';
  import { getPackages, getActivatorForMac, getSite } from '$lib/api.js';
  import { getClientMac, getSiteId } from '$lib/device.js';

  let { mode = 'simulation', onSelect, onActivatorLogin, onCoordinatorLogin, onAdminLogin, onEarnAccess } = $props();

  // Static PACKAGES supplies icon/badge/demoSecs (frontend-only demo/UI
  // concerns); price + label are refreshed from the backend when reachable
  // so pricing can change without a frontend redeploy. Falls back to the
  // static catalogue wholesale if the backend/DB is unreachable.
  //
  // `demoSecs` is what every downstream screen (Active/Warning/Connecting)
  // actually counts down — in `active` mode (real money) it's overridden to
  // the package's real catalog duration here, so nothing further down the
  // chain needs to know about mode at all. In `simulation` it stays the
  // fast accelerated value for demo purposes.
  let packages = $state(PACKAGES);
  // null = not resolved yet — both the "Choose your plan" and "Earn Free
  // Access" sections below stay hidden (see their {#if siteMode && ...}
  // gates) until this settles. Previously defaulted straight to 'both',
  // which meant BOTH sections rendered immediately and only narrowed down
  // once the getSite() round-trip finished — on a pay_only or earn_only
  // site, the section that shouldn't exist flashed on screen for however
  // long that fetch took, then vanished. Resolves to 'both' synchronously
  // (no flash at all) when there's no site to check — local dev has no
  // captive-portal URL to read one from, same "sees everything" convention
  // as every other site-scoped default in this app — and resolves to
  // 'both' on a fetch error too (fail open on the DISPLAY only; the
  // backend enforces site mode server-side regardless of what this screen
  // shows, so a stale/optimistic 'both' here can never actually let a
  // restricted site's purchase or claim through).
  let siteMode = $state(null);

  onMount(async () => {
    const siteId = getSiteId();
    if (!siteId) siteMode = 'both';

    const [siteResult, packagesResult] = await Promise.all([
      siteId ? getSite(siteId) : Promise.resolve(null),
      getPackages(siteId)
    ]);

    if (siteId) {
      siteMode = siteResult?.ok && siteResult.data?.site?.mode ? siteResult.data.site.mode : 'both';
    }

    if (!packagesResult.ok || !packagesResult.data?.packages) return;

    const merged = packagesResult.data.packages
      .map((row) => {
        const local = PACKAGES.find((p) => p.id === row.id);
        if (!local) return null; // unknown id — no icon/UI metadata to render it with
        return {
          ...local,
          label: row.label,
          price: Number(row.price_kes),
          demoSecs: mode === 'active' ? row.duration_secs : local.demoSecs
        };
      })
      .filter(Boolean);

    if (merged.length > 0) packages = merged;
  });

  let selected = $state('weekly');
  let activator = $state(null);
  let activatorError = $state(false);
  // This MAC's activator assignment is permanent once a first purchase has
  // happened (commission integrity — see backend schema.sql) — fetched and
  // locked here so a returning client can't be re-attributed, deliberately
  // or not. `locked` with a null activator means permanently self-onboarded.
  let activatorLocked = $state(false);

  onMount(async () => {
    const result = await getActivatorForMac(getClientMac());
    if (!result.ok || !result.data?.locked) return;

    activatorLocked = true;
    activator = result.data.activator
      ? { id: result.data.activator.code, name: result.data.activator.name, area: result.data.activator.territory ?? '' }
      : ACTIVATORS.find((a) => a.id === 'SELF');
  });
</script>

<ScreenBg>
  <div class="flex flex-col items-center pt-5 pb-6">
    <UnganaLogoMark height={50} />
    <h1 class="text-2xl font-bold text-[#1D3C2A] mt-3" style="font-family: 'Playfair Display', serif;">Ungana</h1>
    <p class="text-xs font-medium mt-0.5" style="color: #2E5A3E;">Free internet, great content</p>
  </div>

  <!-- Activator section -->
  <div class="mb-5">
    <div class="flex items-center gap-2 mb-2">
      <h2 class="text-sm font-bold text-[#1D3C2A]">Your Activator</h2>
      <span
        class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
        style="background: {activatorLocked ? '#3C6A4A' : '#C45C38'};"
      >
        {activatorLocked ? 'Locked' : 'Required'}
      </span>
    </div>
    <p class="text-xs mb-3" style="color: #2E5A3E;">
      {activatorLocked ? 'Set on your first purchase — cannot be changed' : 'Who introduced you to Ungana?'}
    </p>
    <ActivatorDropdown
      value={activator}
      onChange={(a) => {
        activator = a;
        activatorError = false;
      }}
      error={activatorError}
      locked={activatorLocked}
    />
    {#if activator}
      <div
        class="flex items-center gap-2 mt-2.5 px-3 py-2 rounded-xl"
        style="background: rgba(46,90,62,0.1); border: 1px solid rgba(46,90,62,0.15);"
      >
        <CheckCircle2 size={13} color="#3C6A4A" />
        <p class="text-[11px] text-[#3C6A4A]">
          {#if activator.id === 'SELF'}
            <span class="font-semibold text-[#1D3C2A]">Self-onboarded</span>
          {:else}
            <span>Referred by </span><span class="font-semibold text-[#1D3C2A]">{activator.name}</span> · {activator.area}
          {/if}
        </p>
      </div>
    {/if}
  </div>

  <div class="h-px bg-[#1D3C2A] opacity-10 mb-5"></div>

  {#if siteMode === null}
    <div class="flex flex-col gap-3 mb-5">
      {#each [0, 1, 2] as i (i)}
        <div class="h-[76px] rounded-3xl animate-pulse" style="background: rgba(46,90,62,0.08);"></div>
      {/each}
    </div>
  {/if}

  {#if siteMode && siteMode !== 'earn_only'}
  <div class="mb-4">
    <h2 class="text-lg font-bold text-[#1D3C2A]" style="font-family: 'Playfair Display', serif;">Choose your plan</h2>
    <p class="text-xs mt-0.5" style="color: #2E5A3E;">Select how long you want access</p>
  </div>

  <div class="flex flex-col gap-3 mb-5">
    {#each packages as pkg (pkg.id)}
      {@const Icon = pkg.icon}
      {@const isSelected = selected === pkg.id}
      <div
        role="button"
        tabindex="0"
        onclick={() => (selected = pkg.id)}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            selected = pkg.id;
          }
        }}
        class="w-full text-left rounded-3xl transition-all duration-200 active:scale-[0.98] cursor-pointer"
        style="background: {isSelected ? '#2E5A3E' : 'rgba(46,90,62,0.08)'}; border: {isSelected
          ? '2px solid #C45C38'
          : '2px solid transparent'}; box-shadow: {isSelected ? '0 8px 28px rgba(196,92,56,0.18)' : 'none'};"
      >
        <div class="flex items-center gap-4 px-5 py-4">
          <div
            class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
            style="background: {isSelected ? 'rgba(196,92,56,0.35)' : 'rgba(46,90,62,0.12)'};"
          >
            <Icon size={20} color={isSelected ? '#C45C38' : '#3C6A4A'} strokeWidth={2} />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-base font-bold" style="color: {isSelected ? '#E8D4B0' : '#1D3C2A'};">{pkg.label}</span>
              {#if pkg.badge}
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: #C45C38; color: #fff;">{pkg.badge}</span>
              {/if}
            </div>
            <p class="text-xs" style="color: {isSelected ? '#C4DAC0' : '#3C6A4A'};">{pkg.duration} of free internet</p>
          </div>
          <div class="flex flex-col items-end shrink-0">
            <span class="text-xl font-bold" style="color: {isSelected ? '#C45C38' : '#1D3C2A'};">
              {pkg.price}<span class="text-xs ml-0.5" style="color: {isSelected ? '#C45C38' : '#3C6A4A'};">KES</span>
            </span>
            <span class="text-[10px] font-medium mt-0.5" style="color: {isSelected ? '#C4DAC0' : '#9AB498'};">{pkg.duration}</span>
          </div>
        </div>
        {#if isSelected}
          <div class="mx-5 mb-4">
            {#if pkg.id === 'weekly' || pkg.id === 'monthly'}
              <div class="flex items-center gap-2 mb-3 px-1">
                <Clock size={13} color="#E8D4B0" />
                <p class="text-[11px]" style="color: #C4DAC0;">
                  That's only <span class="font-bold text-[#E8D4B0]">{(pkg.price / (pkg.id === 'weekly' ? 7 : 30)).toFixed(0)} KES/day</span>
                  {' '}— saving you {pkg.id === 'weekly' ? '30%' : '50%'}
                </p>
              </div>
            {/if}
            <button
              onclick={(e) => {
                e.stopPropagation();
                if (!activator) {
                  activatorError = true;
                  return;
                }
                onSelect(pkg, activator);
              }}
              class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              style="background: {activator
                ? 'linear-gradient(135deg, #C45C38, #CC8830)'
                : 'transparent'}; border: {activator
                ? 'none'
                : '2px dashed rgba(232,212,176,0.4)'}; color: {activator
                ? '#fff'
                : 'rgba(232,212,176,0.6)'}; letter-spacing: 0.04em; box-shadow: {activator
                ? '0 6px 20px rgba(196,92,56,0.3)'
                : 'none'};"
            >
              Buy Package
              <ChevronRight size={16} />
            </button>
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {/if}

  {#if siteMode && siteMode !== 'pay_only'}
  {#if siteMode !== 'earn_only'}
  <!-- Earn Access divider — only shown between the two options when both are actually available. -->
  <div class="flex items-center gap-3 mt-3 mb-3">
    <div class="flex-1 h-px" style="background: rgba(29,60,42,0.15);"></div>
    <span class="text-[11px] font-medium" style="color: #9AB498;">or</span>
    <div class="flex-1 h-px" style="background: rgba(29,60,42,0.15);"></div>
  </div>
  {/if}
  <!-- Styled as a full card at the same visual weight as the paid plans
       above (icon, title, subtitle, badge) instead of a plain outlined
       button — that version read as a minor/skippable link and was easy to
       scroll past. The glow wrapper nudges attention toward it without a
       constant distracting pulse (see .earn-glow-wrap below). -->
  <div class="earn-glow-wrap w-full mb-2">
    <button
      onclick={onEarnAccess}
      class="w-full text-left rounded-3xl overflow-hidden transition-all active:scale-[0.98]"
      style="background: linear-gradient(135deg, #C45C38, #E0983F); box-shadow: 0 8px 24px rgba(196,92,56,0.3);"
    >
      <div class="flex items-center gap-4 px-5 py-4">
        <div class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.22);">
          <Zap size={20} color="#fff" strokeWidth={2} />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-0.5">
            <span class="text-base font-bold text-white">Earn Free Access</span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.28); color: #fff;">FREE</span>
          </div>
          <p class="text-xs" style="color: rgba(255,255,255,0.85);">Watch & learn to unlock internet time</p>
        </div>
        <ChevronRight size={18} color="#fff" />
      </div>
    </button>
  </div>
  {/if}

  <div class="flex flex-col items-center gap-1.5 mt-2">
    <p class="text-[10px]" style="color: #9AB498;">swap.ungana.app</p>
    <div class="flex items-center gap-3">
      <button
        onclick={onActivatorLogin}
        class="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity active:opacity-60"
        style="color: #2E5A3E;"
      >
        <UserCheck size={12} />
        Activator Portal
      </button>
      <span class="text-[#C4A870]">·</span>
      <button
        onclick={onCoordinatorLogin}
        class="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity active:opacity-60"
        style="color: #96B496;"
      >
        <ShieldCheck size={12} />
        Coordinator
      </button>
      <span class="text-[#C4A870]">·</span>
      <button
        onclick={onAdminLogin}
        class="flex items-center gap-1.5 text-[11px] font-semibold transition-opacity active:opacity-60"
        style="color: #96B496;"
      >
        <ShieldCheck size={12} />
        Admin
      </button>
    </div>
  </div>
</ScreenBg>

<style>
  /* A slow, subtle glow ring rather than a constant scale pulse — this
     button sits right below the primary paid-plan CTAs, so it needs to
     register as "there's a free option too" without competing with them
     for attention the way a full breathing/scale animation would. */
  .earn-glow-wrap {
    position: relative;
    border-radius: 1.5rem;
  }
  .earn-glow-wrap::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 1.5rem;
    box-shadow: 0 0 0 0 rgba(196, 92, 56, 0.4);
    animation: earn-glow-ring 2.8s ease-out infinite;
    pointer-events: none;
  }
  @keyframes earn-glow-ring {
    0% {
      box-shadow: 0 0 0 0 rgba(196, 92, 56, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(196, 92, 56, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(196, 92, 56, 0);
    }
  }
</style>
