<script>
  // Renders exactly ONE campus_posts or community_posts row of type='poll'
  // — shared by both verticals (see TimelineScreen's Campus and Community
  // sections), same reuse pattern as NoticeBoard/CampusEventsStrip/etc.
  // `post.metadata.options` is the list of answer labels; `post.poll_results`
  // (computed server-side — see services/campusPosts.js or
  // communityPosts.js's listActivePosts) is a sparse [{optionIndex, votes}]
  // array (an option with zero votes just doesn't appear in it). A vote is
  // cast via `castVote` (defaults to castCommunityPollVote — Campus's usage
  // passes castCampusPollVote instead) and locked in server-side by a
  // UNIQUE (post_id, mac) constraint on whichever poll-votes table matches
  // — this component's own "have I voted" state is a localStorage flag,
  // purely so a returning device sees the results view again instead of
  // the voting UI; the real source of truth is the backend constraint, so
  // a second vote from a different browser on the same device just
  // silently doesn't change the tally rather than erroring.
  import { BarChart3, CheckCircle2 } from '@lucide/svelte';
  import { castCommunityPollVote } from '$lib/api.js';
  import { getClientMac } from '$lib/device.js';

  const DEFAULT_THEME = {
    bg: '#0b1e13',
    bgAlt: '#0a1b11',
    border: '#12301e',
    accent: '#c29d53',
    accentSoft: 'rgba(194,157,83,0.18)'
  };

  let { post, theme = DEFAULT_THEME, castVote = castCommunityPollVote } = $props();

  // Static demo posts (see communityDemoData.js) use string ids like
  // 'demo-poll-1' rather than a real DB row — voting on one is simulated
  // entirely client-side instead of hitting the backend (which would just
  // 400 on a non-numeric id), so the demo still feels interactive. Deleting
  // communityDemoData.js and its merge point in TimelineScreen removes this
  // path along with the rest of the demo data; nothing else depends on it.
  const isDemo = typeof post.id === 'string' && post.id.startsWith('demo-');

  const options = $derived(post.metadata?.options ?? []);
  let results = $state(post.poll_results ?? []);
  let voted = $state(false);
  let voting = $state(false);
  let justVotedIndex = $state(null);

  const STORAGE_KEY = `communityPollVoted_${post.id}`;
  try {
    voted = localStorage.getItem(STORAGE_KEY) != null;
  } catch {
    // Private browsing / blocked storage — falls back to always showing the
    // voting UI, which is still safe: the backend constraint is what
    // actually prevents a double count, this is just a convenience.
  }

  const tally = $derived.by(() => {
    const byIndex = new Map(results.map((r) => [r.optionIndex, r.votes]));
    const total = results.reduce((sum, r) => sum + r.votes, 0);
    return options.map((label, i) => {
      const votes = byIndex.get(i) ?? 0;
      return { label, votes, pct: total > 0 ? Math.round((votes / total) * 100) : 0 };
    });
  });
  const totalVotes = $derived(tally.reduce((sum, t) => sum + t.votes, 0));

  async function vote(index) {
    if (voting || voted) return;
    voting = true;
    justVotedIndex = index;

    if (isDemo) {
      const next = results.map((r) => ({ ...r }));
      const existing = next.find((r) => r.optionIndex === index);
      if (existing) existing.votes += 1;
      else next.push({ optionIndex: index, votes: 1 });
      results = next;
      voted = true;
      voting = false;
      try {
        localStorage.setItem(STORAGE_KEY, String(index));
      } catch {
        // Nothing to persist to — this is purely a local, in-memory demo vote.
      }
      return;
    }

    const result = await castVote(post.id, getClientMac(), index);
    voting = false;
    if (result.ok && result.data?.results) {
      results = result.data.results;
      voted = true;
      try {
        localStorage.setItem(STORAGE_KEY, String(index));
      } catch {
        // Nothing to persist to — the vote itself still went through server-side.
      }
    }
  }
</script>

{#if options.length >= 2}
  <div class="rounded-2xl p-4" style="background: {theme.bg}; border: 1px solid {theme.border};">
    <div class="flex items-center gap-2 mb-3">
      <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background: {theme.accentSoft};">
        <BarChart3 size={14} color={theme.accent} />
      </div>
      <div class="min-w-0">
        <p class="text-[10px] font-bold uppercase tracking-wider" style="color: {theme.accent};">Quick Poll</p>
        <p class="text-sm font-semibold leading-snug" style="color: #f3f4f6;">{post.title}</p>
      </div>
    </div>
    {#if post.body}
      <p class="text-xs mb-3" style="color: #9ca3af;">{post.body}</p>
    {/if}

    <div class="flex flex-col gap-2">
      {#each tally as opt, i (i)}
        {#if voted}
          <div class="relative rounded-xl overflow-hidden" style="background: {theme.bgAlt};">
            <div class="absolute inset-y-0 left-0 transition-all" style="width: {opt.pct}%; background: {theme.accentSoft};"></div>
            <div class="relative flex items-center justify-between gap-2 px-3.5 py-2.5">
              <span class="text-xs font-semibold flex items-center gap-1.5" style="color: #e5e7eb;">
                {#if justVotedIndex === i}<CheckCircle2 size={12} color={theme.accent} />{/if}
                {opt.label}
              </span>
              <span class="text-xs font-bold shrink-0" style="color: {theme.accent};">{opt.pct}%</span>
            </div>
          </div>
        {:else}
          <button
            type="button"
            onclick={() => vote(i)}
            disabled={voting}
            class="poll-option rounded-xl px-3.5 py-2.5 text-left text-xs font-semibold transition-all active:scale-[0.99]"
            style="background: {theme.bgAlt}; border: 1px solid {theme.border}; color: #e5e7eb; --cp-hover: {theme.accent}; opacity: {voting ? 0.6 : 1};"
          >
            {opt.label}
          </button>
        {/if}
      {/each}
    </div>

    {#if voted}
      <p class="text-[10px] mt-2.5" style="color: #6b7280;">{totalVotes} vote{totalVotes === 1 ? '' : 's'} · thanks for voting</p>
    {/if}
  </div>
{/if}

<style>
  .poll-option:hover {
    border-color: var(--cp-hover, #c29d53) !important;
  }
</style>
