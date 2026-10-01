// Shared state for the Campus/Community/Watch tab group — the mobile
// counterpart to the top of TimelineScreen.svelte's <script>. Scoped to
// app/timeline/* only (provided in app/timeline/_layout.tsx, not the root
// layout), since this data is only relevant while inside that tab group and
// should refetch fresh each time a device re-enters it, same as the source
// component remounting.
//
// Watch & Earn's own state (liveItems/completedIds/realUnclaimedSecs/claim
// flow/content viewer) deliberately lives in its own sibling context
// instead — see WatchEarnContext.tsx's header comment for why. This context
// only covers what the Campus/Community components need.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getSite, getUsernameForMac, getCampusPosts, getCampusReadIds, getCommunityPosts, getCommunityReadIds, markCampusPostRead, markCommunityPostRead } from "@/lib/api";
import { getClientMac, getSiteId } from "@/lib/device";
import {
  COMMUNITY_DEMO_ANNOUNCEMENTS,
  COMMUNITY_DEMO_EVENTS,
  COMMUNITY_DEMO_MARKETPLACE,
  COMMUNITY_DEMO_SERVICES,
  COMMUNITY_DEMO_POLLS,
} from "@/lib/communityDemoData";
import type { NoticePost } from "@/components/NoticeBoard";
import type { EventPost } from "@/components/CampusEventsStrip";
import type { TimetablePost } from "@/components/ExamTimetable";
import type { ResourcePost } from "@/components/CampusResources";
import type { ListingPost } from "@/components/MarketplaceBoard";
import type { PollPost } from "@/components/CommunityPoll";

type Post = Record<string, any>;

function isPast(post: Post): boolean {
  return new Date(post.event_ends_at ?? post.event_starts_at) < new Date();
}
function matchesFilters(post: Post, query: string, category: string): boolean {
  if (category !== "all" && (post.category || "").toLowerCase() !== category.toLowerCase()) return false;
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [post.title, post.category, post.location, post.body].some((f) => (f || "").toLowerCase().includes(q));
}
function distinctCategories(posts: Post[][]): string[] {
  const seen = new Map<string, string>();
  for (const post of posts.flat()) {
    const c = (post.category || "").trim();
    if (c && !seen.has(c.toLowerCase())) seen.set(c.toLowerCase(), c);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

export type TimelineContextValue = {
  mac: string | null;
  site: string | null;
  siteInfo: { id: string; name: string; vertical?: string } | null;
  isInstitution: boolean;
  isCommunity: boolean;
  siteResolved: boolean;
  username: string;
  campusGreeting: () => string;

  campusQuery: string;
  setCampusQuery: (q: string) => void;
  campusCategory: string;
  setCampusCategory: (c: string) => void;
  campusCategories: string[];
  campusReadIds: Set<number | string>;
  markCampusRead: (id: number | string) => void;
  filteredCurrentNotices: NoticePost[];
  filteredPastNotices: NoticePost[];
  filteredUpcomingTimetable: TimetablePost[];
  filteredUpcomingEvents: EventPost[];
  filteredPastEvents: EventPost[];
  filteredCampusResources: ResourcePost[];
  campusHasAnyResults: boolean;
  campusPolls: PollPost[];

  communityQuery: string;
  setCommunityQuery: (q: string) => void;
  communityCategory: string;
  setCommunityCategory: (c: string) => void;
  communityCategories: string[];
  communityReadIds: Set<number | string>;
  markCommunityRead: (id: number | string) => void;
  filteredCurrentAnnouncements: NoticePost[];
  filteredPastAnnouncements: NoticePost[];
  filteredUpcomingCommunityEvents: EventPost[];
  filteredPastCommunityEvents: EventPost[];
  filteredCommunityMarketplace: ListingPost[];
  filteredCommunityServices: ResourcePost[];
  communityHasAnyResults: boolean;
  communityPolls: PollPost[];
};

const TimelineContext = createContext<TimelineContextValue | null>(null);

export function TimelineProvider({ children }: { children: ReactNode }) {
  const mac = getClientMac();
  const site = getSiteId();

  const [siteInfo, setSiteInfo] = useState<TimelineContextValue["siteInfo"]>(null);
  const [siteResolved, setSiteResolved] = useState(!site);
  const [username, setUsername] = useState("");

  const [campusNotices, setCampusNotices] = useState<Post[]>([]);
  const [campusEvents, setCampusEvents] = useState<Post[]>([]);
  const [campusTimetable, setCampusTimetable] = useState<Post[]>([]);
  const [campusResources, setCampusResources] = useState<Post[]>([]);
  const [campusPolls, setCampusPolls] = useState<Post[]>([]);
  const [campusReadIds, setCampusReadIds] = useState<Set<number | string>>(new Set());
  const [campusQuery, setCampusQuery] = useState("");
  const [campusCategory, setCampusCategory] = useState("all");

  const [communityAnnouncements, setCommunityAnnouncements] = useState<Post[]>([]);
  const [communityEvents, setCommunityEvents] = useState<Post[]>([]);
  const [communityMarketplace, setCommunityMarketplace] = useState<Post[]>([]);
  const [communityServices, setCommunityServices] = useState<Post[]>([]);
  const [communityPolls, setCommunityPolls] = useState<Post[]>([]);
  const [communityReadIds, setCommunityReadIds] = useState<Set<number | string>>(new Set());
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityCategory, setCommunityCategory] = useState("all");

  const isInstitution = siteInfo?.vertical === "institution";
  const isCommunity = siteInfo?.vertical === "community";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [siteResult, usernameResult] = await Promise.all([
        site ? getSite(site) : Promise.resolve(null),
        mac ? getUsernameForMac(mac) : Promise.resolve(null),
      ]);
      if (cancelled) return;

      const resolvedSiteInfo = siteResult?.ok && siteResult.data?.site ? siteResult.data.site : null;
      setSiteInfo(resolvedSiteInfo);
      setSiteResolved(true);
      if (usernameResult?.ok && usernameResult.data?.username) setUsername(usernameResult.data.username);

      const vertical = resolvedSiteInfo?.vertical;
      if (vertical === "institution" && site) {
        const [postsResult, readIdsResult] = await Promise.all([getCampusPosts(site), mac ? getCampusReadIds(mac) : Promise.resolve(null)]);
        if (cancelled) return;
        const allPosts: Post[] = postsResult.ok ? (postsResult.data?.posts ?? []) : [];
        setCampusNotices(allPosts.filter((p) => p.type === "notice" || p.type === "release"));
        setCampusEvents(allPosts.filter((p) => p.type === "event"));
        setCampusTimetable(allPosts.filter((p) => p.type === "timetable"));
        setCampusResources(allPosts.filter((p) => p.type === "resource"));
        setCampusPolls(allPosts.filter((p) => p.type === "poll"));
        setCampusReadIds(new Set(readIdsResult?.ok ? (readIdsResult.data?.readIds ?? []) : []));
      } else if (vertical === "community" && site) {
        const [postsResult, readIdsResult] = await Promise.all([getCommunityPosts(site), mac ? getCommunityReadIds(mac) : Promise.resolve(null)]);
        if (cancelled) return;
        const allPosts: Post[] = postsResult.ok ? (postsResult.data?.posts ?? []) : [];
        setCommunityAnnouncements([...allPosts.filter((p) => p.type === "announcement"), ...COMMUNITY_DEMO_ANNOUNCEMENTS]);
        setCommunityEvents([...allPosts.filter((p) => p.type === "event"), ...COMMUNITY_DEMO_EVENTS]);
        setCommunityMarketplace([...allPosts.filter((p) => p.type === "marketplace"), ...COMMUNITY_DEMO_MARKETPLACE]);
        setCommunityServices([...allPosts.filter((p) => p.type === "service"), ...COMMUNITY_DEMO_SERVICES]);
        setCommunityPolls([...allPosts.filter((p) => p.type === "poll"), ...COMMUNITY_DEMO_POLLS]);
        setCommunityReadIds(new Set(readIdsResult?.ok ? (readIdsResult.data?.readIds ?? []) : []));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function campusGreeting(): string {
    const h = new Date().getHours();
    const time = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    return username ? `${time}, ${username}` : time;
  }

  function markCampusRead(postId: number | string) {
    if (campusReadIds.has(postId)) return;
    setCampusReadIds((prev) => new Set(prev).add(postId));
    if (typeof postId === "string" && postId.startsWith("demo-")) return;
    if (mac) markCampusPostRead(postId, mac);
  }
  function markCommunityRead(postId: number | string) {
    if (communityReadIds.has(postId)) return;
    setCommunityReadIds((prev) => new Set(prev).add(postId));
    if (typeof postId === "string" && postId.startsWith("demo-")) return;
    if (mac) markCommunityPostRead(postId, mac);
  }

  const campusCategories = useMemo(
    () => distinctCategories([campusNotices, campusEvents, campusTimetable, campusResources]),
    [campusNotices, campusEvents, campusTimetable, campusResources]
  );
  const filteredCampusNotices = useMemo(() => campusNotices.filter((p) => matchesFilters(p, campusQuery, campusCategory)), [campusNotices, campusQuery, campusCategory]);
  const filteredCurrentNotices = useMemo(() => filteredCampusNotices.filter((n) => !n.event_starts_at || new Date(n.event_starts_at) >= new Date()), [filteredCampusNotices]);
  const filteredPastNotices = useMemo(() => filteredCampusNotices.filter((n) => n.event_starts_at && new Date(n.event_starts_at) < new Date()), [filteredCampusNotices]);
  const filteredCampusTimetable = useMemo(() => campusTimetable.filter((p) => matchesFilters(p, campusQuery, campusCategory)), [campusTimetable, campusQuery, campusCategory]);
  const filteredCampusEvents = useMemo(() => campusEvents.filter((p) => matchesFilters(p, campusQuery, campusCategory)), [campusEvents, campusQuery, campusCategory]);
  const filteredCampusResources = useMemo(() => campusResources.filter((p) => matchesFilters(p, campusQuery, campusCategory)), [campusResources, campusQuery, campusCategory]);
  const filteredUpcomingTimetable = useMemo(() => filteredCampusTimetable.filter((t) => !isPast(t)), [filteredCampusTimetable]);
  const filteredUpcomingEvents = useMemo(() => filteredCampusEvents.filter((e) => !isPast(e)), [filteredCampusEvents]);
  const filteredPastEvents = useMemo(
    () => filteredCampusEvents.filter((e) => isPast(e)).sort((a, b) => new Date(b.event_starts_at).getTime() - new Date(a.event_starts_at).getTime()),
    [filteredCampusEvents]
  );
  const campusHasAnyResults =
    filteredCurrentNotices.length > 0 || filteredUpcomingTimetable.length > 0 || filteredCampusEvents.length > 0 || filteredCampusResources.length > 0 || campusPolls.length > 0;

  const communityCategories = useMemo(
    () => distinctCategories([communityAnnouncements, communityEvents, communityServices]),
    [communityAnnouncements, communityEvents, communityServices]
  );
  const filteredCommunityAnnouncements = useMemo(() => communityAnnouncements.filter((p) => matchesFilters(p, communityQuery, communityCategory)), [communityAnnouncements, communityQuery, communityCategory]);
  const filteredCurrentAnnouncements = useMemo(() => filteredCommunityAnnouncements.filter((n) => !n.event_starts_at || new Date(n.event_starts_at) >= new Date()), [filteredCommunityAnnouncements]);
  const filteredPastAnnouncements = useMemo(() => filteredCommunityAnnouncements.filter((n) => n.event_starts_at && new Date(n.event_starts_at) < new Date()), [filteredCommunityAnnouncements]);
  const filteredCommunityEvents = useMemo(() => communityEvents.filter((p) => matchesFilters(p, communityQuery, communityCategory)), [communityEvents, communityQuery, communityCategory]);
  const filteredUpcomingCommunityEvents = useMemo(() => filteredCommunityEvents.filter((e) => !isPast(e)), [filteredCommunityEvents]);
  const filteredPastCommunityEvents = useMemo(
    () => filteredCommunityEvents.filter((e) => isPast(e)).sort((a, b) => new Date(b.event_starts_at).getTime() - new Date(a.event_starts_at).getTime()),
    [filteredCommunityEvents]
  );
  const filteredCommunityMarketplace = useMemo(() => communityMarketplace.filter((p) => matchesFilters(p, communityQuery, communityCategory)), [communityMarketplace, communityQuery, communityCategory]);
  const filteredCommunityServices = useMemo(() => communityServices.filter((p) => matchesFilters(p, communityQuery, communityCategory)), [communityServices, communityQuery, communityCategory]);
  const communityHasAnyResults =
    filteredCurrentAnnouncements.length > 0 || filteredUpcomingCommunityEvents.length > 0 || filteredCommunityMarketplace.length > 0 || filteredCommunityServices.length > 0 || communityPolls.length > 0;

  const value: TimelineContextValue = {
    mac,
    site,
    siteInfo,
    isInstitution,
    isCommunity,
    siteResolved,
    username,
    campusGreeting,

    campusQuery,
    setCampusQuery,
    campusCategory,
    setCampusCategory,
    campusCategories,
    campusReadIds,
    markCampusRead,
    filteredCurrentNotices: filteredCurrentNotices as NoticePost[],
    filteredPastNotices: filteredPastNotices as NoticePost[],
    filteredUpcomingTimetable: filteredUpcomingTimetable as TimetablePost[],
    filteredUpcomingEvents: filteredUpcomingEvents as EventPost[],
    filteredPastEvents: filteredPastEvents as EventPost[],
    filteredCampusResources: filteredCampusResources as ResourcePost[],
    campusHasAnyResults,
    campusPolls: campusPolls as PollPost[],

    communityQuery,
    setCommunityQuery,
    communityCategory,
    setCommunityCategory,
    communityCategories,
    communityReadIds,
    markCommunityRead,
    filteredCurrentAnnouncements: filteredCurrentAnnouncements as NoticePost[],
    filteredPastAnnouncements: filteredPastAnnouncements as NoticePost[],
    filteredUpcomingCommunityEvents: filteredUpcomingCommunityEvents as EventPost[],
    filteredPastCommunityEvents: filteredPastCommunityEvents as EventPost[],
    filteredCommunityMarketplace: filteredCommunityMarketplace as ListingPost[],
    filteredCommunityServices: filteredCommunityServices as ResourcePost[],
    communityHasAnyResults,
    communityPolls: communityPolls as PollPost[],
  };

  return <TimelineContext.Provider value={value}>{children}</TimelineContext.Provider>;
}

export function useTimeline(): TimelineContextValue {
  const ctx = useContext(TimelineContext);
  if (!ctx) throw new Error("useTimeline() must be used within <TimelineProvider>");
  return ctx;
}
