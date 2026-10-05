// AI assistant chat — backend proxy only; the web app never talks to an LLM
// provider directly. See backend/src/routes/assistant.js. Same request()
// conventions as the rest of api.js (which this file imports rather than
// duplicating a second fetch wrapper).
import { request } from './api.js';

/**
 * POST /api/assistant/chat — one turn, not a stream. propose_mpesa_purchase's
 * result has to arrive as structured data the UI can trust (real
 * package/price/phone), which a plain text stream would lose — see
 * backend/src/services/assistant/index.js's own comment on why it's
 * generateText, not streamText. Longer timeout than the 5s default: a
 * tool-calling turn can take several seconds.
 */
export function sendAssistantMessage(messages, mac, site) {
  return request('/assistant/chat', {
    method: 'POST',
    body: JSON.stringify({ mac, site, messages }),
    timeoutMs: 30000
  });
}

/** Extracts a propose_mpesa_purchase result from a turn's toolResults, if the assistant called it this turn. */
export function findPurchaseProposal(toolResults) {
  const hit = (toolResults || []).find((r) => r.toolName === 'propose_mpesa_purchase');
  return hit?.output?.ok ? hit.output : null;
}

/**
 * POST /api/assistant/purchase/:token/confirm — the ONLY call that actually
 * triggers the M-Pesa STK push for an assistant-proposed purchase. Called
 * when the person clicks "Confirm & Pay" on the proposal card — never
 * automatically, never from the model's own output.
 */
export function confirmAssistantPurchase(token) {
  return request(`/assistant/purchase/${encodeURIComponent(token)}/confirm`, { method: 'POST', timeoutMs: 20000 });
}
