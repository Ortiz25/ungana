// Minmo Pay client. API surface (getStore/read/createInvoice/getInvoice/
// events) confirmed against Minmo's own sdk-pay-demo reference app, not
// guessed from the README alone — see config.js's comment. Wired in as an
// alternative BTC/Lightning provider (BTC_PROVIDER=minmo, see ./btc.js) —
// the connected Pay store's paymentMethodId is BTC-LN, so createInvoice
// always produces a Lightning-payable invoice regardless of the `currency`
// field, which is just the pricing denomination. The M-Pesa/local-currency
// side isn't wired up yet: Minmo Pay settles via a hosted `checkoutUrl`
// page, not an in-app phone-number/STK push, so PAYMENT_PROVIDER=minmo
// needs that UX question settled separately.
import { MinmoClient, PayEventType, PayInvoiceStatus, PayStoreStatus } from "@minmoto/sdk";
import { MINMO_PARTNER_ID, MINMO_API_KEY, MINMO_STORE_ID, MINMO_BASE_URL } from "../../config.js";
import crypto from "crypto";

let client = null;
let store = null;

function getMinmoClient() {
  if (!MINMO_PARTNER_ID || !MINMO_API_KEY) {
    throw new Error("MINMO_PARTNER_ID and MINMO_API_KEY must be set to use Minmo");
  }
  if (!client) {
    client = new MinmoClient({
      partnerId: MINMO_PARTNER_ID,
      apiKey: MINMO_API_KEY,
      ...(MINMO_BASE_URL ? { baseUrl: MINMO_BASE_URL } : {}),
    });
  }
  return client;
}

/** Lazy singleton handle to the configured Pay store — doesn't confirm it's connected, see assertStoreConnected(). */
function getMinmoStore() {
  if (!MINMO_STORE_ID) throw new Error("MINMO_STORE_ID must be set to use Minmo Pay");
  if (!store) store = getMinmoClient().integrations.pay.getStore(MINMO_STORE_ID);
  return store;
}

/** Throws unless the store is connected to a settlement wallet — invoices can't settle otherwise. */
async function assertStoreConnected() {
  const s = getMinmoStore();
  const details = await s.read();
  if (details.status !== PayStoreStatus.CONNECTED) {
    throw new Error(`Minmo store ${MINMO_STORE_ID} is not connected to a wallet (status: ${details.status})`);
  }
  return { store: s, details };
}

/** Read-only connectivity check: confirms credentials work and the store is connected. Returns { partner, store }. */
export async function testMinmoConnection() {
  const minmo = getMinmoClient();
  const [partner, { details }] = await Promise.all([minmo.account.get(), assertStoreConnected()]);
  return { partner, store: details };
}

/**
 * Create a Minmo Pay invoice. `reference` becomes both the invoice's own
 * reference and (combined with `idempotencySuffix`) its idempotency key, so
 * retrying this call with the same reference after a network error can't
 * double-create an invoice. Returns { reference: invoiceId, checkoutUrl,
 * lightningInvoice, status, expiresAt }.
 *
 * @minmoto/sdk@0.2.0's createInvoice response includes a raw `lightningInvoice`
 * BOLT11 string directly (confirmed from a live response — the 0.1.1 .d.ts
 * this was originally built against didn't have this field, so it was
 * assumed unavailable and the UI fell back to embedding `checkoutUrl` in an
 * iframe instead).
 */
export async function createMinmoInvoice({ amountKES, reference, description, expirationMinutes = 30, idempotencySuffix = "v1" }) {
  const { store: s } = await assertStoreConnected();

  const invoice = await s.createInvoice(
    {
      amount: String(amountKES),
      currency: "KES",
      reference,
      description: description || "Ungana access",
      expirationMinutes,
    },
    `${reference}-invoice-${idempotencySuffix}`
  );

  return {
    reference: invoice.invoiceId,
    checkoutUrl: invoice.checkoutUrl,
    lightningInvoice: invoice.lightningInvoice ?? null,
    status: invoice.status,
    expiresAt: invoice.expiresAt ? new Date(invoice.expiresAt).getTime() : null,
  };
}

/**
 * Authoritative invoice read. Returns the raw PayInvoiceStatus value
 * ("new" | "processing" | "settled" | "expired" | "invalid" — confirmed
 * from @minmoto/sdk's shipped .d.ts) — callers map it to whatever
 * vocabulary their own route already speaks (see services/payments/btc.js).
 */
export async function getMinmoInvoiceStatus(reference) {
  const s = getMinmoStore();
  const invoice = await s.getInvoice(reference);
  return invoice.status;
}

/**
 * Create a Lightning invoice via Minmo Pay for the BTC checkout flow. Returns
 * the same shape as ./btcpay.js's createBtcInvoice — `lightningInvoice` is
 * now a real BOLT11 string (see createMinmoInvoice's comment), so the
 * existing in-place QR-code UI renders it directly like it does for BTCPay.
 * `checkoutLink` is still passed through as a fallback for the rare case
 * `lightningInvoice` comes back null (e.g. store misconfiguration).
 * amountSats/btcRateKes stay null — Minmo's Partner API doesn't expose a
 * sats/rate breakdown, only the KES `amount` and the BOLT11 itself.
 */
export async function createMinmoBtcInvoice({ amountKES }) {
  const reference = `UNGANA-LN-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const invoice = await createMinmoInvoice({ amountKES, reference, description: "Ungana Lightning top-up" });
  return {
    reference: invoice.reference,
    lightningInvoice: invoice.lightningInvoice,
    checkoutLink: invoice.checkoutUrl,
    expiresAt: invoice.expiresAt,
    amountSats: null,
    btcRateKes: null,
  };
}

/**
 * Subscribe to this store's live invoice events for push-based settlement
 * detection — mirrors the reference demo exactly: filter to
 * INVOICE_SETTLED, then re-confirm with an authoritative getInvoice() read
 * before calling `onSettled`. Purely an accelerator; polling via
 * getMinmoInvoiceStatus stays the source of truth if this subscription
 * drops. Returns the subscription so the caller can `await subscription
 * .ready` and `.close()` it on shutdown.
 */
export function subscribeToMinmoInvoiceEvents({ onSettled, onError }) {
  const s = getMinmoStore();

  return s.events({
    async onEvent(event) {
      if (event.type !== PayEventType.INVOICE_SETTLED) return;
      const invoiceId = event.payload?.invoiceId;
      if (!invoiceId) return;

      const invoice = await s.getInvoice(invoiceId);
      if (invoice.status === PayInvoiceStatus.SETTLED) onSettled(invoiceId, invoice);
    },
    async onResyncRequired() {
      // A gap was detected in the event stream — nothing to authoritatively
      // re-check without a specific invoice id, so this just relies on
      // polling to catch anything missed during the gap.
    },
    onError(error) {
      console.error("⚠️  Minmo event stream error:", error.message);
      onError?.(error);
    },
  });
}
