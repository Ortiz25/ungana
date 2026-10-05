// Lets WatchEarnContext (several route levels below the root layout, where
// the floating bubble actually lives — see components/AssistantBubble.tsx)
// tell the bubble to hide itself during the Watch & Earn content viewer's
// full-screen takeover, without wiring a context all the way up past
// /packages and /timeline (siblings with no shared provider between them).
// Same plain-external-state convention as device.ts's cached mac/site
// getters — a React Context would have to live above both routes to reach
// this, which is a bigger change than one boolean needs.
import { useSyncExternalStore } from "react";

let hidden = false;
const listeners = new Set<() => void>();

export function setAssistantBubbleHidden(next: boolean): void {
  if (next === hidden) return;
  hidden = next;
  listeners.forEach((l) => l());
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function useAssistantBubbleHidden(): boolean {
  return useSyncExternalStore(subscribe, () => hidden);
}
