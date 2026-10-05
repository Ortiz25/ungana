// OpenTelemetry registration for the AI assistant's LLM calls (see
// services/assistant/index.js's `telemetry` option). Imported first in
// server.js, before anything else, so both halves of this are in place
// before the first generateText() call:
//
//  1. A NodeSDK with a real span exporter — the actual plumbing that turns
//     spans into exported trace data.
//  2. `ai`'s own `registerTelemetry(new OpenTelemetry())` — as of `ai`
//     v7/@ai-sdk/otel, the SDK no longer touches @opentelemetry/api
//     directly; internally it publishes lifecycle events on a Node
//     `diagnostics_channel` ("ai:telemetry") and does *nothing* with them
//     unless an integration is registered to translate those events into
//     spans. Registering NodeSDK alone (OTel's usual setup) produces zero
//     spans for `ai` SDK calls without this second step.
//
// Verified end-to-end: POST /api/assistant/chat against a clean server
// instance produced 11 GenAI-semantic-convention spans
// (invoke_agent/step/chat/execute_tool, each with gen_ai.* attributes —
// model, token usage, tool input/output) via the console exporter.
//
// Exporter selection follows this backend's own "dormant until configured"
// convention (BTC_PROVIDER, UNIFI_URL, SMS_PROVIDER, ...): set
// OTEL_EXPORTER_OTLP_ENDPOINT to ship real spans to a collector (Honeycomb,
// Langfuse, a local Jaeger/Grafana Tempo instance, anything that speaks
// OTLP/HTTP); leave it unset and every span instead prints to this
// process's own stdout via ConsoleSpanExporter — zero external service
// needed, so tracing is visible immediately with no setup at all.
import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { ConsoleSpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-node";
import { resourceFromAttributes, defaultResource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { registerTelemetry } from "ai";
import { OpenTelemetry } from "@ai-sdk/otel";
import { OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_SERVICE_NAME } from "./config.js";

const exporter = OTEL_EXPORTER_OTLP_ENDPOINT ? new OTLPTraceExporter() : new ConsoleSpanExporter();

const sdk = new NodeSDK({
  resource: defaultResource().merge(resourceFromAttributes({ [ATTR_SERVICE_NAME]: OTEL_SERVICE_NAME })),
  // SimpleSpanProcessor, not the NodeSDK traceExporter default
  // (BatchSpanProcessor) — this is low-volume LLM-call tracing, not
  // high-throughput request tracing, so there's no batching upside, and
  // BatchSpanProcessor's few-second export delay made spans seem to never
  // arrive at all during manual testing (the process exits before the
  // next batch flush). Export each span the moment it ends instead.
  spanProcessors: [new SimpleSpanProcessor(exporter)],
});

sdk.start();
// Uses the NodeSDK's just-registered global tracer provider by default —
// pass { tracer } here instead if a specific TracerProvider is ever needed.
registerTelemetry(new OpenTelemetry());
console.log(`📡 OpenTelemetry tracing enabled (${OTEL_EXPORTER_OTLP_ENDPOINT ? `OTLP -> ${OTEL_EXPORTER_OTLP_ENDPOINT}` : "console exporter — set OTEL_EXPORTER_OTLP_ENDPOINT to ship elsewhere"})`);

// Flush pending spans before the process actually exits, not just on a
// clean return — otherwise the last few traces of a shutting-down process
// are silently dropped. Exits explicitly afterward rather than leaving it
// to Node's default signal behaviour, so a restart/redeploy doesn't leave
// an orphaned process still holding the port.
function shutdown() {
  sdk
    .shutdown()
    .catch(() => {})
    .finally(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
