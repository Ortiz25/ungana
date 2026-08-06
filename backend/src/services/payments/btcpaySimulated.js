// Stand-in for BTCPay Server invoices, used when real BTCPay credentials
// aren't configured (or APP_MODE=simulation). No network call, no real
// Lightning invoice — the returned BOLT11-shaped string is structurally
// similar but NOT payable (fake signature/checksum). Exists purely so the
// QR/copy-field UI and the settle-and-authorise flow can be built and
// tested before a real BTCPay Server account exists. Swap in ./btcpay.js
// automatically once BTCPAY_URL is set and APP_MODE=active — see ./btc.js.

const RESOLVE_DELAY_MS = 8000; // longer than the M-Pesa sim — gives time to see/scan the fake QR before it "settles"
const INVOICE_EXPIRY_MS = 15 * 60 * 1000; // 15 min, matches BTCPay's typical default invoice expiry

// invoiceId -> { status: 'Settled' | 'Expired', resolveAt: epoch ms }
const simulatedInvoices = new Map();

const BECH32_CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function fakeBolt11(amountKES) {
  const body = Array.from({ length: 180 }, () => BECH32_CHARSET[Math.floor(Math.random() * BECH32_CHARSET.length)]).join(
    ""
  );
  // Shaped like lnbc<amount><unit>1p<data> — visually a Lightning invoice,
  // not a real, decodable/payable one.
  return `lnbc${Math.max(1, Math.round(amountKES * 10))}u1p${body}`;
}

// Placeholder demo rate only — not a live market feed. Real invoices get
// their actual sats amount + rate straight from BTCPay (see ./btcpay.js);
// this just keeps the simulated flow's amount_sats/btc_rate_kes columns
// populated with something plausible while testing without one.
const SIMULATED_RATE_KES_PER_BTC = 10_000_000;

function fakeSatsAndRate(amountKES) {
  const amountSats = Math.round((amountKES / SIMULATED_RATE_KES_PER_BTC) * 100_000_000);
  return { amountSats, btcRateKes: SIMULATED_RATE_KES_PER_BTC };
}

export async function initiateSimulatedBtcInvoice({ amountKES, simulateFailure = false }) {
  const invoiceId = `SIMBTC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { amountSats, btcRateKes } = fakeSatsAndRate(amountKES);

  simulatedInvoices.set(invoiceId, {
    status: simulateFailure ? "Expired" : "Settled",
    resolveAt: Date.now() + RESOLVE_DELAY_MS,
  });

  return {
    reference: invoiceId,
    lightningInvoice: fakeBolt11(amountKES),
    checkoutLink: null, // no real hosted checkout page in simulation
    expiresAt: Date.now() + INVOICE_EXPIRY_MS,
    amountSats,
    btcRateKes,
  };
}

/** Mirrors BTCPay's own status vocabulary (New/Settled/Expired/Invalid) so callers don't need two branches. */
export async function checkSimulatedBtcInvoiceStatus(invoiceId) {
  const entry = simulatedInvoices.get(invoiceId);
  if (!entry) return { status: "Invalid" };
  if (Date.now() < entry.resolveAt) return { status: "New" };
  simulatedInvoices.delete(invoiceId);
  return { status: entry.status };
}
