/**
 * The grounding tool registry. Every tool wraps an existing service
 * function — none of them write new DB queries directly — so the assistant
 * can only ever report data the rest of the app already considers real.
 *
 * ── Adding a new tool ──────────────────────────────────────────────────
 *   1. Write a zod input schema + a one-line description.
 *   2. Implement execute() by calling an existing service function.
 *   3. Add it to the exported TOOLS object below. If it answers a new
 *      category of factual question, add a line to systemPrompt.js's hard
 *      rules so the model knows to call it before answering that category.
 *   (For a tool that changes state — payments, claims, anything
 *   money/access-related — follow purchases.js's propose/confirm split
 *   instead of executing directly; see that file's header comment.)
 */
import { z } from "zod";
import { tool } from "ai";
import { getLatestSessionForMac } from "../sessions.js";
import { listActivePackages } from "../catalog.js";
import { getClientCompletions } from "../content.js";
import { getPublicSettings } from "../settings.js";
import { getSite } from "../sites.js";
import { searchKnowledgeBase } from "./knowledgeBase.js";
import { proposePurchase } from "./purchases.js";
import { SUPPORT_WHATSAPP, SUPPORT_PHONE } from "../../config.js";

/** Same shape routes/payments.js's sessionStatusPayload() returns, trimmed to what the assistant needs to say out loud. */
function summarizeSession(session) {
  if (!session) return { found: false };
  const expiresAt = session.expires_at ? new Date(session.expires_at).getTime() : null;
  const active = expiresAt === null || expiresAt > Date.now();
  const remainingSecs = active && expiresAt ? Math.max(0, Math.round((expiresAt - Date.now()) / 1000)) : 0;
  return {
    found: true,
    active,
    packageId: session.package_id,
    remainingSecs,
    remainingMinutes: Math.round(remainingSecs / 60),
  };
}

export function buildTools({ mac, site }) {
  return {
    get_session_status: tool({
      description: "Look up this device's current internet session — whether it's active, and how much time is remaining. Always call this before answering any question about remaining time, whether the session is active, or what package is in use.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!mac) return { found: false, reason: "No device identity available for this chat." };
        const session = await getLatestSessionForMac(mac);
        return summarizeSession(session);
      },
    }),

    get_packages: tool({
      description: "Get the real, current list of purchasable packages (id, label, price in KES, duration) for this site. Always call this before quoting any price or duration.",
      inputSchema: z.object({}),
      execute: async () => {
        const packages = await listActivePackages(site || null);
        return packages.map((p) => ({ id: p.id, label: p.label, priceKes: Number(p.price_kes), durationSecs: p.duration_secs }));
      },
    }),

    get_watch_earn_balance: tool({
      description: "Get this device's real Watch & Earn balance — unclaimed earned seconds and the connect threshold. Always call this before answering any question about earned/banked time.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!mac) return { unclaimedSecs: 0, reason: "No device identity available for this chat." };
        const [{ unclaimedSecs }, settings] = await Promise.all([getClientCompletions(mac, site || null), getPublicSettings()]);
        return {
          unclaimedSecs,
          unclaimedMinutes: Math.round(unclaimedSecs / 60),
          connectThresholdSecs: settings.earnConnectThresholdSecs,
          canConnectNow: unclaimedSecs >= settings.earnConnectThresholdSecs,
        };
      },
    }),

    get_site_info: tool({
      description: "Get this site's configuration — whether it sells packages, offers Watch & Earn, or both, and what kind of location it is (general/institution/community).",
      inputSchema: z.object({}),
      execute: async () => {
        if (!site) return { found: false };
        const siteRow = await getSite(site);
        if (!siteRow) return { found: false };
        return { found: true, name: siteRow.name, mode: siteRow.mode, vertical: siteRow.vertical };
      },
    }),

    search_help: tool({
      description: "Search curated help articles for conceptual questions (how packages/Watch & Earn/payments work, troubleshooting, what an activator is). Always call this for 'how does X work' style questions instead of explaining it yourself.",
      inputSchema: z.object({ query: z.string().describe("The user's question, in their own words") }),
      execute: async ({ query }) => {
        const results = searchKnowledgeBase(query);
        return results.length > 0 ? results : { found: false, message: "No matching help article." };
      },
    }),

    propose_mpesa_purchase: tool({
      description: "Propose buying a package via M-Pesa STK push — reads the real price, does NOT charge anything. Only call this once the user has confirmed both which package and the phone number to charge. The chat UI will render a 'Confirm & Pay' button from the result; the user must tap it themselves to actually trigger the charge.",
      inputSchema: z.object({
        packageId: z.string().describe("The package id from get_packages, e.g. 'daily'"),
        phone: z.string().describe("Phone number to charge, digits only, e.g. 712345678"),
      }),
      execute: async ({ packageId, phone }) => proposePurchase({ mac, site, packageId, phone }),
    }),

    request_human_help: tool({
      description: "Hand off to a real person — use this whenever you don't have a grounded answer, the user explicitly asks for a human, or a purchase/session issue needs investigation you can't do.",
      inputSchema: z.object({ reason: z.string().describe("Short reason for the handoff, for the support log") }),
      execute: async ({ reason }) => {
        if (SUPPORT_WHATSAPP) return { channel: "whatsapp", contact: `https://wa.me/${SUPPORT_WHATSAPP}`, reason };
        if (SUPPORT_PHONE) return { channel: "phone", contact: SUPPORT_PHONE, reason };
        return { channel: "none", message: "No live support channel is configured for this deployment yet — point the guest to the activator who referred them.", reason };
      },
    }),
  };
}
