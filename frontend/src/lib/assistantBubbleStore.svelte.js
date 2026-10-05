// Lets TimelineScreen.svelte (no prop/store currently exposes its local
// `viewingItem` state up to +page.svelte) tell the floating assistant
// bubble to hide itself during the Watch & Earn content viewer's
// full-screen takeover. Svelte 5's shared-reactive-state pattern: a
// module-level $state plus exported getter/setter functions — first
// `.svelte.js` module in this codebase, same role as the mobile app's
// assistantBubbleStore.ts (a plain external store there too, for the same
// reason: no shared parent between the two components involved).
let hidden = $state(false);

export function isAssistantBubbleHidden() {
  return hidden;
}

export function setAssistantBubbleHidden(next) {
  hidden = next;
}
