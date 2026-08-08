<script>
  import { onMount } from 'svelte';
  import { ArrowLeft, Zap, CheckCircle2, CircleX, Play, Gift, FileText, Unlock, User, ExternalLink, Wallet, X, Clock } from '@lucide/svelte';
  import UnganaLogoMark from '$lib/components/UnganaLogoMark.svelte';
  import TLContentCard from '$lib/components/TLContentCard.svelte';
  import {
    TL_FEATURED,
    TL_NEW,
    TL_SURVEYS,
    TL_ARTICLES,
    TL_VIDEOS,
    TL_TYPE_ICON,
    TL_TYPE_LABEL,
    TL_TYPE_COLOR,
    doneLabelForFrequency
  } from '$lib/data.js';
  import {
    getContent,
    getContentCompletions,
    completeContentItem,
    claimEarnedSession,
    getSettings,
    recordContentImpression,
    getUsernameForMac,
    checkUsernameAvailable
  } from '$lib/api.js';
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

  // survey_questions is JSONB with no fixed shape — older rows (or a
  // pre-migration remote DB) may still hold plain question strings. Upgrade
  // those on read so the carousel never has to special-case both shapes.
  function normalizeSurveyQuestions(raw) {
    return (raw ?? []).map((q) =>
      typeof q === 'string' ? { question: q, answers: ['Disagree', 'Neutral', 'Agree'] } : q
    );
  }

  function normalizeLiveItem(row) {
    const fallback = TYPE_FALLBACK[row.type] ?? {};
    return {
      id: row.id,
      type: row.type,
      section: row.section,
      viewFrequency: row.view_frequency || 'once',
      title: row.title,
      category: row.category || fallback.category || '',
      duration: row.duration_label || fallback.duration || '',
      earnLabel: formatEarnLabel(row.earn_secs),
      earnSecs: row.earn_secs,
      minWatchSecs: row.min_watch_secs ?? 0,
      surveyQuestions: normalizeSurveyQuestions(row.survey_questions),
      img: row.img_url || fallback.img || '',
      bodyUrl: row.body_url || '',
      isLive: true
    };
  }

  const normalized = $derived(liveItems.map(normalizeLiveItem));
  const DEMO_FEATURED = { ...TL_FEATURED, isLive: false };
  const DEMO_NEW = TL_NEW.map((i) => ({ ...i, isLive: false }));
  const DEMO_SURVEYS = TL_SURVEYS.map((i) => ({ ...i, isLive: false }));
  const DEMO_ARTICLES = TL_ARTICLES.map((i) => ({ ...i, isLive: false }));
  const DEMO_VIDEOS = TL_VIDEOS.map((i) => ({ ...i, isLive: false }));

  // Section placement is an explicit admin choice (content_items.section),
  // not inferred from type — matches the five fixed zones this screen has
  // always had: one hero, "What's new", surveys, "News & Stories", and
  // "Watch & Earn". Only 'hero' is meant to hold a single active real item;
  // if the admin marks several, only the first (by sort_order) is used as
  // the hero slot. 'survey' (like the other list sections) can hold many —
  // every active real survey shows as its own card, demo surveys appended.
  const featured = $derived(normalized.find((i) => i.section === 'hero') ?? DEMO_FEATURED);
  const newItems = $derived([...normalized.filter((i) => i.section === 'whats_new'), ...DEMO_NEW]);
  const surveys = $derived([...normalized.filter((i) => i.section === 'survey'), ...DEMO_SURVEYS]);
  const articles = $derived([...normalized.filter((i) => i.section === 'news'), ...DEMO_ARTICLES]);
  const videos = $derived([...normalized.filter((i) => i.section === 'watch_earn'), ...DEMO_VIDEOS]);

  let viewingItem = $state(null);
  let viewProgress = $state(0);
  let viewDone = $state(false);
  let surveyAnswers = $state({});
  let surveyIndex = $state(0); // which question the carousel is currently showing
  let claimError = $state(false);
  let completedIds = $state(new Set());
  let earnedBanner = $state(null);
  // Shown instead of earnedBanner when a claim comes back alreadyCompleted
  // (nothing new was actually credited) — holds the period-aware label
  // ('Viewed today' etc.) rather than lying with a "+X earned!" toast.
  let lockedNotice = $state(null);
  // Real unclaimed balance mirrors the backend (server-authoritative — this
  // is the only thing "Connect Now" ever actually grants); demoBonusSecs is
  // client-only, from completing demo/padding items, and only ever used via
  // the old client-only flow when there's nothing real to claim.
  let realUnclaimedSecs = $state(0);
  let demoBonusSecs = $state(0);
  const totalEarnedSecs = $derived(realUnclaimedSecs + demoBonusSecs);
  let progressTimer = null;
  let startedAt = 0;

  // Admin-configurable (default 30 min — see backend/src/services/settings.js);
  // fetched once on mount, falls back to the default if unreachable.
  let connectThresholdSecs = $state(1800);
  let justUnlocked = $state(false);
  let showEarnedModal = $state(false);
  // Minutes selected in the earned-balance modal's "use now" slider —
  // reset to the full unclaimed balance each time the modal opens, so the
  // default is still the old zero-friction "claim everything" behaviour.
  let claimAmountMinutes = $state(0);
  // Guards the "you just unlocked Connect Now" celebration so it only fires
  // for a completion during this session, not for restoring an
  // already-sufficient balance from the server on page load/reload.
  let initialLoadDone = $state(false);

  // Same privacy-conscious username-based session recovery as the paid
  // checkout flow (PaymentScreen) — optional, only prompted for a device
  // that doesn't already have one locked in. Never the phone number.
  let username = $state('');
  let usernameError = $state('');
  let usernameLocked = $state(false); // already set for this MAC — no need to prompt again
  let usernameStatus = $state(null); // null | 'checking' | 'available' | 'taken'
  let showUsernamePrompt = $state(false);
  let usernameCheckTimer;

  onMount(async () => {
    mac = getClientMac();

    const result = await getContent();
    if (result.ok && result.data?.items?.length) liveItems = result.data.items;

    const completionsResult = await getContentCompletions(mac);
    const rows = completionsResult.ok ? (completionsResult.data?.completions ?? []) : [];
    completedIds = new Set(rows.map((r) => r.content_item_id));
    realUnclaimedSecs = rows.filter((r) => !r.claimed).reduce((sum, r) => sum + (r.earn_secs ?? 0), 0);

    const settingsResult = await getSettings();
    if (settingsResult.ok && Number.isFinite(settingsResult.data?.earnConnectThresholdSecs)) {
      connectThresholdSecs = settingsResult.data.earnConnectThresholdSecs;
    }

    const usernameResult = await getUsernameForMac(mac);
    if (usernameResult.ok && usernameResult.data?.username) {
      username = usernameResult.data.username;
      usernameLocked = true;
    }

    initialLoadDone = true;
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
      const result = await checkUsernameAvailable(checkedValue, mac);
      if (checkedValue !== username) return; // stale — field changed again while this was in flight
      usernameStatus = result.ok ? (result.data?.available ? 'available' : 'taken') : null;
    }, 400);
  }

  // Real items with no configured minimum still get a short, honest fill —
  // same ~6s pace the old fixed demo timer used — rather than completing
  // instantly or not animating at all.
  const FALLBACK_WATCH_SECS = 6;
  // Real playback position of the current player — native <video> via
  // ontimeupdate, or YouTube via the IFrame Player API's polled
  // getCurrentTime() (see the $effect below). Drives the progress bar
  // directly from actual playback either way, so it only advances while
  // the video is actually playing, not while the screen is merely open.
  let videoCurrentTime = $state(0);

  function hasNativePlayer(item) {
    return item?.type === 'video' && !!item.bodyUrl && !isYouTubeUrl(item.bodyUrl);
  }
  // Both native <video> and YouTube now drive videoCurrentTime from a real
  // player — startContent()/claimReward() treat them the same way: skip
  // the wall-clock fallback timer and trust the real position instead.
  function hasTrackedVideoPlayback(item) {
    return item?.type === 'video' && !!item.bodyUrl;
  }

  function startContent(item) {
    if (completedIds.has(item.id)) return;
    if (progressTimer) clearInterval(progressTimer);
    viewingItem = item;
    viewProgress = 0;
    viewDone = false;
    surveyAnswers = {};
    surveyIndex = 0;
    claimError = false;
    videoCurrentTime = 0;
    startedAt = Date.now();

    // Fire-and-forget — analytics only (admin dashboard's "impressions"),
    // never blocks opening the viewer and never touches demo/padding items
    // since they have no real backend record to increment.
    if (item.isLive) recordContentImpression(item.id);

    // survey: answerSurveyQuestion(); native video: handleVideoTimeUpdate();
    // YouTube: the $effect below drives it via the IFrame Player API;
    // article: the "I've finished reading" button sets viewDone directly —
    // no wall-clock timer, since there's no progress bar to drive.
    if (item.type === 'survey' || item.type === 'article' || hasTrackedVideoPlayback(item)) return;

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

  // Carousel — one question on screen at a time, matching the feed's
  // survey card language rather than the old "all questions stacked in a
  // list" layout. Answering auto-advances to the next unanswered question
  // after a brief pause (so the selection is visible); goToSurveyQuestion
  // lets the user step back and forth manually too.
  function answerSurveyQuestion(index, value) {
    const updated = { ...surveyAnswers, [index]: value };
    surveyAnswers = updated;

    const questions = viewingItem?.surveyQuestions ?? [];
    if (questions.length > 0 && Object.keys(updated).length >= questions.length) {
      viewDone = true;
      return;
    }

    if (index < questions.length - 1) {
      setTimeout(() => {
        if (surveyIndex === index) surveyIndex = index + 1;
      }, 300);
    }
  }

  function goToSurveyQuestion(index) {
    const questions = viewingItem?.surveyQuestions ?? [];
    surveyIndex = Math.max(0, Math.min(index, questions.length - 1));
  }

  async function claimReward() {
    if (!viewingItem) return;
    const item = viewingItem;
    let wasAlreadyCompleted = false;

    if (item.isLive) {
      // Real playback position for a tracked video player — native or
      // YouTube (honest — can't exceed what was actually watched); wall-clock
      // elapsed otherwise (survey, or no player at all).
      const elapsedSecs = hasTrackedVideoPlayback(item) ? Math.round(videoCurrentTime) : Math.round((Date.now() - startedAt) / 1000);
      const body = { mac, elapsedSecs };
      if (item.type === 'survey') body.response = surveyAnswers;

      const result = await completeContentItem(item.id, body);
      if (!result.ok || !result.data?.ok) {
        claimError = true;
        return;
      }
      wasAlreadyCompleted = !!result.data.alreadyCompleted;
      if (!wasAlreadyCompleted) realUnclaimedSecs = realUnclaimedSecs + result.data.earnSecs;
    } else {
      demoBonusSecs = demoBonusSecs + item.earnSecs;
    }

    completedIds = new Set([...completedIds, item.id]);
    viewingItem = null;
    viewProgress = 0;
    viewDone = false;

    if (wasAlreadyCompleted) {
      // The backend is the real gate against double-crediting — this only
      // fires if something let the viewer reopen an item already claimed
      // for its current period (e.g. a stale completedIds snapshot from
      // before this session refreshed). Say so honestly rather than
      // showing a "+X earned!" toast for nothing.
      lockedNotice = doneLabelForFrequency(item.viewFrequency);
      setTimeout(() => (lockedNotice = null), 3500);
      return;
    }

    earnedBanner = item.earnLabel;
    setTimeout(() => (earnedBanner = null), 3500);
  }

  function dismissViewer() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
    destroyYtPlayer();
    viewingItem = null;
    viewProgress = 0;
    viewDone = false;
    claimError = false;
  }

  $effect(() => {
    return () => {
      if (progressTimer) clearInterval(progressTimer);
      destroyYtPlayer();
    };
  });

  function formatMinutesLabel(secs) {
    const hours = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ''}` : `${mins}m`;
  }
  const earnedFormatted = $derived(formatMinutesLabel(totalEarnedSecs));
  const canConnect = $derived(totalEarnedSecs >= connectThresholdSecs);
  const connectProgressPct = $derived(
    connectThresholdSecs > 0 ? Math.min(100, Math.round((totalEarnedSecs / connectThresholdSecs) * 100)) : 100
  );

  // Fires the "unlocked" celebration the moment canConnect flips from false
  // to true — not on every render while it stays true, and not for the
  // initial data restore on mount (see initialLoadDone) — only for a
  // completion, during this session, that visibly crosses the line.
  let wasAbleToConnect = false;
  $effect(() => {
    if (!initialLoadDone) {
      wasAbleToConnect = canConnect;
      return;
    }
    if (canConnect && !wasAbleToConnect) {
      justUnlocked = true;
      setTimeout(() => (justUnlocked = false), 4000);
    }
    wasAbleToConnect = canConnect;
  });

  let connecting = $state(false);
  let connectError = $state(null);

  // Entry point from the "Connect Now" button. A device with no username
  // yet gets one chance to set one — purely optional, for session recovery
  // later — before the real claim actually fires; a returning device that
  // already has one (or the local-only demo fallback, which has no real
  // session to attach a username to) skips straight to performConnect().
  // null = claim the entire unclaimed balance (the original one-tap
  // behaviour, still what the bottom bar's Connect Now button does);
  // otherwise the amount chosen in the earned-balance modal's slider — see
  // showEarnedModal below. Survives the username-prompt detour since that
  // overlay's own buttons call performConnect() directly with no args.
  let pendingClaimSecs = $state(null);

  function handleConnect(requestedSecs = null) {
    pendingClaimSecs = requestedSecs;
    if (realUnclaimedSecs > 0 && !usernameLocked) {
      usernameError = '';
      showUsernamePrompt = true;
      return;
    }
    performConnect();
  }

  async function performConnect() {
    // Nothing real to claim — either the backend's unreachable, or every
    // completion so far was a demo/padding item. Same old client-only flow,
    // using only the demo balance (never the real one, since there isn't one).
    if (realUnclaimedSecs <= 0) {
      onConnect(totalEarnedSecs);
      return;
    }

    connecting = true;
    connectError = null;
    const requestedMinutes = pendingClaimSecs != null ? pendingClaimSecs / 60 : undefined;
    const result = await claimEarnedSession(mac, username.trim() || undefined, requestedMinutes);
    connecting = false;

    if (!result.ok && result.status === 409) {
      // Username taken — a real rejection, not an "unreachable" case. Stay
      // on the prompt so they can fix it and retry, same as PaymentScreen.
      usernameError = result.data?.message || 'That username is taken — try another.';
      showUsernamePrompt = true;
      return;
    }

    // Both a confirmed authorisation and a "router still catching up"
    // response mean the session was created for real — the background
    // retry sweep guarantees the latter eventually succeeds, same as a
    // paid session, so it's safe to proceed to the (purely cosmetic)
    // connecting animation either way. The granted duration always comes
    // from the server's own computation (realUnclaimedSecs mirrors it, but
    // isn't trusted here) — any demoBonusSecs on top is never folded in,
    // so a demo completion can never inflate a real, router-authorised grant.
    if (result.data?.success || result.data?.retrying) {
      showUsernamePrompt = false;
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
  function getYouTubeVideoId(url) {
    const match = (url || '').match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{6,})/);
    return match ? match[1] : null;
  }
  const playableVideoUrl = $derived(
    viewingItem?.type === 'video' && viewingItem?.bodyUrl ? viewingItem.bodyUrl : null
  );

  // YouTube IFrame Player API — loaded once, reused for every YouTube item
  // opened this session. Without this, a YouTube embed had no real
  // playback signal at all: the viewer fell back to the same wall-clock
  // timer used for items with no player, so the progress bar started
  // ticking the instant the viewer opened (before anyone pressed play) and
  // never actually tracked the video. Polling getCurrentTime() while
  // PLAYING mirrors the native <video> case's ontimeupdate handler.
  let ytApiPromise = null;
  function loadYouTubeIframeApi() {
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve) => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        resolve(window.YT);
      };
      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    });
    return ytApiPromise;
  }

  let ytContainerEl = $state(null);
  let ytPlayer = null;
  let ytPollTimer = null;

  function destroyYtPlayer() {
    if (ytPollTimer) {
      clearInterval(ytPollTimer);
      ytPollTimer = null;
    }
    if (ytPlayer) {
      try {
        ytPlayer.destroy();
      } catch {
        // already gone (e.g. iframe removed from the DOM) — nothing to clean up
      }
      ytPlayer = null;
    }
  }

  $effect(() => {
    const url = playableVideoUrl;
    const isYT = !!url && isYouTubeUrl(url);
    const videoId = isYT ? getYouTubeVideoId(url) : null;

    if (!isYT || !videoId || !ytContainerEl) {
      destroyYtPlayer();
      return;
    }

    let cancelled = false;
    loadYouTubeIframeApi().then((YT) => {
      if (cancelled) return;
      destroyYtPlayer();
      ytPlayer = new YT.Player(ytContainerEl, {
        videoId,
        // Without explicit width/height the API defaults to a fixed
        // ~640x390 iframe regardless of the container's actual size,
        // clipped and misaligned inside our 210px-tall media block — the
        // visible thumbnail/play button then don't line up with where the
        // iframe (and its clickable overlay) actually is. width/height:
        // '100%' plus the CSS below keep it filling the container exactly
        // like the native <video> element does.
        width: '100%',
        height: '100%',
        playerVars: { rel: 0 },
        events: {
          onStateChange: (e) => {
            if (ytPollTimer) {
              clearInterval(ytPollTimer);
              ytPollTimer = null;
            }
            if (e.data !== YT.PlayerState.PLAYING) return;
            ytPollTimer = setInterval(() => {
              if (!ytPlayer || viewDone) {
                clearInterval(ytPollTimer);
                ytPollTimer = null;
                return;
              }
              videoCurrentTime = ytPlayer.getCurrentTime();
              const requiredSecs = viewingItem?.minWatchSecs > 0 ? viewingItem.minWatchSecs : FALLBACK_WATCH_SECS;
              viewProgress = Math.min(100, (videoCurrentTime / requiredSecs) * 100);
              if (viewProgress >= 100) viewDone = true;
            }, 250);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      destroyYtPlayer();
    };
  });

  // Article reading body — bodyUrl doubles as either an external link or
  // pasted body copy (see schema comment on content_items.body_url). A
  // link reads as a "Read the full article ↗" CTA; raw text is parsed into
  // a lightweight "writing for the web" structure: an intro paragraph,
  // ## / ### subheadings, - / 1. lists, **bold** for key terms, and an
  // optional trailing "Source: ..." line rendered as an APA-style citation.
  const articleIsExternalLink = $derived(/^https?:\/\//i.test(viewingItem?.bodyUrl || ''));

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function renderInline(text) {
    return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  function parseArticleBody(raw) {
    if (!raw) return [];
    const blocks = [];
    let listBuffer = null; // { type: 'ul' | 'ol', items: [] }
    let paraBuffer = [];

    const flushPara = () => {
      if (paraBuffer.length) {
        blocks.push({ type: 'p', text: paraBuffer.join(' ').trim() });
        paraBuffer = [];
      }
    };
    const flushList = () => {
      if (listBuffer) {
        blocks.push(listBuffer);
        listBuffer = null;
      }
    };

    for (const rawLine of raw.split('\n')) {
      const line = rawLine.trim();
      if (!line) {
        flushPara();
        flushList();
        continue;
      }
      if (/^source:\s*/i.test(line)) {
        flushPara();
        flushList();
        blocks.push({ type: 'citation', text: line.replace(/^source:\s*/i, '') });
      } else if (/^###\s+/.test(line)) {
        flushPara();
        flushList();
        blocks.push({ type: 'h3', text: line.replace(/^###\s+/, '') });
      } else if (/^##\s+/.test(line)) {
        flushPara();
        flushList();
        blocks.push({ type: 'h2', text: line.replace(/^##\s+/, '') });
      } else if (/^[-*]\s+/.test(line)) {
        flushPara();
        if (!listBuffer || listBuffer.type !== 'ul') {
          flushList();
          listBuffer = { type: 'ul', items: [] };
        }
        listBuffer.items.push(line.replace(/^[-*]\s+/, ''));
      } else if (/^\d+\.\s+/.test(line)) {
        flushPara();
        if (!listBuffer || listBuffer.type !== 'ol') {
          flushList();
          listBuffer = { type: 'ol', items: [] };
        }
        listBuffer.items.push(line.replace(/^\d+\.\s+/, ''));
      } else {
        flushList();
        paraBuffer.push(line);
      }
    }
    flushPara();
    flushList();
    return blocks;
  }

  const articleBlocks = $derived(
    viewingItem?.type === 'article' && viewingItem?.bodyUrl && !articleIsExternalLink
      ? parseArticleBody(viewingItem.bodyUrl)
      : []
  );
</script>

{#if viewingItem}
  <!-- ── Content Viewer ── -->
  <!-- Natural document scroll, not a nested overflow-y-auto region — the
       captive-portal WebView this app runs in (see [...catchall]/+page.svelte's
       comments) doesn't reliably handle nested scroll containers; scrolling
       down could get stuck unable to scroll back up. The header stays
       pinned via `sticky` instead. -->
  <div class="flex flex-col" style="min-height: 100dvh; background: #0E1F14;">
    <div class="flex items-center gap-3 px-4 pt-6 pb-4" style="position: sticky; top: 0; z-index: 20; background: #0E1F14;">
      <button onclick={dismissViewer} class="w-9 h-9 rounded-full flex items-center justify-center active:scale-90" style="background: rgba(255,255,255,0.12);">
        <ArrowLeft size={18} color="#E8D4B0" />
      </button>
      <span class="text-sm font-semibold" style="color: #C4DAC0;">{TL_TYPE_LABEL[viewingItem.type]}</span>
    </div>

    <div class="mx-4 rounded-3xl overflow-hidden relative shrink-0" style="height: 210px; background: #000;">
      {#if playableVideoUrl}
        {#if isYouTubeUrl(playableVideoUrl)}
          <!-- Handed off to the YouTube IFrame Player API (see the $effect
               above) — it replaces this div with its own iframe once the
               API's loaded, so the progress bar can track real playback
               instead of wall-clock time since the viewer opened. -->
          <div bind:this={ytContainerEl} class="yt-player-container w-full h-full"></div>
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
      {:else if viewingItem.type === 'video'}
        <!-- No real player (demo/placeholder video) — the original "tap to
             play" treatment: a strong, opaque circular play button reads
             unambiguously as video, which is correct here. -->
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
      {:else if viewingItem.type === 'survey'}
        <!-- Survey isn't "playable" — no play-button, just the same
             icon-badge language as the feed's survey card, so it never reads
             as a video campaign. An admin-set image (if any) sits behind the
             badge instead of the flat brand gradient. -->
        {#if viewingItem.img}
          <img src={viewingItem.img} alt={viewingItem.title} class="w-full h-full object-cover" />
          <div class="absolute inset-0" style="background: linear-gradient(160deg, rgba(29,60,42,0.82), rgba(14,31,20,0.62));"></div>
        {:else}
          <div class="absolute inset-0" style="background: linear-gradient(135deg, #2E5A3E, #1D3C2A);"></div>
        {/if}
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="w-16 h-16 rounded-full flex items-center justify-center"
            style="background: {viewDone ? '#2E5A3E' : 'rgba(196,92,56,0.28)'}; box-shadow: 0 0 40px {viewDone ? 'rgba(46,90,62,0.8)' : 'rgba(196,92,56,0.3)'};"
          >
            {#if viewDone}
              <CheckCircle2 size={30} color="#E8D4B0" />
            {:else}
              <FileText size={26} color="#C45C38" />
            {/if}
          </div>
        </div>
      {:else}
        <!-- article/lesson — reading material, not video: keep the cover
             image if there is one, but never the "tap to play" circle. -->
        {#if viewingItem.img}<img src={viewingItem.img} alt={viewingItem.title} class="w-full h-full object-cover" />{/if}
        <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(14,31,20,0.9) 0%, rgba(14,31,20,0.15) 65%, transparent 100%);"></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <div
            class="w-14 h-14 rounded-full flex items-center justify-center"
            style="background: {viewDone ? '#2E5A3E' : 'rgba(196,92,56,0.28)'}; box-shadow: 0 0 30px {viewDone ? 'rgba(46,90,62,0.8)' : 'rgba(196,92,56,0.25)'};"
          >
            {#if viewDone}
              <CheckCircle2 size={26} color="#E8D4B0" />
            {:else}
              <ViewerIcon size={22} color="#C45C38" />
            {/if}
          </div>
        </div>
      {/if}
      <div class="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1.5 rounded-full" style="background: #C45C38;">
        <Zap size={11} color="#fff" />
        <span class="text-[11px] font-bold text-white">{viewingItem.earnLabel} free</span>
      </div>
    </div>

    {#snippet progressBar()}
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs" style="color: #96B496;">{viewDone ? 'Complete!' : 'Progress'}</span>
        <span class="text-xs font-bold" style="color: #C45C38;">{Math.round(viewProgress)}%</span>
      </div>
      <div class="h-2 rounded-full overflow-hidden mb-5" style="background: rgba(255,255,255,0.1);">
        <div class="h-full rounded-full transition-all duration-300" style="width: {viewProgress}%; background: {viewDone ? '#2E7D52' : '#C45C38'};"></div>
      </div>
    {/snippet}

    <div class="px-4 mt-5 pb-10">
      {#if viewingItem.type === 'article'}
        <!-- Magazine-style article reader — kicker, serif headline, accent
             rule, then typeset body copy with a drop-cap opening
             paragraph, mirroring an editorial/travel-blog layout. -->
        <div class="flex items-center gap-2 mb-3">
          <span class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: #C45C38;">{viewingItem.category || 'Article'}</span>
          <span class="w-1 h-1 rounded-full" style="background: #96B496;"></span>
          <span class="text-[11px]" style="color: #96B496;">{viewingItem.duration}</span>
        </div>
        <h2 class="text-2xl leading-snug font-bold mb-3" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">{viewingItem.title}</h2>
        <div class="w-10 rounded-full mb-5" style="height: 3px; background: #C45C38;"></div>

        {#if articleIsExternalLink}
          <a
            href={viewingItem.bodyUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 text-sm font-semibold mb-6"
            style="color: #C45C38;"
          >
            Read the full article <ExternalLink size={14} />
          </a>
        {:else if articleBlocks.length > 0}
          <div class="article-body mb-6">
            {#each articleBlocks as block, i (i)}
              {#if block.type === 'h2'}
                <h3 class="article-h2">{@html renderInline(block.text)}</h3>
              {:else if block.type === 'h3'}
                <h4 class="article-h3">{@html renderInline(block.text)}</h4>
              {:else if block.type === 'ul'}
                <ul class="article-list">
                  {#each block.items as li (li)}<li>{@html renderInline(li)}</li>{/each}
                </ul>
              {:else if block.type === 'ol'}
                <ol class="article-list">
                  {#each block.items as li (li)}<li>{@html renderInline(li)}</li>{/each}
                </ol>
              {:else if block.type === 'citation'}
                <p class="article-citation">
                  <span class="article-citation-label">Source —</span>
                  {@html renderInline(block.text)}
                </p>
              {:else}
                <p class={i === 0 ? 'article-dropcap' : ''}>{@html renderInline(block.text)}</p>
              {/if}
            {/each}
          </div>
        {/if}

        {#if !viewDone}
          <button
            type="button"
            onclick={() => (viewDone = true)}
            class="w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all mb-1"
            style="background: rgba(196,92,56,0.18); color: #C45C38; border: 1px solid rgba(196,92,56,0.4);"
          >
            <CheckCircle2 size={16} />
            I've finished reading
          </button>
        {/if}
      {:else}
        <div class="flex items-center gap-2 mb-2">
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style="background: {viewerTypeColor};">{viewingItem.category}</span>
          <span class="text-[11px]" style="color: #96B496;">{viewingItem.duration}</span>
        </div>
        <h2 class="text-xl font-bold mb-4" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">{viewingItem.title}</h2>

        {#if viewingItem.type === 'survey'}
        {@const questions = viewingItem.surveyQuestions ?? []}
        {@const currentQuestion = questions[surveyIndex]}
        <div class="mb-5">
          <!-- Carousel progress dots — filled once that question is
               answered, wide + highlighted for the one currently shown.
               Tapping a dot jumps straight to that question. -->
          <div class="flex items-center justify-center gap-1.5 mb-4">
            {#each questions as q, i (i)}
              <button
                type="button"
                onclick={() => goToSurveyQuestion(i)}
                aria-label={`Go to question ${i + 1}`}
                class="rounded-full transition-all duration-200"
                style="width: {i === surveyIndex ? '18px' : '6px'}; height: 6px; background: {surveyAnswers[i] !== undefined
                  ? '#C45C38'
                  : i === surveyIndex
                    ? 'rgba(196,92,56,0.5)'
                    : 'rgba(255,255,255,0.15)'};"
              ></button>
            {/each}
          </div>

          {#key surveyIndex}
            <div class="survey-slide rounded-2xl p-5" style="background: rgba(255,255,255,0.06);">
              <p class="text-[10px] font-bold uppercase tracking-wider mb-2" style="color: #96B496;">
                Question {surveyIndex + 1} of {questions.length}
              </p>
              <p class="text-sm font-semibold mb-4" style="color: #E8D4B0;">{currentQuestion?.question}</p>
              <div class="flex flex-wrap gap-2">
                {#each currentQuestion?.answers ?? [] as opt (opt)}
                  <button
                    type="button"
                    onclick={() => answerSurveyQuestion(surveyIndex, opt)}
                    class="py-2.5 px-3.5 rounded-xl text-[11px] font-semibold transition-all active:scale-95"
                    style="background: {surveyAnswers[surveyIndex] === opt ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {surveyAnswers[surveyIndex] === opt ? '#fff' : '#C4DAC0'};"
                  >
                    {opt}
                  </button>
                {/each}
              </div>
            </div>
          {/key}

          <div class="flex items-center justify-between mt-3">
            <button
              type="button"
              onclick={() => goToSurveyQuestion(surveyIndex - 1)}
              disabled={surveyIndex === 0}
              class="text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style="background: rgba(255,255,255,0.08); color: {surveyIndex === 0 ? '#4A6842' : '#C4DAC0'};"
            >
              ← Previous
            </button>
            <button
              type="button"
              onclick={() => goToSurveyQuestion(surveyIndex + 1)}
              disabled={surveyIndex >= questions.length - 1}
              class="text-[11px] font-semibold px-3 py-1.5 rounded-full"
              style="background: rgba(255,255,255,0.08); color: {surveyIndex >= questions.length - 1 ? '#4A6842' : '#C4DAC0'};"
            >
              Next →
            </button>
          </div>
        </div>
      {:else}
        {@render progressBar()}
      {/if}
      {/if}

      {#if !viewDone}
        {#if viewingItem.type !== 'survey' && viewingItem.type !== 'article'}
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
  <!-- Natural document scroll rather than a nested overflow-y-auto region
       — see the matching comment in the Content Viewer above for why
       (the captive-portal WebView doesn't reliably support nested
       scrolling). Header stays pinned via `sticky`, the Connect Now bar
       via `fixed`, and the transient banners via `fixed` too (they used to
       ride along with document flow via `position: absolute`, which only
       looked right because the page never used to scroll past them). -->
  <div class="flex flex-col" style="min-height: 100dvh; background: #0E1F14;">
    <!-- Header -->
    <div class="px-4 pt-5 pb-3 flex items-center justify-between shrink-0" style="background: #1D3C2A; position: sticky; top: 0; z-index: 40;">
      <div class="flex items-center gap-2">
        <UnganaLogoMark height={26} />
        <span class="text-base font-bold" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">Ungana</span>
      </div>
      <div class="flex items-center gap-2">
        {#if totalEarnedSecs > 0}
          <button
            onclick={() => {
              claimAmountMinutes = Math.floor(realUnclaimedSecs / 60);
              showEarnedModal = true;
            }}
            aria-label="View earned balance"
            class="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-full active:scale-90 transition-transform"
            style="background: rgba(196,92,56,0.22); border: 1px solid rgba(196,92,56,0.5);"
          >
            <Zap size={11} color="#C45C38" />
            <span class="text-[11px] font-bold" style="color: #C45C38;">{earnedFormatted} earned</span>
            {#if canConnect}
              <span
                class="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full"
                style="background: #7EC88E; box-shadow: 0 0 0 2px #1D3C2A; animation: cart-ready-ping 1.8s ease-in-out infinite;"
              ></span>
            {/if}
          </button>
        {/if}
        <button onclick={onBack} class="w-8 h-8 rounded-full flex items-center justify-center active:scale-90" style="background: rgba(255,255,255,0.1);">
          <ArrowLeft size={16} color="#C4DAC0" />
        </button>
      </div>
    </div>

    <!-- Earned banner — fully invisible (not just translated off-screen)
         until a completion sets earnedBanner; fades + slides in showing how
         much was just earned, then auto-dismisses on its own. -->
    <div
      style="position: fixed; top: 64px; left: 50%; transform: translateX(-50%) translateY({earnedBanner
        ? '0'
        : '-16px'}); opacity: {earnedBanner ? '1' : '0'}; transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1); z-index: 50; pointer-events: none;"
    >
      <div class="flex items-center gap-2 px-4 py-2 rounded-full shadow-xl" style="background: #2E5A3E; border: 1px solid rgba(232,212,176,0.2); white-space: nowrap;">
        <Zap size={13} color="#C45C38" />
        <span class="text-xs font-bold" style="color: #E8D4B0;">+{earnedBanner} earned!</span>
      </div>
    </div>

    <!-- Already-completed notice — see lockedNotice in claimReward(). -->
    <div
      style="position: fixed; top: 64px; left: 50%; transform: translateX(-50%) translateY({lockedNotice
        ? '0'
        : '-16px'}); opacity: {lockedNotice ? '1' : '0'}; transition: all 0.35s cubic-bezier(0.34,1.56,0.64,1); z-index: 50; pointer-events: none;"
    >
      <div class="flex items-center gap-2 px-4 py-2 rounded-full shadow-xl" style="background: #4A3820; border: 1px solid rgba(232,212,176,0.2); white-space: nowrap;">
        <Clock size={13} color="#CC8830" />
        <span class="text-xs font-bold" style="color: #E8D4B0;">{lockedNotice} — nothing new earned</span>
      </div>
    </div>

    <!-- Connect Now unlocked celebration -->
    <div
      style="position: fixed; top: 64px; left: 50%; transform: translateX(-50%) translateY({justUnlocked
        ? '0'
        : '-72px'}) scale({justUnlocked ? '1' : '0.92'}); opacity: {justUnlocked ? '1' : '0'}; transition: all 0.4s cubic-bezier(0.34,1.56,0.64,1); z-index: 51; pointer-events: none;"
    >
      <div class="flex items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full shadow-xl" style="background: linear-gradient(135deg, #C45C38, #CC8830); white-space: nowrap;">
        <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.25);">
          <Unlock size={12} color="#fff" />
        </div>
        <span class="text-xs font-bold text-white">You can connect now!</span>
      </div>
    </div>

    <!-- Feed content — normal document flow now; pb-24 keeps the last
         items clear of the fixed Connect Now bar below. -->
    <div class="pb-24">
      <!-- Hero section -->
      {#if featured}
        <div class="px-4 pt-4 pb-6" style="background: #1D3C2A;">
          <h1 class="text-2xl font-bold mb-1" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">Welcome to Ungana!</h1>
          <p class="text-sm mb-4" style="color: #96B496;">Watch, learn & earn your internet access</p>

          <button
            onclick={() => startContent(featured)}
            disabled={completedIds.has(featured.id)}
            class="w-full rounded-3xl overflow-hidden relative active:scale-[0.98] transition-transform"
            style="height: 200px; display: block; opacity: {completedIds.has(featured.id) ? 0.75 : 1};"
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
                <span class="text-[9px] font-bold text-white">{doneLabelForFrequency(featured.viewFrequency)}</span>
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

        <!-- Quick surveys — small photo-background cards, one per active
             survey (real + demo); tapping opens the full survey carousel. -->
        {#if surveys.length > 0}
          <div class="pt-3 pb-2">
            <div class="flex items-center justify-between px-4 mb-3">
              <h3 class="text-sm font-bold" style="color: #1D3C2A;">Quick surveys</h3>
            </div>
            <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
              {#each surveys as survey (survey.id)}
                <TLContentCard item={survey} {completedIds} onStart={startContent} width={132} height={170} />
              {/each}
            </div>
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

    <!-- Bottom bar — fixed to the viewport (the page scrolls under it now)
         so Connect Now stays reachable no matter how far the feed is
         scrolled. -->
    <div
      class="px-4 py-3 flex flex-col gap-2"
      style="background: #1D3C2A; border-top: 1px solid rgba(232,212,176,0.1); position: fixed; left: 0; right: 0; bottom: 0; z-index: 40;"
    >
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
            {@const remainingSecs = Math.max(connectThresholdSecs - totalEarnedSecs, 0)}
            {@const remainingLabel = remainingSecs >= 60 ? `${Math.ceil(remainingSecs / 60)}m` : `${remainingSecs}s`}
            <div class="flex items-center gap-2 shrink-0">
              <div class="relative w-9 h-9 shrink-0">
                <svg viewBox="0 0 36 36" class="w-full h-full" style="transform: rotate(-90deg);">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4" />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    fill="none"
                    stroke="#C45C38"
                    stroke-width="4"
                    stroke-linecap="round"
                    stroke-dasharray={`${(connectProgressPct / 100) * 94.2} 94.2`}
                    style="transition: stroke-dasharray 0.4s ease;"
                  />
                </svg>
                <div class="absolute inset-0 flex items-center justify-center">
                  <span class="text-[9px] font-bold" style="color: #E8D4B0;">{connectProgressPct}%</span>
                </div>
              </div>
              <p class="text-[11px] text-right leading-tight" style="color: #96B496;">{remainingLabel} more<br />to connect</p>
            </div>
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

    <!-- Earned balance modal — the header pill acts like a cart badge;
         tapping it opens this for a breakdown + the same Connect Now /
         "keep earning" affordance as the bottom bar, just front and
         center. -->
    {#if showEarnedModal}
      <div class="fixed inset-0 z-[65] flex items-center justify-center p-5">
        <button
          type="button"
          class="absolute inset-0"
          style="background: rgba(0,0,0,0.6); backdrop-filter: blur(3px); border: none; padding: 0; cursor: default;"
          aria-label="Close"
          onclick={() => (showEarnedModal = false)}
        ></button>
        <div
          class="earned-modal relative w-full rounded-3xl overflow-hidden shadow-2xl"
          style="max-width: 380px; background: linear-gradient(165deg, #1D3C2A, #12241A); border: 1px solid rgba(232,212,176,0.12);"
        >
          <div
            class="absolute -top-20 -right-16 w-52 h-52 rounded-full pointer-events-none"
            style="background: radial-gradient(circle, rgba(196,92,56,0.35), transparent 70%);"
          ></div>

          <div class="relative p-5">
            <div class="flex items-center justify-between mb-5">
              <div class="flex items-center gap-2.5">
                <div class="w-9 h-9 rounded-2xl flex items-center justify-center" style="background: rgba(196,92,56,0.25);">
                  <Wallet size={16} color="#C45C38" />
                </div>
                <p class="text-sm font-bold" style="color: #E8D4B0;">Your Earned Balance</p>
              </div>
              <button
                onclick={() => (showEarnedModal = false)}
                aria-label="Close"
                class="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
                style="background: rgba(255,255,255,0.1);"
              >
                <X size={14} color="#C4DAC0" />
              </button>
            </div>

            <div class="text-center mb-5">
              <p class="text-[40px] leading-none font-bold" style="color: #E8D4B0; font-family: 'Playfair Display', serif;">{earnedFormatted}</p>
              <p class="text-[11px] mt-2" style="color: #96B496;">of free internet earned</p>
            </div>

            <div class="rounded-2xl p-3.5 mb-4" style="background: rgba(255,255,255,0.06);">
              <div class="flex items-center justify-between py-1.5">
                <span class="text-xs" style="color: #C4DAC0;">Claimable now</span>
                <span class="text-xs font-bold" style="color: #E8D4B0;">{formatMinutesLabel(realUnclaimedSecs)}</span>
              </div>
              {#if demoBonusSecs > 0}
                <div class="flex items-center justify-between py-1.5 border-t" style="border-color: rgba(255,255,255,0.08);">
                  <span class="text-xs" style="color: #C4DAC0;">Demo bonus</span>
                  <span class="text-xs font-bold" style="color: #96B496;">{formatMinutesLabel(demoBonusSecs)}</span>
                </div>
              {/if}
            </div>

            {#if canConnect}
              {@const minMinutes = Math.max(1, Math.ceil(connectThresholdSecs / 60))}
              {@const maxMinutes = Math.max(minMinutes, Math.floor(realUnclaimedSecs / 60))}
              {#if maxMinutes > minMinutes}
                <div class="rounded-2xl p-3.5 mb-4" style="background: rgba(255,255,255,0.06);">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-xs" style="color: #C4DAC0;">Use now</span>
                    <span class="text-sm font-bold" style="color: #E8D4B0;">
                      {claimAmountMinutes >= maxMinutes ? 'All' : `${claimAmountMinutes} min`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={minMinutes}
                    max={maxMinutes}
                    step="1"
                    value={claimAmountMinutes}
                    oninput={(e) => (claimAmountMinutes = Number(e.currentTarget.value))}
                    class="w-full"
                    style="accent-color: #C45C38;"
                  />
                  <div class="flex items-center justify-between mt-1">
                    <span class="text-[10px]" style="color: #7A9E7A;">{minMinutes}m</span>
                    <span class="text-[10px]" style="color: #7A9E7A;">All ({maxMinutes}m)</span>
                  </div>
                  <p class="text-[10px] mt-2 leading-snug" style="color: #7A9E7A;">
                    {#if claimAmountMinutes >= maxMinutes}
                      Uses your full balance now.
                    {:else}
                      Keeps ~{maxMinutes - claimAmountMinutes} min banked for next time — earned items can't be
                      split, so you may get slightly more than {claimAmountMinutes} min.
                    {/if}
                  </p>
                </div>
              {/if}

              <button
                onclick={() => {
                  const chosenSecs = claimAmountMinutes < maxMinutes ? claimAmountMinutes * 60 : null;
                  showEarnedModal = false;
                  handleConnect(chosenSecs);
                }}
                disabled={connecting}
                class="w-full py-4 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 active:scale-95 transition-all"
                style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {connecting ? 0.7 : 1};"
              >
                <Zap size={18} />
                {connecting ? 'Connecting…' : 'Connect Now'}
              </button>
            {:else}
              {@const remainingSecs = Math.max(connectThresholdSecs - totalEarnedSecs, 0)}
              {@const remainingLabel = remainingSecs >= 60 ? `${Math.ceil(remainingSecs / 60)}m` : `${remainingSecs}s`}
              <div class="flex items-center gap-3 rounded-2xl p-3.5" style="background: rgba(255,255,255,0.06);">
                <div class="relative w-12 h-12 shrink-0">
                  <svg viewBox="0 0 36 36" class="w-full h-full" style="transform: rotate(-90deg);">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4" />
                    <circle
                      cx="18"
                      cy="18"
                      r="15"
                      fill="none"
                      stroke="#C45C38"
                      stroke-width="4"
                      stroke-linecap="round"
                      stroke-dasharray={`${(connectProgressPct / 100) * 94.2} 94.2`}
                      style="transition: stroke-dasharray 0.4s ease;"
                    />
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-[10px] font-bold" style="color: #E8D4B0;">{connectProgressPct}%</span>
                  </div>
                </div>
                <p class="text-xs leading-snug" style="color: #96B496;">
                  Keep earning — <span class="font-bold" style="color: #E8D4B0;">{remainingLabel} more</span> to unlock Connect Now
                </p>
              </div>
            {/if}
          </div>
        </div>
      </div>
    {/if}

    <!-- Username prompt — shown once, before the first real claim, for a
         device with no username locked in yet. Optional (Skip proceeds
         with no username); same privacy-conscious recovery mechanism as
         PaymentScreen's checkout field. -->
    {#if showUsernamePrompt}
      <div class="fixed inset-0 z-[60] flex items-end justify-center">
        <div class="absolute inset-0" style="background: rgba(0,0,0,0.55);"></div>
        <div class="relative w-full rounded-t-3xl p-5" style="background: #1D3C2A; max-width: 480px;">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-9 h-9 rounded-2xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
              <User size={16} color="#C45C38" />
            </div>
            <div>
              <p class="text-sm font-bold text-[#E8D4B0]">Set a username</p>
              <p class="text-[11px] text-[#96B496]">Optional — so you can check your session later from any browser</p>
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center rounded-2xl overflow-hidden border border-white/10" style="background: #2E5A3E;">
              <div class="px-4 py-3.5 border-r border-white/15 shrink-0">
                <User size={13} color="#C4DAC0" />
              </div>
              <input
                type="text"
                value={username}
                oninput={onUsernameInput}
                placeholder="e.g. swiftrunner42"
                class="flex-1 bg-transparent px-4 py-3.5 text-[#E8D4B0] placeholder-[#7A9E7A] text-sm outline-none"
              />
              <div class="pr-4 shrink-0">
                {#if usernameStatus === 'checking'}
                  <div class="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>
                {:else if usernameStatus === 'available'}
                  <CheckCircle2 size={14} color="#7EC88E" />
                {:else if usernameStatus === 'taken'}
                  <CircleX size={14} color="#F0A08A" />
                {/if}
              </div>
            </div>
            {#if usernameError}
              <p class="text-[11px] mt-1.5 px-1" style="color: #F0A08A;">{usernameError}</p>
            {:else if usernameStatus === 'taken'}
              <p class="text-[11px] mt-1.5 px-1" style="color: #F0A08A;">That username is taken — try another</p>
            {/if}
          </div>

          {#if connectError}
            <p class="text-[11px] text-center mt-3" style="color: #E08A6A;">{connectError}</p>
          {/if}

          <div class="flex gap-2 mt-4">
            <button
              onclick={() => {
                showUsernamePrompt = false;
                username = '';
                usernameStatus = null;
                usernameError = '';
                performConnect();
              }}
              disabled={connecting}
              class="flex-1 py-3 rounded-2xl font-semibold text-sm"
              style="background: rgba(255,255,255,0.1); color: #C4DAC0;"
            >
              Skip
            </button>
            <button
              onclick={performConnect}
              disabled={connecting || usernameStatus === 'taken'}
              class="flex-1 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-1.5"
              style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {connecting ? 0.7 : 1};"
            >
              {connecting ? 'Connecting…' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  /* Carousel transition between survey questions — {#key surveyIndex}
     remounts this element on every question change, so the animation
     replays each time. */
  .survey-slide {
    animation: survey-slide-in 0.25s ease;
  }
  @keyframes survey-slide-in {
    from {
      opacity: 0;
      transform: translateX(16px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  /* "New earnings ready to claim" badge on the header's cart-style pill. */
  @keyframes cart-ready-ping {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.3);
      opacity: 0.7;
    }
  }

  /* Earned-balance modal entrance — pops in rather than just appearing. */
  .earned-modal {
    animation: earned-modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes earned-modal-in {
    from {
      opacity: 0;
      transform: scale(0.92) translateY(8px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  /* Magazine-style article body — generous line-height for long-form
     reading, with a classic drop cap on the opening paragraph. */
  .article-body p {
    font-size: 0.9rem;
    line-height: 1.8;
    color: #C4DAC0;
    margin-bottom: 1rem;
  }
  .article-body p:last-child {
    margin-bottom: 0;
  }
  .article-body p.article-dropcap::first-letter {
    font-family: 'Playfair Display', serif;
    font-size: 3rem;
    font-weight: 700;
    float: left;
    line-height: 0.78;
    padding-right: 0.5rem;
    padding-top: 0.25rem;
    color: #C45C38;
  }
  /* Bold spans are injected via {@html} so they need :global() to be
     reachable by Svelte's scoped styles. */
  .article-body :global(strong) {
    color: #E8D4B0;
    font-weight: 700;
  }
  .article-h2 {
    font-family: 'Playfair Display', serif;
    font-size: 1.15rem;
    font-weight: 700;
    color: #E8D4B0;
    margin: 1.5rem 0 0.6rem;
  }
  .article-h2:first-child {
    margin-top: 0;
  }
  .article-h3 {
    font-size: 0.85rem;
    font-weight: 700;
    color: #C4DAC0;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 1.1rem 0 0.5rem;
  }
  .article-list {
    margin: 0 0 1rem;
    padding-left: 1.15rem;
    color: #C4DAC0;
    font-size: 0.9rem;
    line-height: 1.7;
  }
  .article-list li {
    margin-bottom: 0.35rem;
  }
  .article-list li::marker {
    color: #C45C38;
  }
  .article-citation {
    margin-top: 1.25rem;
    padding-top: 0.85rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 0.75rem;
    font-style: italic;
    line-height: 1.5;
    color: #96B496;
  }
  .article-citation-label {
    font-style: normal;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-right: 0.3rem;
  }

  /* The YouTube IFrame Player API creates its own <iframe> inside this div
     with inline width/height attributes — force it to actually fill the
     container regardless of what the API set them to, so the visible
     play button lines up with where clicks land. */
  .yt-player-container :global(iframe) {
    width: 100% !important;
    height: 100% !important;
  }
</style>
