<script>
  import { onMount } from 'svelte';
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
  import { getContent, getContentCompletions, completeContentItem, claimEarnedSession } from '$lib/api.js';
  import { getClientMac } from '$lib/device.js';

  let { onBuyAccess, onConnect, onBack } = $props();

  // Real content (from the backend) and the static demo catalogue are shown
  // together, always — real items first, demo items filling out the rest of
  // each section for visual completeness even when the admin hasn't
  // populated every zone yet. Each item carries its own `isLive` flag so
  // completion behaviour stays per-item rather than an all-or-nothing mode:
  // a real item's completion is submitted to the backend for real crediting
  // (and can end up in a real, router-authorised session); a demo item's
  // completion stays purely local, exactly like the old fully-offline
  // behaviour, and can never inflate a real session's granted duration —
  // see handleConnect().
  let mac = $state('');
  let liveItems = $state([]);

  function formatEarnLabel(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }

  // A real content item's image/category/duration are all optional in the
  // admin form — an admin who hasn't gotten to those yet shouldn't produce
  // a blank-looking card. Borrow the existing demo assets per type as a
  // placeholder rather than leaving them empty, purely for aesthetics; the
  // title/reward/type itself is always the real admin-entered value.
  const TYPE_FALLBACK = {
    video: { img: TL_VIDEOS[0]?.img, category: 'Video', duration: '5 min' },
    article: { img: TL_ARTICLES[0]?.img, category: 'Article', duration: '3 min' },
    lesson: { img: TL_ARTICLES[1]?.img ?? TL_ARTICLES[0]?.img, category: 'Lesson', duration: '4 min' },
    survey: { img: '', category: 'Survey', duration: '2 min' }
  };

  function normalizeLiveItem(row) {
    const fallback = TYPE_FALLBACK[row.type] ?? {};
    return {
      id: row.id,
      type: row.type,
      section: row.section,
      title: row.title,
      category: row.category || fallback.category || '',
      duration: row.duration_label || fallback.duration || '',
      earnLabel: formatEarnLabel(row.earn_secs),
      earnSecs: row.earn_secs,
      minWatchSecs: row.min_watch_secs ?? 0,
      surveyQuestions: row.survey_questions ?? [],
      img: row.img_url || fallback.img || '',
      bodyUrl: row.body_url || '',
      isLive: true
    };
  }

  const normalized = $derived(liveItems.map(normalizeLiveItem));
  const DEMO_FEATURED = { ...TL_FEATURED, isLive: false };
  const DEMO_NEW = TL_NEW.map((i) => ({ ...i, isLive: false }));
  const DEMO_SURVEY = { ...TL_SURVEY, isLive: false };
  const DEMO_ARTICLES = TL_ARTICLES.map((i) => ({ ...i, isLive: false }));
  const DEMO_VIDEOS = TL_VIDEOS.map((i) => ({ ...i, isLive: false }));

  // Section placement is an explicit admin choice (content_items.section),
  // not inferred from type — matches the five fixed zones this screen has
  // always had: one hero, "What's new", the survey card, "News & Stories",
  // and "Watch & Earn". 'hero'/'survey' are meant to hold one active real
  // item; if the admin marks several, only the first (by sort_order) is
  // used as the hero/survey card slot.
  const featured = $derived(normalized.find((i) => i.section === 'hero') ?? DEMO_FEATURED);
  const newItems = $derived([...normalized.filter((i) => i.section === 'whats_new'), ...DEMO_NEW]);
  const survey = $derived(normalized.find((i) => i.section === 'survey') ?? DEMO_SURVEY);
  const articles = $derived([...normalized.filter((i) => i.section === 'news'), ...DEMO_ARTICLES]);
  const videos = $derived([...normalized.filter((i) => i.section === 'watch_earn'), ...DEMO_VIDEOS]);

  let viewingItem = $state(null);
  let viewProgress = $state(0);
  let viewDone = $state(false);
  let surveyAnswers = $state({});
  let claimError = $state(false);
  let completedIds = $state(new Set());
  let earnedBanner = $state(null);
  // Real unclaimed balance mirrors the backend (server-authoritative — this
  // is the only thing "Connect Now" ever actually grants); demoBonusSecs is
  // client-only, from completing demo/padding items, and only ever used via
  // the old client-only flow when there's nothing real to claim.
  let realUnclaimedSecs = $state(0);
  let demoBonusSecs = $state(0);
  const totalEarnedSecs = $derived(realUnclaimedSecs + demoBonusSecs);
  let progressTimer = null;
  let startedAt = 0;

  onMount(async () => {
    mac = getClientMac();

    const result = await getContent();
    if (result.ok && result.data?.items?.length) liveItems = result.data.items;

    const completionsResult = await getContentCompletions(mac);
    const rows = completionsResult.ok ? (completionsResult.data?.completions ?? []) : [];
    completedIds = new Set(rows.map((r) => r.content_item_id));
    realUnclaimedSecs = rows.filter((r) => !r.claimed).reduce((sum, r) => sum + (r.earn_secs ?? 0), 0);
  });

  // Real items with no configured minimum still get a short, honest fill —
  // same ~6s pace the old fixed demo timer used — rather than completing
  // instantly or not animating at all.
  const FALLBACK_WATCH_SECS = 6;
  // Real playback position of the current native <video> element (not the
  // YouTube-iframe case — no cross-origin access to its play time without
  // the YT IFrame Player API, out of scope here). Drives the progress bar
  // directly via ontimeupdate, so it only advances while the video is
  // actually playing rather than while the screen is merely open.
  let videoCurrentTime = $state(0);

  function hasNativePlayer(item) {
    return item?.type === 'video' && !!item.bodyUrl && !isYouTubeUrl(item.bodyUrl);
  }

  function startContent(item) {
    if (completedIds.has(item.id)) return;
    if (progressTimer) clearInterval(progressTimer);
    viewingItem = item;
    viewProgress = 0;
    viewDone = false;
    surveyAnswers = {};
    claimError = false;
    videoCurrentTime = 0;
    startedAt = Date.now();

    if (item.type === 'survey' || hasNativePlayer(item)) return; // survey: answerSurveyQuestion(); native video: handleVideoTimeUpdate()

    const requiredSecs = item.minWatchSecs > 0 ? item.minWatchSecs : FALLBACK_WATCH_SECS;
    progressTimer = setInterval(() => {
      const elapsed = (Date.now() - startedAt) / 1000;
      viewProgress = Math.min(100, (elapsed / requiredSecs) * 100);
      if (viewProgress >= 100) {
        clearInterval(progressTimer);
        progressTimer = null;
        viewDone = true;
      }
    }, 150);
  }

  // Bound to the native <video>'s ontimeupdate — only fires while actually
  // playing, so the bar is genuinely in sync with playback, not wall-clock
  // time since the viewer opened (pausing/scrubbing back correctly stalls
  // or reduces progress instead of ignoring it).
  function handleVideoTimeUpdate(e) {
    if (!viewingItem || viewDone) return;
    videoCurrentTime = e.currentTarget.currentTime;
    const requiredSecs = viewingItem.minWatchSecs > 0 ? viewingItem.minWatchSecs : FALLBACK_WATCH_SECS;
    viewProgress = Math.min(100, (videoCurrentTime / requiredSecs) * 100);
    if (viewProgress >= 100) viewDone = true;
  }

  function answerSurveyQuestion(index, value) {
    surveyAnswers = { ...surveyAnswers, [index]: value };
    const questions = viewingItem?.surveyQuestions ?? [];
    if (questions.length > 0 && Object.keys(surveyAnswers).length >= questions.length) viewDone = true;
  }

  async function claimReward() {
    if (!viewingItem) return;
    const item = viewingItem;

    if (item.isLive) {
      // Real playback position for a native video player (honest — can't
      // exceed what was actually watched); wall-clock elapsed otherwise
      // (survey, YouTube embed, or no player at all).
      const elapsedSecs = hasNativePlayer(item) ? Math.round(videoCurrentTime) : Math.round((Date.now() - startedAt) / 1000);
      const body = { mac, elapsedSecs };
      if (item.type === 'survey') body.response = surveyAnswers;

      const result = await completeContentItem(item.id, body);
      if (!result.ok || !result.data?.ok) {
        claimError = true;
        return;
      }
      if (!result.data.alreadyCompleted) realUnclaimedSecs = realUnclaimedSecs + result.data.earnSecs;
    } else {
      demoBonusSecs = demoBonusSecs + item.earnSecs;
    }

    completedIds = new Set([...completedIds, item.id]);
    earnedBanner = item.earnLabel;
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
    claimError = false;
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

  let connecting = $state(false);
  let connectError = $state(null);

  async function handleConnect() {
    // Nothing real to claim — either the backend's unreachable, or every
    // completion so far was a demo/padding item. Same old client-only flow,
    // using only the demo balance (never the real one, since there isn't one).
    if (realUnclaimedSecs <= 0) {
      onConnect(totalEarnedSecs);
      return;
    }

    connecting = true;
    connectError = null;
    const result = await claimEarnedSession(mac);
    connecting = false;

    // Both a confirmed authorisation and a "router still catching up"
    // response mean the session was created for real — the background
    // retry sweep guarantees the latter eventually succeeds, same as a
    // paid session, so it's safe to proceed to the (purely cosmetic)
    // connecting animation either way. The granted duration always comes
    // from the server's own computation (realUnclaimedSecs mirrors it, but
    // isn't trusted here) — any demoBonusSecs on top is never folded in,
    // so a demo completion can never inflate a real, router-authorised grant.
    if (result.data?.success || result.data?.retrying) {
      onConnect(result.data.durationSecs ?? realUnclaimedSecs);
      return;
    }

    connectError = result.data?.message ?? 'Could not connect — please try again.';
  }

  // Content viewer derived
  const ViewerIcon = $derived(viewingItem ? TL_TYPE_ICON[viewingItem.type] : null);
  const viewerTypeColor = $derived(viewingItem ? TL_TYPE_COLOR[viewingItem.type] : '#C45C38');

  // Real video playback — only real items carry a bodyUrl (the demo
  // catalogue only ever had thumbnail images), so demo videos keep the old
  // static thumbnail + play-icon look with nothing to actually play.
  function isYouTubeUrl(url) {
    return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url || '');
  }
  function toYouTubeEmbedUrl(url) {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{6,})/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }
  const playableVideoUrl = $derived(
    viewingItem?.type === 'video' && viewingItem?.bodyUrl ? viewingItem.bodyUrl : null
  );
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

    <div class="mx-4 rounded-3xl overflow-hidden relative shrink-0" style="height: 210px; background: #000;">
      {#if playableVideoUrl}
        {#if isYouTubeUrl(playableVideoUrl)}
          <iframe
            src={toYouTubeEmbedUrl(playableVideoUrl)}
            title={viewingItem.title}
            class="w-full h-full"
            style="border: 0;"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          ></iframe>
        {:else}
          <!-- svelte-ignore a11y_media_has_caption -->
          <video
            src={playableVideoUrl}
            controls
            ontimeupdate={handleVideoTimeUpdate}
            class="w-full h-full object-contain"
            poster={viewingItem.img || undefined}
          >
            <track kind="captions" />
          </video>
        {/if}
      {:else}
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

      {#if viewingItem.type === 'survey'}
        <div class="flex flex-col gap-4 mb-5">
          {#each viewingItem.surveyQuestions ?? [] as q, i (i)}
            <div>
              <p class="text-xs font-semibold mb-2" style="color: #C4DAC0;">{q}</p>
              <div class="flex gap-2">
                {#each ['Disagree', 'Neutral', 'Agree'] as opt (opt)}
                  <button
                    type="button"
                    onclick={() => answerSurveyQuestion(i, opt)}
                    class="flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                    style="background: {surveyAnswers[i] === opt ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {surveyAnswers[i] === opt ? '#fff' : '#C4DAC0'};"
                  >
                    {opt}
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs" style="color: #96B496;">{viewDone ? 'Complete!' : 'Progress'}</span>
          <span class="text-xs font-bold" style="color: #C45C38;">{Math.round(viewProgress)}%</span>
        </div>
        <div class="h-2 rounded-full overflow-hidden mb-5" style="background: rgba(255,255,255,0.1);">
          <div class="h-full rounded-full transition-all duration-300" style="width: {viewProgress}%; background: {viewDone ? '#2E7D52' : '#C45C38'};"></div>
        </div>
      {/if}

      {#if !viewDone}
        {#if viewingItem.type !== 'survey'}
          <p class="text-sm text-center" style="color: #C4DAC0;">
            Complete this {TL_TYPE_LABEL[viewingItem.type].toLowerCase()} to earn{' '}
            <span class="font-bold" style="color: #C45C38;">{viewingItem.earnLabel} free internet</span>
          </p>
        {/if}
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
          {#if claimError}
            <p class="text-xs text-center mt-2" style="color: #E08A6A;">That didn't go through — please try again.</p>
          {/if}
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
      {#if featured}
        <div class="px-4 pt-4 pb-6" style="background: #1D3C2A;">
          <h1 class="text-2xl font-bold mb-1" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">Welcome to Ungana!</h1>
          <p class="text-sm mb-4" style="color: #96B496;">Watch, learn & earn your internet access</p>

          <button
            onclick={() => startContent(featured)}
            class="w-full rounded-3xl overflow-hidden relative active:scale-[0.98] transition-transform"
            style="height: 200px; display: block;"
          >
            {#if featured.img}
              <img src={featured.img} alt={featured.title} class="w-full h-full object-cover" />
            {:else}
              <div class="w-full h-full" style="background: linear-gradient(135deg, #1D3C2A, #2E5A3E);"></div>
            {/if}
            <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.12) 65%, transparent 100%);"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <div class="w-14 h-14 rounded-full flex items-center justify-center" style="background: rgba(196,92,56,0.85); box-shadow: 0 0 30px rgba(196,92,56,0.5);">
                <Play size={22} color="#fff" fill="#fff" />
              </div>
            </div>
            <div class="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style="background: #C45C38;">
              <Zap size={11} color="#fff" />
              <span class="text-[11px] font-bold text-white">{featured.earnLabel} free</span>
            </div>
            {#if completedIds.has(featured.id)}
              <div class="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full" style="background: #2E5A3E;">
                <CheckCircle2 size={10} color="#fff" />
                <span class="text-[9px] font-bold text-white">Done</span>
              </div>
            {/if}
            <div class="absolute bottom-0 left-0 right-0 p-4">
              <p class="text-[10px] font-bold mb-1 uppercase tracking-wider" style="color: #C45C38;">{featured.category} · {featured.duration}</p>
              <p class="text-base font-bold text-white">{featured.title}</p>
            </div>
          </button>
        </div>
      {/if}

      <!-- Sandy sections -->
      <div style="background: #E8D4B0;">
        <!-- What's new -->
        {#if newItems.length > 0}
          <div class="pt-5 pb-2">
            <div class="flex items-center justify-between px-4 mb-3">
              <h3 class="text-sm font-bold" style="color: #1D3C2A;">What's new around?</h3>
              <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
            </div>
            <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
              {#each newItems as item (item.id)}
                <TLContentCard {item} {completedIds} onStart={startContent} width={132} height={170} />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Survey feature card -->
        {#if survey}
          <div class="px-4 py-3">
            <button onclick={() => startContent(survey)} class="w-full rounded-3xl p-5 text-left active:scale-[0.98] transition-transform" style="background: #2E5A3E;">
              <div class="flex items-start gap-4">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
                  <FileText size={22} color="#C45C38" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-[10px] font-bold uppercase tracking-wider mb-1" style="color: #C45C38;">Survey · {survey.duration}</p>
                  <p class="text-base font-bold leading-snug mb-3" style="color: #E8D4B0;">{survey.title}</p>

                  <!-- Survey preview -->
                  <div class="rounded-2xl p-3 mb-3" style="background: rgba(255,255,255,0.1);">
                    {#each survey.surveyQuestions ?? [] as q, i (i)}
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
                      <span class="text-[11px] font-bold" style="color: #C45C38;">{survey.earnLabel} free internet</span>
                    </div>
                    {#if completedIds.has(survey.id)}
                      <div class="flex items-center gap-1"><CheckCircle2 size={14} color="#7EC88E" /><span class="text-xs font-semibold" style="color: #7EC88E;">Earned</span></div>
                    {:else}
                      <div class="flex items-center gap-1" style="color: #C4DAC0;"><span class="text-xs font-semibold">Start</span><ChevronRight size={14} /></div>
                    {/if}
                  </div>
                </div>
              </div>
            </button>
          </div>
        {/if}

        <!-- News & Stories -->
        {#if articles.length > 0}
          <div class="pt-2 pb-2">
            <div class="flex items-center justify-between px-4 mb-3">
              <h3 class="text-sm font-bold" style="color: #1D3C2A;">News & Stories</h3>
              <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
            </div>
            <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
              {#each articles as item (item.id)}
                <TLContentCard {item} {completedIds} onStart={startContent} width={158} height={128} />
              {/each}
            </div>
          </div>
        {/if}

        <!-- Watch & Earn -->
        {#if videos.length > 0}
          <div class="pt-2 pb-6">
            <div class="flex items-center justify-between px-4 mb-3">
              <h3 class="text-sm font-bold" style="color: #1D3C2A;">Watch & Earn</h3>
              <span class="text-[11px] font-bold" style="color: #C45C38;">See all</span>
            </div>
            <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
              {#each videos as item (item.id)}
                <TLContentCard {item} {completedIds} onStart={startContent} width={178} height={128} />
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Bottom bar -->
    <div class="px-4 py-3 flex flex-col gap-2 shrink-0" style="background: #1D3C2A; border-top: 1px solid rgba(232,212,176,0.1);">
      {#if connectError}
        <p class="text-[11px] text-center" style="color: #E08A6A;">{connectError}</p>
      {/if}
      <div class="flex items-center gap-3">
        {#if totalEarnedSecs > 0}
          <div class="flex-1 min-w-0">
            <p class="text-[10px]" style="color: #96B496;">Balance earned</p>
            <p class="text-sm font-bold" style="color: #E8D4B0;">{earnedFormatted} free internet</p>
          </div>
          {#if canConnect}
            <button
              onclick={handleConnect}
              disabled={connecting}
              class="px-4 py-2.5 rounded-2xl font-bold text-sm text-white flex items-center gap-1.5 active:scale-95 transition-all shrink-0"
              style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {connecting ? 0.7 : 1};"
            >
              <Zap size={14} />
              {connecting ? 'Connecting…' : 'Connect Now'}
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
  </div>
{/if}
