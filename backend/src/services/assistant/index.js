/**
 * Provider dispatch — mirrors services/payments/index.js's shape. Routes
 * never talk to a provider SDK directly; they call runAssistant(), and
 * LLM_PROVIDER picks which @ai-sdk/* model backs it. Swapping providers is
 * a .env change (LLM_PROVIDER + that provider's API key), never a code
 * change — see config.js's "AI Assistant" block.
 */
import { generateText, stepCountIs } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import {
  LLM_PROVIDER,
  LLM_MODEL,
  ANTHROPIC_API_KEY,
  OPENAI_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  GROQ_API_KEY,
  OLLAMA_BASE_URL,
} from "../../config.js";
import { SYSTEM_PROMPT } from "./systemPrompt.js";
import { buildTools } from "./tools.js";

// Only the Anthropic default (claude-haiku-4-5) is verified current as of
// this writing. The other three are reasonable picks for a cheap/fast
// support-chat workload but model names move fast — check each provider's
// current model list before relying on them, or just set LLM_MODEL
// explicitly (recommended regardless of provider).
const DEFAULT_MODELS = {
  anthropic: "claude-haiku-4-5",
  openai: "gpt-5-mini",
  google: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
  ollama: "llama3.1",
};

/** The model id that will actually be used, for logging — doesn't construct a provider client, so it's safe to call even with no API key configured. */
export function resolveModelId() {
  return LLM_MODEL || DEFAULT_MODELS[LLM_PROVIDER] || DEFAULT_MODELS.anthropic;
}

/** Resolves the configured LLM_PROVIDER into an `ai` SDK LanguageModel. Throws a clear error for a misconfigured/missing API key rather than letting the provider SDK's own opaque error surface. */
function resolveModel() {
  const modelId = resolveModelId();

  switch (LLM_PROVIDER) {
    case "openai": {
      if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set (LLM_PROVIDER=openai)");
      return createOpenAI({ apiKey: OPENAI_API_KEY })(modelId);
    }
    case "google": {
      if (!GOOGLE_GENERATIVE_AI_API_KEY) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set (LLM_PROVIDER=google)");
      return createGoogleGenerativeAI({ apiKey: GOOGLE_GENERATIVE_AI_API_KEY })(modelId);
    }
    case "groq": {
      if (!GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set (LLM_PROVIDER=groq)");
      return createGroq({ apiKey: GROQ_API_KEY })(modelId);
    }
    case "ollama": {
      if (!OLLAMA_BASE_URL) throw new Error("OLLAMA_BASE_URL is not set (LLM_PROVIDER=ollama)");
      // Any OpenAI-compatible endpoint works here, not just Ollama — the
      // provider name is just what this deployment happens to use locally.
      return createOpenAI({ baseURL: OLLAMA_BASE_URL, apiKey: "local" })(modelId);
    }
    case "anthropic":
    default: {
      if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set (LLM_PROVIDER=anthropic)");
      return createAnthropic({ apiKey: ANTHROPIC_API_KEY })(modelId);
    }
  }
}

/**
 * Runs one assistant turn grounded in `mac`/`site`'s real data. `messages`
 * is the running chat history as [{role, content}]. Non-streaming
 * (generateText, not streamText) on purpose: propose_mpesa_purchase's
 * result has to reach the client as structured data (real price/package/
 * phone, never reconstructed from the model's prose) so the chat UI can
 * render an accurate "Confirm & Pay" card — the plain-text streaming
 * protocol would only carry the prose and lose that. The route returns
 * `{ text, toolResults }` directly; the mobile client shows a brief typing
 * indicator rather than a token-by-token stream.
 */
export async function runAssistant({ messages, mac, site }) {
  return generateText({
    model: resolveModel(),
    system: SYSTEM_PROMPT,
    tools: buildTools({ mac, site }),
    // Guards against a runaway tool-calling loop — six tool round-trips is
    // far more than any real question here needs (one or two tools, then
    // the answer), and a hard cap is cheap insurance against a provider
    // quirk looping forever.
    stopWhen: stepCountIs(6),
    temperature: 0,
    messages,
    // Emits OpenTelemetry spans via @ai-sdk/otel — see telemetry.js
    // (registered once at server startup; that file's header comment has
    // the full "why isn't this just @opentelemetry/api" explanation). Also
    // see the comment on assistant_logs.trace in schema.sql for the
    // self-contained, no-exporter-needed alternative this route builds
    // from the same result object regardless.
    telemetry: {
      isEnabled: true,
      functionId: "assistant-chat",
      metadata: { mac: mac ?? "unknown", site: site ?? "unknown", provider: LLM_PROVIDER },
    },
  });
}

/**
 * Flattens a generateText() result into the compact per-step trace stored
 * in assistant_logs.trace — one entry per tool-calling round (which
 * tool(s) ran, their real inputs/outputs, finish reason, per-step token
 * usage), plus the overall totals/latency. Kept here rather than in the
 * route since it depends on the `ai` SDK's result shape, same reasoning as
 * resolveModel() living next to the provider dispatch it serves.
 */
export function buildTrace(result, { durationMs } = {}) {
  return {
    provider: LLM_PROVIDER,
    model: resolveModelId(),
    durationMs: durationMs ?? null,
    finishReason: result.finishReason,
    usage: result.totalUsage ?? result.usage ?? null,
    steps: (result.steps ?? []).map((step) => ({
      stepNumber: step.stepNumber,
      toolCalls: (step.toolCalls ?? []).map((c) => ({ toolName: c.toolName, input: c.input })),
      toolResults: (step.toolResults ?? []).map((r) => ({ toolName: r.toolName, output: r.output })),
      text: step.text || undefined,
      finishReason: step.finishReason,
      usage: step.usage,
    })),
  };
}

export { LLM_PROVIDER };
