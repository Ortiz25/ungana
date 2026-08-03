<script>
  import { onMount } from 'svelte';
  import { ChevronRight, Clock, CheckCircle2, Zap, UserCheck, ShieldCheck } from '@lucide/svelte';
  import ScreenBg from '$lib/components/ScreenBg.svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import ActivatorDropdown from '$lib/components/ActivatorDropdown.svelte';
  import { PACKAGES } from '$lib/data.js';
  import { getPackages } from '$lib/api.js';

  let { onSelect, onActivatorLogin, onCoordinatorLogin, onEarnAccess } = $props();

  // Static PACKAGES supplies icon/badge/demoSecs (frontend-only demo/UI
  // concerns); price + label are refreshed from the backend when reachable
  // so pricing can change without a frontend redeploy. Falls back to the
  // static catalogue wholesale if the backend/DB is unreachable.
  let packages = $state(PACKAGES);

  onMount(async () => {
    const result = await getPackages();
    if (!result.ok || !result.data?.packages) return;

    const merged = result.data.packages
      .map((row) => {
        const local = PACKAGES.find((p) => p.id === row.id);
        if (!local) return null; // unknown id — no icon/UI metadata to render it with
        return { ...local, label: row.label, price: Number(row.price_kes) };
      })
      .filter(Boolean);

    if (merged.length > 0) packages = merged;
  });

  let selected = $state('weekly');
  let activator = $state(null);
  let activatorError = $state(false);
  const chosen = $derived(packages.find((p) => p.id === selected) ?? packages[0]);
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
      <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style="background: #C45C38;">Required</span>
    </div>
    <p class="text-xs mb-3" style="color: #2E5A3E;">Who introduced you to Ungana?</p>
    <ActivatorDropdown
      value={activator}
      onChange={(a) => {
        activator = a;
        activatorError = false;
      }}
      error={activatorError}
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

  <div class="mb-4">
    <h2 class="text-lg font-bold text-[#1D3C2A]" style="font-family: 'Playfair Display', serif;">Choose your plan</h2>
    <p class="text-xs mt-0.5" style="color: #2E5A3E;">Select how long you want access</p>
  </div>

  <div class="flex flex-col gap-3 mb-5">
    {#each packages as pkg (pkg.id)}
      {@const Icon = pkg.icon}
      {@const isSelected = selected === pkg.id}
      <button
        onclick={() => (selected = pkg.id)}
        class="w-full text-left rounded-3xl transition-all duration-200 active:scale-[0.98]"
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
          <div class="mx-5 mb-4 px-4 py-2 rounded-xl flex items-center justify-between" style="background: rgba(196,92,56,0.28);">
            <span class="text-xs text-[#C45C38] font-semibold">Selected</span>
            <div class="flex items-center gap-1">
              {#each [1, 0.6, 0.3] as o, i (i)}
                <div class="w-1.5 h-1.5 rounded-full bg-[#C45C38]" style="opacity: {o};"></div>
              {/each}
            </div>
          </div>
        {/if}
      </button>
    {/each}
  </div>

  {#if chosen.id === 'weekly' || chosen.id === 'monthly'}
    <div
      class="rounded-2xl px-4 py-3 flex items-center gap-3 mb-4"
      style="background: rgba(46,90,62,0.1); border: 1px solid rgba(46,90,62,0.15);"
    >
      <Clock size={15} color="#C45C38" />
      <p class="text-xs text-[#3C6A4A]">
        That's only <span class="font-bold text-[#1D3C2A]">{(chosen.price / (chosen.id === 'weekly' ? 7 : 30)).toFixed(0)} KES/day</span>
        {' '}— saving you {chosen.id === 'weekly' ? '30%' : '50%'}
      </p>
    </div>
  {/if}

  <button
    onclick={() => {
      if (!activator) {
        activatorError = true;
        return;
      }
      onSelect(chosen, activator);
    }}
    class="w-full py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
    style="background: {activator ? 'linear-gradient(135deg, #C45C38, #CC8830)' : 'transparent'}; border: {activator
      ? 'none'
      : '2px dashed rgba(29,60,42,0.4)'}; color: {activator ? '#fff' : 'rgba(29,60,42,0.55)'}; letter-spacing: 0.04em;"
  >
    Continue with {chosen.label} — {chosen.price} KES
    <ChevronRight size={16} />
  </button>

  <!-- Earn Access divider + entry -->
  <div class="flex items-center gap-3 mt-3 mb-1">
    <div class="flex-1 h-px" style="background: rgba(29,60,42,0.15);"></div>
    <span class="text-[11px] font-medium" style="color: #9AB498;">or</span>
    <div class="flex-1 h-px" style="background: rgba(29,60,42,0.15);"></div>
  </div>
  <button
    onclick={onEarnAccess}
    class="w-full py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 mb-2 transition-all active:scale-95"
    style="background: rgba(196,92,56,0.1); border: 1.5px solid rgba(196,92,56,0.45); color: #B84A28;"
  >
    <Zap size={15} />
    Earn Free Access — Watch & Learn
  </button>

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
    </div>
  </div>
</ScreenBg>
