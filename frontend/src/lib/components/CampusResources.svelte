<script>
  // Institution-only quick link tile — library, helpdesk, academic calendar,
  // emergency contacts, etc. Renders exactly ONE campus_posts row of
  // type='resource' (TimelineScreen loops over the filtered list and places
  // each tile as its own grid cell, interleaved with the Notice Board cell —
  // see its Campus view). title is the tile label, attachment_url is the
  // link (an uploaded document or a plain URL typed into the same field —
  // see the admin form's fileOrUrlField), body is an optional description.
  // Uses the Campus tab's dark green/gold palette.
  import { Link2, ArrowUpRight, Laptop, BookOpen } from '@lucide/svelte';

  let { post } = $props();

  // No dedicated "resource kind" field on campus_posts — the title is the
  // only signal we have, so pick a more specific glyph when it obviously
  // matches a common quick-link type and fall back to a generic link icon.
  const Icon = $derived.by(() => {
    const t = (post.title || '').toLowerCase();
    if (t.includes('it') || t.includes('helpdesk') || t.includes('tech')) return Laptop;
    if (t.includes('librar')) return BookOpen;
    return Link2;
  });
</script>

<a
  href={post.attachment_url || '#'}
  target={post.attachment_url ? '_blank' : undefined}
  rel="noopener noreferrer"
  class="quick-link-tile group rounded-xl p-4 flex items-start justify-between gap-3 transition-all"
  style="background: #0b1e13; border: 1px solid #12301e; opacity: {post.attachment_url ? 1 : 0.6};"
>
  <div class="flex items-start gap-3 min-w-0">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, #d4af6a, #8b6a35);">
      <Icon size={15} color="#fdf6e3" />
    </div>
    <div class="min-w-0">
      <p class="text-sm font-semibold leading-snug truncate" style="color: #e5e7eb;">{post.title}</p>
      {#if post.body}
        <p class="text-xs mt-0.5 line-clamp-2" style="color: #6b7280;">{post.body}</p>
      {/if}
    </div>
  </div>
  {#if post.attachment_url}
    <ArrowUpRight size={12} color="#6b7280" class="shrink-0 mt-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
  {/if}
</a>

<style>
  .quick-link-tile:hover {
    border-color: #1c492e !important;
  }
</style>
