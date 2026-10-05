// AI assistant chat — backend proxy only; the mobile app never talks to an
// LLM provider directly (no provider API key could safely live in the app
// bundle anyway). See backend/src/routes/assistant.js.
import { request, type ApiResult } from "@/lib/api";

export type AssistantApiMessage = { role: "user" | "assistant"; content: string };

export type AssistantToolResult = {
  toolName: string;
  output: unknown;
};

export type AssistantPurchaseProposal = {
  ok: true;
  token: string;
  packageId: string;
  packageLabel: string;
  priceKes: number;
  durationSecs: number;
  phone: string;
};

/**
 * POST /api/assistant/chat — one turn, not a stream (see runAssistant's own
 * comment for why: propose_mpesa_purchase's result has to arrive as
 * structured data the UI can trust, which a plain text stream would lose).
 * A generous timeout — tool-calling turns can take several seconds longer
 * than this app's normal 5s default.
 */
export function sendAssistantMessage(
  messages: AssistantApiMessage[],
  mac: string | null,
  site: string | null
): Promise<ApiResult<{ text: string; toolResults: AssistantToolResult[] }>> {
  return request("/assistant/chat", {
    method: "POST",
    body: JSON.stringify({ mac, site, messages }),
    timeoutMs: 30000,
  });
}

/** Extracts a propose_mpesa_purchase result from a turn's toolResults, if the assistant called it this turn. */
export function findPurchaseProposal(toolResults: AssistantToolResult[]): AssistantPurchaseProposal | null {
  const hit = toolResults.find((r) => r.toolName === "propose_mpesa_purchase");
  const output = hit?.output as AssistantPurchaseProposal | undefined;
  return output?.ok ? output : null;
}

/**
 * POST /api/assistant/purchase/:token/confirm — the ONLY call that actually
 * triggers the M-Pesa STK push for an assistant-proposed purchase. Called
 * when the person taps "Confirm & Pay" on the proposal card — never
 * automatically, never from the model's own output.
 */
export function confirmAssistantPurchase(
  token: string
): Promise<ApiResult<{ success: boolean; reference?: string; provider?: string; status?: string; displayText?: string; message?: string }>> {
  return request(`/assistant/purchase/${encodeURIComponent(token)}/confirm`, { method: "POST", timeoutMs: 20000 });
}
