// Dispatch between the real BTCPay client and the simulated stand-in,
// mirroring how ./index.js dispatches the M-Pesa providers. BTC checkout is
// a parallel, independent path from M-Pesa — the user picks per-checkout
// (the "Pay with BTC" button), not via a global env setting the way
// PAYMENT_PROVIDER picks between Paystack/Daraja.
import { APP_MODE, BTCPAY_URL } from "../../config.js";
import { createBtcInvoice, getBtcInvoiceStatus } from "./btcpay.js";
import { initiateSimulatedBtcInvoice, checkSimulatedBtcInvoiceStatus } from "./btcpaySimulated.js";

const btcLive = APP_MODE === "active" && !!BTCPAY_URL;

/** Returns { reference, lightningInvoice, checkoutLink, expiresAt, amountSats, btcRateKes }. */
export async function initiateBtcPayment({ amountKES, metadata, simulateFailure }) {
  if (btcLive) return createBtcInvoice({ amountKES, metadata });
  return initiateSimulatedBtcInvoice({ amountKES, simulateFailure: !!simulateFailure });
}

/** Returns { status } using BTCPay's own vocabulary: New | Processing | Settled | Expired | Invalid. */
export async function checkBtcPaymentStatus(reference) {
  if (btcLive) return getBtcInvoiceStatus(reference);
  return checkSimulatedBtcInvoiceStatus(reference);
}
