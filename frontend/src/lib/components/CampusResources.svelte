<script>
  // Institution-only quick link tile — library, helpdesk, academic calendar,
  // emergency contacts, etc. Renders exactly ONE campus_posts row of
  // type='resource' (TimelineScreen/QuickLinksBoard loop over the filtered
  // list and place each tile as its own grid cell). title is the tile
  // label, attachment_url is the link (an uploaded document or a plain URL
  // typed into the same field — see the admin form's fileOrUrlField), body
  // is an optional description. Icon + accent color come from the post's
  // `category` (matched against RESOURCE_CATEGORIES — see
  // campusResourceCategories.js — with a title-keyword fallback for older
  // resources created before that list existed), so a Security/Emergency
  // tile reads as visually distinct from a Library tile at a glance instead
  // of every tile sharing one generic gold icon. Uses the Campus tab's dark
  // green/gold palette otherwise.
  import { Link2, ArrowUpRight, Laptop, BookOpen, Wallet, HeartPulse, ShieldAlert, Bus, House, Briefcase, GraduationCap, Users, Pin } from '@lucide/svelte';
  import { matchResourceCategory } from '$lib/campusResourceCategories.js';
  import { recordCampusPostClick } from '$lib/api.js';

  const CATEGORY_ICON = {
    library: BookOpen,
    it: Laptop,
    finance: Wallet,
    health: HeartPulse,
    security: ShieldAlert,
    transport: Bus,
    housing: House,
    careers: Briefcase,
    admissions: GraduationCap,
    student_affairs: Users,
    general: Link2
  };

  const DEFAULT_THEME = {
    bg: '#0b1e13',
    border: '#12301e',
    accent: '#c29d53',
    hoverBorder: '#1c492e',
    pinnedHoverBorder: '#d4af6a'
  };

  let {
    post,
    theme = DEFAULT_THEME,
    matchCategory = matchResourceCategory,
    categoryIcons = CATEGORY_ICON,
    recordClick = recordCampusPostClick,
    onOpen = undefined
  } = $props();

  const category = $derived(matchCategory(post.category, post.title));
  const Icon = $derived(categoryIcons[category.id] ?? Link2);

  // Fire-and-forget usage signal for the admin's Quick Links click counts
  // (see campus.js's POST /posts/:id/click, or community.js's for a reused
  // call site — see `recordClick` above) — never blocks the outbound
  // navigation, and skipped entirely for a tile with nothing to actually
  // click through to. When `onOpen` is given (Community's Local Services —
  // see QuickLinksBoard's `detailModal` prop), the tile opens a detail
  // sheet instead of navigating straight out, and the click is recorded
  // from that sheet's own contact button instead, same as
  // MarketplaceBoard's "Contact Seller" — a tap on the tile itself is just
  // browsing, not yet a real engagement with the business.
  function handleClick(e) {
    if (onOpen) {
      e.preventDefault();
      onOpen(post);
      return;
    }
    if (post.attachment_url) recordClick(post.id);
  }
</script>

<a
  href={post.attachment_url || '#'}
  target={post.attachment_url ? '_blank' : undefined}
  rel="noopener noreferrer"
  onclick={handleClick}
  class="quick-link-tile group rounded-xl p-4 flex items-start justify-between gap-3 transition-all relative"
  class:pinned-tile={post.is_pinned}
  style="background: {theme.bg}; border: 1px solid {post.is_pinned ? theme.accent : theme.border}; opacity: {post.attachment_url ? 1 : 0.6}; --qlt-hover: {theme.hoverBorder}; --qlt-pinned-hover: {theme.pinnedHoverBorder};"
>
  {#if post.is_pinned}
    <div class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style="background: {theme.accent}; box-shadow: 0 0 0 2px {theme.bg};">
      <Pin size={9} color={theme.bg} fill={theme.bg} />
    </div>
  {/if}
  <div class="flex items-start gap-3 min-w-0">
    <div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style="background: linear-gradient(135deg, {category.color}, {category.color}bb);">
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
    border-color: var(--qlt-hover, #1c492e) !important;
  }
  .quick-link-tile.pinned-tile:hover {
    border-color: var(--qlt-pinned-hover, #d4af6a) !important;
  }
</style>
