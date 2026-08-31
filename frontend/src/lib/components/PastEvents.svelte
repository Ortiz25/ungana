<script>
  // Institution-only Past Events — campus_posts rows of type='event' whose
  // date has already passed (TimelineScreen splits campus_posts into
  // upcoming, shown in CampusEventsStrip, vs past, shown here — see its
  // filteredPastEvents/filteredUpcomingEvents). Deliberately mirrors the
  // Watch tab's "News & Stories" strip (horizontal photo cards, most-recent
  // first) rather than Campus's other trigger-card+modal components, since
  // this is a browsable memory/highlights feed, not a single actionable
  // item. Tapping a card opens a detail sheet with a photo carousel —
  // attachment_url is the cover photo (also the card's own background);
  // images (jsonb array, set in the admin Campus post form) holds any
  // additional gallery photos.
  import { X, ChevronLeft, ChevronRight, MapPin, CalendarDays, Images } from '@lucide/svelte';

  let { posts = [] } = $props();

  let selected = $state(null);
  let photoIndex = $state(0);

  function open(post) {
    selected = post;
    photoIndex = 0;
  }
  function close() {
    selected = null;
  }
  function handleKeydown(e) {
    if (!selected) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') nextPhoto();
    else if (e.key === 'ArrowLeft') prevPhoto();
  }

  function dayNum(iso) {
    return new Date(iso).getDate();
  }
  function monthAbbrev(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short' });
  }
  function fullDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }

  // Cover photo first, then the gallery — a post with no photos at all
  // still opens fine (the carousel area just shows a placeholder icon).
  const photos = $derived(
    selected ? [selected.attachment_url, ...(selected.images ?? [])].filter(Boolean) : []
  );
  function nextPhoto() {
    photoIndex = (photoIndex + 1) % photos.length;
  }
  function prevPhoto() {
    photoIndex = (photoIndex - 1 + photos.length) % photos.length;
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if posts.length > 0}
  <div class="pt-2 pb-2">
    <div class="flex items-center justify-between px-4 mb-3">
      <h3 class="text-sm font-bold" style="color: #f3f4f6;">Past Events</h3>
    </div>
    <div class="flex gap-3 px-4 overflow-x-auto pb-2 no-scrollbar">
      {#each posts as post (post.id)}
        {@const galleryCount = (post.images?.length ?? 0) + (post.attachment_url ? 1 : 0)}
        <button
          type="button"
          onclick={() => open(post)}
          class="past-event-card shrink-0 rounded-2xl overflow-hidden relative text-left active:scale-95 transition-transform"
          style="width: 158px; height: 128px;"
        >
          {#if post.attachment_url}
            <img src={post.attachment_url} alt="" class="w-full h-full object-cover" />
          {:else}
            <div class="w-full h-full flex items-center justify-center" style="background: linear-gradient(135deg, #12301e, #0b1e13);">
              <CalendarDays size={22} color="#3a5240" />
            </div>
          {/if}
          <div class="absolute inset-0" style="background: linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.1) 55%, transparent 100%);"></div>

          <div class="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wide" style="background: rgba(0,0,0,0.55); color: #c29d53;">
            {monthAbbrev(post.event_starts_at)} {dayNum(post.event_starts_at)}
          </div>
          {#if galleryCount > 1}
            <div class="absolute top-2.5 right-2.5 flex items-center gap-0.5 px-1.5 py-1 rounded-lg" style="background: rgba(0,0,0,0.55);">
              <Images size={9} color="#fff" />
              <span class="text-[9px] font-bold text-white">{galleryCount}</span>
            </div>
          {/if}

          <div class="absolute bottom-0 left-0 right-0 p-2.5">
            {#if post.location}
              <p class="text-[9px] font-semibold mb-0.5 flex items-center gap-1" style="color: #C4DAC0;">
                <MapPin size={8} class="shrink-0" />
                <span class="truncate">{post.location}</span>
              </p>
            {/if}
            <p class="text-xs font-bold text-white leading-tight line-clamp-2">{post.title}</p>
          </div>
        </button>
      {/each}
    </div>
  </div>
{/if}

{#if selected}
  <div
    class="fixed inset-0 z-[100] flex items-end sm:items-center justify-center"
    style="background: rgba(0,0,0,0.75);"
    onclick={close}
    role="presentation"
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="modal-pop w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
      style="background: #0b1e13; max-height: 90vh; border: 1px solid #12301e;"
      onclick={(e) => e.stopPropagation()}
    >
      <!-- Photo carousel -->
      <div class="relative shrink-0" style="aspect-ratio: 4 / 3; background: #05140b;">
        {#if photos.length > 0}
          {#key photoIndex}
            <img src={photos[photoIndex]} alt="" class="carousel-photo w-full h-full object-cover" />
          {/key}
          {#if photos.length > 1}
            <button
              onclick={prevPhoto}
              aria-label="Previous photo"
              class="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
              style="background: rgba(0,0,0,0.5);"
            >
              <ChevronLeft size={16} color="#fff" />
            </button>
            <button
              onclick={nextPhoto}
              aria-label="Next photo"
              class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center"
              style="background: rgba(0,0,0,0.5);"
            >
              <ChevronRight size={16} color="#fff" />
            </button>
            <div class="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5">
              {#each photos as _, i (i)}
                <span
                  class="rounded-full transition-all"
                  style="width: {i === photoIndex ? '14px' : '5px'}; height: 5px; background: {i === photoIndex ? '#c29d53' : 'rgba(255,255,255,0.4)'};"
                ></span>
              {/each}
            </div>
          {/if}
        {:else}
          <div class="w-full h-full flex items-center justify-center">
            <CalendarDays size={32} color="#3a5240" />
          </div>
        {/if}
        <button
          onclick={close}
          aria-label="Close"
          class="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
          style="background: rgba(0,0,0,0.55);"
        >
          <X size={14} color="#fff" />
        </button>
      </div>

      <div class="px-5 py-4 overflow-y-auto flex flex-col gap-2">
        <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: #c29d53;">{fullDate(selected.event_starts_at)}</p>
        <h3 class="text-lg font-bold leading-snug" style="color: #f3f4f6; font-family: 'Playfair Display', serif;">{selected.title}</h3>
        {#if selected.location}
          <div class="flex items-center gap-1.5 text-[12px]" style="color: #9ca3af;">
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
  .past-event-card:active {
    filter: brightness(0.95);
  }
  .modal-pop {
    animation: past-event-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .carousel-photo {
    animation: past-event-photo-fade 0.2s ease-out;
  }
  @keyframes past-event-modal-in {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes past-event-photo-fade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
