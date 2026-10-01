// Ported from frontend/src/lib/data.js — guest-flow-relevant exports only.
// Staff-dashboard-only exports (MOCK_ROSTER, ACT_*, MONTHLY_DATA, etc.) are
// deliberately not ported here; see mobile_app's plan doc for phasing.
import type { LucideIcon } from "lucide-react-native";
import { Beaker, Sun, Calendar, Sparkles, Play, HelpCircle, FileText, BookOpen } from "lucide-react-native";

export type Activator = {
  id: string;
  name: string;
  area: string;
  sessions: number;
};

// Same list as the web app's static fallback/demo catalogue — the live
// activator picker prefers GET /api/activators when reachable (see
// PackageScreen's onMount) and falls back to this only if that fails.
export const ACTIVATORS: Activator[] = [
  { id: "SELF", name: "Self", area: "I signed up on my own", sessions: 0 },
  { id: "ACT-001", name: "James Mwangi", area: "Nairobi CBD", sessions: 142 },
  { id: "ACT-002", name: "Aisha Odhiambo", area: "Westlands", sessions: 98 },
  { id: "ACT-003", name: "Peter Kamau", area: "Kibera", sessions: 211 },
  { id: "ACT-004", name: "Grace Wanjiku", area: "Thika Road", sessions: 76 },
  { id: "ACT-005", name: "Samuel Otieno", area: "Mombasa", sessions: 189 },
  { id: "ACT-006", name: "Faith Njeri", area: "Nakuru", sessions: 54 },
  { id: "ACT-007", name: "David Kipchoge", area: "Eldoret", sessions: 130 },
  { id: "ACT-008", name: "Mary Achieng", area: "Kisumu", sessions: 67 },
];

export type Package = {
  id: string;
  label: string;
  duration: string;
  price: number;
  icon: LucideIcon;
  badge: string | null;
  demoSecs: number;
};

// Static defaults — PackageScreen merges these with GET /api/packages at
// runtime (live label/price/badge/isFeatured), same "static shape + live
// values" split as the web app. `demoSecs` is overridden to the package's
// real duration_secs only when running against a live (non-simulation)
// backend; see ActiveScreen/PackageScreen for that split.
export const PACKAGES: Package[] = [
  { id: "test", label: "Test", duration: "5 minutes", price: 2, icon: Beaker, badge: "Test", demoSecs: 300 },
  { id: "daily", label: "Daily", duration: "24 hours", price: 50, icon: Sun, badge: null, demoSecs: 45 },
  { id: "weekly", label: "Weekly", duration: "7 days", price: 250, icon: Calendar, badge: "Best Value", demoSecs: 45 },
  { id: "monthly", label: "Monthly", duration: "30 days", price: 750, icon: Sparkles, badge: null, demoSecs: 45 },
];

// Warning fires once this fraction of a session's own total duration
// remains — scales correctly for any plan length (demo or real) without
// needing to know which mode produced that duration.
export const WARNING_PERCENT = 0.05;
// Floor so a very short demo countdown (45s) still gets a usable warning window.
export const WARNING_MIN_SECONDS = 5;

export function getWarningThreshold(totalSecs: number): number {
  return Math.max(WARNING_MIN_SECONDS, Math.round(totalSecs * WARNING_PERCENT));
}

export function doneLabelForFrequency(viewFrequency?: string): string {
  switch (viewFrequency) {
    case "daily":
      return "Viewed today";
    case "weekly":
      return "Viewed this week";
    case "monthly":
      return "Viewed this month";
    case "session":
      return "Viewed this session";
    default:
      return "Done";
  }
}

export function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  if (h > 0) return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Compact duration for constrained UI — mm:ss / hh:mm:ss via formatTime()
 * for anything under a day, "Xd Yh" above that (formatTime() alone renders
 * absurd values on a real multi-day session, e.g. "720:00:00").
 */
export function formatCompactDuration(secs: number): string {
  const days = Math.floor(secs / 86400);
  if (days > 0) {
    const hours = Math.floor((secs % 86400) / 3600);
    return `${days}d ${hours}h`;
  }
  return formatTime(secs);
}

// ─── Watch & Earn demo catalogue ────────────────────────────────────────────
// Ported from frontend/src/lib/data.js's TL_* exports — the static fallback/
// padding catalogue that fills out each feed section around whatever real
// content_items rows the admin has configured (see WatchEarnContext.tsx).
export type TLItemType = "video" | "quiz" | "survey" | "lesson" | "article";
export type TLSurveyQuestion = { question: string; answers: string[] };
export type TLItem = {
  id: string | number;
  type: TLItemType;
  title: string;
  category: string;
  duration: string;
  earnLabel: string;
  earnSecs: number;
  img: string;
  bodyUrl?: string;
  surveyQuestions?: TLSurveyQuestion[];
  section?: string;
  viewFrequency?: string;
  minWatchSecs?: number;
  isLive?: boolean;
};

export const TL_FEATURED: TLItem = {
  id: "f1",
  type: "video",
  title: "Artisan Crafts of East Africa",
  category: "Culture & Heritage",
  duration: "8 min",
  earnLabel: "2h",
  earnSecs: 7200,
  img: "https://images.unsplash.com/photo-1749584550329-12f3252202f1?w=700&q=80",
};

export const TL_NEW: TLItem[] = [
  { id: "n1", type: "video", title: "Digital Skills for Kenya", category: "Education", duration: "5 min", earnLabel: "1h", earnSecs: 3600, img: "https://images.unsplash.com/photo-1632215861513-130b66fe97f4?w=400&q=80" },
  { id: "n2", type: "lesson", title: "Women Empowerment Stories", category: "Community", duration: "6 min", earnLabel: "2h", earnSecs: 7200, img: "https://images.unsplash.com/photo-1515658323406-25d61c141a6e?w=400&q=80" },
  { id: "n3", type: "article", title: "Market Innovations", category: "Business", duration: "3 min", earnLabel: "30m", earnSecs: 1800, img: "https://images.unsplash.com/photo-1558907530-fe311178388a?w=400&q=80" },
  { id: "n4", type: "video", title: "Community Stories", category: "Culture", duration: "7 min", earnLabel: "2h", earnSecs: 7200, img: "https://images.unsplash.com/photo-1515657834497-26509e295154?w=400&q=80" },
];

export const TL_SURVEYS: TLItem[] = [
  {
    id: "s1",
    type: "survey",
    title: "Take a survey to get 5 minutes online",
    category: "Community Survey",
    duration: "2 min",
    earnLabel: "5min",
    earnSecs: 300,
    img: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800&q=80",
    surveyQuestions: [
      { question: "How do you use the internet?", answers: ["Social media", "Work/study", "Entertainment", "News"] },
      { question: "What content matters most?", answers: ["Local news", "Education", "Entertainment", "Business"] },
      { question: "Rate your experience", answers: ["Poor", "Okay", "Good", "Excellent"] },
    ],
  },
  {
    id: "s2",
    type: "survey",
    title: "Tell us about your data usage for 45 minutes free",
    category: "Network Feedback",
    duration: "1 min",
    earnLabel: "45m",
    earnSecs: 2700,
    img: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80",
    surveyQuestions: [
      { question: "How often do you connect to Ungana WiFi?", answers: ["Daily", "A few times a week", "Weekly", "First time"] },
      { question: "How would you rate your connection speed?", answers: ["Very slow", "Slow", "Fine", "Fast"] },
    ],
  },
];

export const TL_ARTICLES: TLItem[] = [
  {
    id: "a1",
    type: "article",
    title: "Nairobi Tech Scene 2026",
    category: "Technology",
    duration: "3 min",
    earnLabel: "30m",
    earnSecs: 1800,
    img: "https://images.unsplash.com/photo-1623299677833-9f077d1a2e92?w=400&q=80",
    bodyUrl: [
      "Nairobi's Silicon Savannah has quietly become one of the continent's most consequential startup hubs, and 2026 is shaping up to be its busiest year yet. Here's what's driving the surge, and why it matters for the next billion users coming online.",
      "## What changed this year",
      "From fintech collectives in Kilimani to hardware labs tucked behind Ngong Road, a new generation of builders is shipping **mobile-first** products priced for real wallets. Three shifts stand out:",
      "- Community WiFi is cutting data costs for entire estates",
      "- Pay-as-you-go cloud lets startups launch without upfront infrastructure spend",
      "- Local investors are backing longer, less speculative runways",
      "### Why the infrastructure matters",
      "None of this works without the layer underneath it. Community WiFi, pay-as-you-go data, and local cloud capacity are finally catching up to the **ambition** of the people building on top of them.",
      "Source: Otieno, M. (2026, February 12). Inside the Silicon Savannah boom. Nairobi Business Weekly. nairobibusinessweekly.example.com",
    ].join("\n\n"),
  },
  { id: "a2", type: "lesson", title: "Teacher & Community Impact", category: "Education", duration: "4 min", earnLabel: "45m", earnSecs: 2700, img: "https://images.unsplash.com/photo-1744809482817-9a9d4fc280af?w=400&q=80" },
  { id: "a3", type: "video", title: "Children of the Savanna", category: "Documentary", duration: "5 min", earnLabel: "1h", earnSecs: 3600, img: "https://images.unsplash.com/photo-1520254553641-2eed4cf2ef26?w=400&q=80" },
];

export const TL_VIDEOS: TLItem[] = [
  { id: "v1", type: "video", title: "Elephant in the Wild", category: "Nature", duration: "12 min", earnLabel: "3h", earnSecs: 10800, img: "https://images.unsplash.com/photo-1784727076817-6ec448061770?w=600&q=80" },
  { id: "v2", type: "video", title: "Lion: King of Savanna", category: "Wildlife", duration: "8 min", earnLabel: "2h", earnSecs: 7200, img: "https://images.unsplash.com/photo-1695304909197-9874a20f8efc?w=600&q=80" },
  { id: "v3", type: "video", title: "Zebra Migration", category: "Nature", duration: "10 min", earnLabel: "3h", earnSecs: 10800, img: "https://images.unsplash.com/photo-1772175008003-1b9a07ad1878?w=600&q=80" },
];

export const TL_TYPE_ICON: Record<TLItemType, LucideIcon> = { video: Play, quiz: HelpCircle, survey: FileText, lesson: BookOpen, article: FileText };
export const TL_TYPE_LABEL: Record<TLItemType, string> = { video: "Video", quiz: "Quiz", survey: "Survey", lesson: "Lesson", article: "Article" };
export const TL_TYPE_COLOR: Record<TLItemType, string> = { video: "#C45C38", quiz: "#CC8830", survey: "#2E7D52", lesson: "#5C8C3C", article: "#5A6BA0" };
