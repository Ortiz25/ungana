import { Router } from "express";
import { runAssistant, LLM_PROVIDER, resolveModelId, buildTrace } from "../services/assistant/index.js";
import { confirmPurchase } from "../services/assistant/purchases.js";
import { getSite } from "../services/sites.js";
import { query } from "../db/pool.js";

export const assistantRouter = Router();

/**
 * POST /api/assistant/chat
 * Body: { mac, site?, messages: [{ role: 'user'|'assistant', content }] }
 * Returns { text, toolResults } — a plain JSON response, not a stream (see
 * runAssistant's header comment for why). Declines up front (no LLM call,
 * zero cost) if `site` is given and that site hasn't opted in — see
 * sites.assistant_enabled. Omitting `site` is allowed (dev convenience,
 * same convention as the content/campus/payments routes).
 */
assistantRouter.post("/chat", async (req, res) => {
  const { mac, site, messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: "messages is required" });
  }

  if (site) {
    const siteRow = await getSite(site);
    if (siteRow && !siteRow.assistant_enabled) {
      return res.status(403).json({ message: "The assistant isn't enabled for this site yet." });
    }
  }

  const startedAt = Date.now();
  try {
    const result = await runAssistant({ messages, mac: mac || null, site: site || null });
    const durationMs = Date.now() - startedAt;

    // toolResults carries each tool's real structured output (e.g.
    // propose_mpesa_purchase's token/price) — the mobile client renders UI
    // off this, never off `text`, for anything that has to be accurate.
    const toolResults = result.toolResults.map((r) => ({ toolName: r.toolName, output: r.output }));
    res.json({ text: result.text, toolResults });

    // Best-effort audit log, after the response has already gone to the
    // client — a logging failure here must never affect what the guest saw.
    // `trace` is the full per-step breakdown (see buildTrace) — how many
    // tool round-trips it took, what each one actually returned, token
    // usage and latency — for reviewing a specific exchange without
    // needing an external APM.
    try {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
      const trace = buildTrace(result, { durationMs });
      await query(
        `INSERT INTO assistant_logs (mac, site_id, provider, model, user_message, assistant_message, tool_calls, trace, duration_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [mac || null, site || null, LLM_PROVIDER, resolveModelId(), lastUserMessage?.content ?? "", result.text, JSON.stringify(toolResults), JSON.stringify(trace), durationMs]
      );
    } catch (logError) {
      console.error("⚠️  Assistant log write failed (response already sent):", logError.message);
    }
  } catch (error) {
    console.error("❌ Assistant chat error:", error.message);
    if (!res.headersSent) res.status(500).json({ message: "The assistant is unavailable right now — try again shortly." });
  }
});

/**
 * POST /api/assistant/purchase/:token/confirm
 * The ONLY path that can turn a propose_mpesa_purchase tool result into a
 * real charge — called by the mobile chat UI when the person taps "Confirm
 * & Pay", never by the model. See services/assistant/purchases.js's header
 * comment for the full propose/confirm design.
 */
assistantRouter.post("/purchase/:token/confirm", async (req, res) => {
  try {
    const result = await confirmPurchase(req.params.token);
    res.json(result);
  } catch (error) {
    console.error("❌ Assistant purchase confirm error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
});
