// SMS delivery for activator notifications (services/notifications.js is
// the only caller). Same dormant-until-configured convention as BTCPay in
// services/payments/ — until SMS_PROVIDER is set, this logs to the console
// instead of sending anything real, so the notification pipeline can be
// built and tested before a real SMS account exists. A real provider
// (Africa's Talking is the obvious fit for Kenya-based activators, but
// nothing here commits to it) drops in by adding a branch below and
// setting SMS_PROVIDER — nothing calling sendSms() needs to change.
import { SMS_PROVIDER, SMS_API_KEY, SMS_USERNAME, SMS_SENDER_ID } from "../config.js";

/**
 * Fire-and-forget: returns true if the message was handed off (simulated
 * or real), false if it couldn't be sent. Never throws — a failed SMS
 * should never take down whatever triggered it (see notify()'s caller).
 */
export async function sendSms(phone, message) {
  if (!phone) return false;

  if (!SMS_PROVIDER) {
    console.log(`📱 [simulated SMS] to ${phone}: ${message}`);
    return true;
  }

  // No real provider wired up yet — SMS_PROVIDER being set with no matching
  // branch here is a configuration error, not a silent no-op, so it's
  // surfaced rather than swallowed.
  console.error(`⚠️ SMS_PROVIDER="${SMS_PROVIDER}" is configured but no real integration exists yet — falling back to simulated. (unused: SMS_API_KEY, SMS_USERNAME, SMS_SENDER_ID)`);
  void SMS_API_KEY;
  void SMS_USERNAME;
  void SMS_SENDER_ID;
  console.log(`📱 [simulated SMS] to ${phone}: ${message}`);
  return true;
}
