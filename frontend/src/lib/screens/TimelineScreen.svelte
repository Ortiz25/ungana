<script>
  import { ArrowLeft, Zap, CheckCircle2, Play, Gift, FileText, ChevronRight } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import TLContentCard from '$lib/components/TLContentCard.svelte';
  import {
    TL_FEATURED,
    TL_NEW,
    TL_SURVEY,
    TL_ARTICLES,
    TL_VIDEOS,
    TL_TYPE_ICON,
    TL_TYPE_LABEL,
    TL_TYPE_COLOR
  } from '$lib/data.js';

  let { onBuyAccess, onConnect, onBack } = $props();

  let viewingItem = $state(null);
  let viewProgress = $state(0);
  let viewDone = $state(false);
  let completedIds = $state(new Set());
  let earnedBanner = $state(null);
  let totalEarnedSecs = $state(0);
  let progressTimer = null;

  function startContent(item) {
    if (completedIds.has(item.id)) return;
    if (progressTimer) clearInterval(progressTimer);
    viewingItem = item;
    viewProgress = 0;
    viewDone = false;
    let p = 0;
    progressTimer = setInterval(() => {
      p += 2.5;
      viewProgress = Math.min(p, 100);
      if (p >= 100) {
        clearInterval(progressTimer);
        progressTimer = null;
        viewDone = true;
      }
    }, 150);
  }

  function claimReward() {
    if (!viewingItem) return;
    const { id, earnLabel, earnSecs } = viewingItem;
    completedIds = new Set([...completedIds, id]);
    totalEarnedSecs = totalEarnedSecs + earnSecs;
    earnedBanner = earnLabel;
    viewingItem = null;
    viewProgress = 0;
    viewDone = false;
    setTimeout(() => (earnedBanner = null), 3500);
  }

  function dismissViewer() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    viewingItem = null;
    viewProgress = 0;
    viewDone = false;
  }

  $effect(() => {
    return () => {
      if (progressTimer) clearInterval(progressTimer);
    };
  });

  const earnedHours = $derived(Math.floor(totalEarnedSecs / 3600));
  const earnedMins = $derived(Math.floor((totalEarnedSecs % 3600) / 60));
  const earnedFormatted = $derived(
    earnedHours > 0 ? `${earnedHours}h${earnedMins > 0 ? ` ${earnedMins}m` : ''}` : `${earnedMins}m`
  );
  const canConnect = $derived(totalEarnedSecs >= 1800);

  // Content viewer derived
  const ViewerIcon = $derived(viewingItem ? TL_TYPE_ICON[viewingItem.type] : null);
  const viewerTypeColor = $derived(viewingItem ? TL_TYPE_COLOR[viewingItem.type] : '#C45C38');

  const surveyQuestions = ['How do you use the internet?', 'What content matters most?', 'Rate your experience'];
</script>

{#if viewingItem}
  <!-- ── Content Viewer ── -->
  <div class="flex flex-col" style="height: 100dvh; background: #0E1F14;">
    <div class="flex items-center gap-3 px-4 pt-6 pb-4">
      <button onclick={dismissViewer} class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style="background: rgba(255,255,255,0.12);">
        <ArrowLeft size={18} color="#E8D4B0" />
      </button>
      <span class="text-sm font-semibold" style="color: #C4DAC0;">{TL_TYPE_LABEL[viewingItem.type]}</span>
    </div>

    <div class="mx-4 rounded-3xl overflow-hidden relative shrink-0" style="height: 210px;">
      {#if viewingItem.img}<img src={viewingItem.img} alt={viewingItem.title} class="w-full h-full object-cover" />{/if}
      <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(14,31,20,0.9) 0%, rgba(14,31,20,0.15) 65%, transparent 100%);"></div>
      {#if !viewDone}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background: rgba(196,92,56,0.88); box-shadow: 0 0 40px rgba(196,92,56,0.5);">
            <ViewerIcon size={26} color="#fff" />
          </div>
        </div>
      {:else}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background: #2E5A3E; box-shadow: 0 0 40px rgba(46,90,62,0.8);">
            <CheckCircle2 size={30} color="#E8D4B0" />
          </div>
        </div>
      {/if}
      <div class="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style="background: #C45C38;">
        <Zap size={11} color="#fff" />
        <span class="text-[11px] font-bold text-white">{viewingItem.earnLabel} free</span>
      </div>
    </div>

    <div class="px-4 mt-5 flex-1 overflow-y-auto">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style="background: {viewerTypeColor};">{viewingItem.category}</span>
        <span class="text-[11px]" style="color: #96B496;">{viewingItem.duration}</span>
      </div>
      <h2 class="text-xl font-bold mb-4" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">{viewingItem.title}</h2>

      <div class="flex items-center justify-between mb-2">
        <span class="text-xs" style="color: #96B496;">{viewDone ? 'Complete!' : 'Progress'}</span>
        <span class="text-xs font-bold" style="color: #C45C38;">{Math.round(viewProgress)}%</span>
      </div>
      <div class="h-2 rounded-full overflow-hidden mb-5" style="background: rgba(255,255,255,0.1);">
        <div class="h-full rounded-full transition-all duration-300" style="width: {viewProgress}%; background: {viewDone ? '#2E7D52' : '#C45C38'};"></div>
      </div>

      {#if !viewDone}
        <p class="text-sm text-center" style="color: #C4DAC0;">
          Complete this {TL_TYPE_LABEL[viewingItem.type].toLowerCase()} to earn{' '}
          <span class="font-bold" style="color: #C45C38;">{viewingItem.earnLabel} free internet</span>
        </p>
      {:else}
        <div>
          <div class="rounded-3xl p-5 text-center mb-4" style="background: rgba(46,90,62,0.28); border: 1px solid rgba(46,90,62,0.55);">
            <div class="text-3xl mb-2">🎉</div>
            <p class="text-base font-bold mb-1" style="color: #E8D4B0;">You earned it!</p>
            <p class="text-sm" style="color: #C4DAC0;">
              <span class="font-bold" style="color: #C45C38;">{viewingItem.earnLabel} free internet</span> added to your balance
            </p>
          </div>
          <button
            onclick={claimReward}
            class="w-full py-4 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
            style="background: linear-gradient(135deg, #C45C38, #CC8830);"
          >
            <Gift size={16} />
            Claim {viewingItem.earnLabel} — Add to Balance
          </button>
        </div>
      {/if}
    </div>
  </div>
{:else}
  <!-- ── Main Feed ── -->
  <div class="flex flex-col overflow-hidden" style="height: 100dvh; background: #0E1F14; position: relative;">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3 flex items-center justify-between shrink-0" style="background: #1D3C2A;">
      <div class="flex items-center gap-2">
        <UnganaLogoMark height={26} />
        <span class="text-base font-bold" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">Ungana</span>
      </div>
      <div class="flex items-center gap-2">
        {#if totalEarnedSecs > 0}
          <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style="background: rgba(196,92,56,0.22); border: 1px solid rgba(196,92,56,0.5);">
            <Zap size={11} color="#C45C38" />
            <span class="text-[11px] font-bold" style="color: #C45C38;">{earnedFormatted} earned</span>
          </div>
        {/if}
        <button onclick={onBack} class="w-8 h-8 rounded-full flex items-center justify-center active:scale-90" style="background: rgba(255,255,255,0.1);">
          <ArrowLeft size={16} color="#C4DAC0" />
        </button>
      </div>
    </div>

    <!-- Earned banner -->
    <div
      style="position: absolute; top: 64px; left: 50%; transform: translateX(-50%) translateY({earnedBanner
        ? '0'
        : '-56px'}); transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1); z-index: 50; pointer-events: none;"
    >
      <div class="flex items-center gap-2 px-4 py-2 rounded-full shadow-xl" style="background: #2E5A3E; border: 1px solid rgba(232,212,176,0.2); white-space: nowrap;">
        <Zap size={13} color="#C45C38" />
        <span class="text-xs font-bold" style="color: #E8D4B0;">+{earnedBanner} earned!</span>
      </div>
    </div>

    <!-- Scrollable feed -->
    <div class="flex-1 overflow-y-auto">
      <!-- Hero section -->
      <div class="px-4 pt-4 pb-6" style="background: #1D3C2A;">
        <h1 class="text-2xl font-bold mb-1" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">Welcome to Ungana!</h1>
        <p class="text-sm mb-4" style="color: #96B496;">Watch, learn & earn your internet access</p>

        <button
          onclick={() => startContent(TL_FEATURED)}
          class="w-full rounded-3xl overflow-hidden relative active:scale-[0.98] transition-transform"
          style="height: 200px; display: block;"
        >
          <img src={TL_FEATURED.img} alt={TL_FEATURED.title} class="w-full h-full object-cover" />
          <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.12) 65%, transparent 100%);"></div>
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: rgba(196,92,56,0.85); box-shadow: 0 0 30px rgba(196,92,56,0.5);">
              <Play size={22} color="#fff" fill="#fff" />
            </div>
          </div>
          <div class="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style="background: #C45C38;">
            <Zap size={11} color="#fff" />
            <span class="text-[11px] font-bold text-white">{TL_FEATURED.earnLabel} free</span>
          </div>
          {#if completedIds.has(TL_FEATURED.id)}
            <div class="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full" style="background: #2E5A3E;">
              <CheckCircle2 size={10} color="#fff" />
              <span class="text-[9px] font-bold text-white">Done</span>
            </div>
          {/if}
          <div class="absolute bottom-0 left-0 right-0 p-4">
            <p class="text-[10px] font-bold mb-1 uppercase tracking-wider" style="color: #C45C38;">{TL_FEATURED.category} · {TL_FEATURED.duration}</p>
            <p class="text-base font-bold text-white">{TL_FEATURED.title}</p>
          </div>
        </button>
      </div>

      <!-- Sandy sections -->
      <div style="background: #E8D4B0;">
        <!-- What's new -->
        <div class="pt-5 pb-2">
          <div class="flex items-center justify-between px-4 mb-3">
            <h3 class="text-sm font-bold" style="color: #1D3C2A;">What's new around?</h3>
            <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
          </div>
          <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
            {#each TL_NEW as item (item.id)}
              <TLContentCard {item} {completedIds} onStart={startContent} width={132} height={170} />
            {/each}
          </div>
        </div>

        <!-- Survey feature card -->
        <div class="px-4 py-3">
          <button onclick={() => startContent(TL_SURVEY)} class="w-full rounded-3xl p-5 text-left active:scale-[0.98] transition-transform" style="background: #2E5A3E;">
            <div class="flex items-start gap-4">
              <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
                <FileText size={22} color="#C45C38" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #C45C38;">Survey · {TL_SURVEY.duration}</p>
                <p class="text-base font-bold leading-snug mb-3" style="color: #E8D4B0;">{TL_SURVEY.title}</p>

                <!-- Survey preview -->
                <div class="rounded-2xl p-3 mb-3" style="background: rgba(255,255,255,0.1);">
                  {#each surveyQuestions as q, i (i)}
                    <div class="flex items-center gap-2 py-1.5 last:border-b-0 border-b" style="border-color: rgba(255,255,255,0.08);">
                      <div
                        class="w-3.5 h-3.5 rounded-full border-2 shrink-0"
                        style="border-color: {i === 0 ? '#C45C38' : 'rgba(255,255,255,0.3)'}; background: {i === 0 ? 'rgba(196,92,56,0.35)' : 'transparent'};"
                      ></div>
                      <p class="text-[10px]" style="color: #C4DAC0;">{q}</p>
                    </div>
                  {/each}
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full" style="background: rgba(196,92,56,0.22); border: 1px solid rgba(196,92,56,0.5);">
                    <Zap size={11} color="#C45C38" />
                    <span class="text-[11px] font-bold" style="color: #C45C38;">{TL_SURVEY.earnLabel} free internet</span>
                  </div>
                  {#if completedIds.has(TL_SURVEY.id)}
                    <div class="flex items-center gap-1"><CheckCircle2 size={14} color="#7EC88E" /><span class="text-xs font-semibold" style="color: #7EC88E;">Earned</span></div>
                  {:else}
                    <div class="flex items-center gap-1" style="color: #C4DAC0;"><span class="text-xs font-semibold">Start</span><ChevronRight size={14} /></div>
                  {/if}
                </div>
              </div>
            </div>
          </button>
        </div>

        <!-- News & Stories -->
        <div class="pt-2 pb-2">
          <div class="flex items-center justify-between px-4 mb-3">
            <h3 class="text-sm font-bold" style="color: #1D3C2A;">News & Stories</h3>
            <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
          </div>
          <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
            {#each TL_ARTICLES as item (item.id)}
              <TLContentCard {item} {completedIds} onStart={startContent} width={158} height={128} />
            {/each}
          </div>
        </div>

        <!-- Watch & Earn -->
        <div class="pt-2 pb-6">
          <div class="flex items-center justify-between px-4 mb-3">
            <h3 class="text-sm font-bold" style="color: #1D3C2A;">Watch & Earn</h3>
            <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
          </div>
          <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
            {#each TL_VIDEOS as item (item.id)}
              <TLContentCard {item} {completedIds} onStart={startContent} width={178} height={128} />
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="px-4 py-3 flex items-center gap-3 shrink-0" style="background: #1D3C2A; border-top: 1px solid rgba(232,212,176,0.1);">
      {#if totalEarnedSecs > 0}
        <div class="flex-1 min-w-0">
          <p class="text-[10px]" style="color: #96B496;">Balance earned</p>
          <p class="text-sm font-bold" style="color: #E8D4B0;">{earnedFormatted} free internet</p>
        </div>
        {#if canConnect}
          <button
            onclick={() => onConnect(totalEarnedSecs)}
            class="px-4 py-2.5 rounded-2xl font-bold text-sm text-white flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
            style="background: linear-gradient(135deg, #C45C38, #CC8830);"
          >
            <Zap size={14} />
            Connect Now
          </button>
        {:else}
          <p class="text-[11px] text-right shrink-0" style="color: #96B496;">Keep earning<br />to connect</p>
        {/if}
      {:else}
        <div class="flex-1 min-w-0">
          <p class="text-xs font-semibold" style="color: #C4DAC0;">Complete content to earn access</p>
          <button onclick={onBuyAccess} class="text-[10px] font-semibold mt-0.5 active:opacity-70" style="color: #C45C38;">or buy access instantly →</button>
        </div>
        <button
          onclick={onBuyAccess}
          class="px-4 py-2.5 rounded-2xl font-bold text-sm text-white flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
          style="background: rgba(196,92,56,0.25); border: 1.5px solid rgba(196,92,56,0.5); color: #E8D4B0;"
        >
          Buy Access
        </button>
      {/if}
    </div>
  </div>
{/if}
