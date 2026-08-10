// Shared by the payment routes and the background retry sweep in server.js
// so both go through one code path for turning a confirmed payment into an
// actually-active session.
import { authorizeClient } from "./unifi.js";
import { markSessionAuthorized, markSessionPaid, listPaidUnauthorizedSessions, logPaymentEvent } from "./sessions.js";
import { notify } from "./notifications.js";

/**
 * Attempt router authorisation for a session whose payment is confirmed.
 * On success, marks it 'success' (active) and returns the updated row.
 * On failure (router unreachable/rejected), marks it 'paid' so the retry
 * sweep picks it up, and returns null. The customer already paid — this
 * path must never lose track of that.
 */
export async function completeAuthorization(session) {
  const authorized = await authorizeClient(session.client_mac, {
    duration: session.duration_secs ? Math.round(session.duration_secs / 60) : undefined,
    // null (no site recorded — pre-multi-site session, or single-site
    // deployment) must become undefined here, not stay null, so
    // authorizeClient's default parameter (`site = UNIFI_SITE`) actually
    // kicks in — a default param only triggers on undefined.
    site: session.site_id ?? undefined,
  });

  if (authorized) {
    const authorizedSession = await markSessionAuthorized(session.reference);
    // Every path that can authorise a session (payments.js, btc.js,
    // content.js's earned-session claim, and this function's own retry
    // sweep) funnels through here, so this is the one place a
    // "new_purchase" ping needs to fire — fire-and-forget, a notification
    // failure must never affect the session that already succeeded.
    if (authorizedSession?.source === "purchase" && authorizedSession.activator_id) {
      notify(authorizedSession.activator_id, "new_purchase", {
        title: "New purchase!",
        body: "A client you referred just bought a package.",
      }).catch((err) => console.error("⚠️ new_purchase notification failed:", err.message));
    }
    return authorizedSession;
  }

  await markSessionPaid(session.reference);
  await logPaymentEvent(session.id, "auth_failed", { reference: session.reference, reason: "router_unreachable" });
  return null;
}

/** Re-attempts router authorisation for every 'paid'-but-not-'success' session. */
export async function retryPaidAuthorizations() {
  const pending = await listPaidUnauthorizedSessions();
  for (const session of pending) {
    const result = await completeAuthorization(session);
    if (result) {
      console.log(`✅ Retry sweep authorised ${session.client_mac} [${session.reference}]`);
    } else {
      console.warn(`⏳ Retry sweep: router still unavailable for ${session.client_mac} [${session.reference}]`);
    }
  }
}
