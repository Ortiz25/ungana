// Canonicalises a Kenyan phone number to "+254XXXXXXXXX" regardless of how
// it was typed (0722..., 722..., 254722..., +254722..., with spaces/dashes).
// Used for both storing and looking up activator/coordinator phone numbers
// so login isn't sensitive to which format the admin happened to type when
// creating the account vs. what the login screen sends.
//
// Unlike services/payments/paystack.js's formatKEPhone(), this never throws
// on unrecognised input — a lookup with a malformed phone should just fail
// to match (404/401), not crash the request.
export function normalizeKEPhone(phone) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
  if (digits.length === 9) return `+254${digits}`;
  return `+${digits}`;
}
