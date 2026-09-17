<script>
  // Institution-only Quick Links grid — `posts` are campus_posts rows with
  // type='resource', already pinned-first sorted by the backend (see
  // services/campusPosts.js's listActivePosts). A handful of services (the
  // common case today) renders as a plain grid, exactly like before this
  // component existed. Once a site has grown a real service directory
  // (library, helpdesk, fees, health, security, transport, housing,
  // careers, admissions, student affairs, ...) past VISIBLE_LIMIT tiles,
  // the grid caps itself and a "View all" trigger opens a searchable,
  // category-filterable modal — same scale pattern already established by
  // ExamTimetable/NoticeBoard, so Quick Links doesn't just get longer and
  // longer down the Campus feed as more services are added.
  import { Grid3x3, Search, X, ChevronRight } from '@lucide/svelte';
  import CampusResources from './CampusResources.svelte';
  import { matchResourceCategory } from '$lib/campusResourceCategories.js';

  let { posts = [] } = $props();

  const VISIBLE_LIMIT = 6;
  const overflow = $derived(Math.max(posts.length - (VISIBLE_LIMIT - 1), 0));
  const gridPosts = $derived(overflow > 0 ? posts.slice(0, VISIBLE_LIMIT - 1) : posts);

  let modalOpen = $state(false);
  let query = $state('');
  let activeCategory = $state('all');

  // Only categories actually present in `posts` — same "don't show filter
  // options for content that doesn't exist" rule as the top-level Campus
  // search's category pills.
  const presentCategories = $derived.by(() => {
    const seen = new Map();
    for (const post of posts) {
      const cat = matchResourceCategory(post.category, post.title);
      if (!seen.has(cat.id)) seen.set(cat.id, cat);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  });

  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeCategory !== 'all' && matchResourceCategory(post.category, post.title).id !== activeCategory) return false;
      if (!q) return true;
      return [post.title, post.category, post.body].some((f) => (f || '').toLowerCase().includes(q));
    });
  });

  function openModal() {
    modalOpen = true;
    query = '';
    activeCategory = 'all';
  }
  function closeModal() {
    modalOpen = false;
  }
  function handleKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }
</script>

<svelte:window onkeydown={modalOpen ? handleKeydown : undefined} />

<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
  {#each gridPosts as post (post.id)}
    <CampusResources {post} />
  {/each}
  {#if overflow > 0}
    <button
      type="button"
      onclick={openModal}
      class="more-tile rounded-xl p-4 flex items-center justify-between gap-3 transition-all text-left"
      style="background: #0b1e13; border: 1px dashed #2a5c3a;"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background: rgba(194,157,83,0.18);">
          <Grid3x3 size={15} color="#c29d53" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold leading-snug" style="color: #e5e7eb;">+{overflow} more</p>
          <p class="text-xs mt-0.5" style="color: #6b7280;">View all services</p>
        </div>
      </div>
      <ChevronRight size={13} color="#6b7280" class="shrink-0" />
    </button>
  {/if}
</div>

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
      style="background: #0b1e13; max-height: 85vh; border: 1px solid #12301e;"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: #c29d53;">Quick Links</p>
          <p class="text-[11px] mt-0.5" style="color: #9ca3af;">{filtered.length} of {posts.length} services</p>
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
        <div class="flex items-center gap-2 rounded-lg px-3.5 py-2.5 search-box" style="background: #0a1b11; border: 1px solid #163a23;">
          <Search size={14} color="#c29d53" class="shrink-0" />
          <input
            bind:value={query}
            type="text"
            placeholder="Search services…"
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

      {#if presentCategories.length > 1}
        <div class="flex gap-2 overflow-x-auto no-scrollbar px-5 pb-3 shrink-0">
          <button
            onclick={() => (activeCategory = 'all')}
            class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors"
            style={activeCategory === 'all'
              ? 'background: #c29d53; color: #0b1e13;'
              : 'background: #0a1b11; border: 1px solid #163a23; color: #9ca3af;'}
          >
            All
          </button>
          {#each presentCategories as cat (cat.id)}
            <button
              onclick={() => (activeCategory = cat.id)}
              class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-colors"
              style={activeCategory === cat.id
                ? `background: ${cat.color}; color: #fdf6e3;`
                : 'background: #0a1b11; border: 1px solid #163a23; color: #9ca3af;'}
            >
              {cat.label}
            </button>
          {/each}
        </div>
      {/if}

      <div class="px-5 pb-6 overflow-y-auto flex flex-col gap-2.5">
        {#if filtered.length === 0}
          <p class="text-sm text-center py-8" style="color: #9ca3af;">
            {query ? `No services match "${query}".` : 'Nothing in this category.'}
          </p>
        {:else}
          {#each filtered as post (post.id)}
            <CampusResources {post} />
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .more-tile:hover {
    border-color: #c29d53 !important;
  }
  .search-box:focus-within {
    border-color: #c29d53 !important;
  }
  .modal-pop {
    animation: quicklinks-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes quicklinks-modal-in {
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
