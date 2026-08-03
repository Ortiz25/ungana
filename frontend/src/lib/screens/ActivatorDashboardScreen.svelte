<script>
  import {
    MapPin, Edit3, LogOut, ArrowUpRight, TrendingUp, BarChart2, UserCheck, Wallet, User,
    Clock, CheckCircle2, MessageCircle, Bell, Award, CreditCard, Save, Copy
  } from '@lucide/svelte';
  import BarChartMini from '$lib/components/BarChartMini.svelte';
  import AreaChartMini from '$lib/components/AreaChartMini.svelte';
  import {
    MOCK_ROSTER, daysUntilExpiry, COMMISSION_RATE, ALL_DAILY, MONTHLY_DATA,
    LIFETIME_TOTAL, THIS_WEEK, LAST_WEEK, WEEK_GROWTH, TODAY_EARN, YESTERDAY
  } from '$lib/data.js';

  let { activator, onLogout } = $props();

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
  let displayName = $state(activator.name.split(' ')[0]);
  let territory = $state(activator.area);
  let mpesa = $state('');
  let avatarColor = $state(AVATAR_COLORS[0]);
  let editingProfile = $state(false);
  let profileDraft = $state({ name: activator.name.split(' ')[0], territory: activator.area, mpesa: '' });
  let notifs = $state({ expiring: true, dormant: true, goalMiss: true, newPurchase: false });

  const initials = $derived(displayName.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2));

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

  const statsStrip = $derived([
    { label: 'This Week', value: `KES ${THIS_WEEK.toLocaleString()}`, sub: 'payout Fri', alert: THIS_WEEK < LAST_WEEK },
    { label: 'Users', value: MOCK_ROSTER.length, sub: `${activeUsers} active`, alert: false },
    { label: 'Dormant', value: dormantUsers.length, sub: 'need nudging', alert: dormantUsers.length > 0 }
  ]);

  const profileFields = $derived([
    { icon: User, label: 'Display name', key: 'name', placeholder: 'How you want to be known', value: editingProfile ? profileDraft.name : displayName },
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
      <p class="text-4xl font-bold text-[#E8D4B0]" style="letter-spacing: -1.5px;">KES {LIFETIME_TOTAL.toLocaleString()}</p>
      <div class="flex items-center gap-2 mt-2">
        <div class="flex items-center gap-1 px-2 py-0.5 rounded-full" style="background: {WEEK_GROWTH >= 0 ? 'rgba(78,128,80,0.35)' : 'rgba(192,97,74,0.2)'};">
          <ArrowUpRight size={12} color={WEEK_GROWTH >= 0 ? '#4E8050' : '#B85038'} />
          <span class="text-[11px] font-bold" style="color: {WEEK_GROWTH >= 0 ? '#4E8050' : '#B85038'};">{WEEK_GROWTH}% vs last week</span>
        </div>
        <span class="text-[10px] text-[#AECAAE]">20% commission rate</span>
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

    <!-- EARNINGS -->
    {#if tab === 'earnings'}
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
          <AreaChartMini data={chartData} yKey="earnings" xKey={period === '1Y' ? 'label' : 'shortLabel'} height={140} color="#C45C38" showGrid />
        </div>
      </div>

      <div class="rounded-3xl overflow-hidden" style="background: #2E5A3E;">
        <div class="px-4 pt-4 pb-2">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Monthly comparison</p>
        </div>
        <div style="height: 140px; margin-right: 8px;">
          <BarChartMini data={MONTHLY_DATA} yKey="earnings" xKey="label" barSize={16} radius={4} height={140} color="#C45C38" opacity={0.85} />
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

    <!-- USERS -->
    {#if tab === 'users'}
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

    <!-- PAYOUTS -->
    {#if tab === 'payouts'}
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
            <button onclick={() => { profileDraft = { name: displayName, territory, mpesa }; editingProfile = true; }} class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style="background: rgba(196,92,56,0.30); color: #C45C38;">
              <Edit3 size={10} /> Edit
            </button>
          {:else}
            <button
              onclick={() => { displayName = profileDraft.name || displayName; territory = profileDraft.territory; mpesa = profileDraft.mpesa; editingProfile = false; }}
              class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full"
              style="background: rgba(78,128,80,0.35); color: #4E8050;"
            >
              <Save size={10} /> Save
            </button>
          {/if}
        </div>

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
