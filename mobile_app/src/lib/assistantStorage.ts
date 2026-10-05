// On-device chat history for the AI assistant — AsyncStorage, not SQLite.
// Chosen over SQLite deliberately: this app already uses AsyncStorage for
// every other piece of local state (device.ts's mac/site/username,
// PackageScreen's dismissed-notices list), so a single JSON blob under one
// key stays consistent with that convention rather than introducing a new
// native dependency (expo-sqlite) and a schema/migration story for what's
// just an array of chat messages. If the history ever needs querying
// (search, multiple named conversations) SQLite would earn its place —
// not needed for a single running conversation.
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAT_KEY = "ungana_assistant_chat";

export type AssistantMessage = {
  role: "user" | "assistant";
  content: string;
  // Present only on an assistant message that proposed a purchase — lets
  // the chat re-render the Confirm & Pay card after an app restart instead
  // of just showing the prose. Cleared (not re-offered) once confirmed.
  purchaseProposal?: {
    token: string;
    packageId: string;
    packageLabel: string;
    priceKes: number;
    durationSecs: number;
    phone: string;
    confirmed: boolean;
  } | null;
};

export async function loadAssistantChat(): Promise<AssistantMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAssistantChat(messages: AssistantMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAT_KEY, JSON.stringify(messages));
  } catch {
    // storage unavailable — the chat just won't survive a restart, no functional loss this turn
  }
}

/** The client-facing "Clear chat" action, and also called on logout (see app/active.tsx's onLogout) — nothing assistant-related should outlive the device identity it was asked about. */
export async function clearAssistantChat(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAT_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}
