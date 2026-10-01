// Ported from frontend/src/lib/screens/PaymentScreen.svelte. Notable
// swaps: `qrcode` (canvas data-URL) -> react-native-qrcode-svg's <QRCode>
// component directly; the BTC checkout <iframe> -> react-native-webview's
// <WebView>; navigator.clipboard -> expo-clipboard; the `lightning:` link +
// document.hidden "no wallet app" detection -> Linking.openURL + RN's
// AppState (backgrounding the app is the same signal a URI-scheme handoff
// actually worked).
import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, AppState, Linking } from "react-native";
import Constants from "expo-constants";
import * as Clipboard from "expo-clipboard";
import { WebView } from "react-native-webview";
import QRCode from "react-native-qrcode-svg";
import ScreenBg from "@/components/ScreenBg";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import {
  ArrowLeft,
  Phone,
  Smartphone,
  MessageCircle,
  User,
  CheckCircle2,
  CircleX,
  Bitcoin,
  Copy,
  AlertTriangle,
  Wallet,
} from "lucide-react-native";
import { initiatePayment, initiateBtcPayment, verifyBtcPayment, getUsernameForMac, checkUsernameAvailable, getSite } from "@/lib/api";
import { getClientMac, getSiteId } from "@/lib/device";
import type { Package, Activator } from "@/lib/data";

// Mirrors frontend/.env's VITE_DEMO_MODE — set demoMode:false in app.json's
// extra to hide the "simulate a failed payment" toggle for a real deployment.
const DEMO_MODE = Constants.expoConfig?.extra?.demoMode !== false;

const BTC_POLL_INTERVAL_MS = 10000;

const BRAND = {
  mpesa: { color: "#43B02A", glow: "rgba(67,176,42,0.45)" },
  btc: { color: "#F7931A", glow: "rgba(247,147,26,0.45)" },
} as const;

type BtcInvoice = { reference: string; lightningInvoice?: string; checkoutLink?: string; expiresAt?: number };

export default function PaymentScreen({
  pkg,
  activator,
  onPay,
  onBtcPaid,
  onBack,
}: {
  pkg: Package;
  activator: Activator | null;
  onPay: (phone: string, simulateFailure: boolean, reference: string | null) => void;
  onBtcPaid: () => void;
  onBack: () => void;
}) {
  const [paymentMethod, setPaymentMethod] = useState<"mpesa" | "btc">("mpesa");
  const [btcAvailable, setBtcAvailable] = useState<boolean | null>(null);
  const currentBrand = BRAND[paymentMethod];
  const otherBrand = BRAND[paymentMethod === "btc" ? "mpesa" : "btc"];

  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameLocked, setUsernameLocked] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"checking" | "available" | "taken" | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const usernameValid = usernameLocked || (username.trim().length > 0 && usernameStatus !== "taken");
  const usernameSettled = usernameLocked || (username.trim().length > 0 && usernameStatus !== "checking" && usernameStatus !== "taken");
  const ready = phone.length >= 9 && !submitting && usernameValid;
  const PkgIcon = pkg.icon;

  const [btcStatus, setBtcStatus] = useState<"idle" | "generating" | "awaiting" | "failed">("idle");
  const [btcInvoice, setBtcInvoice] = useState<BtcInvoice | null>(null);
  const [btcCopied, setBtcCopied] = useState(false);
  const [btcError, setBtcError] = useState("");
  const [btcNoWalletHint, setBtcNoWalletHint] = useState(false);
  const noWalletTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const btcReady = btcStatus !== "generating" && usernameValid;

  async function generateBtcInvoice() {
    if (!(btcStatus !== "generating" && usernameValid)) return;
    setBtcStatus("generating");
    setBtcError("");
    setUsernameError("");

    const result = await initiateBtcPayment({
      clientMac: getClientMac(),
      amount: pkg.price,
      packageId: pkg.id,
      activatorCode: activator?.id ?? "SELF",
      durationSecs: pkg.demoSecs,
      simulateFailure,
      username: username.trim() || undefined,
      site: getSiteId() || undefined,
    });

    if (!result.ok || (!result.data?.lightningInvoice && !result.data?.checkoutLink)) {
      if ("status" in result && result.status === 409) {
        setUsernameError(result.data?.message || "That username is taken — try another.");
        setUsernameStatus("taken");
        setBtcStatus("idle");
      } else {
        setBtcError("Could not generate an invoice — try again in a moment.");
        setBtcStatus("failed");
      }
      return;
    }

    setBtcInvoice(result.data);
    setBtcStatus("awaiting");
  }

  function copyInvoice() {
    if (!btcInvoice?.lightningInvoice) return;
    Clipboard.setStringAsync(btcInvoice.lightningInvoice).catch(() => {});
    setBtcCopied(true);
    setTimeout(() => setBtcCopied(false), 2000);
  }

  function attemptOpenWallet() {
    if (!btcInvoice?.lightningInvoice) return;
    clearTimeout(noWalletTimer.current);
    setBtcNoWalletHint(false);
    Linking.openURL(`lightning:${btcInvoice.lightningInvoice}`).catch(() => {});
    noWalletTimer.current = setTimeout(() => {
      if (AppState.currentState === "active") setBtcNoWalletHint(true);
    }, 1500);
  }

  // Returning client (username already locked) gets a seamless BTC flow —
  // switching to it generates the invoice immediately. A first-time client
  // still has to type/settle a username, then explicitly tap "Generate
  // Invoice" — see the button below.
  useEffect(() => {
    if (paymentMethod !== "btc" || btcStatus !== "idle" || !usernameLocked) return;
    generateBtcInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, btcStatus, usernameLocked]);

  // Background polling while the QR is on screen.
  useEffect(() => {
    if (btcStatus !== "awaiting" || !btcInvoice) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      if (cancelled || !btcInvoice) return;
      const result = await verifyBtcPayment(btcInvoice.reference);
      if (cancelled) return;

      if (result.ok && result.data?.success && result.data?.status === "success") {
        onBtcPaid();
        return;
      }
      if (result.ok && result.data?.status === "failed") {
        setBtcStatus("failed");
        setBtcError("This invoice was not paid in time. Generate a new one to try again.");
        return;
      }
      if (btcInvoice.expiresAt && Date.now() > btcInvoice.expiresAt) {
        setBtcStatus("failed");
        setBtcError("This invoice expired. Generate a new one to try again.");
        return;
      }
      timer = setTimeout(poll, BTC_POLL_INTERVAL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [btcStatus, btcInvoice?.reference]);

  useEffect(() => {
    (async () => {
      const siteId = getSiteId();
      if (!siteId) setBtcAvailable(true);

      const [usernameResult, siteResult] = await Promise.all([getUsernameForMac(getClientMac()!), siteId ? getSite(siteId) : Promise.resolve(null)]);

      if (usernameResult.ok && usernameResult.data?.username) {
        setUsername(usernameResult.data.username);
        setUsernameLocked(true);
      }
      if (siteId) {
        setBtcAvailable(siteResult?.ok ? siteResult.data?.site?.btcEnabled !== false : true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onUsernameChange(text: string) {
    const value = text.replace(/\s/g, "").slice(0, 24);
    setUsername(value);
    setUsernameError("");
    clearTimeout(usernameCheckTimer.current);

    if (!value) {
      setUsernameStatus(null);
      return;
    }
    setUsernameStatus("checking");
    // clearTimeout above already cancels any in-flight check the moment the
    // field changes again, so (unlike the web source's own stale-value
    // guard) there's no separate staleness check needed here — this timer
    // can only ever fire for the value it was scheduled for.
    usernameCheckTimer.current = setTimeout(async () => {
      const result = await checkUsernameAvailable(value, getClientMac() ?? undefined);
      setUsernameStatus(result.ok ? (result.data?.available ? "available" : "taken") : null);
    }, 400);
  }

  async function handlePay() {
    if (!ready) return;
    setSubmitting(true);
    setUsernameError("");

    const result = await initiatePayment({
      phoneNumber: `+254${phone}`,
      clientMac: getClientMac(),
      amount: pkg.price,
      packageId: pkg.id,
      activatorCode: activator?.id ?? "SELF",
      durationSecs: pkg.demoSecs,
      simulateFailure,
      username: username.trim() || undefined,
      site: getSiteId() || undefined,
    });

    setSubmitting(false);

    if (!result.ok && "status" in result && result.status === 409) {
      setUsernameError(result.data?.message || "That username is taken — try another.");
      return;
    }

    onPay(phone, simulateFailure, result.ok ? result.data?.reference ?? null : null);
  }

  return (
    <ScreenBg scroll>
      <View className="flex-row items-center gap-3 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(46,90,62,0.12)" }}>
          <ArrowLeft size={18} color="#1D3C2A" />
        </Pressable>
        <View>
          <Text className="text-base font-serif leading-tight" style={{ color: "#1D3C2A" }}>
            Payment
          </Text>
          <Text className="text-[11px]" style={{ color: "#3C6A4A" }}>
            {pkg.label} plan · {pkg.duration}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2 mb-5">
        <UnganaLogoMark height={28} />
        <Text className="text-sm font-serif" style={{ color: "#1D3C2A" }}>
          Ungana
        </Text>
      </View>

      <View className="flex-row items-center justify-between rounded-2xl px-4 py-3 mb-4" style={{ backgroundColor: "#2E5A3E" }}>
        <View className="flex-row items-center gap-3">
          <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.35)" }}>
            <PkgIcon size={15} color="#C45C38" />
          </View>
          <View>
            <Text className="text-xs font-sans-medium" style={{ color: "#C4DAC0" }}>
              {pkg.label} plan
            </Text>
            <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
              {pkg.duration} of free internet
            </Text>
          </View>
        </View>
        <Text className="text-lg font-sans-semibold" style={{ color: "#C45C38" }}>
          {pkg.price} <Text className="text-xs" style={{ color: "#C4DAC0" }}>KES</Text>
        </Text>
      </View>

      <View className="rounded-3xl overflow-hidden mb-3" style={{ backgroundColor: "#2E5A3E" }}>
        <View className="px-5 pt-5 pb-0 flex-row items-start justify-between gap-3">
          <View className="flex-row items-start gap-2.5 flex-1">
            <View className="w-7 h-7 rounded-xl items-center justify-center mt-0.5" style={{ backgroundColor: currentBrand.color }}>
              {paymentMethod === "btc" ? <Bitcoin size={14} color="#fff" strokeWidth={2.5} /> : <Smartphone size={13} color="#fff" strokeWidth={2.5} />}
            </View>
            <View className="flex-1">
              <Text className="text-sm font-sans-semibold mb-1" style={{ color: "#C4DAC0" }}>
                {paymentMethod === "btc" ? "Pay with Bitcoin" : "Pay via M-PESA"}
              </Text>
              <Text className="text-[11px] pb-4" style={{ color: "#AECAAE" }}>
                {paymentMethod === "btc" ? "Scan or copy the Lightning invoice" : "Enter the number to charge"}
              </Text>
            </View>
          </View>
          {btcAvailable && (
            <Pressable
              onPress={() => setPaymentMethod(paymentMethod === "btc" ? "mpesa" : "btc")}
              className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full"
              style={{ backgroundColor: otherBrand.color }}
            >
              {paymentMethod === "btc" ? <Smartphone size={14} color="#fff" strokeWidth={2.25} /> : <Bitcoin size={14} color="#fff" strokeWidth={2.25} />}
              <Text className="text-[11px] font-sans-semibold text-white">{paymentMethod === "btc" ? "Pay with M-PESA" : "Pay with BTC"}</Text>
            </Pressable>
          )}
        </View>
        <View className="h-px mx-5 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.1)" }} />
        <View className="px-5 pb-2" style={{ gap: 12 }}>
          {paymentMethod === "mpesa" && (
            <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "#3C6A4A", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <View className="px-4 py-3.5 flex-row items-center gap-2" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }}>
                <Phone size={13} color="#C4DAC0" />
                <Text className="font-sans-semibold text-sm" style={{ color: "#E8D4B0" }}>
                  +254
                </Text>
              </View>
              <TextInput
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 9))}
                placeholder="700012345"
                placeholderTextColor="#7A9E7A"
                keyboardType="number-pad"
                className="flex-1 px-4 py-3.5 text-sm"
                style={{ color: "#E8D4B0" }}
              />
            </View>
          )}

          <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(196,92,56,0.28)", borderWidth: 1, borderColor: "rgba(196,92,56,0.25)" }}>
            <View className="px-4 py-3.5" style={{ borderRightWidth: 1, borderRightColor: "rgba(196,92,56,0.25)" }}>
              <Text className="font-sans-semibold text-sm" style={{ color: "#C45C38" }}>
                KES
              </Text>
            </View>
            <Text className="flex-1 px-4 py-3.5 font-sans-semibold text-sm" style={{ color: "#C45C38" }}>
              {pkg.price.toLocaleString()}
            </Text>
            <Text className="pr-4 text-[10px] font-sans-medium" style={{ color: "#C45C38", opacity: 0.6 }}>
              fixed
            </Text>
          </View>

          <View>
            <Text className="text-[10px] font-sans-semibold mb-1 uppercase tracking-wider px-1" style={{ color: "#AECAAE" }}>
              Username
            </Text>
            <View
              className="flex-row items-center rounded-2xl overflow-hidden"
              style={{ backgroundColor: "#3C6A4A", opacity: usernameLocked ? 0.75 : 1, borderWidth: 1, borderColor: usernameStatus === "taken" ? "rgba(240,160,138,0.5)" : "rgba(255,255,255,0.1)" }}
            >
              <View className="px-4 py-3.5" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }}>
                <User size={13} color="#C4DAC0" />
              </View>
              <TextInput
                value={username}
                onChangeText={onUsernameChange}
                editable={!usernameLocked}
                placeholder="e.g. swiftrunner42"
                placeholderTextColor="#7A9E7A"
                autoCapitalize="none"
                className="flex-1 px-4 py-3.5 text-sm"
                style={{ color: "#E8D4B0" }}
              />
              <View className="pr-4">
                {usernameLocked || usernameStatus === "available" ? (
                  <CheckCircle2 size={14} color="#7EC88E" />
                ) : usernameStatus === "checking" ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : usernameStatus === "taken" ? (
                  <CircleX size={14} color="#F0A08A" />
                ) : null}
              </View>
            </View>
            {usernameError ? (
              <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#F0A08A" }}>
                {usernameError}
              </Text>
            ) : usernameLocked ? (
              <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#7A9E7A" }}>
                Already set for this device
              </Text>
            ) : usernameStatus === "taken" ? (
              <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#F0A08A" }}>
                That username is taken — try another
              </Text>
            ) : !username ? (
              <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#C4A870" }}>
                Required · tied to this device
              </Text>
            ) : (
              <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#7A9E7A" }}>
                Tied to this device
              </Text>
            )}
          </View>

          <View className="flex-row justify-between items-center px-4 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.14)" }}>
            <Text className="text-xs" style={{ color: "#C4DAC0" }}>
              You get
            </Text>
            <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
              {pkg.duration} free internet
            </Text>
          </View>

          {paymentMethod === "btc" && (
            <View className="rounded-2xl overflow-hidden" style={{ backgroundColor: "rgba(0,0,0,0.15)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              {btcStatus === "idle" &&
                (usernameLocked ? (
                  <View className="items-center gap-3 py-8">
                    <ActivityIndicator color="#fff" />
                    <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                      Preparing your Lightning invoice…
                    </Text>
                  </View>
                ) : usernameSettled ? (
                  <View className="items-center gap-2.5 py-8 px-5">
                    <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(247,147,26,0.15)" }}>
                      <Bitcoin size={16} color="#F7931A" />
                    </View>
                    <Text className="text-xs text-center" style={{ color: "#C4DAC0" }}>
                      Ready — tap "Generate Invoice" below to continue
                    </Text>
                  </View>
                ) : (
                  <View className="items-center gap-2.5 py-8 px-5">
                    <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(247,147,26,0.15)" }}>
                      <User size={16} color="#F7931A" />
                    </View>
                    <Text className="text-xs text-center" style={{ color: "#C4DAC0" }}>
                      Set a username above to continue
                    </Text>
                  </View>
                ))}
              {btcStatus === "generating" && (
                <View className="items-center gap-3 py-8">
                  <ActivityIndicator color="#fff" />
                  <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                    Generating Lightning invoice…
                  </Text>
                </View>
              )}
              {btcStatus === "awaiting" && btcInvoice && (
                <View className="items-center gap-3 px-5 py-5">
                  {btcInvoice.lightningInvoice && (
                    <>
                      <View className="rounded-2xl p-3" style={{ backgroundColor: "#fff" }}>
                        <QRCode value={btcInvoice.lightningInvoice} size={180} />
                      </View>
                      <View className="w-full flex-row items-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(0,0,0,0.3)" }}>
                        <Text className="flex-1 text-[11px]" numberOfLines={1} style={{ color: "#E8D4B0" }}>
                          {btcInvoice.lightningInvoice}
                        </Text>
                        <Pressable
                          onPress={copyInvoice}
                          className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
                          style={{ backgroundColor: btcCopied ? "rgba(78,128,80,0.35)" : "rgba(247,147,26,0.25)" }}
                        >
                          {btcCopied ? <CheckCircle2 size={11} color="#4E8050" /> : <Copy size={11} color="#F7931A" />}
                          <Text className="text-[10px] font-sans-semibold" style={{ color: btcCopied ? "#4E8050" : "#F7931A" }}>
                            {btcCopied ? "Copied" : "Copy"}
                          </Text>
                        </Pressable>
                      </View>
                      <Pressable onPress={attemptOpenWallet} className="w-full flex-row items-center justify-center gap-2 px-3 py-2.5 rounded-xl" style={{ backgroundColor: "#F7931A" }}>
                        <Wallet size={12} color="#fff" strokeWidth={2.5} />
                        <Text className="text-[11px] font-sans-semibold text-white">Pay in Wallet</Text>
                      </Pressable>
                      {btcNoWalletHint && (
                        <Text className="text-[10px] text-center" style={{ color: "#C4A870" }}>
                          No Lightning wallet app found on this device — copy the invoice above or scan the QR instead
                        </Text>
                      )}
                    </>
                  )}
                  {!btcInvoice.lightningInvoice && btcInvoice.checkoutLink && (
                    <View className="w-full rounded-2xl overflow-hidden" style={{ height: 420, backgroundColor: "#fff" }}>
                      <WebView source={{ uri: btcInvoice.checkoutLink }} />
                    </View>
                  )}
                  <View className="w-full flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(247,147,26,0.1)" }}>
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#F7931A" }} />
                    <Text className="text-[11px]" style={{ color: "#C4DAC0" }}>
                      Waiting for payment — this updates automatically
                    </Text>
                  </View>
                </View>
              )}
              {btcStatus === "failed" && (
                <View className="flex-row items-center gap-2 px-4 py-3">
                  <AlertTriangle size={13} color="#F0A08A" />
                  <Text className="text-xs flex-1" style={{ color: "#F0A08A" }}>
                    {btcError}
                  </Text>
                </View>
              )}
            </View>
          )}

          {DEMO_MODE && (
            <Pressable onPress={() => setSimulateFailure((v) => !v)} className="flex-row items-center justify-between gap-2 px-4 py-2.5 rounded-xl" style={{ backgroundColor: "rgba(196,92,56,0.08)" }}>
              <Text className="text-[10px] flex-1" style={{ color: "#AECAAE" }}>
                Demo: simulate a failed payment
              </Text>
              <View className="w-9 h-5 rounded-full" style={{ backgroundColor: simulateFailure ? "#C45C38" : "rgba(255,255,255,0.18)" }}>
                <View
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white"
                  style={{ left: simulateFailure ? 18 : 2 }}
                />
              </View>
            </Pressable>
          )}
        </View>

        {paymentMethod === "mpesa" && (
          <View className="px-5 pt-4 pb-5">
            <Pressable
              onPress={handlePay}
              disabled={!ready}
              className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2"
              style={{ backgroundColor: ready ? "#C45C38" : "rgba(255,255,255,0.1)" }}
            >
              {submitting ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text className="text-sm font-sans-semibold" style={{ color: "#fff" }}>
                    Sending prompt…
                  </Text>
                </>
              ) : (
                <Text className="text-sm font-sans-semibold" style={{ color: ready ? "#fff" : "#AECAAE" }}>
                  Pay Now
                </Text>
              )}
            </Pressable>
          </View>
        )}
        {paymentMethod === "btc" && btcStatus === "idle" && !usernameLocked && (
          <View className="px-5 pt-4 pb-5">
            <Pressable
              onPress={generateBtcInvoice}
              disabled={!usernameSettled}
              className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2"
              style={{ backgroundColor: usernameSettled ? "#F7931A" : "rgba(255,255,255,0.1)" }}
            >
              <Bitcoin size={15} color={usernameSettled ? "#fff" : "#AECAAE"} strokeWidth={2.25} />
              <Text className="text-sm font-sans-semibold" style={{ color: usernameSettled ? "#fff" : "#AECAAE" }}>
                Generate Invoice
              </Text>
            </Pressable>
          </View>
        )}
        {paymentMethod === "btc" && btcStatus === "failed" && (
          <View className="px-5 pt-4 pb-5">
            <Pressable
              onPress={generateBtcInvoice}
              disabled={!btcReady}
              className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2"
              style={{ backgroundColor: btcReady ? "#F7931A" : "rgba(255,255,255,0.1)" }}
            >
              <Bitcoin size={15} color={btcReady ? "#fff" : "#AECAAE"} strokeWidth={2.25} />
              <Text className="text-sm font-sans-semibold" style={{ color: btcReady ? "#fff" : "#AECAAE" }}>
                Try Again
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <View className="rounded-2xl px-4 py-3 flex-row items-center gap-3 mb-3" style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 1, borderColor: "rgba(46,90,62,0.2)" }}>
        {paymentMethod === "btc" ? (
          <>
            <Bitcoin size={16} color="#3C6A4A" />
            <Text className="text-xs flex-1" style={{ color: "#3C6A4A" }}>
              Pay the <Text className="font-sans-semibold" style={{ color: "#1D3C2A" }}>Lightning invoice</Text> from any compatible wallet to confirm
            </Text>
          </>
        ) : (
          <>
            <Phone size={16} color="#3C6A4A" />
            <Text className="text-xs flex-1" style={{ color: "#3C6A4A" }}>
              You will receive an <Text className="font-sans-semibold" style={{ color: "#1D3C2A" }}>M-PESA prompt</Text> to confirm payment
            </Text>
          </>
        )}
      </View>

      <Pressable className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: "#1D3C2A" }}>
        <MessageCircle size={17} color="#E8D4B0" />
        <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
          Contact Ungana Support
        </Text>
      </Pressable>
      <Text className="text-[10px] text-center mt-3" style={{ color: "#7A8868" }}>
        swap.ungana.app
      </Text>
    </ScreenBg>
  );
}
