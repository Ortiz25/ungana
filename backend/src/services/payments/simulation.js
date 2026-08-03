// Stand-in "provider" used when APP_MODE=simulation. No network call is
// made and no money moves — the outcome is decided immediately but held
// 'pending' for a short delay so polling/UI behaves like a real STK push
// (matches the frontend's own InitiatedScreen wait before it resolves).
// `simulateFailure` mirrors the boolean toggle already on PaymentScreen.

const RESOLVE_DELAY_MS = 3000;

// reference -> { status: 'success' | 'failed', resolveAt: epoch ms }
const simulatedOutcomes = new Map();

export async function initiateSimulatedPayment({ simulateFailure = false }) {
  const reference = `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  simulatedOutcomes.set(reference, {
    status: simulateFailure ? "failed" : "success",
    resolveAt: Date.now() + RESOLVE_DELAY_MS,
  });
  return {
    reference,
    status: "pending",
    displayText: "Simulated STK push sent — no real charge (APP_MODE=simulation).",
  };
}

export async function checkSimulatedPaymentStatus(reference) {
  const entry = simulatedOutcomes.get(reference);
  if (!entry) return { status: "failed" };
  if (Date.now() < entry.resolveAt) return { status: "pending" };
  simulatedOutcomes.delete(reference);
  return { status: entry.status };
}
