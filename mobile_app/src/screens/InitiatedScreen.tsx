// Ported from frontend/src/lib/screens/InitiatedScreen.svelte.
import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import * as Clipboard from "expo-clipboard";
import { CheckCircle2, Copy } from "lucide-react-native";
import ScreenBg from "@/components/ScreenBg";
import { verifyPayment } from "@/lib/api";
import type { Package, Activator } from "@/lib/data";

const POLL_INTERVAL_MS = 1500;
// Real STK push confirmation routinely takes 10-45+ seconds in practice — at
// least a minute before giving up.
const POLL_DEADLINE_MS = 60000;

type FailReason = { title: string; detail: string };

const FAILURE_REASON: FailReason = { title: "Payment declined", detail: "The M-PESA prompt was cancelled or declined on your phone." };
const CONNECTION_ISSUE: FailReason = {
  title: "Connection problem",
  detail: 'We couldn\'t confirm your payment. If you completed the M-PESA prompt, use "Check Status Now" — otherwise, please try again.',
};
const TIMED_OUT: FailReason = {
  title: "Taking longer than expected",
  detail: 'We could not confirm your payment in time. If you completed the M-PESA prompt, tap "Check Status Now" — otherwise please try again.',
};

export default function InitiatedScreen({
  pkg,
  phone,
  activator,
  willFail = false,
  reference = null,
  mode = "simulation",
  onContinue,
  onFailed,
}: {
  pkg: Package;
  phone: string;
  activator: Activator | null;
  willFail?: boolean;
  reference?: string | null;
  mode?: "simulation" | "active";
  onContinue: () => void;
  onFailed: (reason: FailReason) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const localTxId = useMemo(() => "UNG-" + Math.random().toString(36).slice(2, 8).toUpperCase(), []);
  const displayTxId = reference || localTxId;
  const showCheckNow = mode === "active" && !!reference;

  const pollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pollCancelled = useRef(false);
  const pollDeadline = useRef(Date.now() + POLL_DEADLINE_MS);

  function localFallbackProceed() {
    if (willFail) onFailed(FAILURE_REASON);
    else onContinue();
  }

  async function poll() {
    if (pollCancelled.current || !reference) return;
    setChecking(true);
    const result = await verifyPayment(reference);
    setChecking(false);
    if (pollCancelled.current) return;

    if (!result.ok && "error" in result && result.error) {
      // Network/timeout on this one poll attempt — never treat that as
      // confirmation of anything. Only fall back to the demo shortcut in
      // simulation mode; in active mode just retry until the deadline.
      if (mode !== "active") {
        localFallbackProceed();
        return;
      }
      if (Date.now() <= pollDeadline.current) {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
        return;
      }
      onFailed(CONNECTION_ISSUE);
      return;
    }

    const status = result.data?.status;
    if (result.data?.success && status === "success") {
      onContinue();
      return;
    }
    if (status === "failed") {
      onFailed(FAILURE_REASON);
      return;
    }
    if (Date.now() > pollDeadline.current) {
      if (mode !== "active") {
        localFallbackProceed();
      } else {
        onFailed(TIMED_OUT);
      }
      return;
    }
    pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
  }

  function proceed() {
    localFallbackProceed();
  }

  function checkNow() {
    clearTimeout(pollTimer.current);
    poll();
  }

  useEffect(() => {
    if (!reference) {
      // By the time this screen mounts, initiate-payment has already fully
      // resolved (PaymentScreen awaits it before navigating here) — no
      // reference means it's already known to have failed, not "still in
      // flight".
      if (mode !== "active") {
        const t = setTimeout(localFallbackProceed, 4000);
        return () => clearTimeout(t);
      }
      onFailed({
        title: "Could not start payment",
        detail: "We couldn't reach the payment provider to send your M-PESA prompt. Please check your connection and try again.",
      });
      return;
    }

    pollCancelled.current = false;
    pollDeadline.current = Date.now() + POLL_DEADLINE_MS;
    poll();
    return () => {
      pollCancelled.current = true;
      clearTimeout(pollTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  const rows = [
    { label: "Plan", value: `${pkg.label} · ${pkg.duration}` },
    { label: "Phone", value: `+254 ${phone}` },
    { label: "Amount", value: `${pkg.price.toLocaleString()} KES` },
    { label: "Payment", value: "M-PESA" },
    ...(activator ? [{ label: "Activator", value: `${activator.name} (${activator.id})` }] : []),
    { label: "Status", value: "Awaiting confirmation ⏳" },
  ];

  function copy() {
    Clipboard.setStringAsync(displayTxId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <ScreenBg className="items-center">
      <View className="items-center mt-8 mb-6">
        <View className="w-24 h-24 rounded-full items-center justify-center mb-4" style={{ backgroundColor: "#1D3C2A" }}>
          <CheckCircle2 size={48} color="#C45C38" strokeWidth={2} />
        </View>
        <Text className="text-2xl font-serif text-center" style={{ color: "#1D3C2A" }}>
          Payment Initiated!
        </Text>
        <Text className="text-sm mt-1 text-center" style={{ color: "#3C6A4A" }}>
          Check your phone for the M-PESA prompt
        </Text>
      </View>

      <View className="w-full rounded-3xl overflow-hidden mb-4" style={{ backgroundColor: "#2E5A3E" }}>
        <View className="px-5 pt-5 pb-3">
          <Text className="text-xs uppercase tracking-widest mb-3 font-sans-semibold" style={{ color: "#C4DAC0" }}>
            Payment Details
          </Text>
          {rows.map((row, i) => (
            <View
              key={row.label}
              className="flex-row justify-between items-center py-2.5"
              style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" } : undefined}
            >
              <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                {row.label}
              </Text>
              <Text className="text-sm font-sans-semibold text-right" style={{ color: "#E8D4B0", maxWidth: "55%" }}>
                {row.value}
              </Text>
            </View>
          ))}
        </View>
        <View className="mx-4 mb-4 px-4 py-3 rounded-2xl flex-row items-center justify-between" style={{ backgroundColor: "#1D3C2A" }}>
          <View>
            <Text className="text-[10px] uppercase tracking-wider" style={{ color: "#AECAAE" }}>
              Reference
            </Text>
            <Text className="text-xs mt-0.5" style={{ color: "#E8D4B0" }}>
              {displayTxId}
            </Text>
          </View>
          <Pressable onPress={copy} className="p-1.5 rounded-lg">
            {copied ? <CheckCircle2 size={16} color="#C45C38" /> : <Copy size={16} color="#C4DAC0" />}
          </Pressable>
        </View>
      </View>

      <View className="w-full rounded-2xl px-4 py-3 flex-row items-center gap-3 mb-4" style={{ backgroundColor: "rgba(46,90,62,0.12)", borderWidth: 1, borderColor: "rgba(46,90,62,0.2)" }}>
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: "#C45C38" }} />
        <Text className="text-xs flex-1" style={{ color: "#3C6A4A" }}>
          Connecting you automatically once payment is confirmed…
        </Text>
      </View>

      <Pressable
        onPress={showCheckNow ? checkNow : proceed}
        disabled={showCheckNow && checking}
        className="w-full py-4 rounded-2xl flex-row items-center justify-center gap-2"
        style={{ backgroundColor: "#C45C38", opacity: showCheckNow && checking ? 0.7 : 1 }}
      >
        {showCheckNow ? (
          checking ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text className="text-base font-sans-semibold text-white">Checking…</Text>
            </>
          ) : (
            <Text className="text-base font-sans-semibold text-white">Check Status Now</Text>
          )
        ) : (
          <Text className="text-base font-sans-semibold text-white">Continue to Session</Text>
        )}
      </Pressable>
      <Text className="text-[10px] text-center mt-4" style={{ color: "#7A8868" }}>
        swap.ungana.app
      </Text>
    </ScreenBg>
  );
}
