<script>
  // Institution-only Campus Events list — full-width cards, soonest-first
  // (see services/campusPosts.js's listActivePosts, which orders
  // type='event' posts by event_starts_at). Stacked vertically at full
  // width rather than a horizontal scroll strip, so it matches Exam
  // Timetable's full-width trigger card next to it. Uses the Campus tab's
  // dark green/gold palette. Uses its own lightweight detail sheet rather
  // than the shared AdminModal, since this is a client-facing screen, not
  // the admin dashboard.
  import { MapPin, CalendarDays, Clock, X } from '@lucide/svelte';

  let { posts = [] } = $props();

  let selected = $state(null);

  function dayNum(iso) {
    return new Date(iso).getDate();
  }
  function monthAbbrev(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short' });
  }
  function timeRange(startIso, endIso) {
    const opts = { hour: 'numeric', minute: '2-digit' };
    const start = new Date(startIso).toLocaleTimeString(undefined, opts);
    if (!endIso) return start;
    return `${start} – ${new Date(endIso).toLocaleTimeString(undefined, opts)}`;
  }

  // "Today" / "Tomorrow" / "in Nd" — read at a glance, matching how a
  // student actually thinks about an upcoming date rather than a raw one.
  function relativeLabel(iso) {
    const now = new Date();
    const target = new Date(iso);
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
    if (diffDays < 0) return 'Past';
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    return `in ${diffDays}d`;
  }
</script>

{#if posts.length > 0}
  <!-- With exactly one event (the common case), this stretches to match
       Exam Timetable's h-full sibling column instead of top-aligning with
       dead space below — with several events, natural stacking height is
       correct instead and this is skipped. -->
  <div class="flex flex-col gap-3" class:h-full={posts.length === 1}>
    {#each posts as post (post.id)}
      <button
        type="button"
        onclick={() => (selected = post)}
        class="event-trigger w-full text-left rounded-xl p-4 transition-all active:scale-[0.98]"
        class:h-full={posts.length === 1}
        style="background: #0b1e13; border: 1px solid #12301e;"
      >
        <div class="flex items-center gap-3" class:h-full={posts.length === 1}>
          <div class="flex flex-col items-center justify-center rounded-lg px-3 py-1.5 shrink-0" style="background: linear-gradient(135deg, #d4af6a, #8b6a35); min-width: 56px;">
            <span class="text-[10px] uppercase tracking-tight" style="color: #fdf6e3;">{monthAbbrev(post.event_starts_at)}</span>
            <span class="text-xl font-bold leading-none my-0.5" style="color: #fdf6e3;">{dayNum(post.event_starts_at)}</span>
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5" style="color: #9ca3af;">
              <CalendarDays size={10} />
              <span class="text-[11px]">{relativeLabel(post.event_starts_at)}</span>
            </div>
            <p class="text-sm font-bold leading-snug truncate mt-0.5" style="color: #f3f4f6;">{post.title}</p>
            {#if post.location}
              <div class="flex items-center gap-1 mt-1" style="color: #6b7280;">
                <MapPin size={10} class="shrink-0" />
                <span class="text-xs truncate">{post.location}</span>
              </div>
            {/if}
          </div>
        </div>
      </button>
    {/each}
  </div>
{/if}

{#if selected}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4" style="background: rgba(0,0,0,0.65);">
    <div class="w-full rounded-3xl shadow-2xl flex flex-col" style="background: #0b1e13; max-width: 480px; max-height: 90vh; border: 1px solid #12301e;">
      <div class="flex items-center justify-between px-5 py-4 shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <p class="text-sm font-bold" style="color: #f3f4f6;">Campus Event</p>
        <button
          onclick={() => (selected = null)}
          aria-label="Close"
          class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style="background: rgba(255,255,255,0.08);"
        >
          <X size={14} color="#9ca3af" />
        </button>
      </div>
      <div class="px-5 py-4 flex flex-col gap-3 overflow-y-auto">
        <div class="flex items-center gap-3">
          <div class="flex flex-col items-center justify-center rounded-lg px-3 py-2 shrink-0" style="background: #12301e; border: 1px solid #1c492e;">
            <span class="text-[10px] uppercase tracking-tight" style="color: #9ca3af;">{monthAbbrev(selected.event_starts_at)}</span>
            <span class="text-xl font-bold leading-none my-0.5" style="color: #c29d53;">{dayNum(selected.event_starts_at)}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-base font-bold leading-snug" style="color: #f3f4f6; font-family: 'Playfair Display', serif;">{selected.title}</p>
            {#if selected.category}<p class="text-[11px] mt-0.5" style="color: #9ca3af;">{selected.category}</p>{/if}
          </div>
        </div>
        <div class="flex items-center gap-1.5 text-[12px]" style="color: #d1d5db;">
          <Clock size={12} color="#9ca3af" />
          {timeRange(selected.event_starts_at, selected.event_ends_at)}
        </div>
        {#if selected.location}
          <div class="flex items-center gap-1.5 text-[12px]" style="color: #d1d5db;">
            <MapPin size={12} color="#9ca3af" />
            {selected.location}
          </div>
        {/if}
        {#if selected.body}
          <p class="text-[12.5px] leading-relaxed mt-1" style="color: #d1d5db;">{selected.body}</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .event-trigger:hover {
    border-color: #1c492e !important;
  }
</style>
