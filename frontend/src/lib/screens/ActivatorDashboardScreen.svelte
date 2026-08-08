<script>
  import { onMount } from 'svelte';
  import {
    MapPin, Edit3, LogOut, ArrowUpRight, TrendingUp, BarChart2, UserCheck, Wallet, User,
    Clock, CheckCircle2, MessageCircle, Bell, Award, CreditCard, Save, Copy, Smartphone,
    ChevronLeft, ChevronRight, Filter
  } from '@lucide/svelte';
  import BarChartMini from '$lib/components/BarChartMini.svelte';
  import AreaChartMini from '$lib/components/AreaChartMini.svelte';
  import {
    MOCK_ROSTER, daysUntilExpiry, COMMISSION_RATE, ALL_DAILY, MONTHLY_DATA,
    LIFETIME_TOTAL, THIS_WEEK, LAST_WEEK, WEEK_GROWTH, TODAY_EARN, YESTERDAY
  } from '$lib/data.js';
  import { getActivatorSessions, getActivatorEarnings, getActivatorEarningsSeries, updateActivatorProfile } from '$lib/api.js';

  let { activator, onLogout } = $props();

  // A real backend login (see ActivatorLoginScreen) carries a JWT; the
  // offline demo-fallback login doesn't. Everywhere below that shows actual
  // money/session numbers branches on this — the mock dataset (MOCK_ROSTER,
  // PAYOUT_HISTORY, weekly/daily goals) is the same fixed demo data
  // regardless of which activator logs in, so showing it next to a real
  // activator's real numbers would be actively misleading, not just
  // incomplete. Real mode's earnings history/charts (below) are built from
  // getActivatorEarningsSeries() — real per-day commission totals, not
  // fabricated — so, unlike goals/payout ledger, those ARE shown for real.
  const isReal = !!activator.token;
  let realSessions = $state([]);
  let realEarnings = $state(null);
  let realDailySeries = $state([]); // [{ date: 'YYYY-MM-DD', commissionKes }], oldest → newest, zero-filled
  let loadingReal = $state(isReal);

  onMount(async () => {
    if (!isReal) return;
    const [sessionsResult, earningsResult, seriesResult] = await Promise.all([
      getActivatorSessions(activator.token),
      getActivatorEarnings(activator.token),
      getActivatorEarningsSeries(activator.token, 365)
    ]);
    if (sessionsResult.ok) realSessions = sessionsResult.data?.sessions ?? [];
    if (earningsResult.ok) realEarnings = earningsResult.data?.earnings ?? null;
    if (seriesResult.ok) realDailySeries = seriesResult.data?.series ?? [];
    loadingReal = false;
  });

  const realGrossKes = $derived(Number(realEarnings?.gross_kes ?? 0));
  const realCommissionKes = $derived(Number(realEarnings?.commission_kes ?? 0));
  const realPaidSessions = $derived(Number(realEarnings?.paid_sessions ?? 0));
  const realUniqueDevices = $derived(new Set(realSessions.map((s) => s.client_mac)).size);
  const realCommissionRate = $derived(activator.commissionRate != null ? Math.round(activator.commissionRate * 100) : 20);

  // Real earnings history/charts — derived from realDailySeries (actual
  // per-day commission totals from the backend, zero-filled), not
  // fabricated. Shape matches what BarChartMini/AreaChartMini already
  // expect ({ label, shortLabel, earnings }) so the same chart components
  // used for the demo view work unchanged here.
  function formatDayLabel(dateStr) {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }
  function formatShortDayLabel(dateStr) {
    return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' });
  }
  const realDaily = $derived(
    realDailySeries.map((d) => ({ label: formatDayLabel(d.date), shortLabel: formatShortDayLabel(d.date), earnings: d.commissionKes }))
  );
  // Trailing 12 calendar months, oldest → newest, summed from the same
  // real daily series.
  const realMonthlyData = $derived.by(() => {
    const byMonth = new Map();
    for (const d of realDailySeries) {
      const monthKey = d.date.slice(0, 7); // 'YYYY-MM'
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + d.commissionKes);
    }
    const months = [];
    const cursor = new Date();
    cursor.setUTCDate(1);
    for (let i = 11; i >= 0; i--) {
      const d = new Date(cursor);
      d.setUTCMonth(d.getUTCMonth() - i);
      const key = d.toISOString().slice(0, 7);
      months.push({ label: d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }), earnings: byMonth.get(key) ?? 0 });
    }
    return months;
  });
  const realChartData = $derived.by(() => {
    if (period === '7D') return realDaily.slice(-7);
    if (period === '30D') return realDaily.slice(-30).filter((_, i) => i % 2 === 0);
    if (period === '3M') return realDaily.slice(-90).filter((_, i) => i % 7 === 0);
    return realMonthlyData;
  });
  const realPeriodTotal = $derived.by(() => {
    if (period === '1Y') return realDaily.reduce((s, d) => s + d.earnings, 0);
    const slice = period === '7D' ? realDaily.slice(-7) : period === '30D' ? realDaily.slice(-30) : realDaily.slice(-90);
    return slice.reduce((s, d) => s + d.earnings, 0);
  });
  const realThisWeekTotal = $derived(realDaily.slice(-7).reduce((s, d) => s + d.earnings, 0));
  const realThisMonthTotal = $derived(realDaily.slice(-30).reduce((s, d) => s + d.earnings, 0));

  // 'active'/'expired' are derived from expires_at only once payment itself
  // succeeded — pending/failed sessions were never granted a session at all.
  function sessionStatus(s) {
    if (s.payment_status !== 'success') return s.payment_status;
    return s.expires_at && new Date(s.expires_at).getTime() > Date.now() ? 'active' : 'expired';
  }
  // A short, non-identifying per-row reference — used only as a fallback
  // when a client never set a username. Phone/MAC are never shown.
  function sessionRef(s) {
    return `#${String(s.id).replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  }
  // Client's self-chosen username (see clients.username) is the preferred
  // label — it's what the client themselves picked to be identified by,
  // unlike phone/MAC which are never surfaced here.
  function sessionLabel(s) {
    return s.client_username || sessionRef(s);
  }

  const SESSION_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'expired', label: 'Expired' },
    { id: 'pending', label: 'Pending' },
    { id: 'failed', label: 'Failed' }
  ];
  const SESSION_PAGE_SIZES = [5, 10, 20, 50, 100];

  let sessionsFilter = $state('all');
  let sessionsPageSize = $state(10);
  let sessionsPage = $state(1);

  const sortedSessions = $derived([...realSessions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
  const filteredSessions = $derived(
    sessionsFilter === 'all' ? sortedSessions : sortedSessions.filter((s) => sessionStatus(s) === sessionsFilter)
  );
  const sessionsTotalPages = $derived(Math.max(1, Math.ceil(filteredSessions.length / sessionsPageSize)));
  const pagedSessions = $derived(
    filteredSessions.slice((sessionsPage - 1) * sessionsPageSize, sessionsPage * sessionsPageSize)
  );

  // Filtering/page-size changes can leave the current page out of range —
  // snap back rather than showing a blank page.
  $effect(() => {
    if (sessionsPage > sessionsTotalPages) sessionsPage = sessionsTotalPages;
  });

  function setSessionsFilter(id) {
    sessionsFilter = id;
    sessionsPage = 1;
  }
  function setSessionsPageSize(size) {
    sessionsPageSize = size;
    sessionsPage = 1;
  }

  let nudged = $state({});
  let reminded = $state({});
  let tab = $state('overview');
  let period = $state('7D');
  let weeklyTarget = $state(2000);
  let dailyTarget = $state(350);
  let editingGoal = $state(null);
  let goalInput = $state('');
  let linkCopied = $state(false);

  const AVATAR_COLORS = ['#C45C38', '#4E8050', '#2E5A3E', '#CC8830', '#5B8ED6', '#9B6DD6', '#B85038', '#C06080'];
  // fullName is the real, persisted name (saved to the backend for real
  // activators — see saveProfile()); displayName is just the first word of
  // it, used for the compact header/avatar. Avatar colour and notification
  // toggles stay client-only — there's no backend concept for either yet,
  // so persisting them would be fabricating a feature rather than wiring
  // one up.
  let fullName = $state(activator.name);
  let territory = $state(activator.area ?? '');
  let mpesa = $state(activator.mpesaNumber ?? '');
  let avatarColor = $state(AVATAR_COLORS[0]);
  let editingProfile = $state(false);
  // Always freshly reset by the "Edit" button right before use (see the
  // profile tab below) — never read while editingProfile is false, so this
  // initial placeholder is never actually shown.
  let profileDraft = $state({ name: '', territory: '', mpesa: '' });
  let profileSaving = $state(false);
  let profileError = $state('');
  let notifs = $state({ expiring: true, dormant: true, goalMiss: true, newPurchase: false });

  const displayName = $derived(fullName.trim().split(/\s+/)[0] || fullName);
  const initials = $derived(
    fullName.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  );

  async function saveProfile() {
    const name = profileDraft.name.trim() || fullName;
    const nextTerritory = profileDraft.territory.trim();
    const nextMpesa = profileDraft.mpesa.trim();

    if (!isReal) {
      fullName = name;
      territory = nextTerritory;
      mpesa = nextMpesa;
      editingProfile = false;
      return;
    }

    profileError = '';
    profileSaving = true;
    const result = await updateActivatorProfile(activator.token, { name, territory: nextTerritory, mpesaNumber: nextMpesa });
    profileSaving = false;

    if (!result.ok || !result.data?.success) {
      profileError = result.data?.message || 'Could not save — check your connection';
      return;
    }

    fullName = result.data.activator.name;
    territory = result.data.activator.territory ?? '';
    mpesa = result.data.activator.mpesaNumber ?? '';
    editingProfile = false;
  }

  const activeUsers = MOCK_ROSTER.filter((u) => u.status === 'active').length;
  const dormantUsers = MOCK_ROSTER.filter((u) => u.status === 'dormant');
  const expiringUsers = MOCK_ROSTER.filter((u) => {
    const exp = daysUntilExpiry(u);
    return u.status === 'active' && exp >= 0 && exp <= 1;
  });
  const sortedRoster = [...MOCK_ROSTER].sort((a, b) => b.paid - a.paid);

  const weeklyPct = $derived(Math.min(Math.round((THIS_WEEK / weeklyTarget) * 100), 100));
  const weeklyStatus = $derived(weeklyPct >= 100 ? 'achieved' : weeklyPct >= 70 ? 'on-track' : 'behind');
  const weeklyColor = $derived(weeklyStatus === 'achieved' ? '#4E8050' : weeklyStatus === 'on-track' ? '#C45C38' : '#B85038');
  const weeklyLeft = $derived(Math.max(weeklyTarget - THIS_WEEK, 0));

  const dailyPct = $derived(Math.min(Math.round((TODAY_EARN / dailyTarget) * 100), 100));
  const dailyStatus = $derived(dailyPct >= 100 ? 'achieved' : dailyPct >= 70 ? 'on-track' : 'behind');
  const dailyColor = $derived(dailyStatus === 'achieved' ? '#4E8050' : dailyStatus === 'on-track' ? '#C45C38' : '#B85038');
  const dailyLeft = $derived(Math.max(dailyTarget - TODAY_EARN, 0));

  const INVITE_LINK = `ungana.app/join?ref=${activator.id.toLowerCase().replace('-', '')}`;

  function handleSaveGoal() {
    const v = parseInt(goalInput.replace(/\D/g, ''), 10);
    if (v > 0) {
      if (editingGoal === 'weekly') weeklyTarget = v;
      if (editingGoal === 'daily') dailyTarget = v;
    }
    editingGoal = null;
  }

  const chartData = $derived.by(() => {
    if (period === '7D') return ALL_DAILY.slice(-7);
    if (period === '30D') return ALL_DAILY.slice(-30).filter((_, i) => i % 2 === 0);
    if (period === '3M') return ALL_DAILY.slice(-90).filter((_, i) => i % 7 === 0);
    return MONTHLY_DATA;
  });

  const periodTotal = $derived.by(() => {
    if (period === '1Y') return LIFETIME_TOTAL;
    const slice = period === '7D' ? ALL_DAILY.slice(-7) : period === '30D' ? ALL_DAILY.slice(-30) : ALL_DAILY.slice(-90);
    return slice.reduce((s, d) => s + d.earnings, 0);
  });

  const PAYOUT_HISTORY = [
    { date: '1 Jul 2025', amount: 980, status: 'Paid' },
    { date: '1 Jun 2025', amount: 1080, status: 'Paid' },
    { date: '1 May 2025', amount: 950, status: 'Paid' },
    { date: '1 Apr 2025', amount: 890, status: 'Paid' }
  ];

  const PLAN_MIX = [
    { label: 'Daily', count: 3, revenue: 150, color: '#C4DAC0' },
    { label: 'Weekly', count: 3, revenue: 750, color: '#C45C38' },
    { label: 'Monthly', count: 2, revenue: 1500, color: '#CC8830' }
  ];
  const totalRevenue = PLAN_MIX.reduce((s, p) => s + p.revenue, 0);

  const TABS = [
    { id: 'overview', label: 'Home', Icon: TrendingUp },
    { id: 'earnings', label: 'Earn', Icon: BarChart2 },
    { id: 'users', label: 'Users', Icon: UserCheck },
    { id: 'payouts', label: 'Pay', Icon: Wallet },
    { id: 'profile', label: 'Profile', Icon: User }
  ];
  const PERIODS = [
    { id: '7D', label: 'This Week' },
    { id: '30D', label: '30 Days' },
    { id: '3M', label: '3 Months' },
    { id: '1Y', label: '1 Year' }
  ];

  function inits(name) {
    return name.split(' ').map((n) => n[0]).join('');
  }

  const statsStrip = $derived(
    isReal
      ? [
          { label: 'Paid Sessions', value: realPaidSessions, sub: 'all-time', alert: false },
          { label: 'Devices', value: realUniqueDevices, sub: 'unique clients', alert: false },
          { label: 'Commission', value: `KES ${realCommissionKes.toLocaleString()}`, sub: 'all-time', alert: false }
        ]
      : [
          { label: 'This Week', value: `KES ${THIS_WEEK.toLocaleString()}`, sub: 'payout Fri', alert: THIS_WEEK < LAST_WEEK },
          { label: 'Users', value: MOCK_ROSTER.length, sub: `${activeUsers} active`, alert: false },
          { label: 'Dormant', value: dormantUsers.length, sub: 'need nudging', alert: dormantUsers.length > 0 }
        ]
  );

  const profileFields = $derived([
    { icon: User, label: 'Full name', key: 'name', placeholder: 'Your full name', value: editingProfile ? profileDraft.name : fullName },
    { icon: MapPin, label: 'Territory', key: 'territory', placeholder: 'e.g. Nairobi CBD, Kibera…', value: editingProfile ? profileDraft.territory : territory },
    { icon: CreditCard, label: 'M-PESA number', key: 'mpesa', placeholder: '+254 7XX XXX XXX', value: editingProfile ? profileDraft.mpesa : mpesa }
  ]);

  const goalDefaults = $derived([
    { label: 'Daily target', value: `KES ${dailyTarget.toLocaleString()}`, action: () => { tab = 'overview'; editingGoal = 'daily'; } },
    { label: 'Weekly target', value: `KES ${weeklyTarget.toLocaleString()}`, action: () => { tab = 'overview'; editingGoal = 'weekly'; } }
  ]);

  const notifRows = [
    { key: 'expiring', label: 'Session expiry alerts', sub: 'Users expiring in 24 hrs' },
    { key: 'dormant', label: 'Dormant user alerts', sub: 'Idle 7+ days' },
    { key: 'goalMiss', label: 'Goal miss warning', sub: "When you're behind by end of day" },
    { key: 'newPurchase', label: 'New purchase ping', sub: 'Every time a user buys' }
  ];

  const payoutStats = $derived([
    { label: 'Total paid out', value: `KES ${Math.round(LIFETIME_TOTAL * 0.75).toLocaleString()}`, icon: Award },
    { label: 'Avg. monthly', value: `KES ${Math.round(LIFETIME_TOTAL / 12).toLocaleString()}`, icon: BarChart2 }
  ]);

  const allTimeBreakdown = $derived([
    { label: 'Gross user purchases', value: LIFETIME_TOTAL * 5, highlight: false },
    { label: 'Your commission (20%)', value: LIFETIME_TOTAL, highlight: true },
    { label: 'Paid out', value: Math.round(LIFETIME_TOTAL * 0.75), highlight: false },
    { label: 'Pending payout', value: Math.round(LIFETIME_TOTAL * 0.25), highlight: false }
  ]);

  function copyLink() {
    navigator.clipboard?.writeText(`https://${INVITE_LINK}`);
    linkCopied = true;
    setTimeout(() => (linkCopied = false), 2000);
  }
</script>

<div style="min-height: 100dvh; background: #E8D4B0;">
  <!-- Hero header -->
  <div
    class="px-5 pt-5 pb-24"
    style={`background-image: linear-gradient(170deg, rgba(29,60,42,0.85) 0%, rgba(29,60,42,0.75) 40%, rgba(29,60,42,0.93) 100%), url("https://images.unsplash.com/photo-1664181220731-06219378d8c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxLZW55YSUyME5haXJvYmklMjBjb21tdW5pdHklMjBtYXJrZXQlMjB2aWJyYW50fGVufDF8fHx8MTc4NTI0ODU0OXww&ixlib=rb-4.1.0&q=80&w=1080"); background-size: cover; background-position: center;`}
  >
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0" style="background: {avatarColor}; color: #fff;">
          {initials}
        </div>
        <div>
          <p class="text-[9px] text-[#C4DAC0] font-semibold uppercase tracking-widest">Activator · {activator.id}</p>
          <p class="text-sm font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">{displayName}</p>
          {#if territory}
            <p class="text-[10px] text-[#AECAAE] flex items-center gap-1"><MapPin size={9} />{territory}</p>
          {/if}
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick={() => (tab = 'profile')} class="w-8 h-8 rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.18);">
          <Edit3 size={14} color="#C4DAC0" />
        </button>
        <button onclick={onLogout} class="w-8 h-8 rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.18);">
          <LogOut size={14} color="#C4DAC0" />
        </button>
      </div>
    </div>

    <!-- Hero lifetime earnings -->
    <div>
      <p class="text-xs text-[#AECAAE] uppercase tracking-widest font-semibold mb-1">Total lifetime earnings</p>
      {#if isReal && loadingReal}
        <div class="h-9 w-40 rounded-lg animate-pulse" style="background: rgba(255,255,255,0.14);"></div>
      {:else}
        <p class="text-4xl font-bold text-[#E8D4B0]" style="letter-spacing: -1.5px;">KES {(isReal ? realCommissionKes : LIFETIME_TOTAL).toLocaleString()}</p>
      {/if}
      <div class="flex items-center gap-2 mt-2">
        {#if !isReal}
          <div class="flex items-center gap-1 px-2 py-0.5 rounded-full" style="background: {WEEK_GROWTH >= 0 ? 'rgba(78,128,80,0.35)' : 'rgba(192,97,74,0.2)'};">
            <ArrowUpRight size={12} color={WEEK_GROWTH >= 0 ? '#4E8050' : '#B85038'} />
            <span class="text-[11px] font-bold" style="color: {WEEK_GROWTH >= 0 ? '#4E8050' : '#B85038'};">{WEEK_GROWTH}% vs last week</span>
          </div>
        {/if}
        <span class="text-[10px] text-[#AECAAE]">{isReal ? realCommissionRate : 20}% commission rate</span>
      </div>
    </div>
  </div>

  <!-- Floating stats strip -->
  <div class="mx-4 -mt-16 rounded-3xl shadow-xl mb-4 grid grid-cols-3 divide-x overflow-hidden" style="background: #162C1E;">
    {#each statsStrip as s (s.label)}
      <div class="flex flex-col items-center py-4 px-2" style="border-color: rgba(255,255,255,0.18);">
        <span class="text-base font-bold" style="color: {s.alert ? '#B85038' : '#C45C38'};">{s.value}</span>
        <span class="text-[9px] uppercase tracking-wider mt-0.5 text-center" style="color: {s.alert ? '#C07860' : '#C4DAC0'};">{s.label}</span>
        <span class="text-[9px] text-[#96B496] mt-0.5 text-center">{s.sub}</span>
      </div>
    {/each}
  </div>

  <!-- Tab bar -->
  <div class="flex mx-4 mb-4 rounded-2xl overflow-hidden p-1 gap-0.5" style="background: rgba(46,90,62,0.12);">
    {#each TABS as t (t.id)}
      {@const Icon = t.Icon}
      <button onclick={() => (tab = t.id)} class="flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-all" style="background: {tab === t.id ? '#2E5A3E' : 'transparent'};">
        <Icon size={14} color={tab === t.id ? avatarColor : '#C4DAC0'} />
        <span class="text-[9px] font-bold" style="color: {tab === t.id ? '#E8D4B0' : '#C4DAC0'};">{t.label}</span>
      </button>
    {/each}
  </div>

  <!-- Tab content -->
  <div class="px-4 pb-8 flex flex-col gap-3">
    <!-- OVERVIEW -->
    {#if tab === 'overview'}
      {#if isReal}
        <!-- Real summary — no goals/plan-mix/dormancy here: those need
             per-day time-series or engagement tracking the backend doesn't
             have yet, so showing them would just be the same fixed demo
             numbers regardless of who's logged in. -->
        <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
          <div class="px-5 pt-4 pb-4">
            <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold mb-1">All-time commission</p>
            <p class="text-2xl font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">KES {realCommissionKes.toLocaleString()}</p>
            <p class="text-[10px] text-[#96B496] mt-1">from KES {realGrossKes.toLocaleString()} in referred purchases · {realPaidSessions} paid sessions</p>
          </div>
        </div>

        <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
          <div class="px-4 pt-4 pb-2 flex items-center justify-between">
            <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Recent Sessions</p>
            {#if sortedSessions.length > 5}
              <button onclick={() => (tab = 'users')} class="text-[10px] font-bold" style="color: #C45C38;">View all →</button>
            {/if}
          </div>
          {#if loadingReal}
            <div class="px-4 pb-4"><div class="h-6 w-6 rounded-full border-2 border-white/20 border-t-white/70 animate-spin mx-auto"></div></div>
          {:else if sortedSessions.length === 0}
            <p class="text-xs text-[#96B496] px-4 pb-4">No sessions referred yet.</p>
          {:else}
            {#each sortedSessions.slice(0, 5) as s, i (s.id)}
              <div class="flex items-center gap-3 px-4 py-3" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
                <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.30);">
                  <Smartphone size={13} color="#C45C38" />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-[#E8D4B0] truncate">{sessionLabel(s)} · {s.package_id}</p>
                  <p class="text-[10px] text-[#AECAAE]">{new Date(s.created_at).toLocaleDateString()} · {sessionStatus(s)}</p>
                </div>
                <p class="text-xs font-bold text-[#C45C38] shrink-0">+KES {Number(s.commission_kes).toLocaleString()}</p>
              </div>
            {/each}
          {/if}
          <div class="h-3"></div>
        </div>
      {:else}
      <!-- Daily goal -->
      <div class="rounded-3xl px-5 py-4" style="background: #2E5A3E; border: 1px solid {dailyColor}33;">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold">Today's Goal</p>
            <p class="text-[10px] mt-0.5" style="color: {dailyColor};">
              {dailyStatus === 'achieved' ? 'Smashed it! Great day.' : dailyStatus === 'on-track' ? 'On track — finish strong' : `KES ${dailyLeft.toLocaleString()} to go today`}
            </p>
          </div>
          <button
            onclick={() => { goalInput = String(dailyTarget); editingGoal = editingGoal === 'daily' ? null : 'daily'; }}
            class="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style="background: rgba(196,92,56,0.30); color: #C45C38;"
          >
            {editingGoal === 'daily' ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {#if editingGoal === 'daily'}
          <div class="flex gap-2 items-center">
            <div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl" style="background: rgba(0,0,0,0.2);">
              <span class="text-xs text-[#C4DAC0]">KES</span>
              <input type="number" bind:value={goalInput} class="flex-1 bg-transparent text-sm font-bold text-[#E8D4B0] outline-none min-w-0" />
            </div>
            <button onclick={handleSaveGoal} class="px-4 py-2 rounded-2xl text-xs font-bold" style="background: #C45C38; color: #fff;">Save</button>
          </div>
        {:else}
          <div class="flex items-end justify-between mb-2">
            <span class="text-2xl font-bold" style="color: {dailyColor}; letter-spacing: -0.5px;">KES {TODAY_EARN.toLocaleString()}</span>
            <span class="text-xs text-[#AECAAE] pb-0.5">{dailyPct}% of KES {dailyTarget.toLocaleString()}</span>
          </div>
          <div class="h-2.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.18);">
            <div class="h-full rounded-full transition-all duration-700" style="width: {dailyPct}%; background: linear-gradient(90deg, {dailyColor}88, {dailyColor});"></div>
          </div>
          <p class="text-[10px] text-[#AECAAE] mt-1.5">
            Yesterday: KES {YESTERDAY.toLocaleString()}
            {#if TODAY_EARN >= YESTERDAY}<span style="color: #4E8050;"> · ahead of yesterday ↑</span>{:else}<span style="color: #B85038;"> · behind yesterday ↓</span>{/if}
          </p>
        {/if}
      </div>

      <!-- Weekly goal -->
      <div class="rounded-3xl px-5 py-4" style="background: #2E5A3E; border: 1px solid {weeklyColor}33;">
        <div class="flex items-center justify-between mb-3">
          <div>
            <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold">Weekly Goal · payout Friday</p>
            <p class="text-[10px] mt-0.5" style="color: {weeklyColor};">
              {weeklyStatus === 'achieved' ? 'Goal achieved — great week!' : weeklyStatus === 'on-track' ? 'On track — keep going!' : `KES ${weeklyLeft.toLocaleString()} short — push today`}
            </p>
          </div>
          <button
            onclick={() => { goalInput = String(weeklyTarget); editingGoal = editingGoal === 'weekly' ? null : 'weekly'; }}
            class="text-[10px] font-bold px-2.5 py-1 rounded-full"
            style="background: rgba(196,92,56,0.30); color: #C45C38;"
          >
            {editingGoal === 'weekly' ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {#if editingGoal === 'weekly'}
          <div class="flex gap-2 items-center">
            <div class="flex-1 flex items-center gap-2 px-3 py-2 rounded-2xl" style="background: rgba(0,0,0,0.2);">
              <span class="text-xs text-[#C4DAC0]">KES</span>
              <input type="number" bind:value={goalInput} class="flex-1 bg-transparent text-sm font-bold text-[#E8D4B0] outline-none min-w-0" />
            </div>
            <button onclick={handleSaveGoal} class="px-4 py-2 rounded-2xl text-xs font-bold" style="background: #C45C38; color: #fff;">Save</button>
          </div>
        {:else}
          <div class="h-2.5 rounded-full overflow-hidden mb-2" style="background: rgba(255,255,255,0.18);">
            <div class="h-full rounded-full transition-all duration-700" style="width: {weeklyPct}%; background: linear-gradient(90deg, {weeklyColor}88, {weeklyColor});"></div>
          </div>
          <div class="flex justify-between items-center mb-3">
            <span class="text-sm font-bold" style="color: {weeklyColor};">KES {THIS_WEEK.toLocaleString()}</span>
            <span class="text-xs text-[#AECAAE]">{weeklyPct}% of KES {weeklyTarget.toLocaleString()}</span>
          </div>
          <div style="height: 52px; margin-left: -8px; margin-right: -8px;">
            <BarChartMini data={ALL_DAILY.slice(-7)} yKey="earnings" xKey="shortLabel" barSize={18} radius={3} color={weeklyColor} opacity={0.8} height={52} labelSize={8} />
          </div>
        {/if}
      </div>

      <!-- Renewal alerts -->
      {#if expiringUsers.length > 0}
        <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.35);">
          <div class="px-4 pt-4 pb-2 flex items-center gap-2">
            <Clock size={14} color="#C45C38" />
            <p class="text-xs font-bold text-[#C45C38]">Renewal alerts · {expiringUsers.length} expiring soon</p>
          </div>
          {#each expiringUsers as u, i (u.name)}
            {@const exp = daysUntilExpiry(u)}
            {@const hasReminded = reminded[u.name]}
            <div class="flex items-center gap-3 px-4 py-3" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
              <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: rgba(196,92,56,0.30); color: #C45C38;">
                {inits(u.name)}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-semibold text-[#E8D4B0] truncate">{u.name}</p>
                <p class="text-[10px] text-[#C45C38] font-semibold">{exp === 0 ? 'Expires today' : 'Expires tomorrow'} · {u.plan}</p>
              </div>
              <button
                onclick={() => (reminded[u.name] = true)}
                disabled={hasReminded}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full shrink-0"
                style="background: {hasReminded ? 'rgba(78,128,80,0.30)' : 'rgba(196,92,56,0.35)'}; color: {hasReminded ? '#4E8050' : '#C45C38'};"
              >
                {#if hasReminded}<CheckCircle2 size={10} /> Sent{:else}<MessageCircle size={10} /> Remind{/if}
              </button>
            </div>
          {/each}
          <div class="h-3"></div>
        </div>
      {/if}

      <!-- Dormant alert -->
      {#if dormantUsers.length > 0}
        <button onclick={() => (tab = 'users')} class="w-full rounded-2xl px-4 py-3 flex items-center justify-between" style="background: rgba(192,97,74,0.08); border: 1px solid rgba(192,97,74,0.25);">
          <div class="flex items-center gap-2">
            <Bell size={14} color="#B85038" />
            <p class="text-xs text-[#1D3C2A] font-semibold">{dormantUsers.length} users idle 7+ days</p>
          </div>
          <span class="text-[10px] font-bold px-2 py-1 rounded-lg" style="background: rgba(192,97,74,0.12); color: #B85038;">Nudge →</span>
        </button>
      {/if}

      <!-- Plan mix -->
      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-4 pt-4 pb-3">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider mb-3">Plan Mix</p>
          {#each PLAN_MIX as p (p.label)}
            <div class="mb-2.5 last:mb-0">
              <div class="flex justify-between items-center mb-1">
                <span class="text-xs text-[#E8D4B0] font-medium">{p.label}</span>
                <span class="text-xs font-bold" style="color: {p.color};">KES {Math.round(p.revenue * COMMISSION_RATE)}</span>
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.18);">
                <div class="h-full rounded-full" style="width: {(p.revenue / totalRevenue) * 100}%; background: {p.color};"></div>
              </div>
            </div>
          {/each}
        </div>
      </div>

      <!-- Recent transactions -->
      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-4 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Recent Purchases</p>
        </div>
        {#each MOCK_ROSTER.slice(0, 4) as u, i (u.name)}
          <div class="flex items-center gap-3 px-4 py-3" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: rgba(196,92,56,0.30); color: #C45C38;">
              {inits(u.name)}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-semibold text-[#E8D4B0] truncate">{u.name}</p>
              <p class="text-[10px] text-[#AECAAE]">{u.plan} · {u.lastActive === 0 ? 'Today' : `${u.lastActive}d ago`}</p>
            </div>
            <p class="text-xs font-bold text-[#C45C38] shrink-0">+KES {Math.round(u.paid * COMMISSION_RATE)}</p>
          </div>
        {/each}
        <div class="h-3"></div>
      </div>
      {/if}
    {/if}

    <!-- EARNINGS -->
    {#if tab === 'earnings'}
      {#if isReal}
        {#if loadingReal}
          <div class="flex justify-center py-8"><div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div></div>
        {:else}
          <!-- Quick summary — real per-day commission totals from
               getActivatorEarningsSeries(), not fabricated. -->
          <div class="grid grid-cols-3 gap-2">
            <div class="rounded-2xl px-3 py-3" style="background: #2E5A3E;">
              <p class="text-[9px] text-[#96B496] uppercase tracking-wider">This Week</p>
              <p class="text-sm font-bold text-[#E8D4B0] mt-0.5 truncate">KES {realThisWeekTotal.toLocaleString()}</p>
            </div>
            <div class="rounded-2xl px-3 py-3" style="background: #2E5A3E;">
              <p class="text-[9px] text-[#96B496] uppercase tracking-wider">This Month</p>
              <p class="text-sm font-bold text-[#E8D4B0] mt-0.5 truncate">KES {realThisMonthTotal.toLocaleString()}</p>
            </div>
            <div class="rounded-2xl px-3 py-3" style="background: #2E5A3E;">
              <p class="text-[9px] text-[#96B496] uppercase tracking-wider">All Time</p>
              <p class="text-sm font-bold text-[#C45C38] mt-0.5 truncate">KES {realCommissionKes.toLocaleString()}</p>
            </div>
          </div>

          <!-- Filter -->
          <div class="flex rounded-2xl overflow-hidden p-1 gap-1" style="background: rgba(46,90,62,0.12);">
            {#each PERIODS as p (p.id)}
              <button onclick={() => (period = p.id)} class="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all" style="background: {period === p.id ? '#2E5A3E' : 'transparent'}; color: {period === p.id ? '#C45C38' : '#3C6A4A'};">
                {p.label}
              </button>
            {/each}
          </div>

          <div class="rounded-3xl px-5 py-5" style="background: #2E5A3E;">
            <p class="text-[10px] text-[#AECAAE] uppercase tracking-widest font-semibold mb-1">
              {period === '7D' ? 'This Week' : period === '30D' ? 'Last 30 Days' : period === '3M' ? 'Last 3 Months' : 'This Year'}
            </p>
            <p class="text-3xl font-bold text-[#E8D4B0]" style="letter-spacing: -1px;">KES {realPeriodTotal.toLocaleString()}</p>
            <p class="text-xs text-[#C4DAC0] mt-1">at {realCommissionRate}% commission rate</p>
            <div style="height: 140px; margin-top: 16px; margin-left: -20px; margin-right: -8px;">
              <AreaChartMini data={realChartData} yKey="earnings" xKey={period === '1Y' ? 'label' : 'shortLabel'} height={140} color="#C45C38" showGrid showYLabels />
            </div>
          </div>

          <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
            <div class="px-4 pt-4 pb-2">
              <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Monthly comparison</p>
            </div>
            <div style="height: 140px; margin-right: 8px;">
              <BarChartMini data={realMonthlyData} yKey="earnings" xKey="label" barSize={16} radius={4} height={140} color="#C45C38" opacity={0.85} showYLabels />
            </div>
            <div class="h-3"></div>
          </div>

          <div class="rounded-3xl px-5 py-4" style="background: #2E5A3E;">
            <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider mb-3">All-time breakdown</p>
            {#each [
              { label: 'Gross referred purchases', value: realGrossKes, highlight: false },
              { label: `Your commission (${realCommissionRate}%)`, value: realCommissionKes, highlight: true },
              { label: 'Paid sessions', value: realPaidSessions, highlight: false, isCount: true }
            ] as row (row.label)}
              <div class="flex justify-between items-center py-2.5" style="border-bottom: 1px solid rgba(255,255,255,0.14);">
                <span class="text-xs text-[#C4DAC0]">{row.label}</span>
                <span class="text-sm font-bold" style="color: {row.highlight ? '#C45C38' : '#E8D4B0'};">{row.isCount ? row.value : `KES ${row.value.toLocaleString()}`}</span>
              </div>
            {/each}
          </div>
        {/if}
      {:else}
      <div class="flex rounded-2xl overflow-hidden p-1 gap-1" style="background: rgba(46,90,62,0.12);">
        {#each PERIODS as p (p.id)}
          <button onclick={() => (period = p.id)} class="flex-1 py-2 rounded-xl text-[11px] font-bold transition-all" style="background: {period === p.id ? '#2E5A3E' : 'transparent'}; color: {period === p.id ? '#C45C38' : '#3C6A4A'};">
            {p.label}
          </button>
        {/each}
      </div>

      <div class="rounded-3xl px-5 py-5" style="background: #2E5A3E;">
        <p class="text-[10px] text-[#AECAAE] uppercase tracking-widest font-semibold mb-1">
          {period === '7D' ? 'This Week · payout Friday' : period === '30D' ? 'Last 30 Days' : period === '3M' ? 'Last 3 Months' : 'This Year'}
        </p>
        <p class="text-3xl font-bold text-[#E8D4B0]" style="letter-spacing: -1px;">KES {periodTotal.toLocaleString()}</p>
        <p class="text-xs text-[#C4DAC0] mt-1">at 20% commission rate</p>
        <div style="height: 140px; margin-top: 16px; margin-left: -20px; margin-right: -8px;">
          <AreaChartMini data={chartData} yKey="earnings" xKey={period === '1Y' ? 'label' : 'shortLabel'} height={140} color="#C45C38" showGrid showYLabels />
        </div>
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-4 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Monthly comparison</p>
        </div>
        <div style="height: 140px; margin-right: 8px;">
          <BarChartMini data={MONTHLY_DATA} yKey="earnings" xKey="label" barSize={16} radius={4} height={140} color="#C45C38" opacity={0.85} showYLabels />
        </div>
        <div class="h-3"></div>
      </div>

      <div class="rounded-3xl px-5 py-4" style="background: #2E5A3E;">
        <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider mb-3">All-time breakdown</p>
        {#each allTimeBreakdown as row, i (row.label)}
          <div class="flex justify-between items-center py-2.5" style="border-bottom: {i < allTimeBreakdown.length - 1 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <span class="text-xs text-[#C4DAC0]">{row.label}</span>
            <span class="text-sm font-bold" style="color: {row.highlight ? '#C45C38' : '#E8D4B0'};">KES {row.value.toLocaleString()}</span>
          </div>
        {/each}
      </div>
      {/if}
    {/if}

    <!-- USERS -->
    {#if tab === 'users'}
      {#if isReal}
        <!-- Real sessions, not "users" — clients aren't named in this
             system (identified by MAC/phone only), so this is a session
             ledger rather than the roster-with-nudge-buttons concept below,
             which depends on fictional plan/dormancy/lastActive fields.
             Client phone/MAC is never shown here — see sessionRef(). -->
        <p class="text-xs text-[#3C6A4A] font-semibold">{filteredSessions.length} session{filteredSessions.length === 1 ? '' : 's'} · {realUniqueDevices} unique device{realUniqueDevices === 1 ? '' : 's'}</p>
        {#if loadingReal}
          <div class="flex justify-center py-8"><div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div></div>
        {:else if realSessions.length === 0}
          <div class="rounded-2xl px-4 py-8 flex flex-col items-center gap-2" style="background: rgba(46,90,62,0.08);">
            <UserCheck size={24} color="#96B496" />
            <p class="text-xs text-[#96B496]">No sessions referred yet</p>
          </div>
        {:else}
          <!-- Filter -->
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
            <Filter size={12} color="#3C6A4A" class="shrink-0" />
            {#each SESSION_FILTERS as f (f.id)}
              <button
                onclick={() => setSessionsFilter(f.id)}
                class="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
                style="background: {sessionsFilter === f.id ? '#2E5A3E' : 'rgba(46,90,62,0.1)'}; color: {sessionsFilter === f.id ? '#E8D4B0' : '#3C6A4A'};"
              >
                {f.label}
              </button>
            {/each}
          </div>

          {#if filteredSessions.length === 0}
            <div class="rounded-2xl px-4 py-8 flex flex-col items-center gap-2" style="background: rgba(46,90,62,0.08);">
              <p class="text-xs text-[#96B496]">No sessions match this filter.</p>
            </div>
          {:else}
            {#each pagedSessions as s (s.id)}
              {@const status = sessionStatus(s)}
              {@const statusColor = status === 'active' ? '#4E8050' : status === 'expired' ? '#96B496' : status === 'failed' ? '#B85038' : '#CC8830'}
              {@const statusBg = status === 'active' ? 'rgba(78,128,80,0.30)' : status === 'expired' ? 'rgba(255,255,255,0.1)' : status === 'failed' ? 'rgba(192,97,74,0.2)' : 'rgba(204,136,48,0.25)'}
              <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E;">
                <div class="flex items-center gap-3 px-4 py-3.5">
                  <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
                    <Smartphone size={15} color="#C45C38" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-semibold text-[#E8D4B0] truncate">{sessionLabel(s)} · {s.package_id}</p>
                    <p class="text-[10px] text-[#AECAAE]">{new Date(s.created_at).toLocaleDateString()}</p>
                  </div>
                  <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize" style="background: {statusBg}; color: {statusColor};">
                      {status}
                    </span>
                    <p class="text-[10px] font-bold text-[#C45C38]">+KES {Number(s.commission_kes).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            {/each}

            <!-- Pagination -->
            <div class="flex items-center justify-between gap-2 pt-1">
              <div class="flex items-center gap-1.5">
                <span class="text-[10px] text-[#3C6A4A]">Show</span>
                <select
                  value={sessionsPageSize}
                  onchange={(e) => setSessionsPageSize(Number(e.currentTarget.value))}
                  class="text-[11px] font-bold px-2 py-1.5 rounded-lg outline-none"
                  style="background: rgba(46,90,62,0.1); color: #1D3C2A; border: none;"
                >
                  {#each SESSION_PAGE_SIZES as size (size)}
                    <option value={size}>{size}</option>
                  {/each}
                </select>
              </div>
              <div class="flex items-center gap-2">
                <button
                  onclick={() => (sessionsPage = Math.max(1, sessionsPage - 1))}
                  disabled={sessionsPage <= 1}
                  class="w-7 h-7 rounded-full flex items-center justify-center"
                  style="background: rgba(46,90,62,0.1); opacity: {sessionsPage <= 1 ? 0.4 : 1};"
                >
                  <ChevronLeft size={13} color="#1D3C2A" />
                </button>
                <span class="text-[11px] font-semibold text-[#1D3C2A]">Page {sessionsPage} of {sessionsTotalPages}</span>
                <button
                  onclick={() => (sessionsPage = Math.min(sessionsTotalPages, sessionsPage + 1))}
                  disabled={sessionsPage >= sessionsTotalPages}
                  class="w-7 h-7 rounded-full flex items-center justify-center"
                  style="background: rgba(46,90,62,0.1); opacity: {sessionsPage >= sessionsTotalPages ? 0.4 : 1};"
                >
                  <ChevronRight size={13} color="#1D3C2A" />
                </button>
              </div>
            </div>
          {/if}
        {/if}
      {:else}
      <p class="text-xs text-[#3C6A4A] font-semibold">{MOCK_ROSTER.length} total · sorted by value · {expiringUsers.length} expiring soon</p>
      {#each sortedRoster as u, rank (u.name)}
        {@const isDormant = u.status === 'dormant'}
        {@const hasNudged = nudged[u.name]}
        {@const exp = daysUntilExpiry(u)}
        {@const isExpiring = u.status === 'active' && exp >= 0 && exp <= 1}
        {@const borderColor = isDormant ? 'rgba(192,97,74,0.3)' : isExpiring ? 'rgba(196,92,56,0.4)' : 'rgba(255,255,255,0.04)'}
        <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid {borderColor};">
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 relative" style="background: {isDormant ? 'rgba(192,97,74,0.15)' : rank === 0 ? 'rgba(196,92,56,0.25)' : 'rgba(196,92,56,0.28)'};">
              <span class="text-xs font-bold" style="color: {isDormant ? '#B85038' : '#C45C38'};">{inits(u.name)}</span>
              {#if rank === 0}<span class="absolute -top-1 -right-1 text-[9px]">🏆</span>{/if}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{u.name}</p>
              <p class="text-[10px] text-[#AECAAE]">+254 {u.phone} · {u.plan}</p>
              <p class="text-[10px] font-bold text-[#C45C38]">+KES {Math.round(u.paid * COMMISSION_RATE)} commission</p>
            </div>
            <div class="flex flex-col items-end gap-1.5 shrink-0">
              {#if isExpiring}
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(196,92,56,0.30); color: #C45C38;">{exp === 0 ? 'Expires today' : 'Tomorrow'}</span>
              {:else}
                <span class="text-[10px] font-semibold px-2 py-0.5 rounded-full" style="background: {isDormant ? 'rgba(192,97,74,0.15)' : 'rgba(78,128,80,0.30)'}; color: {isDormant ? '#B85038' : '#4E8050'};">
                  {isDormant ? `${u.lastActive}d idle` : u.lastActive === 0 ? 'Active now' : `${u.lastActive}d ago`}
                </span>
              {/if}
              {#if isDormant || isExpiring}
                {@const sent = isDormant ? hasNudged : !!reminded[u.name]}
                <button
                  onclick={() => (isDormant ? (nudged[u.name] = true) : (reminded[u.name] = true))}
                  disabled={sent}
                  class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style="background: {sent ? 'rgba(78,128,80,0.30)' : 'rgba(196,92,56,0.35)'}; color: {sent ? '#4E8050' : '#C45C38'};"
                >
                  {#if sent}<CheckCircle2 size={10} /> Sent{:else if isDormant}<Bell size={10} /> Nudge{:else}<MessageCircle size={10} /> Remind{/if}
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
      {/if}
    {/if}

    <!-- PAYOUTS -->
    {#if tab === 'payouts'}
      {#if isReal}
        <!-- No real payout ledger exists yet — commission is tracked, but
             nothing marks it as "paid out" vs. "owed". Showing the old fake
             payout dates/amounts here would look like real transaction
             history, so this is a plain balance summary instead. -->
        <div class="rounded-3xl px-5 py-5" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.35);">
          <div class="flex items-center gap-2 mb-3">
            <Wallet size={16} color="#C45C38" />
            <p class="text-xs text-[#C4DAC0] uppercase tracking-widest font-semibold">All-time commission earned</p>
          </div>
          <p class="text-4xl font-bold text-[#C45C38]" style="letter-spacing: -1px;">KES {realCommissionKes.toLocaleString()}</p>
          <p class="text-xs text-[#AECAAE] mt-1">Payout tracking isn't wired up yet — talk to your coordinator about settlement.</p>
        </div>
      {:else}
      <div class="rounded-3xl px-5 py-5" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.35);">
        <div class="flex items-center gap-2 mb-3">
          <Wallet size={16} color="#C45C38" />
          <p class="text-xs text-[#C4DAC0] uppercase tracking-widest font-semibold">Available balance</p>
        </div>
        <p class="text-4xl font-bold text-[#C45C38]" style="letter-spacing: -1px;">KES {Math.round(LIFETIME_TOTAL * 0.25).toLocaleString()}</p>
        <p class="text-xs text-[#AECAAE] mt-1">Next payout: 1 Aug 2025</p>
        <button class="mt-4 w-full py-3 rounded-2xl font-bold text-sm" style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;">Request Early Payout</button>
      </div>

      <div class="grid grid-cols-2 gap-2">
        {#each payoutStats as ps (ps.label)}
          {@const Icon = ps.icon}
          <div class="rounded-2xl px-4 py-4" style="background: #2E5A3E;">
            <Icon size={16} color="#C45C38" />
            <p class="text-[10px] text-[#C4DAC0] mt-2 uppercase tracking-wider">{ps.label}</p>
            <p class="text-base font-bold text-[#E8D4B0] mt-0.5">{ps.value}</p>
          </div>
        {/each}
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-4 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Payout History</p>
        </div>
        {#each PAYOUT_HISTORY as p, i (p.date)}
          <div class="flex items-center gap-3 px-4 py-3.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(78,128,80,0.30);">
              <CheckCircle2 size={15} color="#4E8050" />
            </div>
            <div class="flex-1">
              <p class="text-xs font-semibold text-[#E8D4B0]">{p.date}</p>
              <p class="text-[10px] text-[#AECAAE]">M-PESA transfer</p>
            </div>
            <div class="text-right">
              <p class="text-sm font-bold text-[#E8D4B0]">KES {p.amount.toLocaleString()}</p>
              <p class="text-[10px] font-semibold" style="color: #4E8050;">{p.status}</p>
            </div>
          </div>
        {/each}
        <div class="h-3"></div>
      </div>
      {/if}
    {/if}

    <!-- PROFILE -->
    {#if tab === 'profile'}
      <div class="rounded-3xl px-5 py-5 flex flex-col items-center gap-4" style="background: #2E5A3E;">
        <div class="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold shadow-lg" style="background: {avatarColor}; color: #fff; letter-spacing: -0.5px;">
          {initials}
        </div>
        <div>
          <p class="text-[10px] text-[#C4DAC0] uppercase tracking-widest font-semibold text-center mb-2">Avatar colour</p>
          <div class="flex gap-2">
            {#each AVATAR_COLORS as c (c)}
              <button
                onclick={() => (avatarColor = c)}
                class="w-7 h-7 rounded-full transition-all"
                style="background: {c}; transform: {avatarColor === c ? 'scale(1.25)' : 'scale(1)'}; box-shadow: {avatarColor === c ? `0 0 0 2px #2E5A3E, 0 0 0 4px ${c}` : 'none'};"
                aria-label="Avatar colour"
              ></button>
            {/each}
          </div>
        </div>
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-5 pt-4 pb-2 flex items-center justify-between">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Your details</p>
          {#if !editingProfile}
            <button onclick={() => { profileDraft = { name: fullName, territory, mpesa }; profileError = ''; editingProfile = true; }} class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style="background: rgba(196,92,56,0.30); color: #C45C38;">
              <Edit3 size={10} /> Edit
            </button>
          {:else}
            <button
              onclick={saveProfile}
              disabled={profileSaving}
              class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style="background: rgba(78,128,80,0.35); color: #4E8050; opacity: {profileSaving ? 0.7 : 1};"
            >
              {#if profileSaving}
                <div class="w-2.5 h-2.5 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
              {:else}
                <Save size={10} />
              {/if}
              Save
            </button>
          {/if}
        </div>

        {#if profileError}
          <p class="text-[11px] px-5 pb-1" style="color: #E08A6A;">{profileError}</p>
        {/if}

        {#each profileFields as f, i (f.label)}
          {@const Icon = f.icon}
          <div class="flex items-start gap-3 px-5 py-3.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <div class="mt-0.5 shrink-0"><Icon size={14} color={avatarColor} /></div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] text-[#AECAAE] uppercase tracking-wider font-semibold mb-0.5">{f.label}</p>
              {#if editingProfile}
                <input
                  type={f.key === 'mpesa' ? 'tel' : 'text'}
                  value={f.value}
                  placeholder={f.placeholder}
                  oninput={(e) => (profileDraft[f.key] = e.currentTarget.value)}
                  class="w-full bg-transparent text-sm font-semibold text-[#E8D4B0] outline-none placeholder:text-[#4A6842]"
                />
              {:else}
                <p class="text-sm font-semibold" style="color: {f.value ? '#E8D4B0' : '#4A6842'};">{f.value || f.placeholder}</p>
              {/if}
            </div>
          </div>
        {/each}

        <div class="flex items-center gap-3 px-5 py-3.5" style="border-top: 1px solid rgba(255,255,255,0.14);">
          <Award size={14} color={avatarColor} />
          <div>
            <p class="text-[10px] text-[#AECAAE] uppercase tracking-wider font-semibold mb-0.5">Activator ID</p>
            <p class="text-sm font-semibold text-[#E8D4B0]">{activator.id}</p>
          </div>
        </div>
        <div class="h-2"></div>
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-5 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Goal defaults</p>
        </div>
        {#each goalDefaults as g, i (g.label)}
          <button onclick={g.action} class="w-full flex items-center justify-between px-5 py-3.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <span class="text-sm text-[#E8D4B0] font-medium">{g.label}</span>
            <div class="flex items-center gap-2">
              <span class="text-sm font-bold" style="color: {avatarColor};">{g.value}</span>
              <Edit3 size={12} color="#AECAAE" />
            </div>
          </button>
        {/each}
        <div class="h-2"></div>
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-5 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Notifications</p>
        </div>
        {#each notifRows as row, i (row.key)}
          <div class="flex items-center justify-between px-5 py-3.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.14)' : 'none'};">
            <div>
              <p class="text-sm text-[#E8D4B0] font-medium">{row.label}</p>
              <p class="text-[10px] text-[#AECAAE]">{row.sub}</p>
            </div>
            <button onclick={() => (notifs[row.key] = !notifs[row.key])} class="w-11 h-6 rounded-full relative transition-all shrink-0" style="background: {notifs[row.key] ? avatarColor : 'rgba(255,255,255,0.12)'};" aria-label={row.label}>
              <div class="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style="left: {notifs[row.key] ? 'calc(100% - 22px)' : '2px'};"></div>
            </button>
          </div>
        {/each}
        <div class="h-2"></div>
      </div>

      <div class="rounded-3xl px-5 py-4" style="background: #2E5A3E;">
        <div class="flex items-center gap-2 mb-2">
          <ArrowUpRight size={14} color={avatarColor} />
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Your invite link</p>
        </div>
        <div class="flex items-center gap-2 px-3 py-2.5 rounded-2xl mb-2" style="background: rgba(0,0,0,0.2);">
          <p class="flex-1 text-xs text-[#E8D4B0] font-mono truncate">{INVITE_LINK}</p>
          <button onclick={copyLink} class="shrink-0 flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg" style="background: {linkCopied ? 'rgba(78,128,80,0.35)' : 'rgba(196,92,56,0.30)'}; color: {linkCopied ? '#4E8050' : '#C45C38'};">
            {#if linkCopied}<CheckCircle2 size={10} /> Copied{:else}<Copy size={10} /> Copy{/if}
          </button>
        </div>
        <p class="text-[10px] text-[#AECAAE]">Share to onboard new users. You earn 20% on every purchase they make.</p>
      </div>

      <button onclick={onLogout} class="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm" style="background: rgba(192,97,74,0.1); border: 1px solid rgba(192,97,74,0.2); color: #B85038;">
        <LogOut size={15} /> Sign out
      </button>
    {/if}
  </div>
</div>
