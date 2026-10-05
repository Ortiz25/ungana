// On-device chat history for the AI assistant. localStorage (survives tab
// close, unlike dashboardSession.js's sessionStorage — chat continuity is
// the point here) with the same try/catch-never-throws convention
// dashboardSession.js already uses. Mirrors the mobile app's
// assistantStorage.ts (AsyncStorage there — same role, platform's own
// local-storage primitive).
const STORAGE_KEY = 'ungana_assistant_chat';

/** { role: 'user'|'assistant', content, purchaseProposal? } */
export function loadAssistantChat() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAssistantChat(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // storage unavailable — the chat just won't survive a reload, no functional loss this turn
  }
}

/** The client-facing "Clear chat" action. */
export function clearAssistantChat() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing to clean up if storage was never reachable
  }
}
