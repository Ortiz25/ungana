// Real BTCPay Server Greenfield API client. Only ever called via ./btc.js's
// dispatch, which requires APP_MODE=active AND BTCPAY_URL/BTCPAY_API_KEY/
// BTCPAY_STORE_ID to all be set — otherwise BTC checkout transparently uses
// ./btcpaySimulated.js instead. See config.js for the env vars.
//
// Built from BTCPay's documented Node.js example and REST conventions:
// https://docs.btcpayserver.org/Development/GreenFieldExample-NodeJS/
// The interactive API reference (docs.btcpayserver.org/API/Greenfield/v1)
// is a JS-rendered Swagger UI that couldn't be scraped for exact field
// names while writing this — before going live, verify against your own
// instance's /swagger page:
//   - PAYMENT_METHOD_ID below ("BTC-LN") is the Lightning-only checkout
//     payment method key; older BTCPay versions used "BTC_LightningLike".
//   - The payment-methods response fields used below (`destination`,
//     `amount`, `rate`) — confirm they match your version's response shape.
import axios from "axios";
import crypto from "crypto";
import { BTCPAY_URL, BTCPAY_API_KEY, BTCPAY_STORE_ID, BTCPAY_WEBHOOK_SECRET } from "../../config.js";

const PAYMENT_METHOD_ID = "BTC-LN";

function authHeaders() {
  return { Authorization: `token ${BTCPAY_API_KEY}`, "Content-Type": "application/json" };
}

/**
 * Create a Lightning-only invoice. Returns { reference, lightningInvoice,
 * checkoutLink, expiresAt, amountSats, btcRateKes }. The sats amount and
 * KES/BTC rate are captured at invoice-creation time purely for
 * audit/reconciliation — never used to compute anything ourselves.
 */
export async function createBtcInvoice({ amountKES, metadata = {} }) {
  const response = await axios.post(
    `${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices`,
    {
      amount: amountKES,
      currency: "KES", // BTCPay converts to BTC/sats at the live rate — we never handle BTC pricing ourselves
      metadata,
      checkout: { paymentMethods: [PAYMENT_METHOD_ID] },
    },
    { headers: authHeaders() }
  );

  const invoice = response.data;

  const methodsResponse = await axios.get(
    `${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${invoice.id}/payment-methods`,
    { headers: authHeaders() }
  );
  const lnMethod = methodsResponse.data.find((m) => m.paymentMethod === PAYMENT_METHOD_ID);

  const amountBtc = lnMethod?.amount != null ? Number(lnMethod.amount) : null;
  const amountSats = amountBtc != null && Number.isFinite(amountBtc) ? Math.round(amountBtc * 100_000_000) : null;
  const btcRateKes = lnMethod?.rate != null ? Number(lnMethod.rate) : null;

  return {
    reference: invoice.id,
    lightningInvoice: lnMethod?.destination ?? null,
    checkoutLink: invoice.checkoutLink,
    expiresAt: invoice.expirationTime ? invoice.expirationTime * 1000 : null,
    amountSats,
    btcRateKes,
  };
}

/** Poll an invoice's status. Returns { status } — BTCPay's own values: New | Processing | Settled | Expired | Invalid. */
export async function getBtcInvoiceStatus(invoiceId) {
  const response = await axios.get(`${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${invoiceId}`, {
    headers: authHeaders(),
  });
  return { status: response.data.status };
}

/** Verify the `BTCPay-Sig` header on an incoming webhook (format: "sha256=<hex hmac>"). */
export function verifyBtcpayWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !rawBody) return false;

  const expected = "sha256=" + crypto.createHmac("sha256", BTCPAY_WEBHOOK_SECRET).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
