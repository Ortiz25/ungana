// Shared by the payment routes and the background retry sweep in server.js
// so both go through one code path for turning a confirmed payment into an
// actually-active session.
import { authorizeClient } from "./unifi.js";
import { markSessionAuthorized, markSessionPaid, listPaidUnauthorizedSessions, logPaymentEvent } from "./sessions.js";

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

  if (authorized) return markSessionAuthorized(session.reference);

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
