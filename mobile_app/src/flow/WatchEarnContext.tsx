// Watch & Earn state — the mobile counterpart to TimelineScreen.svelte's
// Watch/Earn-specific script (browsing content, the content viewer, and the
// earn-balance/claim-into-a-session flow). Deliberately a sibling to
// TimelineContext (see its own header comment) rather than folded into it —
// mounted one level up, at app/timeline/_layout.tsx, so the earned-balance
// pill (TimelineHeader) and the bottom Connect bar/modals
// (WatchEarnOverlays) are visible across BOTH the Campus/Community and
// Watch tabs, matching the source's single shared "main feed" wrapper (see
// the plan doc's "Key architectural call").
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Constants from "expo-constants";
import {
  getContent,
  getContentCompletions,
  completeContentItem,
  claimEarnedSession,
  previewClaimAmount,
  getSettings,
  recordContentImpression,
  checkUsernameAvailable,
  resolveMediaUrl,
} from "@/lib/api";
import { TL_FEATURED, TL_NEW, TL_SURVEYS, TL_ARTICLES, TL_VIDEOS, doneLabelForFrequency, type TLItem, type TLSurveyQuestion } from "@/lib/data";
import { useTimeline } from "@/flow/TimelineContext";

// Same flag/convention as PaymentScreen.tsx (mirrors frontend's
// VITE_DEMO_MODE) — gates the static TL_* demo catalogue below so a real
// deployment never shows placeholder content alongside genuine admin content.
const DEMO_MODE = Constants.expoConfig?.extra?.demoMode !== false;

const FALLBACK_WATCH_SECS = 6;

export function isYouTubeUrl(url?: string | null): boolean {
  return /(?:youtube\.com\/watch\?v=|youtu\.be\/)/.test(url || "");
}
export function getYouTubeVideoId(url?: string | null): string | null {
  const match = (url || "").match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]{6,})/);
  return match ? match[1] : null;
}

// ─── Article body parsing — ## / ### / - / 1. / **bold** / trailing
// "Source: ..." line, same lightweight "writing for the web" structure as
// the source's parseArticleBody(). RN has no {@html}, so bold spans are
// returned as separate runs (see splitBold) for the screen to render as
// nested <Text>.
export type ArticleBlock =
  | { type: "p"; text: string; dropcap?: boolean }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "citation"; text: string };

export function parseArticleBody(raw?: string | null): ArticleBlock[] {
  if (!raw) return [];
  const blocks: ArticleBlock[] = [];
  let listBuffer: { type: "ul" | "ol"; items: string[] } | null = null;
  let paraBuffer: string[] = [];

  const flushPara = () => {
    if (paraBuffer.length) {
      blocks.push({ type: "p", text: paraBuffer.join(" ").trim() });
      paraBuffer = [];
    }
  };
  const flushList = () => {
    if (listBuffer) {
      blocks.push(listBuffer);
      listBuffer = null;
    }
  };

  for (const rawLine of raw.split("\n")) {
    const line = rawLine.trim();
    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (/^source:\s*/i.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "citation", text: line.replace(/^source:\s*/i, "") });
    } else if (/^###\s+/.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "h3", text: line.replace(/^###\s+/, "") });
    } else if (/^##\s+/.test(line)) {
      flushPara();
      flushList();
      blocks.push({ type: "h2", text: line.replace(/^##\s+/, "") });
    } else if (/^[-*]\s+/.test(line)) {
      flushPara();
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(line.replace(/^[-*]\s+/, ""));
    } else if (/^\d+\.\s+/.test(line)) {
      flushPara();
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(line.replace(/^\d+\.\s+/, ""));
    } else {
      flushList();
      paraBuffer.push(line);
    }
  }
  flushPara();
  flushList();
  if (blocks.length && blocks[0].type === "p") (blocks[0] as { type: "p"; text: string; dropcap?: boolean }).dropcap = true;
  return blocks;
}

export function splitBold(text: string): { text: string; bold: boolean }[] {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > lastIndex) parts.push({ text: text.slice(lastIndex, m.index), bold: false });
    parts.push({ text: m[1], bold: true });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex), bold: false });
  if (parts.length === 0) parts.push({ text, bold: false });
  return parts;
}

type LiveRow = Record<string, any>;

// A real content item's image/category/duration are all optional in the
// admin form — borrow the demo catalogue's assets per type as a
// placeholder rather than a blank-looking card; the title/reward/type
// itself is always the real admin-entered value.
const TYPE_FALLBACK: Record<string, { img?: string; category: string; duration: string }> = {
  video: { img: TL_VIDEOS[0]?.img, category: "Video", duration: "5 min" },
  article: { img: TL_ARTICLES[0]?.img, category: "Article", duration: "3 min" },
  lesson: { img: TL_ARTICLES[1]?.img ?? TL_ARTICLES[0]?.img, category: "Lesson", duration: "4 min" },
  survey: { img: "", category: "Survey", duration: "2 min" },
};

function formatEarnLabel(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

export function formatMinutesLabel(secs: number): string {
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  return hours > 0 ? `${hours}h${mins > 0 ? ` ${mins}m` : ""}` : `${mins}m`;
}

function normalizeSurveyQuestions(raw: any): TLSurveyQuestion[] {
  return (raw ?? []).map((q: any) => (typeof q === "string" ? { question: q, answers: ["Disagree", "Neutral", "Agree"] } : q));
}

function normalizeLiveItem(row: LiveRow): TLItem {
  const fallback = TYPE_FALLBACK[row.type] ?? { category: "", duration: "" };
  return {
    id: row.id,
    type: row.type,
    section: row.section,
    viewFrequency: row.view_frequency || "once",
    title: row.title,
    category: row.category || fallback.category || "",
    duration: row.duration_label || fallback.duration || "",
    earnLabel: formatEarnLabel(row.earn_secs),
    earnSecs: row.earn_secs,
    minWatchSecs: row.min_watch_secs ?? 0,
    surveyQuestions: normalizeSurveyQuestions(row.survey_questions),
    img: resolveMediaUrl(row.img_url) || fallback.img || "",
    // Only video/lesson's body_url is ever a file URL — article's is prose
    // (or an external link, matched separately by WatchEarnScreen), so
    // resolving it here would otherwise corrupt real article text that
    // happens to start with "/" (rare, but not worth the risk).
    bodyUrl: (row.type === "video" || row.type === "lesson" ? resolveMediaUrl(row.body_url) : row.body_url) || "",
    isLive: true,
  };
}

export function hasTrackedVideoPlayback(item: TLItem | null): boolean {
  return !!item && (item.type === "video" || item.type === "lesson") && !!item.bodyUrl;
}

export type WatchEarnContextValue = {
  featured: TLItem | null;
  newItems: TLItem[];
  surveys: TLItem[];
  articles: TLItem[];
  videos: TLItem[];
  completedIds: Set<string | number>;

  expandedSection: "whats_new" | "survey" | "news" | "watch_earn" | null;
  setExpandedSection: (s: WatchEarnContextValue["expandedSection"]) => void;

  viewingItem: TLItem | null;
  viewProgress: number;
  viewDone: boolean;
  lessonVideoDone: boolean;
  showingQuiz: boolean;
  surveyAnswers: Record<number, string>;
  surveyIndex: number;
  claimError: boolean;
  isViewerOpen: boolean;
  playableVideoUrl: string | null;
  startContent: (item: TLItem) => void;
  handleVideoTimeUpdate: (currentSecs: number) => void;
  answerSurveyQuestion: (index: number, value: string) => void;
  goToSurveyQuestion: (index: number) => void;
  claimReward: () => Promise<void>;
  dismissViewer: () => void;
  // Article's "I've finished reading" — no progress bar to drive for
  // reading material, so this sets viewDone directly (source: onclick={() =>
  // (viewDone = true)}).
  markArticleDone: () => void;

  totalEarnedSecs: number;
  realUnclaimedSecs: number;
  demoBonusSecs: number;
  earnedFormatted: string;
  connectThresholdSecs: number;
  canConnect: boolean;
  connectProgressPct: number;
  earnedBanner: string | null;
  lockedNotice: string | null;
  justUnlocked: boolean;

  showEarnedModal: boolean;
  setShowEarnedModal: (b: boolean) => void;
  claimAmountMinutes: number;
  setClaimAmountMinutes: (n: number) => void;
  claimMinMinutes: number;
  claimMaxMinutes: number;
  claimPreviewSecs: number | null;
  claimPreviewLoading: boolean;

  username: string;
  usernameError: string;
  usernameLocked: boolean;
  usernameStatus: "checking" | "available" | "taken" | null;
  showUsernamePrompt: boolean;
  setShowUsernamePrompt: (b: boolean) => void;
  onUsernameInput: (text: string) => void;
  connecting: boolean;
  connectError: string | null;
  handleConnect: (requestedSecs?: number | null) => void;
  performConnect: () => Promise<void>;
};

const WatchEarnContext = createContext<WatchEarnContextValue | null>(null);

export function WatchEarnProvider({
  children,
  onConnect,
}: {
  children: ReactNode;
  // Route-owned navigation — same split as onBuyAccess/onConnect in
  // app/active.tsx / app/packages.tsx: screens/context never call
  // expo-router directly, the layout route file does (see
  // app/timeline/_layout.tsx).
  onConnect: (secs: number, isReal: boolean) => void;
}) {
  const { mac, site, username: fetchedUsername } = useTimeline();

  const [liveItems, setLiveItems] = useState<LiveRow[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string | number>>(new Set());
  const [realUnclaimedSecs, setRealUnclaimedSecs] = useState(0);
  const [demoBonusSecs, setDemoBonusSecs] = useState(0);
  const [connectThresholdSecs, setConnectThresholdSecs] = useState(1800);

  const [expandedSection, setExpandedSection] = useState<WatchEarnContextValue["expandedSection"]>(null);

  const [viewingItem, setViewingItem] = useState<TLItem | null>(null);
  const [viewProgress, setViewProgress] = useState(0);
  const [viewDone, setViewDone] = useState(false);
  const [lessonVideoDone, setLessonVideoDone] = useState(false);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<number, string>>({});
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [claimError, setClaimError] = useState(false);

  const [earnedBanner, setEarnedBanner] = useState<string | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [justUnlocked, setJustUnlocked] = useState(false);

  const [showEarnedModal, setShowEarnedModal] = useState(false);
  const [claimAmountMinutes, setClaimAmountMinutes] = useState(0);
  const [claimPreviewSecs, setClaimPreviewSecs] = useState<number | null>(null);
  const [claimPreviewLoading, setClaimPreviewLoading] = useState(false);

  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"checking" | "available" | "taken" | null>(null);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [pendingClaimSecs, setPendingClaimSecs] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef(0);
  const initialLoadDoneRef = useRef(false);
  const wasAbleToConnectRef = useRef(false);
  const usernameCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoCurrentTimeRef = useRef(0);

  // A username already resolved for this MAC (TimelineContext's own fetch,
  // shared rather than duplicated here) is locked — no prompt needed. Once
  // it arrives, seed the editable field with it so the prompt (if ever
  // shown for some other reason) doesn't start blank.
  const usernameLocked = !!fetchedUsername;
  useEffect(() => {
    if (fetchedUsername) setUsername(fetchedUsername);
  }, [fetchedUsername]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [contentResult, completionsResult, settingsResult] = await Promise.all([getContent(site), getContentCompletions(mac ?? "", site), getSettings()]);
      if (cancelled) return;

      if (contentResult.ok && contentResult.data?.items?.length) setLiveItems(contentResult.data.items);

      const rows = completionsResult.ok ? (completionsResult.data?.completions ?? []) : [];
      setCompletedIds(new Set(rows.map((r: any) => r.content_item_id)));
      setRealUnclaimedSecs(completionsResult.ok ? (completionsResult.data?.unclaimedSecs ?? 0) : 0);

      if (settingsResult.ok && Number.isFinite(settingsResult.data?.earnConnectThresholdSecs)) {
        setConnectThresholdSecs(settingsResult.data.earnConnectThresholdSecs);
      }
      initialLoadDoneRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mac, site]);

  const normalized = useMemo(() => liveItems.map(normalizeLiveItem), [liveItems]);
  const featured = useMemo(
    () => normalized.find((i) => i.section === "hero") ?? (DEMO_MODE ? { ...TL_FEATURED, isLive: false } : null),
    [normalized]
  );
  const newItems = useMemo(
    () => [...normalized.filter((i) => i.section === "whats_new"), ...(DEMO_MODE ? TL_NEW.map((i) => ({ ...i, isLive: false })) : [])],
    [normalized]
  );
  const surveys = useMemo(
    () => [...normalized.filter((i) => i.section === "survey"), ...(DEMO_MODE ? TL_SURVEYS.map((i) => ({ ...i, isLive: false })) : [])],
    [normalized]
  );
  const articles = useMemo(
    () => [...normalized.filter((i) => i.section === "news"), ...(DEMO_MODE ? TL_ARTICLES.map((i) => ({ ...i, isLive: false })) : [])],
    [normalized]
  );
  const videos = useMemo(
    () => [...normalized.filter((i) => i.section === "watch_earn"), ...(DEMO_MODE ? TL_VIDEOS.map((i) => ({ ...i, isLive: false })) : [])],
    [normalized]
  );

  const totalEarnedSecs = realUnclaimedSecs + demoBonusSecs;
  const earnedFormatted = formatMinutesLabel(totalEarnedSecs);
  const canConnect = totalEarnedSecs >= connectThresholdSecs;
  const connectProgressPct = connectThresholdSecs > 0 ? Math.min(100, Math.round((totalEarnedSecs / connectThresholdSecs) * 100)) : 100;
  const claimMinMinutes = Math.max(1, Math.ceil(connectThresholdSecs / 60));
  const claimMaxMinutes = Math.max(claimMinMinutes, Math.floor(realUnclaimedSecs / 60));

  // "Just unlocked Connect Now" celebration — only for a completion during
  // this session crossing the line, not for restoring an already-sufficient
  // balance from the server on mount (see initialLoadDoneRef above).
  useEffect(() => {
    if (!initialLoadDoneRef.current) {
      wasAbleToConnectRef.current = canConnect;
      return;
    }
    if (canConnect && !wasAbleToConnectRef.current) {
      setJustUnlocked(true);
      const t = setTimeout(() => setJustUnlocked(false), 4000);
      wasAbleToConnectRef.current = canConnect;
      return () => clearTimeout(t);
    }
    wasAbleToConnectRef.current = canConnect;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canConnect]);

  // Debounce-fetch the live claim preview while the slider isn't at "All".
  // The "not applicable" case (modal closed, or slider at "All") is handled
  // by previewApplicable below at read time rather than by resetting state
  // from this effect — the stale fetched value just goes unused instead.
  const previewApplicable = showEarnedModal && claimAmountMinutes < claimMaxMinutes;
  useEffect(() => {
    if (!previewApplicable) return;
    const requestedMinutes = claimAmountMinutes;
    setClaimPreviewLoading(true);
    const timer = setTimeout(async () => {
      const result = await previewClaimAmount(mac ?? "", requestedMinutes);
      setClaimPreviewSecs(result.ok ? (result.data?.totalSecs ?? null) : null);
      setClaimPreviewLoading(false);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewApplicable, claimAmountMinutes]);

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);
    };
  }, []);

  function markVideoWatched() {
    setViewingItem((current) => {
      if (current?.type === "lesson" && (current.surveyQuestions?.length ?? 0) > 0) {
        setLessonVideoDone(true);
      } else {
        setViewDone(true);
      }
      return current;
    });
  }

  function startContent(item: TLItem) {
    if (completedIds.has(item.id)) return;
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setViewingItem(item);
    setViewProgress(0);
    setViewDone(false);
    setLessonVideoDone(false);
    setSurveyAnswers({});
    setSurveyIndex(0);
    setClaimError(false);
    videoCurrentTimeRef.current = 0;
    startedAtRef.current = Date.now();

    if (item.isLive) recordContentImpression(item.id);

    // survey/article/tracked-video: progress is driven by the real
    // input (answers, "finished reading" tap, or actual playback position)
    // — see handleVideoTimeUpdate and the quiz carousel actions below.
    if (item.type === "survey" || item.type === "article" || hasTrackedVideoPlayback(item)) return;

    const requiredSecs = item.minWatchSecs && item.minWatchSecs > 0 ? item.minWatchSecs : FALLBACK_WATCH_SECS;
    progressTimerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startedAtRef.current) / 1000;
      const pct = Math.min(100, (elapsed / requiredSecs) * 100);
      setViewProgress(pct);
      if (pct >= 100) {
        if (progressTimerRef.current) clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
        markVideoWatched();
      }
    }, 150);
  }

  // Bound to the native <video>'s / YouTube player's real playback position
  // — only advances while actually playing, so pausing/scrubbing back
  // correctly stalls or reduces progress instead of ignoring it.
  function handleVideoTimeUpdate(currentSecs: number) {
    if (!viewingItem || viewDone || lessonVideoDone) return;
    videoCurrentTimeRef.current = currentSecs;
    const requiredSecs = viewingItem.minWatchSecs && viewingItem.minWatchSecs > 0 ? viewingItem.minWatchSecs : FALLBACK_WATCH_SECS;
    const pct = Math.min(100, (currentSecs / requiredSecs) * 100);
    setViewProgress(pct);
    if (pct >= 100) markVideoWatched();
  }

  function answerSurveyQuestion(index: number, value: string) {
    setSurveyAnswers((prev) => {
      const updated = { ...prev, [index]: value };
      const questions = viewingItem?.surveyQuestions ?? [];
      if (questions.length > 0 && Object.keys(updated).length >= questions.length) {
        setViewDone(true);
      } else if (index < questions.length - 1) {
        setTimeout(() => setSurveyIndex((current) => (current === index ? index + 1 : current)), 300);
      }
      return updated;
    });
  }

  function goToSurveyQuestion(index: number) {
    const questions = viewingItem?.surveyQuestions ?? [];
    setSurveyIndex(Math.max(0, Math.min(index, questions.length - 1)));
  }

  async function claimReward() {
    if (!viewingItem) return;
    const item = viewingItem;
    let wasAlreadyCompleted = false;

    if (item.isLive) {
      const elapsedSecs = hasTrackedVideoPlayback(item) ? Math.round(videoCurrentTimeRef.current) : Math.round((Date.now() - startedAtRef.current) / 1000);
      const body: Record<string, unknown> = { mac, elapsedSecs };
      if (item.type === "survey" || (item.type === "lesson" && (item.surveyQuestions?.length ?? 0) > 0)) {
        body.response = surveyAnswers;
      }

      const result = await completeContentItem(item.id, body);
      if (!result.ok || !result.data?.ok) {
        setClaimError(true);
        return;
      }
      wasAlreadyCompleted = !!result.data.alreadyCompleted;
      if (!wasAlreadyCompleted) setRealUnclaimedSecs((s) => s + result.data.earnSecs);
    } else {
      setDemoBonusSecs((s) => s + item.earnSecs);
    }

    setCompletedIds((prev) => new Set(prev).add(item.id));
    setViewingItem(null);
    setViewProgress(0);
    setViewDone(false);

    if (wasAlreadyCompleted) {
      setLockedNotice(doneLabelForFrequency(item.viewFrequency));
      setTimeout(() => setLockedNotice(null), 3500);
      return;
    }

    setEarnedBanner(item.earnLabel);
    setTimeout(() => setEarnedBanner(null), 3500);
  }

  function markArticleDone() {
    setViewDone(true);
  }

  function dismissViewer() {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    setViewingItem(null);
    setViewProgress(0);
    setViewDone(false);
    setClaimError(false);
  }

  function onUsernameInput(text: string) {
    const next = text.replace(/\s/g, "").slice(0, 24);
    setUsername(next);
    setUsernameError("");
    if (usernameCheckTimerRef.current) clearTimeout(usernameCheckTimerRef.current);

    if (!next) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    usernameCheckTimerRef.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(next, mac ?? undefined);
      setUsernameStatus(result.ok ? (result.data?.available ? "available" : "taken") : null);
    }, 400);
  }

  function handleConnect(requestedSecs: number | null = null) {
    setPendingClaimSecs(requestedSecs);
    if (realUnclaimedSecs > 0 && !usernameLocked) {
      setUsernameError("");
      setShowUsernamePrompt(true);
      return;
    }
    performConnect(requestedSecs);
  }

  async function performConnect(requestedSecsOverride?: number | null) {
    const requestedSecs = requestedSecsOverride !== undefined ? requestedSecsOverride : pendingClaimSecs;

    if (realUnclaimedSecs <= 0) {
      onConnect(totalEarnedSecs, false);
      return;
    }

    setConnecting(true);
    setConnectError(null);
    const requestedMinutes = requestedSecs != null ? requestedSecs / 60 : undefined;
    const result = await claimEarnedSession(mac ?? "", username.trim() || undefined, requestedMinutes, site);
    setConnecting(false);

    if (!result.ok && "status" in result && result.status === 409) {
      setUsernameError(result.data?.message || "That username is taken — try another.");
      setShowUsernamePrompt(true);
      return;
    }

    if (result.data?.success || result.data?.retrying) {
      setShowUsernamePrompt(false);
      onConnect(result.data.durationSecs ?? realUnclaimedSecs, true);
      return;
    }

    setConnectError(result.data?.message ?? "Could not connect — please try again.");
  }

  const showingQuiz = viewingItem?.type === "survey" || (viewingItem?.type === "lesson" && lessonVideoDone);
  const playableVideoUrl = (viewingItem?.type === "video" || viewingItem?.type === "lesson") && viewingItem?.bodyUrl ? viewingItem.bodyUrl : null;

  const value: WatchEarnContextValue = {
    featured,
    newItems,
    surveys,
    articles,
    videos,
    completedIds,

    expandedSection,
    setExpandedSection,

    viewingItem,
    viewProgress,
    viewDone,
    lessonVideoDone,
    showingQuiz,
    surveyAnswers,
    surveyIndex,
    claimError,
    isViewerOpen: viewingItem !== null,
    playableVideoUrl,
    startContent,
    handleVideoTimeUpdate,
    answerSurveyQuestion,
    goToSurveyQuestion,
    claimReward,
    dismissViewer,
    markArticleDone,

    totalEarnedSecs,
    realUnclaimedSecs,
    demoBonusSecs,
    earnedFormatted,
    connectThresholdSecs,
    canConnect,
    connectProgressPct,
    earnedBanner,
    lockedNotice,
    justUnlocked,

    showEarnedModal,
    setShowEarnedModal,
    claimAmountMinutes,
    setClaimAmountMinutes,
    claimMinMinutes,
    claimMaxMinutes,
    claimPreviewSecs: previewApplicable ? claimPreviewSecs : null,
    claimPreviewLoading: previewApplicable && claimPreviewLoading,

    username,
    usernameError,
    usernameLocked,
    usernameStatus,
    showUsernamePrompt,
    setShowUsernamePrompt,
    onUsernameInput,
    connecting,
    connectError,
    handleConnect,
    performConnect: () => performConnect(),
  };

  return <WatchEarnContext.Provider value={value}>{children}</WatchEarnContext.Provider>;
}

export function useWatchEarn(): WatchEarnContextValue {
  const ctx = useContext(WatchEarnContext);
  if (!ctx) throw new Error("useWatchEarn() must be used within <WatchEarnProvider>");
  return ctx;
}
