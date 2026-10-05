/**
 * Curated FAQ answers for the search_help tool (see tools.js). Plain array +
 * keyword match — this is the anti-hallucination design for "how does X
 * work" questions: the assistant returns this fixed, reviewable text
 * instead of generating its own explanation, so a wrong/confusing answer is
 * a one-line edit here rather than a prompt-tuning exercise.
 *
 * Future: move this to a DB table with admin-dashboard CRUD (same pattern
 * already used for Campus/Community posts) once the initial set earns its
 * keep — static is fine for ~20 entries.
 */
export const KNOWLEDGE_BASE = [
  {
    id: "packages",
    keywords: ["package", "plan", "price", "cost", "how much", "buy", "daily", "weekly", "monthly"],
    answer:
      "Packages are time-based internet plans — Daily, Weekly and Monthly are the usual ones, each with its own price in KES. Real prices and durations can change per site, so always check get_packages for the current ones rather than quoting a remembered price.",
  },
  {
    id: "watch_earn",
    keywords: ["earn", "watch", "free", "video", "survey", "reward", "minutes for"],
    answer:
      "Watch & Earn lets a guest earn free internet time by watching videos, reading articles or completing short surveys in the app — each item shows how many minutes it's worth before you start it. Earned time banks up until it crosses the site's connect threshold, then you can connect with it or keep banking more.",
  },
  {
    id: "check_session",
    keywords: ["check my session", "recover", "lost my session", "new phone", "different device", "username"],
    answer:
      "If a device doesn't recognize an existing session (new phone, reinstalled app, cleared storage), enter the username chosen at checkout on the Check Session screen to recover it. Didn't set a username? Reconnecting to the site's Wi-Fi usually re-recognizes the device automatically.",
  },
  {
    id: "activator",
    keywords: ["activator", "referred", "who introduced", "agent"],
    answer:
      "An activator is the person/agent who introduced a guest to Ungana — choosing one (or 'self-onboarded' if nobody did) is required on a first purchase and is locked in permanently after that.",
  },
  {
    id: "no_internet_after_paying",
    keywords: ["no internet", "not connecting", "paid but", "not working", "can't connect", "cannot connect"],
    answer:
      "After a successful payment or claimed earned session, access is granted automatically — if it still isn't working, check get_session_status first: if it shows an active session but the device still has no internet, that's a router-side issue (try reconnecting to the Wi-Fi network) rather than a payment problem. If no session is found at all, the payment may still be processing — wait a minute and check again before assuming it failed.",
  },
  {
    id: "mpesa_stk",
    keywords: ["stk", "m-pesa", "mpesa", "pay with phone", "prompt"],
    answer:
      "Buying with M-Pesa sends an STK push prompt directly to the phone number given — enter the M-Pesa PIN on that prompt to complete payment. The prompt can take a few seconds to arrive; nothing is charged until it's approved on the phone.",
  },
];

/** Simple keyword/substring scoring — good enough for ~20 curated entries; swap for a real search index only if the KB grows much larger. */
export function searchKnowledgeBase(query) {
  const q = query.toLowerCase();
  const scored = KNOWLEDGE_BASE.map((entry) => ({
    entry,
    score: entry.keywords.filter((k) => q.includes(k)).length,
  })).filter((s) => s.score > 0);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 3).map((s) => ({ id: s.entry.id, answer: s.entry.answer }));
}
