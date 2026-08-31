<script>
  // Institution-only Notice Board — notices + official releases (exam
  // results, fee deadlines, circulars) for a site with vertical =
  // 'institution'. `posts` is already scoped/sorted by the backend
  // (GET /api/campus/posts — pinned first, then newest; see
  // services/campusPosts.js's listActivePosts). Shown as a featured,
  // centered trigger card (with an overlapping pin icon) in the Campus
  // feed's Quick Links row; tapping it opens a modal with the full
  // scrollable, interactive list. Uses the Campus tab's dark green/gold
  // palette throughout.
  import { onMount } from 'svelte';
  import { Pin, FileText, Megaphone, ExternalLink, ChevronDown, X } from '@lucide/svelte';

  let { posts = [] } = $props();

  let modalOpen = $state(false);
  let expandedId = $state(null);

  // static/pin.webp is a stock photo flattened onto a plain white square
  // (with a faint diagonal watermark baked into that white), not a real
  // cutout. A flat brightness threshold left watermark speckle behind and
  // risked eating the pin's own specular highlights (which are near-white
  // too). Flood-filling inward from the canvas border instead only erases
  // the region that's actually *connected* to the background — it walks
  // through the watermark fine (still near-white, low-saturation) but
  // stops at the pin's silhouette (dark metal needle / saturated yellow),
  // so highlights fully enclosed by the pin survive untouched.
  let pinSrc = $state('/pin.webp');
  onMount(() => {
    const img = new Image();
    img.src = '/pin.webp';
    img.onload = () => {
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const frame = ctx.getImageData(0, 0, w, h);
      const px = frame.data;
      const visited = new Uint8Array(w * h);
      const stack = [];
      for (let x = 0; x < w; x++) {
        stack.push(x, x + (h - 1) * w);
      }
      for (let y = 0; y < h; y++) {
        stack.push(y * w, y * w + (w - 1));
      }
      while (stack.length) {
        const i = stack.pop();
        if (visited[i]) continue;
        visited[i] = 1;
        const o = i * 4;
        const r = px[o], g = px[o + 1], b = px[o + 2];
        const brightness = (r + g + b) / 3;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        if (brightness < 165 || saturation > 60) continue;
        px[o + 3] = 0;
        const x = i % w;
        const y = (i - x) / w;
        if (x > 0) stack.push(i - 1);
        if (x < w - 1) stack.push(i + 1);
        if (y > 0) stack.push(i - w);
        if (y < h - 1) stack.push(i + w);
      }
      ctx.putImageData(frame, 0, 0);
      pinSrc = canvas.toDataURL('image/png');
    };
  });

  function toggle(id) {
    expandedId = expandedId === id ? null : id;
  }
  function openModal() {
    modalOpen = true;
    expandedId = null;
  }
  function closeModal() {
    modalOpen = false;
  }
  function handleKeydown(e) {
    if (e.key === 'Escape') closeModal();
  }

  const PRIORITY_COLOR = {
    urgent: '#C45C38',
    important: '#c29d53',
    normal: '#5b6b60'
  };
  const TYPE_LABEL = { notice: 'Notice', release: 'Release' };

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // The top (pinned/newest) notice previews on the trigger card — posts is
  // already sorted pinned-first by the backend.
  const topPost = $derived(posts[0]);
</script>

<svelte:window onkeydown={modalOpen ? handleKeydown : undefined} />

{#if posts.length > 0}
  <div class="relative w-full">
    <p class="text-xs font-semibold uppercase tracking-wider mb-4 text-center" style="color: #9ca3af;">Notice Board</p>
    <div class="relative">
      <!-- Real pushpin photo (frontend/static/pin.webp) rather than a
           drawn icon/SVG, centered above the card like the earlier
           hand-drawn pins. pinSrc is the flood-fill cutout built in
           onMount (see script) — mix-blend-mode alone crushed the yellow
           to near-black against this dark card, so this needs a real
           cutout rather than a blend trick. -->
      <img
        src={pinSrc}
        alt=""
        aria-hidden="true"
        class="absolute -top-5 left-1/2 z-20 -translate-x-1/2 pointer-events-none select-none"
        style="width: 44px; height: auto; filter: drop-shadow(0 4px 5px rgba(0,0,0,0.45));"
      />
      <button
        type="button"
        onclick={openModal}
        class="w-full text-center rounded-xl pt-8 px-5 pb-5 transition-all active:scale-[0.99] flex flex-col justify-center"
        style="background: #0d2317; border: 1px solid #1c472e; box-shadow: 0 10px 30px rgba(0,0,0,0.35); min-height: 104px;"
      >
        <div class="flex items-center justify-center gap-1.5">
          {#if topPost?.priority === 'urgent'}
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: #C45C38;"></span>
          {/if}
          <h3 class="text-sm font-bold" style="color: #f3f4f6;">{posts.length} notice{posts.length === 1 ? '' : 's'}:</h3>
        </div>
        <p class="text-xs mt-1" style="color: #9ca3af;">{topPost?.title}</p>
      </button>
    </div>
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
      style="background: #0b1e13; max-height: 85vh; border: 1px solid #12301e;"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex items-center justify-between px-5 pt-5 pb-3 shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.2em]" style="color: #c29d53;">Notice Board</p>
          <p class="text-[11px] mt-0.5" style="color: #9ca3af;">{posts.length} notice{posts.length === 1 ? '' : 's'}</p>
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

      <div class="px-5 py-4 overflow-y-auto flex flex-col gap-2.5">
        {#each posts as post (post.id)}
          {@const color = PRIORITY_COLOR[post.priority] ?? PRIORITY_COLOR.normal}
          {@const open = expandedId === post.id}
          <button
            type="button"
            onclick={() => toggle(post.id)}
            class="text-left rounded-xl overflow-hidden transition-transform active:scale-[0.99]"
            style="background: rgba(255,255,255,0.04); border-left: 3px solid {color};"
          >
            <div class="flex items-start gap-3 px-4 py-3.5">
              <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style="background: {color}30;">
                <Megaphone size={14} color={color} />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5 flex-wrap mb-1">
                  <span class="text-[9px] font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded" style="background: {color}25; color: {color};">
                    {TYPE_LABEL[post.type] ?? post.type}
                  </span>
                  {#if post.category}
                    <span class="text-[10px]" style="color: #9ca3af;">{post.category}</span>
                  {/if}
                  {#if post.is_pinned}<Pin size={10} color="#c29d53" fill="#c29d53" />{/if}
                </div>
                <p class="text-sm font-semibold leading-snug" style="color: #f3f4f6;">{post.title}</p>
                {#if !open}
                  <p class="text-[11px] mt-0.5 line-clamp-1" style="color: #6b7280;">{post.body ?? ''}</p>
                {/if}
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span class="text-[10px]" style="color: #6b7280;">{formatDate(post.published_at)}</span>
                <ChevronDown size={13} color="#6b7280" style="transition: transform 0.2s; transform: rotate({open ? 180 : 0}deg);" />
              </div>
            </div>

            {#if open}
              <div class="px-4 pb-4" style="padding-left: 3.25rem;">
                {#if post.body}
                  <p class="text-[12.5px] leading-relaxed mb-3" style="color: #d1d5db;">{post.body}</p>
                {/if}
                {#if post.attachment_url}
                  <a
                    href={post.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(e) => e.stopPropagation()}
                    class="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-2 rounded-full"
                    style="background: rgba(194,157,83,0.15); color: #c29d53;"
                  >
                    <FileText size={12} /> View attachment <ExternalLink size={10} />
                  </a>
                {/if}
              </div>
            {/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-pop {
    animation: notice-modal-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes notice-modal-in {
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