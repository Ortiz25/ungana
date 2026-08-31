<script>
  // Institution-only Exam Timetable — `posts` are campus_posts rows with
  // type='timetable', already sorted chronologically by the backend (see
  // services/campusPosts.js's listActivePosts, which treats 'timetable' like
  // 'event' for sorting). Structurally an exam slot reuses the same
  // title/event_starts_at/location fields an event does. Shown as a compact
  // trigger card in the Campus feed; tapping it opens a full-screen search
  // modal — a real timetable can easily hold dozens of entries, so browsing
  // it inline would dominate the whole tab. Uses the Campus tab's dark
  // green/gold palette.
  import { MapPin, Search, X, CalendarDays, ChevronRight, GraduationCap, BookOpen, FlaskConical } from '@lucide/svelte';

  let { posts = [] } = $props();

  // One small badge per scheduled exam (capped so the row never overflows a
  // narrow column) — a glance-able "how many" indicator that echoes
  // campus.png's colored subject-icon row. We don't have a real "subject"
  // field to draw distinct icons from, so this cycles a fixed icon/color
  // palette rather than inventing per-subject data.
  const BADGE_STYLES = [
    { icon: GraduationCap, color: '#c07a2e' },
    { icon: BookOpen, color: '#2d6fa3' },
    { icon: FlaskConical, color: '#6b4fa3' }
  ];
  const badges = $derived(posts.slice(0, 4).map((_, i) => BADGE_STYLES[i % BADGE_STYLES.length]));

  let modalOpen = $state(false);
  let query = $state('');
  let searchInput = $state(null);

  function dayAbbrev(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short' });
  }
  function dateShort(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  // Matches on course/unit title, program/session category, and venue — a
  // student might search "CS301", "Year 2", or "Hall B" just as naturally.
  const filtered = $derived.by(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      [p.title, p.category, p.location].some((field) => (field || '').toLowerCase().includes(q))
    );
  });

  function openModal() {
    modalOpen = true;
    query = '';
    // Autofocus needs the input to exist first — it doesn't until this
    // {#if modalOpen} block renders, one tick after this click handler runs.
    setTimeout(() => searchInput?.focus(), 0);
  }
  function closeModal() {
    modalOpen = false;
  }
  function handleKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }
</script>

<svelte:window onkeydown={modalOpen ? handleKeydown : undefined} />

{#if posts.length > 0}
  <button
    type="button"
    onclick={openModal}
    class="exam-trigger w-full h-full rounded-xl p-4 flex flex-col gap-3 text-left transition-all"
    style="background: #0b1e13; border: 1px solid #12301e;"
  >
    <div class="flex items-center justify-between gap-3">
      <div class="flex items-start gap-3 min-w-0">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style="background: linear-gradient(135deg, #d4af6a, #8b6a35);">
          <CalendarDays size={15} color="#fdf6e3" />
        </div>
        <div class="min-w-0">
          <p class="text-sm font-semibold" style="color: #e5e7eb;">{posts.length} exam{posts.length === 1 ? '' : 's'} scheduled</p>
          <p class="text-xs mt-0.5 flex items-center gap-1" style="color: #6b7280;"><Search size={10} /> Tap to search the timetable</p>
        </div>
      </div>
      <ChevronRight size={13} color="#6b7280" class="shrink-0" />
    </div>
    {#if badges.length > 0}
      <div class="flex items-center gap-1.5">
        {#each badges as b, i (i)}
          <div class="w-7 h-7 rounded-md flex items-center justify-center shrink-0" style="background: {b.color};">
            <svelte:component this={b.icon} size={13} color="#fdf6e3" />
          </div>
        {/each}
      </div>
    {/if}
  </button>
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
      style="background: #0b1e13; max-height: 85vh; border: 1px solid #12301e;"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: #c29d53;">Exam Timetable</p>
          <p class="text-[11px] mt-0.5" style="color: #9ca3af;">{filtered.length} of {posts.length} exams</p>
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
            bind:this={searchInput}
            bind:value={query}
            type="text"
            placeholder="Search course, program, or venue…"
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

      <div class="px-5 pb-6 overflow-y-auto flex flex-col gap-2.5">
        {#if filtered.length === 0}
          <p class="text-sm text-center py-8" style="color: #9ca3af;">No exams match "{query}".</p>
        {:else}
          {#each filtered as post (post.id)}
            <div class="rounded-xl p-4 flex items-center justify-between gap-3" style="background: rgba(255,255,255,0.04);">
              <div class="flex items-center gap-3 min-w-0">
                <div class="w-14 text-center py-2 rounded-lg shrink-0" style="background: #12301e; border: 1px solid #1c492e;">
                  <span class="block text-[9px] uppercase tracking-wider" style="color: #9ca3af;">{dayAbbrev(post.event_starts_at)}</span>
                  <span class="block text-sm font-bold" style="color: #c29d53;">{dateShort(post.event_starts_at)}</span>
                </div>
                <div class="min-w-0">
                  {#if post.category}
                    <p class="text-[9px] font-bold uppercase tracking-wider mb-0.5 truncate" style="color: #9ca3af;">{post.category}</p>
                  {/if}
                  <p class="text-sm font-semibold leading-snug truncate" style="color: #f3f4f6;">{post.title}</p>
                  {#if post.location}
                    <p class="text-[10px] flex items-center gap-1 mt-0.5" style="color: #6b7280;">
                      <MapPin size={9} />{post.location}
                    </p>
                  {/if}
                </div>
              </div>
              <span class="text-[11px] font-mono px-2.5 py-1.5 rounded-lg shrink-0" style="background: rgba(194,157,83,0.15); color: #c29d53;">
                {timeLabel(post.event_starts_at)}
              </span>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .exam-trigger:hover {
    border-color: #1c492e !important;
  }
  .search-box:focus-within {
    border-color: #c29d53 !important;
  }
  .modal-pop {
    animation: exam-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes exam-modal-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
</style>
