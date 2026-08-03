<script>
  import { CheckCircle2, Copy } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import { verifyPayment } from '$lib/api.js';

  let { pkg, phone, activator, willFail = false, reference = null, onContinue, onFailed } = $props();

  let copied = $state(false);
  const localTxId = 'UNG-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  // Prefer the backend's real reference when we have one, for display/copy.
  const displayTxId = reference || localTxId;

  const failureReason = { title: 'Payment declined', detail: 'The M-PESA prompt was cancelled or declined on your phone.' };

  // Local fallback path — used when there's no backend reference at all
  // (initiate-payment failed/unreachable) or the backend never resolves in
  // time. Mirrors the same `simulateFailure` intent the backend was asked
  // to honour, so behaviour is consistent either way.
  function localFallbackProceed() {
    if (willFail) onFailed(failureReason);
    else onContinue();
  }

  const POLL_INTERVAL_MS = 1500;
  const POLL_DEADLINE_MS = 15000;

  // Manual "skip the wait" button — resolves immediately without waiting on
  // the poll loop, using the same simulated intent.
  function proceed() {
    localFallbackProceed();
  }

  $effect(() => {
    if (!reference) {
      const t = setTimeout(localFallbackProceed, 4000);
      return () => clearTimeout(t);
    }

    let cancelled = false;
    let pollTimer;
    const deadline = Date.now() + POLL_DEADLINE_MS;

    async function poll() {
      if (cancelled) return;
      const result = await verifyPayment(reference);
      if (cancelled) return;

      if (!result.ok && result.error) {
        // Network/timeout — backend unreachable mid-flow, fall back.
        localFallbackProceed();
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
      if (Date.now() > deadline) {
        localFallbackProceed();
        return;
      }
      pollTimer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
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
    onclick={proceed}
    class="w-full py-4 rounded-2xl font-bold text-base transition-all active:scale-95"
    style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
  >
    Continue to Session
  </button>
  <p class="text-[10px] text-[#7A8868] text-center mt-4">swap.ungana.app</p>
</ScreenBg>
