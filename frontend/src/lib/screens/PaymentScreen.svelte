<script>
  import { onMount } from 'svelte';
  import QRCode from 'qrcode';
  import {
    ArrowLeft,
    Phone,
    Smartphone,
    MessageCircle,
    User,
    CheckCircle2,
    CircleX,
    Bitcoin,
    Copy,
    AlertTriangle,
    Wallet
  } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import {
    initiatePayment,
    initiateBtcPayment,
    verifyBtcPayment,
    getUsernameForMac,
    checkUsernameAvailable,
    getSite
  } from '$lib/api.js';
  import { getClientMac, getSiteId } from '$lib/device.js';

  // `onBtcPaid` fires once a Lightning invoice is confirmed settled — unlike
  // M-Pesa (onPay -> InitiatedScreen polls), BTC polling happens right here
  // while the QR is on screen, so by the time this fires payment is already
  // confirmed and the caller can go straight to connecting.
  let { pkg, activator, onPay, onBtcPaid, onBack } = $props();

  let paymentMethod = $state('mpesa'); // 'mpesa' | 'btc'
  // null = not resolved yet (button stays hidden — see the {#if btcAvailable}
  // below, where null is as falsy as false). Deliberately NOT defaulted to
  // true: that was the previous behaviour, and it meant the button flashed
  // on screen for every client on a BTC-disabled site for as long as the
  // getSite() round-trip took, then vanished — briefly showing a payment
  // method that was never actually going to work. Resolves to true
  // synchronously (no flash at all) when there's no site to check — local
  // dev has no captive-portal URL to read one from, same "sees everything"
  // convention as every other site-scoped default in this app — and
  // resolves to true on a fetch error too (fail open on the DISPLAY only;
  // the backend enforces btc_enabled server-side regardless of what this
  // screen shows, so a stale/optimistic true here can never actually let a
  // disabled site's payment through).
  let btcAvailable = $state(null);

  // Evocative brand colours for each method — not a reproduction of either
  // company's actual logo/trademark, just a tint + generic icon so each
  // option reads as visually distinct at a glance.
  const BRAND = {
    mpesa: { gradient: 'linear-gradient(135deg, #43B02A, #6FCF56)', glow: 'rgba(67,176,42,0.45)' },
    btc: { gradient: 'linear-gradient(135deg, #F7931A, #FFB74D)', glow: 'rgba(247,147,26,0.45)' }
  };
  const currentBrand = $derived(BRAND[paymentMethod]);
  const otherBrand = $derived(BRAND[paymentMethod === 'btc' ? 'mpesa' : 'btc']);

  let phone = $state('');
  let username = $state('');
  let usernameError = $state('');
  let usernameLocked = $state(false); // already set for this MAC on an earlier purchase — just display it
  let usernameStatus = $state(null); // null | 'checking' | 'available' | 'taken'
  let simulateFailure = $state(false);
  let submitting = $state(false);
  // A username is mandatory — either already locked in from an earlier
  // purchase on this MAC, or freshly typed and not already taken by
  // someone else. Empty blocks submission just like an unset activator
  // blocks package selection on the previous screen.
  const usernameValid = $derived(usernameLocked || (username.trim().length > 0 && usernameStatus !== 'taken'));
  // Stricter than usernameValid: also waits out the in-flight availability
  // check (avoids firing BTC auto-generation on every keystroke). Does NOT
  // require the check to have resolved 'available' specifically — if it
  // never comes back (network hiccup, unreachable backend in dev) status
  // just sits at null, and requiring 'available' literally left the BTC
  // flow permanently stuck with no invoice and no way to proceed. Backend
  // still enforces uniqueness for real (409 on submit), this is only a UX
  // nicety.
  const usernameSettled = $derived(
    usernameLocked || (username.trim().length > 0 && usernameStatus !== 'checking' && usernameStatus !== 'taken')
  );
  const ready = $derived(phone.length >= 9 && !submitting && usernameValid);
  const PkgIcon = $derived(pkg.icon);

  // ── BTC / Lightning ────────────────────────────────────────────────────
  let btcStatus = $state('idle'); // 'idle' | 'generating' | 'awaiting' | 'failed'
  let btcInvoice = $state(null); // { reference, lightningInvoice, checkoutLink, expiresAt }
  let btcQrDataUrl = $state(null);
  let btcCopied = $state(false);
  let btcError = $state('');
  const btcReady = $derived(btcStatus !== 'generating' && usernameValid);

  const BTC_POLL_INTERVAL_MS = 10000;

  async function generateBtcInvoice() {
    if (!btcReady) return;
    btcStatus = 'generating';
    btcError = '';
    usernameError = '';

    const result = await initiateBtcPayment({
      clientMac: getClientMac(),
      amount: pkg.price,
      packageId: pkg.id,
      activatorCode: activator?.id ?? 'SELF',
      durationSecs: pkg.demoSecs,
      simulateFailure,
      username: username.trim() || undefined,
      site: getSiteId() || undefined
    });

    // Accept either a raw Lightning invoice (renders our own in-place QR)
    // or just a hosted checkout link (BTCPay's own page — has its own
    // QR/copy UI) — either is enough to actually pay. Only treat this as a
    // hard failure when NEITHER came back, which is when invoice creation
    // genuinely failed. Previously required lightningInvoice specifically,
    // which meant a real, payable invoice with only a checkout link (e.g.
    // if the raw BOLT11 string wasn't extracted for some reason) still
    // showed "could not generate an invoice" despite BTCPay having
    // actually succeeded.
    if (!result.ok || (!result.data?.lightningInvoice && !result.data?.checkoutLink)) {
      if (result.status === 409) {
        // A username problem, not an invoice-generation problem — resets to
        // idle so the auto-generate effect below waits for a corrected
        // username, but forces usernameStatus to 'taken' first so that same
        // effect doesn't immediately re-fire with the still-taken value and
        // loop.
        usernameError = result.data?.message || 'That username is taken — try another.';
        usernameStatus = 'taken';
        btcStatus = 'idle';
      } else {
        // A real generation failure — lands on 'failed' (not 'idle') so the
        // auto-generate effect won't immediately retry on its own; the user
        // has to tap "Try Again".
        btcError = 'Could not generate an invoice — try again in a moment.';
        btcStatus = 'failed';
      }
      return;
    }

    btcInvoice = result.data;
    btcQrDataUrl = btcInvoice.lightningInvoice
      ? await QRCode.toDataURL(btcInvoice.lightningInvoice, { margin: 1, width: 220 })
      : null;
    btcStatus = 'awaiting';
  }

  // A returning client (username already locked in from an earlier
  // purchase on this MAC) gets a seamless BTC flow — switching to it
  // generates the invoice immediately, no extra tap. A first-time client
  // still has to type and settle a username, then explicitly tap "Generate
  // Invoice" below — auto-firing off a freshly-typed, not-yet-fully-trusted
  // username felt too eager, and this also sidesteps ever needing to guess
  // whether the user is "done typing". `btcStatus` flips to 'generating'
  // synchronously inside generateBtcInvoice before its first await, so this
  // effect naturally stops re-firing once the request starts.
  $effect(() => {
    if (paymentMethod !== 'btc') return;
    if (btcStatus !== 'idle') return;
    if (!usernameLocked) return;
    generateBtcInvoice();
  });

  function copyInvoice() {
    if (!btcInvoice?.lightningInvoice) return;
    navigator.clipboard?.writeText(btcInvoice.lightningInvoice).catch(() => {});
    btcCopied = true;
    setTimeout(() => (btcCopied = false), 2000);
  }

  // "Pay in Wallet" is a plain same-tab `lightning:` link — same mechanism
  // BTCPay's own checkout uses. Any "choose an app" prompt on tap is the
  // phone's OS resolving that URI scheme against installed apps; a page
  // can't add code to force that dialog to appear, it either has handlers
  // registered or it doesn't. This just detects the "doesn't" case — if
  // tapping it didn't send the tab to the background within ~1.5s (a sign
  // some app intercepted the link), surface a hint instead of leaving the
  // tap looking like it did nothing.
  let btcNoWalletHint = $state(false);
  let noWalletTimer;
  function attemptOpenWallet() {
    clearTimeout(noWalletTimer);
    btcNoWalletHint = false;
    noWalletTimer = setTimeout(() => {
      if (!document.hidden) btcNoWalletHint = true;
    }, 1500);
  }

  // Background polling while the QR is on screen — tied to btcStatus so it
  // starts/stops automatically as the invoice lifecycle changes.
  $effect(() => {
    if (btcStatus !== 'awaiting' || !btcInvoice) return;

    let cancelled = false;
    let timer;

    async function poll() {
      if (cancelled) return;
      const result = await verifyBtcPayment(btcInvoice.reference);
      if (cancelled) return;

      if (result.ok && result.data?.success && result.data?.status === 'success') {
        onBtcPaid();
        return;
      }
      if (result.ok && result.data?.status === 'failed') {
        btcStatus = 'failed';
        btcError = 'This invoice was not paid in time. Generate a new one to try again.';
        return;
      }
      if (btcInvoice.expiresAt && Date.now() > btcInvoice.expiresAt) {
        btcStatus = 'failed';
        btcError = 'This invoice expired. Generate a new one to try again.';
        return;
      }
      timer = setTimeout(poll, BTC_POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  });

  let usernameCheckTimer;

  onMount(async () => {
    const siteId = getSiteId();
    // No site round-trip needed when there's nothing to check — resolves
    // synchronously so a dev/no-site client never even sees a flash.
    if (!siteId) btcAvailable = true;

    const [usernameResult, siteResult] = await Promise.all([
      getUsernameForMac(getClientMac()),
      siteId ? getSite(siteId) : Promise.resolve(null)
    ]);

    if (usernameResult.ok && usernameResult.data?.username) {
      username = usernameResult.data.username;
      usernameLocked = true;
    }

    if (siteId) {
      btcAvailable = siteResult.ok ? siteResult.data?.site?.btcEnabled !== false : true;
    }
  });

  function onUsernameInput(e) {
    username = e.currentTarget.value.replace(/\s/g, '').slice(0, 24);
    usernameError = '';
    clearTimeout(usernameCheckTimer);

    if (!username) {
      usernameStatus = null;
      return;
    }

    usernameStatus = 'checking';
    const checkedValue = username;
    usernameCheckTimer = setTimeout(async () => {
      const result = await checkUsernameAvailable(checkedValue, getClientMac());
      // The field may have changed again while this was in flight — only
      // apply the result if it's still describing the current value.
      if (checkedValue !== username) return;
      usernameStatus = result.ok ? (result.data?.available ? 'available' : 'taken') : null;
    }, 400);
  }

  async function handlePay() {
    if (!ready) return;
    submitting = true;
    usernameError = '';

    // Best-effort: ask the backend to start a real (or simulated, depending
    // on its APP_MODE) STK push. If it's unreachable, `reference` stays
    // null and InitiatedScreen falls back to its own local demo timing.
    const result = await initiatePayment({
      phoneNumber: `+254${phone}`,
      clientMac: getClientMac(),
      amount: pkg.price,
      packageId: pkg.id,
      activatorCode: activator?.id ?? 'SELF',
      durationSecs: pkg.demoSecs,
      simulateFailure,
      username: username.trim() || undefined,
      site: getSiteId() || undefined
    });

    submitting = false;

    if (!result.ok && result.status === 409) {
      // Username taken — a real rejection, not an "unreachable" case. Let
      // the user fix it and retry rather than silently dropping it.
      usernameError = result.data?.message || 'That username is taken — try another.';
      return;
    }

    onPay(phone, simulateFailure, result.ok ? result.data?.reference ?? null : null);
  }
</script>

<ScreenBg>
  <div class="flex items-center gap-3 pt-4 pb-5">
    <button
      onclick={onBack}
      class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90"
      style="background: rgba(46,90,62,0.12);"
    >
      <ArrowLeft size={18} color="#1D3C2A" />
    </button>
    <div>
      <h2 class="text-base font-bold text-[#1D3C2A] leading-tight" style="font-family: 'Playfair Display', serif;">Payment</h2>
      <p class="text-[11px] text-[#3C6A4A]">{pkg.label} plan · {pkg.duration}</p>
    </div>
  </div>

  <div class="flex items-center gap-2 mb-5">
    <UnganaLogoMark height={28} />
    <span class="text-sm font-bold text-[#1D3C2A]" style="font-family: 'Playfair Display', serif;">Ungana</span>
  </div>

  <!-- Plan summary -->
  <div class="flex items-center justify-between rounded-2xl px-4 py-3 mb-4" style="background: #2E5A3E;">
    <div class="flex items-center gap-3">
      <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background: rgba(196,92,56,0.35);">
        <PkgIcon size={15} color="#C45C38" />
      </div>
      <div>
        <p class="text-xs text-[#C4DAC0] font-medium">{pkg.label} plan</p>
        <p class="text-sm font-bold text-[#E8D4B0]">{pkg.duration} of free internet</p>
      </div>
    </div>
    <div class="text-right">
      <span class="text-lg font-bold text-[#C45C38]">{pkg.price}</span>
      <span class="text-xs text-[#C4DAC0] ml-0.5">KES</span>
    </div>
  </div>

  <!-- Form card -->
  <div class="rounded-3xl shadow-xl overflow-hidden mb-3" style="background: #2E5A3E;">
    <div class="px-5 pt-5 pb-0 flex items-start justify-between gap-3">
      <div class="flex items-start gap-2.5">
        <div
          class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
          style="background: {currentBrand.gradient}; box-shadow: 0 3px 10px {currentBrand.glow};"
        >
          {#if paymentMethod === 'btc'}
            <Bitcoin size={14} color="#fff" strokeWidth={2.5} />
          {:else}
            <Smartphone size={13} color="#fff" strokeWidth={2.5} />
          {/if}
        </div>
        <div>
          <p class="text-sm font-semibold text-[#C4DAC0] mb-1">
            {paymentMethod === 'btc' ? 'Pay with Bitcoin' : 'Pay via M-PESA'}
          </p>
          <p class="text-[11px] text-[#AECAAE] pb-4">
            {paymentMethod === 'btc' ? 'Scan or copy the Lightning invoice' : 'Enter the number to charge'}
          </p>
        </div>
      </div>
      {#if btcAvailable}
        <button
          type="button"
          onclick={() => (paymentMethod = paymentMethod === 'btc' ? 'mpesa' : 'btc')}
          class="shrink-0 flex items-center gap-1.5 text-[11px] font-bold px-3.5 py-2 rounded-full transition-all active:scale-95"
          style="background: {otherBrand.gradient}; color: #fff; letter-spacing: 0.01em;
            border: 1px solid rgba(255,255,255,0.35);
            box-shadow: 0 4px 16px {otherBrand.glow}, inset 0 1px 0 rgba(255,255,255,0.3);"
        >
          {#if paymentMethod === 'btc'}
            <Smartphone size={14} strokeWidth={2.25} />
          {:else}
            <Bitcoin size={14} strokeWidth={2.25} />
          {/if}
          {paymentMethod === 'btc' ? 'Pay with M-PESA' : 'Pay with BTC'}
        </button>
      {/if}
    </div>
    <div class="h-px mx-5 bg-white/10 mb-4"></div>
    <div class="px-5 flex flex-col gap-3 pb-2">
      {#if paymentMethod === 'mpesa'}
        <div class="flex items-center rounded-2xl overflow-hidden border border-white/10" style="background: #3C6A4A;">
          <div class="px-4 py-3.5 border-r border-white/15 shrink-0 flex items-center gap-2">
            <Phone size={13} color="#C4DAC0" />
            <span class="text-[#E8D4B0] font-semibold text-sm">+254</span>
          </div>
          <input
            type="tel"
            value={phone}
            oninput={(e) => (phone = e.currentTarget.value.replace(/[^0-9]/g, '').slice(0, 9))}
            placeholder="700012345"
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#7A9E7A] text-sm outline-none"
          />
        </div>
      {/if}

      <div
        class="flex items-center rounded-2xl overflow-hidden"
        style="background: rgba(196,92,56,0.28); border: 1px solid rgba(196,92,56,0.25);"
      >
        <div class="px-4 py-3.5 border-r shrink-0" style="border-color: rgba(196,92,56,0.25);">
          <span class="text-[#C45C38] font-semibold text-sm">KES</span>
        </div>
        <span class="flex-1 px-4 py-3.5 text-[#C45C38] font-bold text-sm">{pkg.price.toLocaleString()}</span>
        <span class="pr-4 text-[10px] text-[#C45C38] opacity-60 font-medium">fixed</span>
      </div>

      <div>
        <div
          class="flex items-center rounded-2xl overflow-hidden border transition-colors"
          style="background: #3C6A4A; opacity: {usernameLocked ? 0.75 : 1}; border-color: {usernameStatus === 'taken'
            ? 'rgba(240,160,138,0.5)'
            : 'rgba(255,255,255,0.1)'};"
        >
          <div class="px-4 py-3.5 border-r border-white/15 shrink-0">
            <User size={13} color="#C4DAC0" />
          </div>
          <input
            type="text"
            value={username}
            oninput={onUsernameInput}
            disabled={usernameLocked}
            placeholder="Username"
            required
            class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#7A9E7A] text-sm outline-none"
          />
          <div class="pr-4 shrink-0">
            {#if usernameLocked}
              <CheckCircle2 size={14} color="#7EC88E" />
            {:else if usernameStatus === 'checking'}
              <div class="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
            {:else if usernameStatus === 'available'}
              <CheckCircle2 size={14} color="#7EC88E" />
            {:else if usernameStatus === 'taken'}
              <CircleX size={14} color="#F0A08A" />
            {/if}
          </div>
        </div>
        {#if usernameError}
          <p class="text-[11px] text-[#F0A08A] mt-1.5 px-1">{usernameError}</p>
        {:else if usernameLocked}
          <p class="text-[11px] mt-1.5 px-1" style="color: #7A9E7A;">Your username from a previous purchase</p>
        {:else if usernameStatus === 'taken'}
          <p class="text-[11px] text-[#F0A08A] mt-1.5 px-1">That username is taken — try another</p>
        {:else if !username}
          <p class="text-[11px] mt-1.5 px-1" style="color: #C4A870;">Required — so you can check your session later from any browser</p>
        {:else}
          <p class="text-[11px] mt-1.5 px-1" style="color: #7A9E7A;">
            So you can check your session later from any browser
          </p>
        {/if}
      </div>

      <div class="flex justify-between items-center px-4 py-2.5 rounded-xl" style="background: rgba(255,255,255,0.14);">
        <span class="text-xs text-[#C4DAC0]">You get</span>
        <span class="text-sm font-semibold text-[#E8D4B0]">{pkg.duration} free internet</span>
      </div>

      {#if paymentMethod === 'btc'}
        <div class="rounded-2xl overflow-hidden" style="background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.1);">
          {#if btcStatus === 'idle'}
            {#if usernameLocked}
              <!-- Returning client — the auto-generate effect is about to
                   kick off the real request; this is a brief bridge so
                   there's no dead frame between "username OK" and the
                   'generating' state below. -->
              <div class="flex flex-col items-center gap-3 py-8">
                <div class="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                <p class="text-xs text-[#C4DAC0]">Preparing your Lightning invoice…</p>
              </div>
            {:else if usernameSettled}
              <div class="flex flex-col items-center gap-2.5 py-8 px-5 text-center">
                <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background: rgba(247,147,26,0.15);">
                  <Bitcoin size={16} color="#F7931A" />
                </div>
                <p class="text-xs text-[#C4DAC0]">Ready — tap "Generate Invoice" below to continue</p>
              </div>
            {:else}
              <div class="flex flex-col items-center gap-2.5 py-8 px-5 text-center">
                <div class="w-9 h-9 rounded-full flex items-center justify-center" style="background: rgba(247,147,26,0.15);">
                  <User size={16} color="#F7931A" />
                </div>
                <p class="text-xs text-[#C4DAC0]">Set a username above to continue</p>
              </div>
            {/if}
          {:else if btcStatus === 'generating'}
            <div class="flex flex-col items-center gap-3 py-8">
              <div class="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
              <p class="text-xs text-[#C4DAC0]">Generating Lightning invoice…</p>
            </div>
          {:else if btcStatus === 'awaiting' && btcInvoice}
            <div class="flex flex-col items-center gap-3 px-5 py-5">
              {#if btcQrDataUrl}
                <div
                  class="rounded-2xl p-3"
                  style="background: #fff; box-shadow: 0 0 0 1px rgba(247,147,26,0.4), 0 8px 24px rgba(247,147,26,0.25);"
                >
                  <img src={btcQrDataUrl} alt="Lightning invoice QR code" width="180" height="180" />
                </div>
              {/if}
              {#if btcInvoice.lightningInvoice}
                <div class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl" style="background: rgba(0,0,0,0.3);">
                  <p class="flex-1 text-[11px] text-[#E8D4B0] font-mono truncate">{btcInvoice.lightningInvoice}</p>
                  <button
                    onclick={copyInvoice}
                    class="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg"
                    style="background: {btcCopied
                      ? 'rgba(78,128,80,0.35)'
                      : 'rgba(247,147,26,0.25)'}; color: {btcCopied ? '#4E8050' : '#F7931A'};"
                  >
                    {#if btcCopied}<CheckCircle2 size={11} /> Copied{:else}<Copy size={11} /> Copy{/if}
                  </button>
                </div>
                <a
                  href={`lightning:${btcInvoice.lightningInvoice}`}
                  onclick={attemptOpenWallet}
                  class="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[11px] font-bold"
                  style="background: linear-gradient(135deg, #F7931A, #FFB74D); color: #fff; box-shadow: 0 4px 14px rgba(247,147,26,0.35);"
                >
                  <Wallet size={12} strokeWidth={2.5} />
                  Pay in Wallet
                </a>
                {#if btcNoWalletHint}
                  <p class="text-[10px] text-center" style="color: #C4A870;">
                    No Lightning wallet app found on this device — copy the invoice above or scan the QR instead
                  </p>
                {/if}
              {/if}
              <div class="w-full flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(247,147,26,0.1);">
                <div class="w-2 h-2 rounded-full animate-pulse shrink-0" style="background: #F7931A;"></div>
                <p class="text-[11px] text-[#C4DAC0]">Waiting for payment — this updates automatically</p>
              </div>
            </div>
          {:else if btcStatus === 'failed'}
            <div class="flex items-center gap-2 px-4 py-3">
              <AlertTriangle size={13} color="#F0A08A" />
              <p class="text-xs text-[#F0A08A]">{btcError}</p>
            </div>
          {/if}
        </div>
      {/if}

      <button
        type="button"
        onclick={() => (simulateFailure = !simulateFailure)}
        class="flex items-center justify-between gap-2 px-4 py-2.5 rounded-xl"
        style="background: rgba(196,92,56,0.08);"
      >
        <p class="text-[10px] text-[#AECAAE] text-left">Demo: simulate a failed payment</p>
        <div
          class="w-9 h-5 rounded-full relative transition-all shrink-0"
          style="background: {simulateFailure ? '#C45C38' : 'rgba(255,255,255,0.18)'};"
        >
          <div
            class="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
            style="left: {simulateFailure ? 'calc(100% - 18px)' : '2px'};"
          ></div>
        </div>
      </button>
    </div>
    {#if paymentMethod === 'mpesa'}
      <div class="px-5 pt-4 pb-5">
        <button
          onclick={handlePay}
          class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          style="background: {ready
            ? 'linear-gradient(135deg, #C45C38, #CC8830)'
            : 'rgba(255,255,255,0.1)'}; color: {ready ? '#fff' : '#AECAAE'}; cursor: {ready ? 'pointer' : 'default'};"
        >
          {#if submitting}
            <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Sending prompt…
          {:else}
            Pay Now
          {/if}
        </button>
      </div>
    {:else if btcStatus === 'idle' && !usernameLocked}
      <!-- First-time client — the auto-generate effect only fires for an
           already-locked username, so this is the explicit trigger for a
           freshly-typed one. Disabled until the availability check settles
           (usernameSettled), not just usernameValid, so this can't be
           tapped mid-check. -->
      <div class="px-5 pt-4 pb-5">
        <button
          onclick={generateBtcInvoice}
          disabled={!usernameSettled}
          class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          style="background: {usernameSettled
            ? 'linear-gradient(135deg, #F7931A, #FFB74D)'
            : 'rgba(255,255,255,0.1)'}; color: {usernameSettled ? '#fff' : '#AECAAE'}; box-shadow: {usernameSettled
            ? '0 6px 20px rgba(247,147,26,0.35)'
            : 'none'};"
        >
          <Bitcoin size={15} strokeWidth={2.25} />
          Generate Invoice
        </button>
      </div>
    {:else if btcStatus === 'failed'}
      <div class="px-5 pt-4 pb-5">
        <button
          onclick={generateBtcInvoice}
          disabled={!btcReady}
          class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
          style="background: {btcReady
            ? 'linear-gradient(135deg, #F7931A, #FFB74D)'
            : 'rgba(255,255,255,0.1)'}; color: {btcReady ? '#fff' : '#AECAAE'}; box-shadow: {btcReady
            ? '0 6px 20px rgba(247,147,26,0.35)'
            : 'none'};"
        >
          <Bitcoin size={15} strokeWidth={2.25} />
          Try Again
        </button>
      </div>
    {/if}
  </div>

  <div
    class="rounded-2xl px-4 py-3 flex items-center gap-3 mb-3"
    style="background: rgba(46,90,62,0.12); border: 1px solid rgba(46,90,62,0.2);"
  >
    {#if paymentMethod === 'btc'}
      <Bitcoin size={16} color="#3C6A4A" />
      <p class="text-xs text-[#3C6A4A]">
        Pay the <span class="font-semibold text-[#1D3C2A]">Lightning invoice</span> from any compatible wallet to confirm
      </p>
    {:else}
      <Phone size={16} color="#3C6A4A" />
      <p class="text-xs text-[#3C6A4A]">You will receive an <span class="font-semibold text-[#1D3C2A]">M-PESA prompt</span> to confirm payment</p>
    {/if}
  </div>

  <button
    class="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
    style="background: #1D3C2A; color: #E8D4B0;"
  >
    <MessageCircle size={17} />Contact Ungana Support
  </button>
  <p class="text-[10px] text-[#7A8868] text-center mt-3">swap.ungana.app</p>
</ScreenBg>
