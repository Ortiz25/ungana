// Dispatch between the real BTCPay client, Minmo Pay, and the simulated
// stand-in, mirroring how ./index.js dispatches the M-Pesa providers. BTC
// checkout is a parallel, independent path from M-Pesa — the user picks
// per-checkout (the "Pay with BTC" button) — but which real backend serves
// it is a global setting (BTC_PROVIDER), the same way PAYMENT_PROVIDER picks
// between Paystack/Daraja.
import { APP_MODE, BTC_PROVIDER, BTCPAY_URL, MINMO_PARTNER_ID, MINMO_API_KEY, MINMO_STORE_ID } from "../../config.js";
import { createBtcInvoice, getBtcInvoiceStatus } from "./btcpay.js";
import { createMinmoBtcInvoice, getMinmoInvoiceStatus } from "./minmo.js";
import { initiateSimulatedBtcInvoice, checkSimulatedBtcInvoiceStatus } from "./btcpaySimulated.js";

const minmoLive =
  APP_MODE === "active" && BTC_PROVIDER === "minmo" && !!MINMO_PARTNER_ID && !!MINMO_API_KEY && !!MINMO_STORE_ID;
const btcpayLive = APP_MODE === "active" && BTC_PROVIDER !== "minmo" && !!BTCPAY_URL;

// Minmo's PayInvoiceStatus ("new"|"processing"|"settled"|"expired"|"invalid",
// confirmed from @minmoto/sdk's shipped .d.ts) maps 1:1 onto BTCPay's own
// vocabulary by capitalising — keeping every caller of checkBtcPaymentStatus
// (routes/btc.js) speaking BTCPay's vocabulary regardless of which provider
// actually answered.
function toBtcpayVocab(minmoStatus) {
  return minmoStatus.charAt(0).toUpperCase() + minmoStatus.slice(1);
}

/** Returns { reference, lightningInvoice, checkoutLink, expiresAt, amountSats, btcRateKes }. */
export async function initiateBtcPayment({ amountKES, metadata, simulateFailure }) {
  if (minmoLive) return createMinmoBtcInvoice({ amountKES });
  if (btcpayLive) return createBtcInvoice({ amountKES, metadata });
  return initiateSimulatedBtcInvoice({ amountKES, simulateFailure: !!simulateFailure });
}

/** Returns { status } using BTCPay's own vocabulary: New | Processing | Settled | Expired | Invalid. */
export async function checkBtcPaymentStatus(reference) {
  if (minmoLive) return { status: toBtcpayVocab(await getMinmoInvoiceStatus(reference)) };
  if (btcpayLive) return getBtcInvoiceStatus(reference);
  return checkSimulatedBtcInvoiceStatus(reference);
}
