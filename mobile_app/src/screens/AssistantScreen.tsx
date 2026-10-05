// In-app AI assistant chat. Grounded entirely server-side (see
// backend/src/services/assistant/) — this screen just renders turns and,
// when a turn proposed a purchase, a Confirm & Pay card built from the
// tool's real structured output (never from the assistant's prose). See
// assistantApi.ts's header comment for why the backend call isn't streamed.
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send, Trash2, Bot, User, CheckCircle2, AlertTriangle } from "lucide-react-native";
import UnganaLogoMark from "@/components/UnganaLogoMark";
import { sendAssistantMessage, confirmAssistantPurchase, findPurchaseProposal, type AssistantApiMessage } from "@/lib/assistantApi";
import { loadAssistantChat, saveAssistantChat, clearAssistantChat, type AssistantMessage } from "@/lib/assistantStorage";
import { getClientMac, getSiteId } from "@/lib/device";

const SUGGESTED_PROMPTS = ["Check my session", "How do I earn minutes?", "Talk to a human"];

type ConfirmedPurchase = { phone: string; reference: string; packageId: string; packageLabel: string; priceKes: number; durationSecs: number };

export default function AssistantScreen({
  onBack,
  onPurchaseConfirmed,
}: {
  onBack: () => void;
  // Hands off to the SAME post-payment flow PaymentScreen uses (InitiatedScreen
  // -> ConnectingScreen, polling /api/verify-payment/:reference) rather than
  // reimplementing that polling here — see app/assistant.tsx. Screens don't
  // call expo-router directly in this app, so the route owns the navigation.
  onPurchaseConfirmed: (payload: ConfirmedPurchase) => void;
}) {
  const insets = useSafeAreaInsets();
  const mac = getClientMac();
  const site = getSiteId();

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmingToken, setConfirmingToken] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    (async () => {
      setMessages(await loadAssistantChat());
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (loaded) saveAssistantChat(messages);
  }, [messages, loaded]);

  function scrollToEnd() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    const next: AssistantMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setSending(true);
    scrollToEnd();

    const history: AssistantApiMessage[] = next.map((m) => ({ role: m.role, content: m.content }));
    const result = await sendAssistantMessage(history, mac, site);
    setSending(false);

    if (!result.ok || !result.data) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Sorry, I couldn't reach the assistant — try again in a moment." }]);
      scrollToEnd();
      return;
    }

    const proposal = findPurchaseProposal(result.data.toolResults);
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: result.data.text || "…",
        purchaseProposal: proposal
          ? {
              token: proposal.token,
              packageId: proposal.packageId,
              packageLabel: proposal.packageLabel,
              priceKes: proposal.priceKes,
              durationSecs: proposal.durationSecs,
              phone: proposal.phone,
              confirmed: false,
            }
          : null,
      },
    ]);
    scrollToEnd();
  }

  async function handleConfirmPurchase(proposal: NonNullable<AssistantMessage["purchaseProposal"]>) {
    setConfirmingToken(proposal.token);
    const result = await confirmAssistantPurchase(proposal.token);
    setConfirmingToken(null);

    setMessages((prev) => prev.map((m) => (m.purchaseProposal?.token === proposal.token ? { ...m, purchaseProposal: { ...m.purchaseProposal!, confirmed: true } } : m)));

    if (result.ok && result.data?.success && result.data.reference) {
      // Hand off to the existing payment-polling flow immediately — don't
      // make the guest sit in the chat watching nothing happen while the
      // STK push is pending.
      onPurchaseConfirmed({
        phone: proposal.phone,
        reference: result.data.reference,
        packageId: proposal.packageId,
        packageLabel: proposal.packageLabel,
        priceKes: proposal.priceKes,
        durationSecs: proposal.durationSecs,
      });
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: result.data?.message || "Couldn't start that payment — try again or buy from the Packages screen." },
    ]);
    scrollToEnd();
  }

  function handleClearChat() {
    Alert.alert("Clear chat?", "This removes the conversation from this device — it isn't saved anywhere else.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          await clearAssistantChat();
          setMessages([]);
        },
      },
    ]);
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#1D3C2A" }}>
      <View className="flex-row items-center px-4 pb-3" style={{ paddingTop: insets.top + 12 }}>
        <Pressable onPress={onBack} hitSlop={8} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <ArrowLeft size={16} color="#C4DAC0" />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2 ml-3">
          <UnganaLogoMark height={20} />
          <Text className="text-sm font-serif" style={{ color: "#E8D4B0" }}>
            Assistant
          </Text>
        </View>
        {messages.length > 0 && (
          <Pressable onPress={handleClearChat} hitSlop={8} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
            <Trash2 size={14} color="#C4DAC0" />
          </Pressable>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={insets.top + 48}>
        <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 16, paddingBottom: 12, gap: 12, flexGrow: 1 }}>
          {messages.length === 0 && (
            <View className="flex-1 items-center justify-center" style={{ gap: 16 }}>
              <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.18)" }}>
                <Bot size={26} color="#C45C38" />
              </View>
              <Text className="text-sm text-center px-6" style={{ color: "#C4DAC0" }}>
                Ask about your session, packages, or how Watch & Earn works.
              </Text>
              <View className="flex-row flex-wrap justify-center" style={{ gap: 8 }}>
                {SUGGESTED_PROMPTS.map((p) => (
                  <Pressable key={p} onPress={() => send(p)} className="px-3 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
                    <Text className="text-xs font-sans-semibold" style={{ color: "#E8D4B0" }}>
                      {p}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {messages.map((m, i) => (
            <View key={i} style={{ gap: 6 }}>
              <View className={m.role === "user" ? "flex-row justify-end" : "flex-row justify-start"}>
                <View className="flex-row items-end" style={{ gap: 6, maxWidth: "85%" }}>
                  {m.role === "assistant" && (
                    <View className="w-6 h-6 rounded-full items-center justify-center shrink-0" style={{ backgroundColor: "rgba(196,92,56,0.22)" }}>
                      <Bot size={12} color="#C45C38" />
                    </View>
                  )}
                  <View
                    className="px-4 py-2.5 rounded-2xl"
                    style={{
                      backgroundColor: m.role === "user" ? "#C45C38" : "rgba(255,255,255,0.08)",
                      borderWidth: m.role === "assistant" ? 1 : 0,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Text className="text-sm" style={{ color: m.role === "user" ? "#fff" : "#E8D4B0" }}>
                      {m.content}
                    </Text>
                  </View>
                  {m.role === "user" && (
                    <View className="w-6 h-6 rounded-full items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                      <User size={12} color="#C4DAC0" />
                    </View>
                  )}
                </View>
              </View>

              {m.purchaseProposal && (
                <View className="ml-8 rounded-2xl p-4" style={{ backgroundColor: "rgba(196,92,56,0.1)", borderWidth: 1, borderColor: "rgba(196,92,56,0.3)", gap: 8 }}>
                  <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                      {m.purchaseProposal.packageLabel}
                    </Text>
                    <Text className="text-sm font-sans-semibold" style={{ color: "#C45C38" }}>
                      KES {m.purchaseProposal.priceKes.toLocaleString()}
                    </Text>
                  </View>
                  <Text className="text-xs" style={{ color: "#AECAAE" }}>
                    M-Pesa prompt to +254 {m.purchaseProposal.phone}
                  </Text>
                  {m.purchaseProposal.confirmed ? (
                    <View className="flex-row items-center gap-1.5">
                      <CheckCircle2 size={13} color="#4E8050" />
                      <Text className="text-xs font-sans-semibold" style={{ color: "#4E8050" }}>
                        Prompt sent
                      </Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleConfirmPurchase(m.purchaseProposal!)}
                      disabled={confirmingToken === m.purchaseProposal.token}
                      className="py-2.5 rounded-xl items-center flex-row justify-center gap-2"
                      style={{ backgroundColor: "#C45C38", opacity: confirmingToken === m.purchaseProposal.token ? 0.7 : 1 }}
                    >
                      {confirmingToken === m.purchaseProposal.token ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text className="text-xs font-sans-semibold text-white">Confirm &amp; Pay</Text>
                      )}
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          ))}

          {sending && (
            <View className="flex-row items-center gap-2 ml-1">
              <ActivityIndicator size="small" color="#96B496" />
              <Text className="text-xs" style={{ color: "#96B496" }}>
                Thinking…
              </Text>
            </View>
          )}
        </ScrollView>

        <View className="flex-row items-center gap-2 px-4" style={{ paddingBottom: insets.bottom + 12, paddingTop: 8 }}>
          <View className="flex-1 flex-row items-center rounded-2xl px-4" style={{ backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="Ask the assistant…"
              placeholderTextColor="#6B8A6B"
              className="flex-1 py-3 text-sm"
              style={{ color: "#E8D4B0" }}
              onSubmitEditing={() => send(input)}
              returnKeyType="send"
              editable={!sending}
            />
          </View>
          <Pressable
            onPress={() => send(input)}
            disabled={sending || !input.trim()}
            className="w-11 h-11 rounded-full items-center justify-center"
            style={{ backgroundColor: "#C45C38", opacity: sending || !input.trim() ? 0.5 : 1 }}
          >
            <Send size={16} color="#fff" />
          </Pressable>
        </View>

        {messages.length === 0 && (
          <View className="flex-row items-center gap-1.5 px-4 justify-center" style={{ paddingBottom: insets.bottom + 8 }}>
            <AlertTriangle size={10} color="#6B8A6B" />
            <Text className="text-[10px]" style={{ color: "#6B8A6B" }}>
              Answers are grounded in your real session data — not guesses.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}
