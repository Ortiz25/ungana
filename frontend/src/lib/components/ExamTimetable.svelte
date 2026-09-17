<script>
  // Institution-only Exam Timetable — `posts` are campus_posts rows with
  // type='timetable', already filtered to upcoming-only and sorted
  // chronologically by the caller (see TimelineScreen's
  // filteredUpcomingTimetable, and services/campusPosts.js's
  // listActivePosts, which treats 'timetable' like 'event' for sorting).
  // Structurally an exam slot reuses the same title/event_starts_at/location
  // fields an event does. Shown as a compact trigger card that previews the
  // soonest exam (matching CampusEventsStrip's date-block styling); tapping
  // it opens a full-screen search modal — a real timetable can easily hold
  // dozens of entries across an exam period, so browsing it inline would
  // dominate the whole tab, and even the modal groups entries by day (with
  // sticky day headers) rather than one long flat list, so it stays
  // scannable at any size. Uses the Campus tab's dark green/gold palette.
  import { MapPin, Search, X, CalendarDays, ChevronRight } from '@lucide/svelte';

  let { posts = [] } = $props();

  // Soonest exam — `posts` arrives pre-sorted, so this is just the first
  // entry. Drives the trigger card's preview; null only when there are no
  // upcoming exams at all, in which case the trigger doesn't render.
  const nextExam = $derived(posts[0] ?? null);
  const remainingCount = $derived(Math.max(posts.length - 1, 0));

  let modalOpen = $state(false);
  let query = $state('');
  let searchInput = $state(null);

  function dayNum(iso) {
    return new Date(iso).getDate();
  }
  function monthAbbrev(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short' });
  }
  function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  function fullDateLabel(iso) {
    return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  }
  // "Today" / "Tomorrow" / null (falls back to fullDateLabel) — read at a
  // glance, matching how a student actually thinks about an upcoming date
  // rather than a raw one. Same rule as CampusEventsStrip's relativeLabel.
  function relativeLabel(iso) {
    const now = new Date();
    const target = new Date(iso);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return null;
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

  // Sectioned by calendar day (in `filtered`'s existing chronological
  // order) so the modal reads like a day-by-day agenda instead of one flat
  // list — the difference that actually matters once an exam period has
  // dozens of entries. Each section gets a sticky header (see the modal
  // markup) as the anchor while scrolling.
  const groupedByDay = $derived.by(() => {
    const groups = [];
    const byKey = new Map();
    for (const post of filtered) {
      const key = new Date(post.event_starts_at).toDateString();
      let group = byKey.get(key);
      if (!group) {
        group = { key, iso: post.event_starts_at, items: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.items.push(post);
    }
    return groups;
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

{#if nextExam}
  <button
    type="button"
    onclick={openModal}
    class="exam-trigger w-full h-full rounded-xl p-4 flex flex-col gap-3 text-left transition-all active:scale-[0.98]"
    style="background: #0b1e13; border: 1px solid #12301e;"
  >
    <div class="flex items-center gap-3">
      <div class="flex flex-col items-center justify-center rounded-lg px-3 py-1.5 shrink-0" style="background: linear-gradient(135deg, #d4af6a, #8b6a35); min-width: 52px;">
        <span class="text-[9px] uppercase tracking-tight" style="color: #fdf6e3;">{monthAbbrev(nextExam.event_starts_at)}</span>
        <span class="text-lg font-bold leading-none my-0.5" style="color: #fdf6e3;">{dayNum(nextExam.event_starts_at)}</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-1.5" style="color: #9ca3af;">
          <CalendarDays size={10} />
          <span class="text-[11px]">{relativeLabel(nextExam.event_starts_at) ?? fullDateLabel(nextExam.event_starts_at)} · {timeLabel(nextExam.event_starts_at)}</span>
        </div>
        <p class="text-sm font-bold leading-snug truncate mt-0.5" style="color: #f3f4f6;">{nextExam.title}</p>
        {#if nextExam.location}
          <div class="flex items-center gap-1 mt-1" style="color: #6b7280;">
            <MapPin size={10} class="shrink-0" />
            <span class="text-xs truncate">{nextExam.location}</span>
          </div>
        {/if}
      </div>
      <ChevronRight size={13} color="#6b7280" class="shrink-0" />
    </div>
    <div class="flex items-center justify-between gap-2 pt-2.5" style="border-top: 1px solid rgba(255,255,255,0.06);">
      <span class="text-[11px] flex items-center gap-1" style="color: #6b7280;"><Search size={10} /> Tap to search the timetable</span>
      {#if remainingCount > 0}
        <span class="text-[11px] font-bold shrink-0" style="color: #c29d53;">+{remainingCount} more</span>
      {/if}
    </div>
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
          <p class="text-[11px] mt-0.5" style="color: #9ca3af;">{filtered.length} of {posts.length} upcoming exams</p>
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

      <div class="px-5 pb-6 overflow-y-auto flex flex-col">
        {#if filtered.length === 0}
          <p class="text-sm text-center py-8" style="color: #9ca3af;">No exams match "{query}".</p>
        {:else}
          {#each groupedByDay as group (group.key)}
            <!-- Sticky day header — the anchor that keeps a long, multi-day
                 exam period scannable instead of one undifferentiated list. -->
            <div class="day-header sticky top-0 z-10 flex items-center gap-2 pt-3 pb-2" style="background: #0b1e13;">
              <span class="text-[11px] font-bold uppercase tracking-wider shrink-0" style="color: {relativeLabel(group.iso) ? '#c29d53' : '#9ca3af'};">
                {relativeLabel(group.iso) ?? fullDateLabel(group.iso)}
              </span>
              {#if relativeLabel(group.iso)}
                <span class="text-[10px] shrink-0" style="color: #6b7280;">{fullDateLabel(group.iso)}</span>
              {/if}
              <span class="flex-1 h-px" style="background: rgba(255,255,255,0.08);"></span>
            </div>
            <div class="flex flex-col gap-2 pb-3">
              {#each group.items as post (post.id)}
                <div class="rounded-xl p-3.5 flex items-center justify-between gap-3" style="background: rgba(255,255,255,0.04);">
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
                  <span class="text-[11px] font-mono px-2.5 py-1.5 rounded-lg shrink-0" style="background: rgba(194,157,83,0.15); color: #c29d53;">
                    {timeLabel(post.event_starts_at)}
                  </span>
                </div>
              {/each}
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
