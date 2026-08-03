import axios from "axios";
import crypto from "crypto";
import { PAYSTACK_SECRET_KEY } from "../../config.js";

/** Normalise a Kenyan phone number to +254XXXXXXXXX. */
export function formatKEPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  throw new Error(`Invalid Kenyan phone number: ${phone}`);
}

/** Initiate a Paystack M-Pesa STK push. Returns { reference, status, displayText }. */
export async function initiatePaystackMpesa({ phone, amountKES, email, metadata = {} }) {
  const formattedPhone = formatKEPhone(phone);
  const reference = `UNGANA-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const payload = {
    email: email || `${formattedPhone.replace("+", "")}@example.com`, // Paystack requires an email per charge
    amount: Math.round(amountKES * 100), // kobo/cents
    currency: "KES",
    reference,
    mobile_money: { phone: formattedPhone, provider: "mpesa" },
    metadata,
  };

  const response = await axios.post("https://api.paystack.co/charge", payload, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
  });

  const { data } = response.data;
  return { reference, status: data.status, displayText: data.display_text };
}

/** Verify a Paystack transaction by reference. */
export async function verifyPaystackTransaction(reference) {
  const response = await axios.get(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
  });
  return response.data.data;
}

/** Verify the `x-paystack-signature` header on an incoming webhook. */
export function verifyPaystackSignature(rawBody, signature) {
  const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(rawBody).digest("hex");
  return hash === signature;
}
