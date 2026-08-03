<script>
  import { ArrowLeft, Phone, MessageCircle } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import { initiatePayment } from '$lib/api.js';
  import { getClientMac } from '$lib/device.js';

  let { pkg, activator, onPay, onBack } = $props();

  let phone = $state('');
  let simulateFailure = $state(false);
  let submitting = $state(false);
  const ready = $derived(phone.length >= 9 && !submitting);
  const PkgIcon = $derived(pkg.icon);

  async function handlePay() {
    if (!ready) return;
    submitting = true;

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
      simulateFailure
    });

    submitting = false;
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
    <div class="px-5 pt-5 pb-0">
      <p class="text-sm font-semibold text-[#C4DAC0] mb-1">Pay via M-PESA</p>
      <p class="text-[11px] text-[#AECAAE] pb-4">Enter the number to charge</p>
    </div>
    <div class="h-px mx-5 bg-white/10 mb-4"></div>
    <div class="px-5 flex flex-col gap-3 pb-2">
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

      <div class="flex justify-between items-center px-4 py-2.5 rounded-xl" style="background: rgba(255,255,255,0.14);">
        <span class="text-xs text-[#C4DAC0]">You get</span>
        <span class="text-sm font-semibold text-[#E8D4B0]">{pkg.duration} free internet</span>
      </div>
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
    <div class="px-5 pt-4 pb-5">
      <button
        onclick={handlePay}
        class="w-full py-4 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 flex items-center justify-center gap-2"
        style="background: {ready ? 'linear-gradient(135deg, #C45C38, #CC8830)' : 'rgba(255,255,255,0.1)'}; color: {ready
          ? '#fff'
          : '#AECAAE'}; cursor: {ready ? 'pointer' : 'default'};"
      >
        {#if submitting}
          <div class="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>Sending prompt…
        {:else}
          Pay Now
        {/if}
      </button>
    </div>
  </div>

  <div
    class="rounded-2xl px-4 py-3 flex items-center gap-3 mb-3"
    style="background: rgba(46,90,62,0.12); border: 1px solid rgba(46,90,62,0.2);"
  >
    <Phone size={16} color="#3C6A4A" />
    <p class="text-xs text-[#3C6A4A]">You will receive an <span class="font-semibold text-[#1D3C2A]">M-PESA prompt</span> to confirm payment</p>
  </div>

  <button
    class="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95"
    style="background: #1D3C2A; color: #E8D4B0;"
  >
    <MessageCircle size={17} />Contact Ungana Support
  </button>
  <p class="text-[10px] text-[#7A8868] text-center mt-3">swap.ungana.app</p>
</ScreenBg>
