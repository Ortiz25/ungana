// Provider dispatch — routes/services stay provider-agnostic and just call
// initiatePayment / checkPaymentStatus. See ../../../PAYMENTS.md at the repo
// root for how to configure each real provider.
//
// APP_MODE=simulation short-circuits to the local simulated provider before
// any real provider is even considered, so a misconfigured .env can never
// accidentally trigger a real charge.
import { APP_MODE, PAYMENT_PROVIDER } from "../../config.js";
import { initiatePaystackMpesa, verifyPaystackTransaction } from "./paystack.js";
import { initiateDarajaStk, queryDarajaStk } from "./daraja.js";
import { initiateSimulatedPayment, checkSimulatedPaymentStatus } from "./simulation.js";

/**
 * Initiate a payment. Returns { reference, status, displayText }.
 * `simulateFailure` is only honoured in simulation mode.
 */
export async function initiatePayment({ phone, amountKES, email, metadata, simulateFailure }) {
  if (APP_MODE === "simulation") return initiateSimulatedPayment({ simulateFailure });
  if (PAYMENT_PROVIDER === "daraja") return initiateDarajaStk({ phone, amountKES });
  return initiatePaystackMpesa({ phone, amountKES, email, metadata });
}

/** Check the status of a payment. Returns { status }. */
export async function checkPaymentStatus(reference) {
  if (APP_MODE === "simulation") return checkSimulatedPaymentStatus(reference);
  if (PAYMENT_PROVIDER === "daraja") {
    const { status } = await queryDarajaStk(reference);
    return { status };
  }
  const txn = await verifyPaystackTransaction(reference);
  if (txn.status === "success") return { status: "success" };
  if (txn.status === "failed" || txn.status === "abandoned") return { status: "failed" };
  return { status: "pending" };
}
