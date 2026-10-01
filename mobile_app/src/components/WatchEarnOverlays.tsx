// Cross-tab Watch & Earn chrome — mounted once at app/timeline/_layout.tsx,
// not per-tab, so it's visible over both the Campus/Community and Watch
// tabs, matching the source's single shared "main feed" wrapper (see the
// plan doc's "Key architectural call"). Ported from TimelineScreen.svelte's
// earned/locked/unlocked banners (template lines ~1405-1443), the fixed
// bottom Connect Now bar (~1897-1966), the earned-balance modal
// (~1968-2105), and the username prompt (~2107-2184).
import { View, Text, Pressable, TextInput, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle } from "react-native-svg";
import Slider from "@react-native-community/slider";
import { Zap, Clock, Unlock, Wallet, X, User, CheckCircle2, CircleX } from "lucide-react-native";
import { useWatchEarn, formatMinutesLabel } from "@/flow/WatchEarnContext";

const RADIUS = 15;
const CIRC = 2 * Math.PI * RADIUS;

function ProgressRing({ pct, size = 36 }: { pct: number; size?: number }) {
  // Same rotate-the-<Svg>-itself convention as ActiveScreen.tsx's own ring,
  // rather than react-native-svg's rotation/origin props.
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" style={{ transform: [{ rotate: "-90deg" }] }}>
      <Circle cx={18} cy={18} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={4} />
      <Circle
        cx={18}
        cy={18}
        r={RADIUS}
        fill="none"
        stroke="#C45C38"
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
      />
    </Svg>
  );
}

function Banners() {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 64, left: 0, right: 0, alignItems: "center", zIndex: 50, gap: 8 }}>
      {!!w.earnedBanner && (
        <View className="flex-row items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(232,212,176,0.2)" }}>
          <Zap size={13} color="#C45C38" />
          <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>+{w.earnedBanner} earned!</Text>
        </View>
      )}
      {!!w.lockedNotice && (
        <View className="flex-row items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: "#4A3820", borderWidth: 1, borderColor: "rgba(232,212,176,0.2)" }}>
          <Clock size={13} color="#CC8830" />
          <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>{w.lockedNotice} — nothing new earned</Text>
        </View>
      )}
      {w.justUnlocked && (
        <View className="flex-row items-center gap-2.5 pl-3 pr-4 py-2.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
          <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.25)" }}>
            <Unlock size={12} color="#fff" />
          </View>
          <Text className="text-xs font-bold text-white">You can connect now!</Text>
        </View>
      )}
    </View>
  );
}

function BottomConnectBar({ onBuyAccess }: { onBuyAccess: () => void }) {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();

  function openEarnedModal() {
    w.setClaimAmountMinutes(Math.floor(w.realUnclaimedSecs / 60));
    w.setShowEarnedModal(true);
  }

  return (
    <View
      className="px-4 pt-3"
      style={{
        backgroundColor: "#1D3C2A",
        borderTopWidth: 1,
        borderTopColor: "rgba(232,212,176,0.1)",
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        gap: 8,
        paddingBottom: insets.bottom + 12,
      }}
    >
      {!!w.connectError && <Text className="text-[11px] text-center" style={{ color: "#E08A6A" }}>{w.connectError}</Text>}
      <View className="flex-row items-center gap-3">
        {w.totalEarnedSecs > 0 ? (
          <>
            <View className="flex-1 min-w-0">
              <Text className="text-[10px]" style={{ color: "#96B496" }}>Balance earned</Text>
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>{w.earnedFormatted} free internet</Text>
            </View>
            {w.canConnect ? (
              <Pressable
                onPress={openEarnedModal}
                disabled={w.connecting}
                className="px-4 py-2.5 rounded-2xl flex-row items-center gap-1.5 active:scale-95"
                style={{ backgroundColor: "#C45C38", opacity: w.connecting ? 0.7 : 1 }}
              >
                <Zap size={14} color="#fff" />
                <Text className="font-bold text-sm text-white">{w.connecting ? "Connecting…" : "Connect Now"}</Text>
              </Pressable>
            ) : (
              <View className="flex-row items-center gap-2">
                <View className="items-center justify-center" style={{ width: 36, height: 36 }}>
                  <ProgressRing pct={w.connectProgressPct} />
                  <View className="absolute items-center">
                    <Text className="text-[9px] font-bold" style={{ color: "#E8D4B0" }}>{w.connectProgressPct}%</Text>
                  </View>
                </View>
                <Text className="text-[11px] text-right" style={{ color: "#96B496", lineHeight: 14 }}>
                  {(() => {
                    const remainingSecs = Math.max(w.connectThresholdSecs - w.totalEarnedSecs, 0);
                    return remainingSecs >= 60 ? `${Math.ceil(remainingSecs / 60)}m` : `${remainingSecs}s`;
                  })()}
                  {"\nmore to connect"}
                </Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View className="flex-1 min-w-0">
              <Text className="text-xs font-sans-semibold" style={{ color: "#C4DAC0" }}>Complete content to earn access</Text>
              <Pressable onPress={onBuyAccess}>
                <Text className="text-[10px] font-sans-semibold mt-0.5" style={{ color: "#C45C38" }}>or buy access instantly →</Text>
              </Pressable>
            </View>
            <Pressable onPress={onBuyAccess} className="px-4 py-2.5 rounded-2xl" style={{ backgroundColor: "rgba(196,92,56,0.25)", borderWidth: 1.5, borderColor: "rgba(196,92,56,0.5)" }}>
              <Text className="font-bold text-sm" style={{ color: "#E8D4B0" }}>Buy Access</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

function EarnedBalanceModal() {
  const w = useWatchEarn();

  return (
    <Modal visible={w.showEarnedModal} transparent animationType="fade" onRequestClose={() => w.setShowEarnedModal(false)}>
      <Pressable className="flex-1 items-center justify-center p-5" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onPress={() => w.setShowEarnedModal(false)}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full rounded-3xl overflow-hidden"
          style={{ maxWidth: 380, backgroundColor: "#152A1D", borderWidth: 1, borderColor: "rgba(232,212,176,0.12)" }}
        >
          <View className="p-5">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-row items-center gap-2.5">
                <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.25)" }}>
                  <Wallet size={16} color="#C45C38" />
                </View>
                <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>Your Earned Balance</Text>
              </View>
              <Pressable onPress={() => w.setShowEarnedModal(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <X size={14} color="#C4DAC0" />
              </Pressable>
            </View>

            <View className="items-center mb-5">
              <Text className="font-serif" style={{ fontSize: 40, fontWeight: "700", color: "#E8D4B0" }}>{w.earnedFormatted}</Text>
              <Text className="text-[11px] mt-2" style={{ color: "#96B496" }}>of free internet earned</Text>
            </View>

            <View className="rounded-2xl p-3.5 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
              <View className="flex-row items-center justify-between py-1.5">
                <Text className="text-xs" style={{ color: "#C4DAC0" }}>Claimable now</Text>
                <Text className="text-xs font-bold" style={{ color: "#E8D4B0" }}>{formatMinutesLabel(w.realUnclaimedSecs)}</Text>
              </View>
              {w.demoBonusSecs > 0 && (
                <View className="flex-row items-center justify-between py-1.5" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" }}>
                  <Text className="text-xs" style={{ color: "#C4DAC0" }}>Demo bonus</Text>
                  <Text className="text-xs font-bold" style={{ color: "#96B496" }}>{formatMinutesLabel(w.demoBonusSecs)}</Text>
                </View>
              )}
            </View>

            {w.canConnect ? (
              <>
                {w.claimMaxMinutes > w.claimMinMinutes && (
                  <View className="rounded-2xl p-3.5 mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-xs" style={{ color: "#C4DAC0" }}>Use now</Text>
                      <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                        {w.claimAmountMinutes >= w.claimMaxMinutes ? "All" : `${w.claimAmountMinutes} min`}
                      </Text>
                    </View>
                    <Slider
                      minimumValue={w.claimMinMinutes}
                      maximumValue={w.claimMaxMinutes}
                      step={1}
                      value={w.claimAmountMinutes}
                      onValueChange={w.setClaimAmountMinutes}
                      minimumTrackTintColor="#C45C38"
                      maximumTrackTintColor="rgba(255,255,255,0.15)"
                      thumbTintColor="#C45C38"
                    />
                    <View className="flex-row items-center justify-between mt-1">
                      <Text className="text-[10px]" style={{ color: "#7A9E7A" }}>{w.claimMinMinutes}m</Text>
                      <Text className="text-[10px]" style={{ color: "#7A9E7A" }}>All ({w.claimMaxMinutes}m)</Text>
                    </View>
                    <Text className="text-[10px] mt-2" style={{ color: "#7A9E7A", lineHeight: 14 }}>
                      {w.claimAmountMinutes >= w.claimMaxMinutes
                        ? "Uses your full balance now."
                        : w.claimPreviewLoading || w.claimPreviewSecs == null
                          ? "Checking exactly what you'll get…"
                          : `Uses exactly ${formatMinutesLabel(w.claimPreviewSecs)} now, keeping ~${formatMinutesLabel(w.realUnclaimedSecs - w.claimPreviewSecs)} banked for next time.`}
                    </Text>
                  </View>
                )}

                <Pressable
                  onPress={() => {
                    const chosenSecs = w.claimAmountMinutes < w.claimMaxMinutes ? w.claimAmountMinutes * 60 : null;
                    w.setShowEarnedModal(false);
                    w.handleConnect(chosenSecs);
                  }}
                  disabled={w.connecting}
                  className="w-full py-4 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95"
                  style={{ backgroundColor: "#C45C38", opacity: w.connecting ? 0.7 : 1 }}
                >
                  <Zap size={18} color="#fff" />
                  <Text className="font-bold text-base text-white">{w.connecting ? "Connecting…" : "Connect Now"}</Text>
                </Pressable>
              </>
            ) : (
              <View className="flex-row items-center gap-3 rounded-2xl p-3.5" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <View className="items-center justify-center" style={{ width: 48, height: 48 }}>
                  <ProgressRing pct={w.connectProgressPct} size={48} />
                  <View className="absolute items-center">
                    <Text className="text-[10px] font-bold" style={{ color: "#E8D4B0" }}>{w.connectProgressPct}%</Text>
                  </View>
                </View>
                <Text className="text-xs flex-1" style={{ color: "#96B496", lineHeight: 18 }}>
                  Keep earning —{" "}
                  <Text className="font-bold" style={{ color: "#E8D4B0" }}>
                    {(() => {
                      const remainingSecs = Math.max(w.connectThresholdSecs - w.totalEarnedSecs, 0);
                      return remainingSecs >= 60 ? `${Math.ceil(remainingSecs / 60)}m more` : `${remainingSecs}s more`;
                    })()}
                  </Text>{" "}
                  to unlock Connect Now
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function UsernamePrompt() {
  const w = useWatchEarn();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={w.showUsernamePrompt} transparent animationType="fade" onRequestClose={() => w.setShowUsernamePrompt(false)}>
      <View className="flex-1 items-center justify-end" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
        <View className="w-full rounded-t-3xl p-5" style={{ backgroundColor: "#1D3C2A", maxWidth: 480, paddingBottom: insets.bottom + 20 }}>
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-9 h-9 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
              <User size={16} color="#C45C38" />
            </View>
            <View>
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>Set a username</Text>
              <Text className="text-[11px]" style={{ color: "#96B496" }}>Optional · tied to this device</Text>
            </View>
          </View>

          <View className="mt-4">
            <View className="flex-row items-center rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <View className="px-4 py-3.5" style={{ borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.15)" }}>
                <User size={13} color="#C4DAC0" />
              </View>
              <TextInput
                value={w.username}
                onChangeText={w.onUsernameInput}
                placeholder="e.g. swiftrunner42"
                placeholderTextColor="#7A9E7A"
                autoCapitalize="none"
                className="flex-1 px-4 py-3.5 text-sm"
                style={{ color: "#E8D4B0" }}
              />
              <View className="pr-4">
                {w.usernameStatus === "available" && <CheckCircle2 size={14} color="#7EC88E" />}
                {w.usernameStatus === "taken" && <CircleX size={14} color="#F0A08A" />}
              </View>
            </View>
            {!!w.usernameError && <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#F0A08A" }}>{w.usernameError}</Text>}
          </View>

          {!!w.connectError && <Text className="text-[11px] text-center mt-3" style={{ color: "#E08A6A" }}>{w.connectError}</Text>}

          <View className="flex-row gap-2 mt-4">
            <Pressable
              onPress={() => {
                w.setShowUsernamePrompt(false);
                w.onUsernameInput("");
                w.performConnect();
              }}
              disabled={w.connecting}
              className="flex-1 py-3 rounded-2xl items-center"
              style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
            >
              <Text className="font-sans-semibold text-sm" style={{ color: "#C4DAC0" }}>Skip</Text>
            </Pressable>
            <Pressable
              onPress={w.performConnect}
              disabled={w.connecting || w.usernameStatus === "taken"}
              className="flex-1 py-3 rounded-2xl items-center flex-row justify-center gap-1.5"
              style={{ backgroundColor: "#C45C38", opacity: w.connecting ? 0.7 : 1 }}
            >
              <Text className="font-bold text-sm text-white">{w.connecting ? "Connecting…" : "Continue"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function WatchEarnOverlays({ onBuyAccess }: { onBuyAccess: () => void }) {
  const w = useWatchEarn();

  return (
    <>
      {/* The content viewer (WatchEarnScreen) is a full-screen takeover with
          its own header and no bottom bar, same as the source — hide these
          cross-tab overlays while it's open rather than letting them show
          through on top of it. */}
      {!w.isViewerOpen && (
        <>
          <Banners />
          <BottomConnectBar onBuyAccess={onBuyAccess} />
        </>
      )}
      <EarnedBalanceModal />
      <UsernamePrompt />
    </>
  );
}
