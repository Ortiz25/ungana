<script>
  // Floating entry point to the AI assistant — rendered once from
  // +page.svelte (outside the `{#if screen === ...}` chain so it persists
  // across screen switches), visible only on Packages/Timeline, only when
  // the current site has the assistant enabled, and hidden during the
  // Watch & Earn content viewer's full-screen takeover (see
  // assistantBubbleStore.svelte.js). Mirrors
  // mobile_app/src/components/AssistantBubble.tsx.
  import { Bot } from '@lucide/svelte';
  import { getSiteId } from '$lib/device.js';
  import { getSite } from '$lib/api.js';
  import { isAssistantBubbleHidden } from '$lib/assistantBubbleStore.svelte.js';

  let { screen, onOpen } = $props();

  const ALLOWED_SCREENS = new Set(['packages', 'timeline']);

  let assistantEnabled = $state(false);

  $effect(() => {
    const site = getSiteId();
    if (!site) return;
    getSite(site).then((result) => {
      if (result.ok && result.data?.site) assistantEnabled = !!result.data.site.assistantEnabled;
    });
  });

  const visible = $derived(assistantEnabled && ALLOWED_SCREENS.has(screen) && !isAssistantBubbleHidden());
</script>

{#if visible}
  <button
    type="button"
    onclick={onOpen}
    aria-label="Open assistant"
    class="fixed flex items-center justify-center rounded-full"
    style="right: 20px; bottom: 24px; width: 56px; height: 56px; background: #C45C38; box-shadow: 0 6px 20px rgba(0,0,0,0.3); z-index: 40; border: none; cursor: pointer;"
  >
    <span class="assistant-bubble-pulse" style="position: absolute; inset: 0; border-radius: 9999px; background: #C45C38;"></span>
    <Bot size={24} color="#fff" style="position: relative;" />
  </button>
{/if}

<style>
  .assistant-bubble-pulse {
    animation: assistant-bubble-pulse 1.8s ease-out infinite;
  }
  @keyframes assistant-bubble-pulse {
    0% {
      opacity: 0.45;
      transform: scale(1);
    }
    100% {
      opacity: 0;
      transform: scale(1.5);
    }
  }
</style>
