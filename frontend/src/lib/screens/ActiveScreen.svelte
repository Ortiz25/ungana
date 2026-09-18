<script>
  import { onMount } from 'svelte';
  import { Wifi, Phone, RotateCcw, MessageCircle, Globe, Megaphone, Zap, ChevronRight } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import DemoBadge from '$lib/components/DemoBadge.svelte';
  import { formatTime, formatCompactDuration, getWarningThreshold } from '$lib/data.js';
  import { getSite } from '$lib/api.js';
  import { getSiteId } from '$lib/device.js';

  // `initialRemaining` lets a restored session (page reload while still
  // connected) resume the countdown from the actual time left instead of
  // restarting the full duration — see +page.svelte's session-restore check.
  // `autoGoOnline` is true only when this screen was just reached fresh from
  // ConnectingScreen (a payment that just confirmed) — false when it's a
  // restored/reloaded already-active session (on-load MAC check or
  // CheckSessionScreen), where auto-popping a new tab on every visit would
  // be unwanted. See +page.svelte's `cameFromConnecting`.
  // `onExplore` sends the client to TimelineScreen without losing this
  // session — see +page.svelte's timelineOrigin, which brings them right
  // back here on "Back" instead of dropping them at package selection.
  let { pkg, phone, mode = 'simulation', initialRemaining = null, autoGoOnline = false, onExpiring, onExtend, onExplore } = $props();

  // Same site-vertical lookup TimelineScreen itself makes — drives the
  // Explore tile's label/icon below so it points at whichever half of
  // TimelineScreen this site actually has (Campus for an institution site,
  // Watch & Earn otherwise) instead of a generic "Explore" that doesn't set
  // the right expectation. null site (dev/local) just defaults to Watch & Earn.
  const site = getSiteId();
  let isInstitution = $state(false);

  const total = pkg.demoSecs;
  const warningThreshold = getWarningThreshold(total);
  let remaining = $state(initialRemaining ?? total);
  let warned = false;
  let returnBanner = $state(false);
  const originalTitle = document.title;

  // Countdown
  $effect(() => {
    const t = setInterval(() => {
      const next = remaining - 1;
      if (next <= warningThreshold && !warned) {
        warned = true;
        setTimeout(onExpiring, 0);
      }
      remaining = next;
    }, 1000);
    return () => clearInterval(t);
  });

  // Page Visibility — update tab title when hidden, restore + banner on return
  $effect(() => {
    const stored = originalTitle;
    let titleInterval = null;

    function onVisibilityChange() {
      if (document.hidden) {
        titleInterval = setInterval(() => {
          const r = remaining;
          const ts = formatCompactDuration(r);
          document.title = r <= warningThreshold ? `⚠️ ${ts} left — Ungana WiFi` : `⏱ ${ts} remaining — Ungana`;
        }, 1000);
      } else {
        if (titleInterval) {
          clearInterval(titleInterval);
          titleInterval = null;
        }
        document.title = stored;
        returnBanner = true;
        setTimeout(() => (returnBanner = false), 4000);
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (titleInterval) clearInterval(titleInterval);
      document.title = stored;
    };
  });

  const pct = $derived(remaining / total);
  const radius = 54;
  const circ = 2 * Math.PI * radius;
  const minsLeft = $derived(Math.ceil(remaining / 60));

  // `_blank` hands focus straight to the new tab — firing this on every
  // visit to an already-active session (restored on load, or via "Check
  // Session") would yank the user onto google.com unprompted and leave the
  // countdown running unseen behind it. Auto-firing it exactly once, right
  // after a fresh payment is confirmed (autoGoOnline, set by
  // ConnectingScreen's onConnected), is the one case where that's actually
  // wanted — everywhere else the button stays purely tap-only.
  function goOnline() {
    window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
  }

  onMount(async () => {
    if (autoGoOnline) goOnline();
    if (site) {
      const result = await getSite(site);
      if (result.ok && result.data?.site) isInstitution = result.data.site.vertical === 'institution';
    }
  });
</script>

<div
  class="flex flex-col px-5 pb-8"
  style="min-height: 100dvh; background: linear-gradient(160deg, #1D3C2A 0%, #2E5A3E 100%); position: relative;"
>
  <!-- Welcome-back banner -->
  <div
    style="position: absolute; top: 16px; left: 50%; transform: translateX(-50%) translateY({returnBanner
      ? '0'
      : '-60px'}); transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); z-index: 50; pointer-events: none;"
  >
    <div
      class="flex items-center gap-2 px-4 py-2 rounded-full shadow-lg"
      style="background: {remaining <= warningThreshold
        ? '#B85038'
        : '#2E5A3E'}; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap;"
    >
      <div class="w-2 h-2 rounded-full animate-pulse" style="background: {remaining <= warningThreshold ? '#ffb0a0' : '#C45C38'};"></div>
      <span class="text-xs font-semibold text-[#E8D4B0]">
        {remaining <= warningThreshold ? '⚠️ Session expiring soon!' : `${minsLeft} min left in your session`}
      </span>
    </div>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between pt-5 pb-4">
    <div class="flex items-center gap-2">
      <UnganaLogoMark height={24} />
      <span class="text-sm font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">Ungana</span>
    </div>
    <div
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
      style="background: rgba(196,92,56,0.30); border: 1px solid rgba(196,92,56,0.3);"
    >
      <div class="w-2 h-2 rounded-full bg-[#C45C38] animate-pulse"></div>
      <span class="text-xs font-bold text-[#C45C38]">LIVE</span>
    </div>
  </div>

  <!-- Online banner -->
  <div class="rounded-3xl mb-5 overflow-hidden" style="background: rgba(196,92,56,0.08); border: 1px solid rgba(196,92,56,0.35);">
    <div class="px-5 py-4 flex items-center gap-4">
      <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.30);">
        <Wifi size={24} color="#C45C38" />
      </div>
      <div>
        <p class="text-base font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">You're Online!</p>
        <p class="text-xs text-[#C4DAC0] mt-0.5">Session started · {pkg.label} plan</p>
      </div>
    </div>
  </div>

  <!-- Countdown ring -->
  <div class="flex flex-col items-center mb-5">
    <div class="relative flex items-center justify-center" style="width: 160px; height: 160px;">
      <svg width="160" height="160" style="transform: rotate(-90deg);">
        <circle cx="80" cy="80" r={radius} fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="10" />
        <circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke={pct > 0.4 ? '#C45C38' : pct > 0.2 ? '#CC8830' : '#B85038'}
          stroke-width="10"
          stroke-linecap="round"
          stroke-dasharray={circ}
          stroke-dashoffset={circ * (1 - pct)}
          style="transition: stroke-dashoffset 0.9s linear, stroke 1s;"
        />
      </svg>
      <div class="absolute flex flex-col items-center">
        <span class="text-3xl font-bold text-[#E8D4B0]" style="font-family: 'Inter', sans-serif; letter-spacing: -1px;">
          {formatTime(remaining)}
        </span>
        <span class="text-[10px] text-[#C4DAC0] mt-0.5 uppercase tracking-wider">remaining</span>
      </div>
    </div>
    <p class="text-xs text-[#AECAAE] mt-2">{pkg.duration} total · expires when timer ends</p>
  </div>

  <!-- Explore tile — replaces the old fabricated Signal/Speed readout
       (this app has no real link-quality telemetry to show) with something
       actually useful: a way back into TimelineScreen without losing this
       session, pointed at whichever half of it this site actually has. -->
  <button
    onclick={onExplore}
    class="w-full rounded-2xl p-4 flex items-center gap-3 mb-5 text-left transition-all active:scale-[0.98]"
    style="background: rgba(196,92,56,0.10); border: 1px solid rgba(196,92,56,0.35);"
  >
    <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.30);">
      {#if isInstitution}
        <Megaphone size={18} color="#C45C38" />
      {:else}
        <Zap size={18} color="#C45C38" />
      {/if}
    </div>
    <div class="flex-1 min-w-0">
      <p class="text-sm font-bold text-[#E8D4B0]">{isInstitution ? 'Explore Campus' : 'Watch & Earn'}</p>
      <p class="text-xs text-[#C4DAC0] mt-0.5">
        {isInstitution ? 'Notices, exam timetable & more' : 'Earn extra time while you’re connected'}
      </p>
    </div>
    <ChevronRight size={16} color="#C4DAC0" class="shrink-0" />
  </button>

  <!-- Account row -->
  <div
    class="rounded-2xl px-4 py-3 flex items-center gap-3 mb-5"
    style="background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18);"
  >
    <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background: rgba(196,92,56,0.30);">
      <Phone size={14} color="#C45C38" />
    </div>
    <div class="flex-1">
      <p class="text-[10px] text-[#AECAAE] uppercase tracking-wider">Registered number</p>
      <p class="text-sm font-semibold text-[#E8D4B0]">+254 {phone}</p>
    </div>
  </div>

  {#if autoGoOnline}
    <!-- Already auto-triggered on mount — this is purely the fail-safe for
         a browser that blocked the automatic window.open() call, so it
         reads as a backup action, not the primary CTA. -->
    <button
      onclick={goOnline}
      class="w-full py-3.5 rounded-2xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 mb-2"
      style="background: rgba(255,255,255,0.14); color: #C4DAC0; border: 1.5px solid rgba(196,92,56,0.3);"
    >
      <Globe size={15} />Not redirected? Go Online
    </button>
  {:else}
    <button
      onclick={goOnline}
      class="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 mb-2"
      style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
    >
      <Globe size={16} />Go Online
    </button>
  {/if}
  <button
    onclick={onExtend}
    class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 mb-2"
    style="background: rgba(255,255,255,0.14); color: #C4DAC0;"
  >
    <RotateCcw size={15} />Extend Session
  </button>
  <button
    class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
    style="background: rgba(255,255,255,0.14); color: #C4DAC0;"
  >
    <MessageCircle size={15} />Support
  </button>
  {#if mode !== 'active'}<DemoBadge />{/if}
</div>
