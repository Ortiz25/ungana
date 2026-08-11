// Real BTCPay Server Greenfield API client. Only ever called via ./btc.js's
// dispatch, which requires APP_MODE=active AND BTCPAY_URL/BTCPAY_API_KEY/
// BTCPAY_STORE_ID to all be set — otherwise BTC checkout transparently uses
// ./btcpaySimulated.js instead. See config.js for the env vars.
//
// Field names below are verified against BTCPayServer.Client's actual
// model source (not just the docs site, which renders its API reference
// via JS and can't be scraped) — specifically
// BTCPayServer.Client/Models/InvoicePaymentMethodDataModel.cs and
// InvoiceData.cs in https://github.com/btcpayserver/btcpayserver.
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

  // The invoice-creation response already carries each requested payment
  // method's generated destination/amount/rate (InvoiceData.paymentMethods
  // — same InvoicePaymentMethodDataModel[] shape as the dedicated
  // payment-methods endpoint), so the common case needs no second request.
  // Falls back to that dedicated GET only if it ever comes back empty (e.g.
  // a BTCPay config where payment methods are generated lazily after
  // creation) — cheap insurance, not something observed in practice here.
  let methods = invoice.paymentMethods ?? [];
  if (methods.length === 0) {
    const methodsResponse = await axios.get(
      `${BTCPAY_URL}/api/v1/stores/${BTCPAY_STORE_ID}/invoices/${invoice.id}/payment-methods`,
      { headers: authHeaders() }
    );
    methods = methodsResponse.data ?? [];
  }

  // Lightning-only checkout (see `checkout.paymentMethods` above) means
  // there's only ever one entry — matching by id when present, falling
  // back to "whatever's there" is extra safety against a version-specific
  // naming quirk. This match previously used `m.paymentMethod`, which
  // isn't a real field on this object (the actual property is
  // `paymentMethodId`) — so it silently matched nothing on every call,
  // and lightningInvoice/amountSats/btcRateKes always fell back to null
  // below even though BTCPay had genuinely generated a real invoice (see
  // the BTCPay dashboard for the same invoice id, which showed the real
  // BOLT11 destination and rate the whole time).
  const lnMethod = methods.find((m) => m.paymentMethodId === PAYMENT_METHOD_ID) ?? methods[0] ?? null;

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
