<script>
  import { onMount } from 'svelte';
  import { UserCheck, ChevronDown, Search, CheckCircle2, Lock } from '@lucide/svelte';
  import { ACTIVATORS } from '$lib/data.js';
  import { getActivators } from '$lib/api.js';

  // `locked` — this MAC already has a permanent activator assignment from
  // an earlier purchase (or is permanently self-onboarded); display-only,
  // can't be reopened/changed. See PackageScreen's checkout auto-fill.
  let { value = null, onChange, error = false, locked = false } = $props();

  let open = $state(false);
  let query = $state('');
  let ref = $state(null);

  // 'Self' is a frontend-only pseudo-activator (not stored in the DB) —
  // always keep it first when the live list replaces the static fallback.
  let activators = $state(ACTIVATORS);

  onMount(async () => {
    const result = await getActivators();
    if (!result.ok || !result.data?.activators) return;

    const fetched = result.data.activators.map((a) => ({ id: a.code, name: a.name, area: a.territory ?? '' }));
    const self = ACTIVATORS.find((a) => a.id === 'SELF');
    activators = self ? [self, ...fetched] : fetched;
  });

  const filtered = $derived(
    activators.filter(
      (a) =>
        a.name.toLowerCase().includes(query.toLowerCase()) ||
        a.area.toLowerCase().includes(query.toLowerCase()) ||
        a.id.toLowerCase().includes(query.toLowerCase())
    )
  );

  $effect(() => {
    function handleClick(e) {
      if (ref && !ref.contains(e.target)) open = false;
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  });

  function initials(name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('');
  }
</script>

<div bind:this={ref} class="relative">
  <!-- Trigger -->
  <button
    type="button"
    disabled={locked}
    onclick={() => {
      if (locked) return;
      open = !open;
      query = '';
    }}
    class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left transition-all"
    style="background: {open ? '#2E5A3E' : 'rgba(46,90,62,0.08)'}; opacity: {locked
      ? 0.8
      : 1}; border: {error ? '1.5px solid #B85038' : open ? '1.5px solid #C45C38' : '1.5px solid transparent'};"
  >
    <div
      class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
      style="background: {value ? 'rgba(196,92,56,0.35)' : 'rgba(46,90,62,0.12)'};"
    >
      <UserCheck size={16} color={value ? '#C45C38' : '#3C6A4A'} />
    </div>
    <div class="flex-1 min-w-0">
      {#if value}
        <p class="text-sm font-semibold truncate" style="color: {open ? '#E8D4B0' : '#1D3C2A'};">{value.name}</p>
        <p class="text-[11px] truncate" style="color: {open ? '#C4DAC0' : '#3C6A4A'};">{value.area} · {value.id}</p>
      {:else}
        <p class="text-sm" style="color: #9AB498;">Select your activator</p>
      {/if}
    </div>
    {#if locked}
      <Lock size={14} color="#3C6A4A" />
    {:else}
      <ChevronDown
        size={16}
        color={open ? '#C45C38' : '#3C6A4A'}
        style="transform: {open ? 'rotate(180deg)' : 'rotate(0deg)'}; transition: transform 0.2s;"
      />
    {/if}
  </button>

  <!-- Locked hint -->
  {#if locked}
    <p class="text-[11px] mt-1.5 px-1" style="color: #9AB498;">
      {value ? 'Locked to your activator from a previous purchase' : 'Locked — you started self-onboarded'}
    </p>
  {/if}

  <!-- Error hint -->
  {#if error && !open && !locked}
    <p class="text-[11px] text-[#B85038] mt-1.5 px-1">Please select an activator to continue</p>
  {/if}

  <!-- Panel -->
  {#if open && !locked}
    <div
      class="absolute left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
      style="background: #2E5A3E; box-shadow: 0 16px 48px rgba(0,0,0,0.25); border: 1px solid rgba(196,92,56,0.35);"
    >
      <!-- Search -->
      <div class="px-3 pt-3 pb-2">
        <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: #3C6A4A;">
          <Search size={13} color="#AECAAE" />
          <!-- svelte-ignore a11y_autofocus -->
          <input
            autofocus
            bind:value={query}
            placeholder="Search activator…"
            class="flex-1 bg-transparent text-xs text-[#E8D4B0] placeholder-[#7A9E7A] outline-none"
          />
        </div>
      </div>

      <!-- List -->
      <div style="max-height: 220px; overflow-y: auto;">
        {#if filtered.length === 0}
          <p class="text-xs text-[#AECAAE] text-center py-6">No activators found</p>
        {:else}
          {#each filtered as a, i (a.id)}
            {@const isSelected = value?.id === a.id}
            <button
              type="button"
              onclick={() => {
                onChange(a);
                open = false;
                query = '';
              }}
              class="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
              style="background: {isSelected ? 'rgba(196,92,56,0.28)' : 'transparent'}; border-top: {i > 0
                ? '1px solid rgba(255,255,255,0.14)'
                : 'none'};"
            >
              <div
                class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs"
                style="background: {isSelected ? 'rgba(196,92,56,0.35)' : 'rgba(255,255,255,0.14)'}; color: {isSelected
                  ? '#C45C38'
                  : '#C4DAC0'};"
              >
                {#if a.id === 'SELF'}
                  <UserCheck size={15} color={isSelected ? '#C45C38' : '#C4DAC0'} />
                {:else}
                  {initials(a.name)}
                {/if}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-semibold text-[#E8D4B0] truncate">{a.name}</p>
                <p class="text-[11px] text-[#C4DAC0]">{a.area}</p>
              </div>
              <div class="flex flex-col items-end shrink-0 gap-1">
                <span
                  class="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style="background: rgba(255,255,255,0.14); color: #AECAAE;">{a.id}</span
                >
                {#if isSelected}
                  <CheckCircle2 size={13} color="#C45C38" />
                {/if}
              </div>
            </button>
          {/each}
        {/if}
      </div>
      <div class="px-4 py-2.5 border-t border-white/10">
        <p class="text-[10px] text-[#AECAAE] text-center">{activators.length} activators · tap to select</p>
      </div>
    </div>
  {/if}
</div>
