import axios from "axios";
import {
  DARAJA_BASE_URL,
  DARAJA_CONSUMER_KEY,
  DARAJA_CONSUMER_SECRET,
  DARAJA_SHORTCODE,
  DARAJA_PASSKEY,
  DARAJA_TRANSACTION_TYPE,
  DARAJA_CALLBACK_URL,
  DARAJA_ACCOUNT_REF,
} from "../../config.js";

/** Normalise a Kenyan phone number to the 2547XXXXXXXX MSISDN format Daraja expects. */
export function formatKEMsisdn(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  throw new Error(`Invalid Kenyan phone number: ${phone}`);
}

/** timestamp (YYYYMMDDHHmmss) + password = Base64(Shortcode + Passkey + Timestamp). */
function darajaPassword() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const password = Buffer.from(`${DARAJA_SHORTCODE}${DARAJA_PASSKEY}${timestamp}`).toString("base64");
  return { timestamp, password };
}

async function getDarajaToken() {
  const auth = Buffer.from(`${DARAJA_CONSUMER_KEY}:${DARAJA_CONSUMER_SECRET}`).toString("base64");
  const response = await axios.get(`${DARAJA_BASE_URL}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.data.access_token;
}

/** Initiate a Daraja STK push. Returns { reference, status, displayText } — reference is CheckoutRequestID. */
export async function initiateDarajaStk({ phone, amountKES }) {
  const token = await getDarajaToken();
  const { timestamp, password } = darajaPassword();
  const msisdn = formatKEMsisdn(phone);

  const payload = {
    BusinessShortCode: DARAJA_SHORTCODE,
    Password: password,
    Timestamp: timestamp,
    TransactionType: DARAJA_TRANSACTION_TYPE,
    Amount: Math.round(amountKES),
    PartyA: msisdn,
    PartyB: DARAJA_SHORTCODE,
    PhoneNumber: msisdn,
    CallBackURL: DARAJA_CALLBACK_URL,
    AccountReference: DARAJA_ACCOUNT_REF.slice(0, 12),
    TransactionDesc: "Hotspot Access",
  };

  const response = await axios.post(`${DARAJA_BASE_URL}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });

  const data = response.data;
  if (data.ResponseCode !== "0") {
    throw new Error(data.ResponseDescription || data.errorMessage || "STK push rejected");
  }

  return { reference: data.CheckoutRequestID, status: "pending", displayText: data.CustomerMessage };
}

/** Query the status of a Daraja STK push by CheckoutRequestID. */
export async function queryDarajaStk(checkoutRequestId) {
  const token = await getDarajaToken();
  const { timestamp, password } = darajaPassword();

  try {
    const response = await axios.post(
      `${DARAJA_BASE_URL}/mpesa/stkpushquery/v1/query`,
      { BusinessShortCode: DARAJA_SHORTCODE, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId },
      { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
    );

    const data = response.data;
    if (data.ResultCode === "0" || data.ResultCode === 0) {
      return { status: "success", resultCode: "0", resultDesc: data.ResultDesc };
    }
    return { status: "failed", resultCode: String(data.ResultCode), resultDesc: data.ResultDesc };
  } catch (error) {
    // While the customer hasn't yet acted, Daraja returns HTTP 500 with
    // errorCode 500.001.1001 ("transaction is being processed"). Treat as pending.
    if (error.response?.data?.errorCode === "500.001.1001") {
      return { status: "pending", resultCode: null, resultDesc: "Awaiting customer" };
    }
    throw error;
  }
}
