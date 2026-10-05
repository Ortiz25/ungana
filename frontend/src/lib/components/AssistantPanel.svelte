<script>
  // The AI assistant chat — a modal, not a route/screen, so opening it never
  // disturbs +page.svelte's own `screen` state (Packages/Timeline/Active
  // stay exactly where they were underneath). Bottom-sheet on mobile /
  // centered dialog on desktop — same responsive pattern AdminModal.svelte
  // and TimelineScreen's earned-balance modal already use (items-end
  // sm:items-center, rounded-t-3xl sm:rounded-3xl), not a new overlay
  // style. Opened via AssistantBubble (Packages/Timeline) or ActiveScreen's
  // own Support button. Grounded entirely server-side
  // (backend/src/services/assistant/) — this component only renders turns
  // and, when one proposed a purchase, a Confirm & Pay card built from the
  // tool's real structured output, never from the assistant's prose.
  import { X, Send, Trash2, Bot, User, CheckCircle2, AlertTriangle } from '@lucide/svelte';
  import { sendAssistantMessage, confirmAssistantPurchase, findPurchaseProposal } from '$lib/assistantApi.js';
  import { loadAssistantChat, saveAssistantChat, clearAssistantChat } from '$lib/assistantChatStorage.js';
  import { getClientMac, getSiteId } from '$lib/device.js';

  let { onClose, onPurchaseConfirmed } = $props();

  const SUGGESTED_PROMPTS = ['Check my session', 'How do I earn minutes?', 'Talk to a human'];

  let messages = $state(loadAssistantChat());
  let input = $state('');
  let sending = $state(false);
  let confirmingToken = $state(null);
  let scrollEl = $state(null);

  $effect(() => {
    saveAssistantChat(messages);
  });

  function scrollToEnd() {
    requestAnimationFrame(() => {
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    });
  }

  async function send(text) {
    const trimmed = (text ?? input).trim();
    if (!trimmed || sending) return;
    input = '';
    messages = [...messages, { role: 'user', content: trimmed }];
    sending = true;
    scrollToEnd();

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const result = await sendAssistantMessage(history, getClientMac(), getSiteId());
    sending = false;

    if (!result.ok || !result.data) {
      messages = [...messages, { role: 'assistant', content: "Sorry, I couldn't reach the assistant — try again in a moment." }];
      scrollToEnd();
      return;
    }

    const proposal = findPurchaseProposal(result.data.toolResults);
    messages = [
      ...messages,
      {
        role: 'assistant',
        content: result.data.text || '…',
        purchaseProposal: proposal
          ? {
              token: proposal.token,
              packageId: proposal.packageId,
              packageLabel: proposal.packageLabel,
              priceKes: proposal.priceKes,
              durationSecs: proposal.durationSecs,
              phone: proposal.phone,
              confirmed: false
            }
          : null
      }
    ];
    scrollToEnd();
  }

  async function handleConfirmPurchase(proposal) {
    confirmingToken = proposal.token;
    const result = await confirmAssistantPurchase(proposal.token);
    confirmingToken = null;

    messages = messages.map((m) => (m.purchaseProposal?.token === proposal.token ? { ...m, purchaseProposal: { ...m.purchaseProposal, confirmed: true } } : m));

    if (result.ok && result.data?.success && result.data.reference) {
      // Same handoff PaymentScreen's onPay does — 'initiated' (shows the
      // "check your phone" messaging) -> 'connecting', which polls
      // GET /verify-payment/:reference the normal way. Closing this modal is
      // the caller's job (+page.svelte switches `screen`, which naturally
      // unmounts the modal's host). Only ever reached after a real confirmed
      // charge (see handleConfirmPurchase above) — never on its own.
      onPurchaseConfirmed({
        phone: proposal.phone,
        reference: result.data.reference,
        packageId: proposal.packageId,
        packageLabel: proposal.packageLabel,
        priceKes: proposal.priceKes,
        durationSecs: proposal.durationSecs
      });
      return;
    }

    messages = [...messages, { role: 'assistant', content: result.data?.message || "Couldn't start that payment — try again or buy from the Packages screen." }];
    scrollToEnd();
  }

  function handleClearChat() {
    if (!confirm("Clear this chat? It isn't saved anywhere else.")) return;
    clearAssistantChat();
    messages = [];
  }

  function handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }
</script>

<div
  class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
  style="background: rgba(0,0,0,0.6);"
  onclick={onClose}
  role="presentation"
>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    onclick={(e) => e.stopPropagation()}
    role="presentation"
    class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
    style="background: #1D3C2A; height: min(85vh, 640px); border: 1px solid rgba(196,92,56,0.2);"
  >
    <div class="flex items-center px-4 py-3.5 shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.22);">
          <Bot size={14} color="#C45C38" />
        </div>
        <p class="text-sm font-bold" style="color: #E8D4B0;">Assistant</p>
      </div>
      {#if messages.length > 0}
        <button onclick={handleClearChat} aria-label="Clear chat" class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 mr-1" style="background: rgba(255,255,255,0.08);">
          <Trash2 size={13} color="#C4DAC0" />
        </button>
      {/if}
      <button onclick={onClose} aria-label="Close" class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.08);">
        <X size={14} color="#C4DAC0" />
      </button>
    </div>

    <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-4 flex flex-col" style="gap: 12px;">
      {#if messages.length === 0}
        <div class="flex-1 flex flex-col items-center justify-center" style="gap: 16px;">
          <div class="w-14 h-14 rounded-2xl flex items-center justify-center" style="background: rgba(196,92,56,0.18);">
            <Bot size={26} color="#C45C38" />
          </div>
          <p class="text-sm text-center px-6" style="color: #C4DAC0;">Ask about your session, packages, or how Watch &amp; Earn works.</p>
          <div class="flex flex-wrap justify-center gap-2">
            {#each SUGGESTED_PROMPTS as p (p)}
              <button onclick={() => send(p)} class="px-3 py-2 rounded-full text-xs font-semibold" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #E8D4B0;">
                {p}
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each messages as m, i (i)}
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <div class="flex {m.role === 'user' ? 'justify-end' : 'justify-start'}">
            <div class="flex items-end gap-1.5" style="max-width: 85%;">
              {#if m.role === 'assistant'}
                <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.22);">
                  <Bot size={12} color="#C45C38" />
                </div>
              {/if}
              <div
                class="px-4 py-2.5 rounded-2xl text-sm"
                style="background: {m.role === 'user' ? '#C45C38' : 'rgba(255,255,255,0.08)'}; color: {m.role === 'user' ? '#fff' : '#E8D4B0'}; {m.role === 'assistant' ? 'border: 1px solid rgba(255,255,255,0.1);' : ''}"
              >
                {m.content}
              </div>
              {#if m.role === 'user'}
                <div class="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.1);">
                  <User size={12} color="#C4DAC0" />
                </div>
              {/if}
            </div>
          </div>

          {#if m.purchaseProposal}
            <div class="ml-8 rounded-2xl p-4 flex flex-col" style="background: rgba(196,92,56,0.1); border: 1px solid rgba(196,92,56,0.3); gap: 8px;">
              <div class="flex items-center justify-between">
                <p class="text-sm font-semibold" style="color: #E8D4B0;">{m.purchaseProposal.packageLabel}</p>
                <p class="text-sm font-semibold" style="color: #C45C38;">KES {m.purchaseProposal.priceKes.toLocaleString()}</p>
              </div>
              <p class="text-xs" style="color: #AECAAE;">M-Pesa prompt to +254 {m.purchaseProposal.phone}</p>
              {#if m.purchaseProposal.confirmed}
                <div class="flex items-center gap-1.5">
                  <CheckCircle2 size={13} color="#4E8050" />
                  <p class="text-xs font-semibold" style="color: #4E8050;">Prompt sent</p>
                </div>
              {:else}
                <button
                  onclick={() => handleConfirmPurchase(m.purchaseProposal)}
                  disabled={confirmingToken === m.purchaseProposal.token}
                  class="py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold text-white"
                  style="background: #C45C38; opacity: {confirmingToken === m.purchaseProposal.token ? 0.7 : 1};"
                >
                  {confirmingToken === m.purchaseProposal.token ? 'Sending…' : 'Confirm & Pay'}
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}

      {#if sending}
        <div class="flex items-center gap-2 ml-1">
          <div class="w-3.5 h-3.5 rounded-full border-2 animate-spin" style="border-color: rgba(150,180,150,0.3); border-top-color: #96B496;"></div>
          <p class="text-xs" style="color: #96B496;">Thinking…</p>
        </div>
      {/if}
    </div>

    <div class="shrink-0 px-4 py-3" style="border-top: 1px solid rgba(255,255,255,0.08);">
      <div class="flex items-center gap-2">
        <div class="flex-1 rounded-2xl px-4" style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);">
          <input
            type="text"
            bind:value={input}
            onkeydown={handleKeydown}
            placeholder="Ask the assistant…"
            disabled={sending}
            class="w-full py-3 text-sm bg-transparent outline-none"
            style="color: #E8D4B0;"
          />
        </div>
        <button
          onclick={() => send(input)}
          disabled={sending || !input.trim()}
          aria-label="Send"
          class="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style="background: #C45C38; opacity: {sending || !input.trim() ? 0.5 : 1}; border: none;"
        >
          <Send size={16} color="#fff" />
        </button>
      </div>
      {#if messages.length === 0}
        <div class="flex items-center justify-center gap-1.5 mt-2">
          <AlertTriangle size={10} color="#6B8A6B" />
          <p class="text-[10px]" style="color: #6B8A6B;">Answers are grounded in your real session data — not guesses.</p>
        </div>
      {/if}
    </div>
  </div>
</div>
