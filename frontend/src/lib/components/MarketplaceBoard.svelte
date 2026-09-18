<script>
  // Community-only Marketplace — buy/sell/trade listings, `posts` are
  // community_posts rows with type='marketplace' (see
  // services/communityPosts.js's listActivePosts — pinned-first, then
  // newest). Same "grid for a few, searchable modal past a threshold"
  // scale pattern as QuickLinksBoard, since a real marketplace easily grows
  // past a handful of listings. Tapping a listing opens a detail sheet with
  // the full photo/description/price/condition and a "Contact Seller"
  // button (opens WhatsApp via metadata.contactPhone) — that tap also
  // records a click (see api.js's recordCommunityPostClick), same signal
  // Quick Links tiles already give admins.
  import { ShoppingBag, Search, X, MessageCircle } from '@lucide/svelte';
  import { recordCommunityPostClick } from '$lib/api.js';

  // Matches Campus's own palette — TimelineScreen always passes its own
  // COMMUNITY_THEME (which carries the same colors), so this only matters
  // if this component is ever used without that.
  const DEFAULT_THEME = {
    bg: '#0b1e13',
    bgAlt: '#0a1b11',
    border: '#12301e',
    accent: '#c29d53',
    accentSoft: 'rgba(194,157,83,0.18)',
    featured: '#d4af6a'
  };

  let { posts = [], theme = DEFAULT_THEME } = $props();

  const VISIBLE_LIMIT = 6;
  const overflow = $derived(Math.max(posts.length - (VISIBLE_LIMIT - 1), 0));
  const gridPosts = $derived(overflow > 0 ? posts.slice(0, VISIBLE_LIMIT - 1) : posts);

  let modalOpen = $state(false);
  let query = $state('');
  let selected = $state(null);

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => [p.title, p.category, p.body].some((f) => (f || '').toLowerCase().includes(q)));
  });

  function openModal() {
    modalOpen = true;
    query = '';
  }
  function closeModal() {
    modalOpen = false;
  }
  function openListing(post) {
    selected = post;
  }
  function closeListing() {
    selected = null;
  }
  function handleKeydown(e) {
    if (e.key !== 'Escape') return;
    if (selected) closeListing();
    else if (modalOpen) closeModal();
  }

  function formatPrice(priceKes) {
    const n = Number(priceKes);
    return Number.isFinite(n) ? `KES ${n.toLocaleString()}` : null;
  }

  const CONDITION_LABEL = { new: 'New', like_new: 'Like new', used: 'Used' };

  // Builds a wa.me link from a local Kenyan number (0712... -> 254712...) —
  // same phone-normalisation convention as the rest of the app (see
  // ActiveScreen's "+254 {phone}" readout). Falls back to null (button
  // hidden) if no contact was set.
  function whatsAppLink(post) {
    const phone = post.metadata?.contactPhone;
    if (!phone) return null;
    const digits = String(phone).replace(/\D/g, '');
    const normalized = digits.startsWith('254') ? digits : `254${digits.replace(/^0/, '')}`;
    return `https://wa.me/${normalized}`;
  }

  function handleContactClick(post) {
    recordCommunityPostClick(post.id);
  }
</script>

<svelte:window onkeydown={modalOpen || selected ? handleKeydown : undefined} />

{#if posts.length > 0}
  <div class="grid grid-cols-3 md:grid-cols-4 gap-2.5">
    {#each gridPosts as post (post.id)}
      {@const price = formatPrice(post.price_kes)}
      <button
        type="button"
        onclick={() => openListing(post)}
        class="listing-tile rounded-xl overflow-hidden text-left transition-all active:scale-[0.98] relative"
        style="background: {theme.bg}; border: 1px solid {post.is_pinned ? theme.featured : theme.border}; --mb-hover: {theme.accent};"
      >
        <div class="relative" style="aspect-ratio: 16 / 9; background: {theme.bgAlt};">
          {#if post.attachment_url}
            <img src={post.attachment_url} alt="" class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full flex items-center justify-center">
              <ShoppingBag size={16} color={theme.border} />
            </div>
          {/if}
          {#if price}
            <span class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style="background: rgba(0,0,0,0.65); color: {theme.accent};">
              {price}
            </span>
          {/if}
        </div>
        <div class="p-2">
          <p class="text-[11px] font-semibold leading-snug truncate" style="color: #e5e7eb;">{post.title}</p>
          {#if post.metadata?.condition}
            <p class="text-[9px] mt-0.5" style="color: #6b7280;">{CONDITION_LABEL[post.metadata.condition] ?? post.metadata.condition}</p>
          {/if}
        </div>
      </button>
    {/each}
    {#if overflow > 0}
      <button
        type="button"
        onclick={openModal}
        class="more-tile rounded-xl flex flex-col items-center justify-center gap-1.5 text-center transition-all p-3"
        style="background: {theme.bgAlt}; border: 1px dashed {theme.border}; --mb-hover: {theme.accent};"
      >
        <ShoppingBag size={16} color={theme.accent} />
        <p class="text-xs font-bold" style="color: #e5e7eb;">+{overflow} more</p>
      </button>
    {/if}
  </div>
{/if}

{#if modalOpen}
  <div
    class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
    style="background: rgba(0,0,0,0.65);"
    onclick={closeModal}
    role="presentation"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-pop w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col"
      style="background: {theme.bg}; max-height: 85vh; border: 1px solid {theme.border};"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: {theme.accent};">Marketplace</p>
          <p class="text-[11px] mt-0.5" style="color: #9ca3af;">{filtered.length} of {posts.length} listings</p>
        </div>
        <button
          onclick={closeModal}
          aria-label="Close"
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style="background: rgba(255,255,255,0.08);"
        >
          <X size={14} color="#9ca3af" />
        </button>
      </div>

      <div class="px-5 pb-3 shrink-0">
        <div class="flex items-center gap-2 rounded-lg px-3.5 py-2.5 search-box" style="background: {theme.bgAlt}; border: 1px solid {theme.border}; --mb-hover: {theme.accent};">
          <Search size={14} color={theme.accent} class="shrink-0" />
          <input
            bind:value={query}
            type="text"
            placeholder="Search listings…"
            class="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder-[#6b7280]"
            style="color: #e5e7eb;"
          />
          {#if query}
            <button onclick={() => (query = '')} aria-label="Clear search" class="shrink-0">
              <X size={13} color="#9ca3af" />
            </button>
          {/if}
        </div>
      </div>

      <div class="px-5 pb-6 overflow-y-auto grid grid-cols-3 gap-2.5">
        {#if filtered.length === 0}
          <p class="col-span-3 text-sm text-center py-8" style="color: #9ca3af;">
            {query ? `No listings match "${query}".` : 'Nothing listed yet.'}
          </p>
        {:else}
          {#each filtered as post (post.id)}
            {@const price = formatPrice(post.price_kes)}
            <button
              type="button"
              onclick={() => openListing(post)}
              class="listing-tile rounded-xl overflow-hidden text-left transition-all active:scale-[0.98]"
              style="background: {theme.bgAlt}; border: 1px solid {post.is_pinned ? theme.featured : theme.border}; --mb-hover: {theme.accent};"
            >
              <div class="relative" style="aspect-ratio: 16 / 9; background: {theme.bg};">
                {#if post.attachment_url}
                  <img src={post.attachment_url} alt="" class="w-full h-full object-cover" />
                {:else}
                  <div class="w-full h-full flex items-center justify-center">
                    <ShoppingBag size={16} color={theme.border} />
                  </div>
                {/if}
                {#if price}
                  <span class="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold" style="background: rgba(0,0,0,0.65); color: {theme.accent};">
                    {price}
                  </span>
                {/if}
              </div>
              <div class="p-2">
                <p class="text-[11px] font-semibold leading-snug truncate" style="color: #e5e7eb;">{post.title}</p>
              </div>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if selected}
  {@const price = formatPrice(selected.price_kes)}
  {@const contactUrl = whatsAppLink(selected)}
  <div
    class="fixed inset-0 z-[110] flex items-end sm:items-center justify-center"
    style="background: rgba(0,0,0,0.75);"
    onclick={closeListing}
    role="presentation"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-pop w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      style="background: {theme.bg}; max-height: 90vh; border: 1px solid {theme.border};"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="relative shrink-0" style="aspect-ratio: 16 / 9; background: {theme.bgAlt};">
        {#if selected.attachment_url}
          <img src={selected.attachment_url} alt="" class="w-full h-full object-cover" />
        {:else}
          <div class="w-full h-full flex items-center justify-center">
            <ShoppingBag size={28} color={theme.border} />
          </div>
        {/if}
        <button
          onclick={closeListing}
          aria-label="Close"
          class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style="background: rgba(0,0,0,0.55);"
        >
          <X size={14} color="#fff" />
        </button>
        {#if price}
          <span class="absolute bottom-3 left-3 px-3 py-1.5 rounded-full text-sm font-bold" style="background: rgba(0,0,0,0.65); color: {theme.accent};">
            {price}
          </span>
        {/if}
      </div>

      <div class="px-5 py-4 overflow-y-auto flex flex-col gap-2.5">
        {#if selected.category}
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: {theme.accent};">{selected.category}</p>
        {/if}
        <h3 class="text-lg font-bold leading-snug" style="color: #f3f4f6;">{selected.title}</h3>
        {#if selected.metadata?.condition}
          <p class="text-xs" style="color: #9ca3af;">Condition: {CONDITION_LABEL[selected.metadata.condition] ?? selected.metadata.condition}</p>
        {/if}
        {#if selected.body}
          <p class="text-[12.5px] leading-relaxed mt-1" style="color: #d1d5db;">{selected.body}</p>
        {/if}
        {#if contactUrl}
          <a
            href={contactUrl}
            target="_blank"
            rel="noopener noreferrer"
            onclick={() => handleContactClick(selected)}
            class="mt-2 w-full py-3 rounded-2xl font-bold text-sm text-center flex items-center justify-center gap-2"
            style="background: linear-gradient(135deg, {theme.accent}, {theme.featured}); color: #0b1120;"
          >
            <MessageCircle size={15} /> Contact Seller
          </a>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .listing-tile:hover,
  .more-tile:hover {
    border-color: var(--mb-hover, #22d3ee) !important;
  }
  .search-box:focus-within {
    border-color: var(--mb-hover, #22d3ee) !important;
  }
  .modal-pop {
    animation: marketplace-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes marketplace-modal-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .modal-pop {
      animation: none;
    }
  }
</style>
