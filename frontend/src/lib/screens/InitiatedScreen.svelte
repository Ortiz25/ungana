<script>
  import { CheckCircle2, Copy } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import { verifyPayment } from '$lib/api.js';

  let { pkg, phone, activator, willFail = false, reference = null, mode = 'simulation', onContinue, onFailed } = $props();

  let copied = $state(false);
  let checking = $state(false);
  const localTxId = 'UNG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  // Prefer the backend's real reference when we have one, for display/copy.
  const displayTxId = reference || localTxId;

  const failureReason = { title: 'Payment declined', detail: 'The M-PESA prompt was cancelled or declined on your phone.' };
  const connectionIssue = {
    title: 'Connection problem',
    detail: "We couldn't confirm your payment. If you completed the M-PESA prompt, use \"Check Status Now\" — otherwise, please try again."
  };
  const timedOut = {
    title: 'Taking longer than expected',
    detail: 'We could not confirm your payment in time. If you completed the M-PESA prompt, tap "Check Status Now" — otherwise please try again.'
  };

  // Local fallback path — ONLY safe in simulation mode (no real money, a
  // fake/local "provider" backs it) or genuinely offline dev (no backend
  // reachable at all, so there's nothing real to confirm either way). In
  // `active` mode this must never fire on its own: silently granting access
  // whenever something is merely uncertain (a slow response, one dropped
  // poll, the deadline passing with no confirmation) used to mean a flaky
  // connection — or someone whose payment plainly never went through — got
  // free internet exactly as if they'd paid. Real failures/uncertainty in
  // active mode now surface as a genuine error state instead.
  function localFallbackProceed() {
    if (willFail) onFailed(failureReason);
    else onContinue();
  }

  const POLL_INTERVAL_MS = 1500;
  // Real STK push confirmation routinely takes 10-45+ seconds in practice
  // (the customer has to notice the prompt, unlock their phone, enter their
  // M-PESA PIN) — 15s was cutting real payments off mid-flight and dropping
  // them into the local demo fallback. At least a minute before giving up.
  const POLL_DEADLINE_MS = 60000;

  let pollTimer;
  let pollCancelled = false;
  let pollDeadline = Date.now() + POLL_DEADLINE_MS;

  async function poll() {
    if (pollCancelled || !reference) return;
    checking = true;
    const result = await verifyPayment(reference);
    checking = false;
    if (pollCancelled) return;

    if (!result.ok && result.error) {
      // Network/timeout on this one poll attempt — never treat that as
      // confirmation of anything. In active mode, just retry until the
      // deadline (a single dropped request mid-poll is normal, not a
      // reason to either grant or deny access); only fall back to the
      // demo shortcut in simulation mode.
      if (mode !== 'active') {
        localFallbackProceed();
        return;
      }
      if (Date.now() <= pollDeadline) {
        pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      onFailed(connectionIssue);
      return;
    }

    const status = result.data?.status;
    if (result.data?.success && status === 'success') {
      onContinue();
      return;
    }
    if (status === 'failed') {
      onFailed(failureReason);
      return;
    }
    if (Date.now() > pollDeadline) {
      if (mode !== 'active') {
        localFallbackProceed();
      } else {
        onFailed(timedOut);
      }
      return;
    }
    pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
  }

  // "Continue to Session" in simulation / offline-fallback: skip the wait
  // using the same simulated intent the backend was asked to honour.
  function proceed() {
    localFallbackProceed();
  }

  // "Check Status Now" in active mode with a real reference: re-queries the
  // actual payment status immediately instead of waiting for the next
  // scheduled poll tick. Never fabricates an outcome — a real payment must
  // actually be confirmed by the provider before granting access.
  function checkNow() {
    clearTimeout(pollTimer);
    poll();
  }

  const showCheckNow = $derived(mode === 'active' && !!reference);

  $effect(() => {
    if (!reference) {
      // By the time this screen mounts, initiate-payment has already fully
      // resolved (PaymentScreen awaits it before navigating here) — no
      // reference means it's already known to have failed, not "still in
      // flight". In active mode that's a real, immediate failure: no
      // reference means no way to ever confirm a real payment, so there is
      // nothing to wait 4 seconds for before saying so.
      if (mode !== 'active') {
        const t = setTimeout(localFallbackProceed, 4000);
        return () => clearTimeout(t);
      }
      onFailed({
        title: 'Could not start payment',
        detail: "We couldn't reach the payment provider to send your M-PESA prompt. Please check your connection and try again."
      });
      return;
    }

    pollCancelled = false;
    pollDeadline = Date.now() + POLL_DEADLINE_MS;
    poll();
    return () => {
      pollCancelled = true;
      clearTimeout(pollTimer);
    };
  });

  const rows = $derived([
    { label: 'Plan', value: `${pkg.label} · ${pkg.duration}` },
    { label: 'Phone', value: `+254 ${phone}` },
    { label: 'Amount', value: `${pkg.price.toLocaleString()} KES` },
    { label: 'Payment', value: 'M-PESA' },
    ...(activator ? [{ label: 'Activator', value: `${activator.name} (${activator.id})` }] : []),
    { label: 'Status', value: 'Awaiting confirmation ⏳' }
  ]);

  function copy() {
    navigator.clipboard.writeText(displayTxId).catch(() => {});
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<ScreenBg class="items-center">
  <div class="flex flex-col items-center mt-8 mb-6">
    <div
      class="w-24 h-24 rounded-full flex items-center justify-center mb-4"
      style="background: linear-gradient(135deg, #1D3C2A, #2E5A3E); box-shadow: 0 12px 40px rgba(29,60,42,0.3);"
    >
      <CheckCircle2 size={48} color="#C45C38" strokeWidth={2} />
    </div>
    <h2 class="text-2xl font-bold text-[#1D3C2A] text-center" style="font-family: 'Playfair Display', serif;">Payment Initiated!</h2>
    <p class="text-sm text-[#3C6A4A] mt-1 text-center">Check your phone for the M-PESA prompt</p>
  </div>

  <!-- Receipt -->
  <div class="w-full rounded-3xl overflow-hidden shadow-xl mb-4" style="background: #2E5A3E;">
    <div class="px-5 pt-5 pb-3">
      <p class="text-xs text-[#C4DAC0] uppercase tracking-widest mb-3 font-semibold">Payment Details</p>
      {#each rows as row (row.label)}
        <div class="flex justify-between items-center py-2.5 border-b border-white/10 last:border-0">
          <span class="text-xs text-[#C4DAC0]">{row.label}</span>
          <span class="text-sm font-semibold text-[#E8D4B0] text-right max-w-[55%]">{row.value}</span>
        </div>
      {/each}
    </div>
    <div class="mx-4 mb-4 px-4 py-3 rounded-2xl flex items-center justify-between" style="background: #1D3C2A;">
      <div>
        <p class="text-[10px] text-[#AECAAE] uppercase tracking-wider">Reference</p>
        <p class="text-xs font-mono text-[#E8D4B0] mt-0.5">{displayTxId}</p>
      </div>
      <button onclick={copy} class="p-1.5 rounded-lg" style="color: {copied ? '#C45C38' : '#C4DAC0'};">
        {#if copied}<CheckCircle2 size={16} />{:else}<Copy size={16} />{/if}
      </button>
    </div>
  </div>

  <!-- Auto-advance notice -->
  <div
    class="w-full rounded-2xl px-4 py-3 flex items-center gap-3 mb-4"
    style="background: rgba(46,90,62,0.12); border: 1px solid rgba(46,90,62,0.2);"
  >
    <div class="w-2 h-2 rounded-full bg-[#C45C38] animate-pulse shrink-0"></div>
    <p class="text-xs text-[#3C6A4A]">Connecting you automatically once payment is confirmed…</p>
  </div>

  <button
    onclick={showCheckNow ? checkNow : proceed}
    disabled={showCheckNow && checking}
    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95 flex items-center justify-center gap-2"
    style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff; opacity: {showCheckNow && checking ? 0.7 : 1};"
  >
    {#if showCheckNow}
      {#if checking}
        <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Checking…
      {:else}
        Check Status Now
      {/if}
    {:else}
      Continue to Session
    {/if}
  </button>
  <p class="text-[10px] text-[#7A8868] text-center mt-4">swap.ungana.app</p>
</ScreenBg>
