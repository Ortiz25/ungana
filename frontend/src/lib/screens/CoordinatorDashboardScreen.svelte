<script>
  import { onMount } from 'svelte';
  import {
    ShieldCheck, MapPin, LogOut, ArrowLeft, TrendingUp, TrendingDown, Minus, Radio, Users,
    Wallet, Award, AlertTriangle, Clock, Edit3, MessageCircle, Send, CheckCircle2, Eye,
    ChevronRight, ChevronDown, RefreshCw, WifiOff, Bell
  } from '@lucide/svelte';
  import BarChartMini from '$lib/components/BarChartMini.svelte';
  import {
    ACCESS_POINTS, COORD_ACTS, INIT_ESCALATIONS, ACT_WEEKLY, ACT_MONTHLY, ACT_DAYS, ACT_YEARLY
  } from '$lib/data.js';
  import { getCoordinatorActivators, getCoordinatorEarnings } from '$lib/api.js';

  let { coordinator, onLogout } = $props();

  // Real login (see CoordinatorLoginScreen) carries a JWT; the offline
  // demo fallback doesn't. Network health/APs and escalations below are
  // facility-wide mock data unrelated to which coordinator is logged in —
  // that's a separate feature (real AP monitoring + a ticketing system)
  // that doesn't exist yet, so those two tabs stay demo-only in both modes.
  // Team performance vs. weekly/monthly targets (COORD_ACTS) IS
  // coordinator-specific data the backend can now provide for real, so that
  // part switches to live data when isReal — without the target-tracking
  // UI, since no real per-activator targets exist to track against.
  const isReal = !!coordinator.token;
  let realActivators = $state([]);
  let realEarnings = $state(null);
  let loadingReal = $state(isReal);

  onMount(async () => {
    if (!isReal) return;
    const [activatorsResult, earningsResult] = await Promise.all([
      getCoordinatorActivators(coordinator.token),
      getCoordinatorEarnings(coordinator.token)
    ]);
    if (activatorsResult.ok) realActivators = activatorsResult.data?.activators ?? [];
    if (earningsResult.ok) realEarnings = earningsResult.data?.earnings ?? null;
    loadingReal = false;
  });

  const realGrossKes = $derived(Number(realEarnings?.gross_kes ?? 0));
  const realCommissionKes = $derived(Number(realEarnings?.commission_kes ?? 0));
  const realPaidSessions = $derived(Number(realEarnings?.paid_sessions ?? 0));
  const realActivatorCount = $derived(Number(realEarnings?.activator_count ?? realActivators.length));

  let tab = $state('overview');
  let escalations = $state(INIT_ESCALATIONS.map((e) => ({ ...e })));
  let actTargets = $state({});
  let editingTarget = $state(null);
  let targetInput = $state('');
  let nudgedActs = $state({});
  let composing = $state(false);
  let composeText = $state('');
  let drillActId = $state(null);
  let teamSort = $state('target');
  let teamFilter = $state('all');
  let revPeriod = $state('week');
  let teamPeriod = $state('week');

  function getActPeriodStats(a, prd) {
    const weekArr = ACT_WEEKLY[a.id] ?? [0, 0, 0, 0, 0, 0, 0];
    const monthArr = ACT_MONTHLY[a.id] ?? [];
    const yearArr = ACT_YEARLY[a.id] ?? [];
    const customWeekTarget = actTargets[a.id] ?? a.weekTarget;
    switch (prd) {
      case 'day':
        return { earn: weekArr[weekArr.length - 1], target: a.dailyTarget, label: 'today' };
      case 'week':
        return { earn: a.weekEarn, target: customWeekTarget, label: 'this week' };
      case 'month':
        return { earn: monthArr.reduce((s, w) => s + w.earn, 0), target: customWeekTarget * 4, label: 'this month' };
      case 'year':
        return { earn: yearArr.reduce((s, m) => s + m.earn, 0), target: customWeekTarget * 52, label: 'this year' };
    }
  }

  // Network metrics (static source data)
  const onlineAPs = ACCESS_POINTS.filter((ap) => ap.status === 'online').length;
  const offlineAPs = ACCESS_POINTS.filter((ap) => ap.status === 'offline').length;
  const degradedAPs = ACCESS_POINTS.filter((ap) => ap.status === 'degraded').length;
  const totalUsers = ACCESS_POINTS.reduce((s, ap) => s + ap.users, 0);
  const networkHealth = Math.round(
    ACCESS_POINTS.reduce((s, ap) => s + ap.uptime * ap.capacity, 0) / ACCESS_POINTS.reduce((s, ap) => s + ap.capacity, 0)
  );
  const healthColor = networkHealth >= 90 ? '#4E8050' : networkHealth >= 70 ? '#CC8830' : '#B85038';
  const healthLabel = networkHealth >= 90 ? 'Healthy' : networkHealth >= 70 ? 'Degraded' : 'Critical';
  const totalCapacity = ACCESS_POINTS.reduce((s, a) => s + a.capacity, 0);

  const openEscs = $derived(escalations.filter((e) => e.status === 'open'));
  const weeklyRevenue = COORD_ACTS.reduce((s, a) => s + a.weekEarn, 0);
  const monthlyRevenue = COORD_ACTS.reduce((s, a) => {
    const m = ACT_MONTHLY[a.id];
    return s + (m ? m.slice(0, 3).reduce((x, w) => x + w.earn, 0) + a.weekEarn : a.weekEarn);
  }, 0);

  const sortedAPs = [...ACCESS_POINTS].sort((a, b) => {
    const o = { offline: 0, degraded: 1, online: 2 };
    return o[a.status] - o[b.status];
  });

  function actPct(a) {
    const { earn, target } = getActPeriodStats(a, teamPeriod);
    return Math.min(Math.round((earn / target) * 100), 999);
  }

  const filteredActs = $derived(
    COORD_ACTS.filter((a) => {
      const p = actPct(a);
      if (teamFilter === 'risk') return p < 70;
      if (teamFilter === 'ontrack') return p >= 70 && p < 100;
      if (teamFilter === 'exceeding') return p >= 100;
      return true;
    })
  );

  const sortedActs = $derived(
    [...filteredActs].sort((a, b) => {
      if (teamSort === 'earnings') return getActPeriodStats(b, teamPeriod).earn - getActPeriodStats(a, teamPeriod).earn;
      if (teamSort === 'users') return b.users - a.users;
      return actPct(a) - actPct(b);
    })
  );

  const atRiskActs = $derived(COORD_ACTS.filter((a) => actPct(a) < 70));

  const AP_STATUS_COLOR = { online: '#4E8050', degraded: '#CC8830', offline: '#B85038' };
  const ESC_PRIORITY_COLOR = { high: '#B85038', medium: '#CC8830', low: '#C4DAC0' };

  function resolveEsc(id) {
    escalations = escalations.map((e) => (e.id === id ? { ...e, status: 'resolved' } : e));
  }
  function escalateEsc(id) {
    escalations = escalations.map((e) => (e.id === id ? { ...e, status: 'escalated' } : e));
  }

  const DRILL_PERIODS = [
    { id: 'day', label: 'Today' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
    { id: 'year', label: 'Year' }
  ];

  const drillAct = $derived(drillActId ? COORD_ACTS.find((a) => a.id === drillActId) : null);

  function inits(name) {
    return name.split(' ').map((n) => n[0]).join('');
  }

  const HERO_BG =
    'linear-gradient(170deg, rgba(29,60,42,0.88) 0%, rgba(29,60,42,0.78) 40%, rgba(29,60,42,0.95) 100%), url("https://images.unsplash.com/photo-1664181220731-06219378d8c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxLZW55YSUyME5haXJvYmklMjBjb21tdW5pdHklMjBtYXJrZXQlMjB2aWJyYW50fGVufDF8fHx8MTc4NTI0ODU0OXww&ixlib=rb-4.1.0&q=80&w=1080")';
  const DRILL_BG =
    'linear-gradient(170deg, rgba(29,60,42,0.92) 0%, rgba(29,60,42,0.82) 40%, rgba(29,60,42,0.96) 100%), url("https://images.unsplash.com/photo-1664181220731-06219378d8c7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080")';
</script>

{#if drillAct}
  {@const stats = getActPeriodStats(drillAct, teamPeriod)}
  {@const periodEarn = stats.earn}
  {@const periodTarget = stats.target}
  {@const periodLabel = stats.label}
  {@const pct = Math.min(Math.round((periodEarn / periodTarget) * 100), 100)}
  {@const bc = pct >= 100 ? '#4E8050' : pct >= 70 ? '#C45C38' : '#B85038'}
  {@const weekDays = (ACT_WEEKLY[drillAct.id] ?? [0, 0, 0, 0, 0, 0, 0]).map((earn, i) => ({ day: ACT_DAYS[i], earn }))}
  {@const monthData = ACT_MONTHLY[drillAct.id] ?? []}
  {@const yearData = ACT_YEARLY[drillAct.id] ?? []}
  {@const rank = [...COORD_ACTS].sort((a, b) => actPct(b) - actPct(a)).findIndex((a) => a.id === drillAct.id) + 1}
  {@const dailyAvg = Math.round(drillAct.weekEarn / 6)}
  {@const isEditing = editingTarget === drillAct.id}
  {@const escForAct = escalations.filter((e) => e.activator === drillAct.name && e.status !== 'resolved')}
  {@const circumference = 226.2}
  {@const drillStats = [
    { label: 'Users', value: drillAct.users, sub: 'active', alert: false },
    { label: 'Dormant', value: drillAct.dormant, sub: 'users', alert: drillAct.dormant > 1 },
    { label: 'Earned', value: `KES ${periodEarn}`, sub: periodLabel, alert: false },
    { label: 'Daily Avg', value: `KES ${dailyAvg}`, sub: 'avg/day', alert: false }
  ]}

  <div style="min-height: 100dvh; background: #E8D4B0;">
    <!-- Drilldown header -->
    <div class="px-5 pt-5 pb-16" style={`background-image: ${DRILL_BG}; background-size: cover; background-position: center;`}>
      <div class="flex items-center gap-3 mb-5">
        <button onclick={() => (drillActId = null)} class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.10);">
          <ArrowLeft size={15} color="#E8D4B0" />
        </button>
        <p class="text-[10px] text-[#C4DAC0] font-semibold uppercase tracking-widest">Activator Profile</p>
        <div class="ml-auto flex rounded-xl overflow-hidden" style="background: rgba(0,0,0,0.2);">
          {#each DRILL_PERIODS as p (p.id)}
            <button onclick={() => (teamPeriod = p.id)} class="px-2.5 py-1 text-[9px] font-bold" style="background: {teamPeriod === p.id ? '#C45C38' : 'transparent'}; color: {teamPeriod === p.id ? '#fff' : '#96B496'};">
              {p.label}
            </button>
          {/each}
        </div>
      </div>
      <div class="flex items-center gap-4">
        <div class="relative w-20 h-20 shrink-0">
          <svg viewBox="0 0 100 100" class="w-full h-full" style="transform: rotate(-90deg);">
            <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="10" />
            <circle cx="50" cy="50" r="36" fill="none" stroke={bc} stroke-width="10" stroke-linecap="round" stroke-dasharray={`${(pct / 100) * circumference} ${circumference}`} />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-lg font-bold text-[#E8D4B0]">{pct}%</span>
            <span class="text-[7px] text-[#C4DAC0] uppercase tracking-wider">target</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-0.5">
            <p class="text-base font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">{drillAct.name}</p>
            {#if drillAct.trend === 'up'}<TrendingUp size={13} color="#4E8050" />{/if}
            {#if drillAct.trend === 'down'}<TrendingDown size={13} color="#B85038" />{/if}
            {#if drillAct.streak >= 5}<span class="text-xs">🔥</span>{/if}
          </div>
          <p class="text-[10px] text-[#C4DAC0] flex items-center gap-1 mb-2"><MapPin size={9} />{drillAct.area}</p>
          <div class="flex items-center gap-2">
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background: {bc}22; color: {bc};">{pct >= 100 ? 'On Target' : pct >= 70 ? 'Watch' : 'At Risk'}</span>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(255,255,255,0.18); color: #C4DAC0;">#{rank} of {COORD_ACTS.length}</span>
            {#if drillAct.streak > 0}
              <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(204,136,48,0.15); color: #CC8830;">{drillAct.streak}d streak</span>
            {/if}
          </div>
        </div>
      </div>
    </div>

    <!-- Stats strip -->
    <div class="mx-4 -mt-10 rounded-3xl shadow-xl mb-4 grid grid-cols-4 divide-x overflow-hidden" style="background: #162C1E;">
      {#each drillStats as s (s.label)}
        <div class="flex flex-col items-center py-3 px-1.5" style="border-color: rgba(255,255,255,0.14);">
          <span class="text-xs font-bold leading-tight text-center" style="color: {s.alert ? '#B85038' : '#C45C38'};">{s.value}</span>
          <span class="text-[8px] uppercase tracking-wider mt-0.5 text-center" style="color: {s.alert ? '#C07860' : '#C4DAC0'};">{s.label}</span>
          <span class="text-[8px] text-[#96B496] mt-0.5 text-center">{s.sub}</span>
        </div>
      {/each}
    </div>

    <div class="px-4 pb-8 flex flex-col gap-3">
      {#if escForAct.length > 0}
        <div class="rounded-2xl px-4 py-3 flex items-center gap-2" style="background: rgba(184,80,56,0.08); border: 1px solid rgba(184,80,56,0.3);">
          <AlertTriangle size={13} color="#B85038" />
          <p class="text-xs font-semibold text-[#1D3C2A]">{escForAct.length} open issue{escForAct.length > 1 ? 's' : ''} from this activator</p>
          <button onclick={() => { drillActId = null; tab = 'escalations'; }} class="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-lg" style="background: rgba(184,80,56,0.12); color: #B85038;">View →</button>
        </div>
      {/if}

      {#if drillAct.dormant > 1}
        <div class="rounded-2xl px-4 py-3 flex items-center gap-2" style="background: rgba(204,136,48,0.07); border: 1px solid rgba(204,136,48,0.25);">
          <Clock size={13} color="#CC8830" />
          <p class="text-xs font-semibold text-[#1D3C2A]">{drillAct.dormant} dormant users — re-engagement opportunity</p>
        </div>
      {/if}

      <!-- Progress card -->
      <div class="rounded-2xl px-4 pt-4 pb-3" style="background: #2E5A3E;">
        <div class="flex justify-between items-center mb-3">
          <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider capitalize">{periodLabel}</p>
          <div class="flex items-center gap-1.5">
            <span class="text-sm font-bold text-[#E8D4B0]">KES {periodEarn.toLocaleString()}</span>
            <span class="text-xs text-[#96B496]">/ {periodTarget.toLocaleString()}</span>
          </div>
        </div>
        <div class="h-2 rounded-full overflow-hidden mb-1" style="background: rgba(255,255,255,0.18);">
          <div class="h-full rounded-full transition-all" style="width: {pct}%; background: {bc};"></div>
        </div>
        <div class="flex justify-between text-[9px] text-[#96B496] mb-3">
          <span>KES {Math.max(periodTarget - periodEarn, 0).toLocaleString()} to go</span>
          {#if teamPeriod === 'week'}
            <button onclick={() => { editingTarget = drillAct.id; targetInput = String(actTargets[drillAct.id] ?? drillAct.weekTarget); }} class="flex items-center gap-0.5 font-bold" style="color: #C45C38;">
              <Edit3 size={9} /> Edit Target
            </button>
          {/if}
        </div>
        {#if isEditing}
          <div class="flex gap-2 items-center mb-3">
            <div class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl" style="background: rgba(0,0,0,0.2);">
              <span class="text-[10px] text-[#C4DAC0]">KES</span>
              <input type="number" bind:value={targetInput} class="flex-1 bg-transparent text-sm font-bold text-[#E8D4B0] outline-none min-w-0" />
            </div>
            <button onclick={() => { const v = parseInt(targetInput, 10); if (v > 0) actTargets[drillAct.id] = v; editingTarget = null; }} class="px-3 py-1.5 rounded-xl text-xs font-bold" style="background: #C45C38; color: #fff;">Set</button>
          </div>
        {/if}
        {#if teamPeriod === 'day'}
          <div class="flex flex-col items-center py-2 gap-1">
            <p class="text-2xl font-bold" style="color: {bc}; font-family: 'Playfair Display', serif;">KES {periodEarn}</p>
            <p class="text-[10px] text-[#96B496]">today vs KES {drillAct.dailyTarget} daily target</p>
          </div>
        {/if}
        {#if teamPeriod === 'week'}
          <BarChartMini data={weekDays} yKey="earn" xKey="day" height={70} color={bc} barSize={18} radius={4} showGrid labelColor="#96B496" />
        {/if}
        {#if teamPeriod === 'month' && monthData.length > 0}
          <BarChartMini data={monthData} yKey="earn" xKey="w" height={70} color={bc} barSize={22} radius={4} showGrid labelColor="#96B496" />
        {/if}
        {#if teamPeriod === 'year' && yearData.length > 0}
          <BarChartMini data={yearData} yKey="earn" xKey="m" height={70} color={bc} barSize={13} radius={4} showGrid labelColor="#96B496" labelSize={8} />
        {/if}
      </div>

      <!-- Action buttons -->
      <div class="grid grid-cols-2 gap-2">
        <button onclick={() => (nudgedActs[drillAct.id] = true)} disabled={nudgedActs[drillAct.id]} class="py-3 rounded-2xl flex flex-col items-center gap-1.5" style="background: {nudgedActs[drillAct.id] ? 'rgba(78,128,80,0.30)' : 'rgba(196,92,56,0.30)'}; border: 1px solid {nudgedActs[drillAct.id] ? 'rgba(78,128,80,0.35)' : 'rgba(196,92,56,0.35)'};">
          {#if nudgedActs[drillAct.id]}
            <CheckCircle2 size={16} color="#4E8050" /><span class="text-[10px] font-bold text-[#4E8050]">Message Sent</span>
          {:else}
            <MessageCircle size={16} color="#C45C38" /><span class="text-[10px] font-bold text-[#C45C38]">{pct < 70 ? 'Coach Now' : 'Encourage'}</span>
          {/if}
        </button>
        <button onclick={() => { editingTarget = drillAct.id; targetInput = String(actTargets[drillAct.id] ?? drillAct.weekTarget); }} class="py-3 rounded-2xl flex flex-col items-center gap-1.5" style="background: rgba(46,90,62,0.15); border: 1px solid rgba(46,90,62,0.2);">
          <Edit3 size={16} color="#4E8050" />
          <span class="text-[10px] font-bold text-[#4E8050]">Adjust Target</span>
        </button>
      </div>

      {#if pct < 70}
        <button onclick={() => { drillActId = null; tab = 'escalations'; composing = true; composeText = `Activator ${drillAct.name} (${drillAct.area}) is at ${pct}% of weekly target. Requesting support.`; }} class="w-full py-3 rounded-2xl flex items-center justify-center gap-2" style="background: rgba(184,80,56,0.22); border: 1px solid rgba(184,80,56,0.25);">
          <Send size={13} color="#B85038" />
          <span class="text-xs font-bold text-[#B85038]">Escalate Performance to Central</span>
        </button>
      {/if}
    </div>
  </div>
{:else}
  <div style="min-height: 100dvh; background: #E8D4B0;">
    <!-- Hero header -->
    <div class="px-5 pt-5 pb-20" style={`background-image: ${HERO_BG}; background-size: cover; background-position: center;`}>
      <div class="flex items-center justify-between mb-5">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style="background: #C45C38;">
            <ShieldCheck size={18} color="#fff" />
          </div>
          <div>
            <p class="text-[9px] text-[#C4DAC0] font-semibold uppercase tracking-widest">Coordinator · {coordinator.id}</p>
            <p class="text-sm font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">{coordinator.name}</p>
            <p class="text-[10px] text-[#AECAAE] flex items-center gap-1"><MapPin size={9} />{coordinator.area}</p>
          </div>
        </div>
        <button onclick={onLogout} class="w-8 h-8 rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.18);">
          <LogOut size={14} color="#C4DAC0" />
        </button>
      </div>

      <!-- Network health donut -->
      <div class="flex items-center gap-5">
        <div class="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 100 100" class="w-full h-full" style="transform: rotate(-90deg);">
            <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="10" />
            <circle cx="50" cy="50" r="36" fill="none" stroke={healthColor} stroke-width="10" stroke-linecap="round" stroke-dasharray={`${(networkHealth / 100) * 226.2} 226.2`} />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-xl font-bold text-[#E8D4B0]">{networkHealth}%</span>
            <span class="text-[8px] text-[#C4DAC0] uppercase tracking-wider">health</span>
          </div>
        </div>
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <div class="w-2 h-2 rounded-full" style="background: {healthColor};"></div>
            <span class="text-sm font-bold" style="color: {healthColor};">{healthLabel}</span>
          </div>
          <p class="text-[10px] text-[#C4DAC0] mb-2">{coordinator.area} network</p>
          <div class="grid grid-cols-3 gap-1.5">
            {#each [{ v: onlineAPs, l: 'Online', c: '#4E8050' }, { v: degradedAPs, l: 'Degraded', c: '#CC8830' }, { v: offlineAPs, l: 'Offline', c: '#B85038' }] as g (g.l)}
              <div class="rounded-xl px-2 py-1.5 flex flex-col items-center" style="background: rgba(255,255,255,0.14);">
                <span class="text-sm font-bold" style="color: {g.c};">{g.v}</span>
                <span class="text-[8px] text-[#C4DAC0]">{g.l}</span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </div>

    <!-- Floating stats strip -->
    <div class="mx-4 -mt-12 rounded-3xl shadow-xl mb-4 grid grid-cols-3 divide-x overflow-hidden" style="background: #162C1E;">
      {#each [{ label: 'Active Users', value: totalUsers, sub: `of ${totalCapacity} capacity`, alert: false, dest: 'network' }, isReal ? { label: 'Activators', value: realActivatorCount, sub: `${realPaidSessions} paid sessions`, alert: false, dest: 'activators' } : { label: 'Activators', value: COORD_ACTS.length, sub: `${COORD_ACTS.filter((a) => actPct(a) >= 100).length} on target`, alert: false, dest: 'activators' }, { label: 'Escalations', value: openEscs.length, sub: 'open tickets', alert: openEscs.length > 0, dest: 'escalations' }] as s (s.label)}
        <button onclick={() => (tab = s.dest)} class="flex flex-col items-center py-3 px-2 active:opacity-70 transition-opacity" style="border-color: rgba(255,255,255,0.14);">
          <span class="text-base font-bold" style="color: {s.alert ? '#B85038' : '#C45C38'};">{s.value}</span>
          <span class="text-[9px] uppercase tracking-wider mt-0.5 text-center" style="color: {s.alert ? '#C07860' : '#C4DAC0'};">{s.label}</span>
          <span class="text-[9px] text-[#96B496] mt-0.5 text-center">{s.sub}</span>
        </button>
      {/each}
    </div>

    <!-- Tab bar -->
    <div class="flex mx-4 mb-4 rounded-2xl overflow-hidden p-1 gap-0.5" style="background: rgba(46,90,62,0.12);">
      {#each [{ id: 'overview', label: 'Overview', Icon: TrendingUp }, { id: 'network', label: 'Network', Icon: Radio }, { id: 'activators', label: 'Team', Icon: Users }, { id: 'escalations', label: 'Issues', Icon: ShieldCheck }] as t (t.id)}
        {@const Icon = t.Icon}
        <button onclick={() => (tab = t.id)} class="flex-1 py-2 rounded-xl flex flex-col items-center gap-0.5 transition-all relative" style="background: {tab === t.id ? '#2E5A3E' : 'transparent'};">
          <Icon size={14} color={tab === t.id ? '#C45C38' : '#C4DAC0'} />
          <span class="text-[9px] font-bold" style="color: {tab === t.id ? '#E8D4B0' : '#C4DAC0'};">{t.label}</span>
          {#if t.id === 'escalations' && openEscs.length > 0}
            <div class="w-1.5 h-1.5 rounded-full absolute" style="background: #B85038; margin-top: -2px;"></div>
          {/if}
        </button>
      {/each}
    </div>

    <div class="px-4 pb-8 flex flex-col gap-3">
      <!-- OVERVIEW -->
      {#if tab === 'overview'}
        {#if openEscs.length > 0}
          <button onclick={() => (tab = 'escalations')} class="w-full rounded-2xl px-4 py-3 flex items-center justify-between" style="background: rgba(184,80,56,0.08); border: 1px solid rgba(184,80,56,0.3);">
            <div class="flex items-center gap-2">
              <AlertTriangle size={14} color="#B85038" />
              <p class="text-xs font-semibold text-[#1D3C2A]">{openEscs.length} open issue{openEscs.length > 1 ? 's' : ''} need attention</p>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-lg" style="background: rgba(184,80,56,0.12); color: #B85038;">Review →</span>
          </button>
        {/if}
        {#if offlineAPs > 0}
          <button onclick={() => (tab = 'network')} class="w-full rounded-2xl px-4 py-3 flex items-center justify-between" style="background: rgba(204,136,48,0.08); border: 1px solid rgba(204,136,48,0.3);">
            <div class="flex items-center gap-2">
              <Radio size={14} color="#CC8830" />
              <p class="text-xs font-semibold text-[#1D3C2A]">{offlineAPs} AP{offlineAPs > 1 ? 's' : ''} offline — users affected</p>
            </div>
            <span class="text-[10px] font-bold px-2 py-1 rounded-lg" style="background: rgba(204,136,48,0.12); color: #CC8830;">Check →</span>
          </button>
        {/if}

        {#if isReal}
          <!-- Real summary — no targets, trends, streaks, or dormancy here:
               none of that is tracked by the backend yet, so a "team vs
               target" widget would have nothing real to compare against. -->
          <div class="rounded-2xl px-4 pt-4 pb-4" style="background: #2E5A3E;">
            <div class="flex items-center gap-2 mb-3">
              <Wallet size={14} color="#C45C38" />
              <p class="text-[10px] text-[#C4DAC0] font-semibold uppercase tracking-wider">Team Commission (all-time)</p>
            </div>
            <p class="text-2xl font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">KES {realCommissionKes.toLocaleString()}</p>
            <p class="text-[9px] text-[#96B496] mt-0.5">from KES {realGrossKes.toLocaleString()} gross · {realPaidSessions} paid sessions across {realActivatorCount} activator{realActivatorCount === 1 ? '' : 's'}</p>
          </div>
          <button onclick={() => (tab = 'activators')} class="w-full rounded-2xl px-4 py-3 flex items-center justify-between" style="background: rgba(46,90,62,0.1); border: 1px solid rgba(46,90,62,0.2);">
            <span class="text-xs font-semibold text-[#1D3C2A]">View team breakdown by activator</span>
            <ChevronRight size={14} color="#3C6A4A" />
          </button>
        {:else}
        <!-- Revenue card -->
        <div class="rounded-2xl px-4 pt-4 pb-3" style="background: #2E5A3E;">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <Wallet size={14} color="#C45C38" />
              <p class="text-[10px] text-[#C4DAC0] font-semibold uppercase tracking-wider">Team Revenue</p>
            </div>
            <div class="flex rounded-xl overflow-hidden" style="background: rgba(0,0,0,0.2);">
              {#each ['week', 'month'] as p (p)}
                <button onclick={() => (revPeriod = p)} class="px-2.5 py-1 text-[9px] font-bold capitalize" style="background: {revPeriod === p ? '#C45C38' : 'transparent'}; color: {revPeriod === p ? '#fff' : '#96B496'};">
                  {p === 'week' ? 'Week' : 'Month'}
                </button>
              {/each}
            </div>
          </div>
          <p class="text-2xl font-bold text-[#E8D4B0]" style="font-family: 'Playfair Display', serif;">KES {(revPeriod === 'week' ? weeklyRevenue : monthlyRevenue).toLocaleString()}</p>
          <p class="text-[9px] text-[#96B496] mt-0.5">{revPeriod === 'week' ? 'this week' : 'this month'}</p>
        </div>

        <!-- Team vs Target -->
        <div class="rounded-2xl px-4 pt-4 pb-3" style="background: #2E5A3E;">
          <div class="flex items-center justify-between mb-3">
            <p class="text-[10px] text-[#C4DAC0] font-semibold uppercase tracking-wider">Team vs Target</p>
            <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(78,128,80,0.30); color: #4E8050;">{COORD_ACTS.filter((a) => actPct(a) >= 100).length}/{COORD_ACTS.length} on target</span>
          </div>
          {#each [...COORD_ACTS].sort((a, b) => actPct(b) - actPct(a)) as act (act.id)}
            {@const p = actPct(act)}
            {@const bc = p >= 100 ? '#4E8050' : p >= 70 ? '#C45C38' : '#B85038'}
            <button onclick={() => (drillActId = act.id)} class="w-full mb-2.5 last:mb-0 text-left">
              <div class="flex justify-between items-center mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs text-[#E8D4B0] font-medium">{act.name.split(' ')[0]}</span>
                  {#if act.trend === 'up'}<TrendingUp size={10} color="#4E8050" />{/if}
                  {#if act.trend === 'down'}<TrendingDown size={10} color="#B85038" />{/if}
                  {#if act.streak >= 5}<span class="text-[9px]">🔥</span>{/if}
                </div>
                <span class="text-[10px] font-bold" style="color: {bc};">{p}%</span>
              </div>
              <div class="h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.18);">
                <div class="h-full rounded-full" style="width: {Math.min(p, 100)}%; background: {bc};"></div>
              </div>
            </button>
          {/each}
          <p class="text-[9px] text-[#96B496] mt-2 text-center">Tap a name to drill in →</p>
        </div>

        <!-- Star performer -->
        {#each [[...COORD_ACTS].sort((a, b) => actPct(b) - actPct(a))[0]] as star (star.id)}
          {@const p = actPct(star)}
          {@const ss = getActPeriodStats(star, teamPeriod)}
          <button onclick={() => (drillActId = star.id)} class="w-full rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.25);">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: rgba(196,92,56,0.35); color: #C45C38;">{inits(star.name)}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-xs font-bold text-[#E8D4B0]">{star.name}</p>
                <span class="text-[9px]">🌟</span>
              </div>
              <p class="text-[10px] text-[#C4DAC0]">{star.area} · {p}% · KES {ss.earn.toLocaleString()} {ss.label}</p>
            </div>
            <Award size={18} color="#CC8830" />
          </button>
        {/each}

        <!-- At-risk activators -->
        {#if atRiskActs.length > 0}
          <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid rgba(184,80,56,0.2);">
            <div class="px-4 pt-3.5 pb-2 flex items-center gap-2">
              <AlertTriangle size={13} color="#B85038" />
              <p class="text-xs font-bold text-[#E8D4B0]">Needs Attention · {atRiskActs.length} activator{atRiskActs.length > 1 ? 's' : ''} at risk</p>
            </div>
            {#each atRiskActs as act (act.id)}
              {@const p = actPct(act)}
              <div onclick={() => (drillActId = act.id)} onkeydown={(e) => e.key === 'Enter' && (drillActId = act.id)} role="button" tabindex="0" class="w-full flex items-center gap-3 px-4 py-2.5 border-t text-left" style="border-color: rgba(255,255,255,0.14);">
                <div class="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-bold" style="background: rgba(184,80,56,0.32); color: #B85038;">{inits(act.name)}</div>
                <div class="flex-1 min-w-0">
                  <p class="text-xs font-semibold text-[#E8D4B0]">{act.name}</p>
                  <p class="text-[9px] text-[#B85038]">{p}% of target · {act.dormant} dormant</p>
                </div>
                <button onclick={(e) => { e.stopPropagation(); nudgedActs[act.id] = true; }} class="flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full shrink-0" style="background: {nudgedActs[act.id] ? 'rgba(78,128,80,0.35)' : 'rgba(184,80,56,0.32)'}; color: {nudgedActs[act.id] ? '#4E8050' : '#B85038'};">
                  {#if nudgedActs[act.id]}<CheckCircle2 size={9} />Sent{:else}<Bell size={9} />Nudge{/if}
                </button>
              </div>
            {/each}
          </div>
        {/if}
        {/if}
      {/if}

      <!-- NETWORK -->
      {#if tab === 'network'}
        <div class="flex items-center justify-between">
          <p class="text-xs text-[#3C6A4A] font-semibold">{ACCESS_POINTS.length} access points · {onlineAPs} online</p>
          <button class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full" style="background: rgba(46,90,62,0.12); color: #3C6A4A;">
            <RefreshCw size={10} /> Refresh
          </button>
        </div>
        {#each sortedAPs as ap (ap.id)}
          {@const sc = AP_STATUS_COLOR[ap.status]}
          {@const loadPct = Math.round((ap.users / ap.capacity) * 100)}
          <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid {sc}33;">
            <div class="px-4 pt-4 pb-3">
              <div class="flex items-start justify-between mb-3">
                <div class="flex items-center gap-2">
                  <div class="w-2 h-2 rounded-full mt-0.5 shrink-0" style="background: {sc};"></div>
                  <div>
                    <p class="text-sm font-bold text-[#E8D4B0]">{ap.name}</p>
                    <p class="text-[10px] text-[#C4DAC0]">{ap.id}</p>
                  </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize" style="background: {sc}18; color: {sc};">{ap.status}</span>
              </div>
              {#if ap.status !== 'offline'}
                <div class="grid grid-cols-3 gap-2 mb-3">
                  {#each [{ label: 'Uptime', value: `${ap.uptime}%` }, { label: 'Users', value: `${ap.users}/${ap.capacity}` }, { label: 'Speed', value: ap.bw }] as m (m.label)}
                    <div class="rounded-xl px-2 py-2" style="background: rgba(0,0,0,0.15);">
                      <p class="text-xs font-bold text-[#E8D4B0]">{m.value}</p>
                      <p class="text-[9px] text-[#C4DAC0]">{m.label}</p>
                    </div>
                  {/each}
                </div>
                <div>
                  <div class="flex justify-between text-[9px] text-[#C4DAC0] mb-1">
                    <span>Capacity load</span><span>{loadPct}%</span>
                  </div>
                  <div class="h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.18);">
                    <div class="h-full rounded-full" style="width: {loadPct}%; background: {loadPct > 85 ? '#B85038' : loadPct > 65 ? '#CC8830' : '#4E8050'};"></div>
                  </div>
                </div>
              {:else}
                <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(184,80,56,0.22);">
                  <WifiOff size={13} color="#B85038" />
                  <p class="text-xs text-[#B85038] font-semibold">Offline {ap.lastSeenMins}m ago · 0 users</p>
                </div>
              {/if}
            </div>
          </div>
        {/each}
      {/if}

      <!-- TEAM -->
      {#if tab === 'activators'}
        {#if isReal}
          <!-- Plain real list — no target/streak/drill-down UI, since none
               of that exists for real activators (see Overview's comment). -->
          <p class="text-xs text-[#3C6A4A] font-semibold">{realActivators.length} activator{realActivators.length === 1 ? '' : 's'}</p>
          {#if loadingReal}
            <div class="flex justify-center py-8"><div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div></div>
          {:else if realActivators.length === 0}
            <div class="rounded-2xl px-4 py-8 flex flex-col items-center gap-2" style="background: #2E5A3E;">
              <Users size={24} color="#96B496" />
              <p class="text-xs text-[#96B496]">No activators assigned yet</p>
            </div>
          {:else}
            {#each [...realActivators].sort((a, b) => Number(b.commission_kes) - Number(a.commission_kes)) as act (act.id)}
              <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; opacity: {act.status === 'active' ? 1 : 0.5};">
                <div class="flex items-center gap-3 px-4 py-3.5">
                  <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: rgba(196,92,56,0.28); color: #C45C38;">{inits(act.name)}</div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold text-[#E8D4B0] truncate">{act.name} <span class="text-[10px] text-[#96B496] font-normal">· {act.code}</span></p>
                    <p class="text-[10px] text-[#C4DAC0] flex items-center gap-1">
                      {#if act.territory}<MapPin size={9} />{act.territory} · {/if}{act.paid_sessions} sessions
                    </p>
                  </div>
                  <div class="text-right shrink-0">
                    <p class="text-sm font-bold text-[#C45C38]">KES {Number(act.commission_kes).toLocaleString()}</p>
                    <p class="text-[9px] text-[#96B496]">{act.status}</p>
                  </div>
                </div>
              </div>
            {/each}
          {/if}
        {:else}
        <div class="flex rounded-2xl overflow-hidden" style="background: rgba(46,90,62,0.12);">
          {#each ['day', 'week', 'month', 'year'] as p (p)}
            <button onclick={() => (teamPeriod = p)} class="flex-1 py-2 text-[10px] font-bold" style="background: {teamPeriod === p ? '#2E5A3E' : 'transparent'}; color: {teamPeriod === p ? '#E8D4B0' : '#96B496'};">
              {p === 'day' ? 'Today' : p === 'week' ? 'Week' : p === 'month' ? 'Month' : 'Year'}
            </button>
          {/each}
        </div>

        <div class="flex gap-2">
          <div class="flex rounded-xl overflow-hidden flex-1" style="background: rgba(46,90,62,0.12);">
            {#each ['target', 'earnings', 'users'] as s (s)}
              <button onclick={() => (teamSort = s)} class="flex-1 py-1.5 text-[9px] font-bold capitalize" style="background: {teamSort === s ? '#2E5A3E' : 'transparent'}; color: {teamSort === s ? '#E8D4B0' : '#96B496'};">
                {s === 'target' ? 'Target %' : s === 'earnings' ? 'Earned' : 'Users'}
              </button>
            {/each}
          </div>
        </div>
        <div class="flex gap-1.5 flex-wrap">
          {#each ['all', 'risk', 'ontrack', 'exceeding'] as f (f)}
            <button onclick={() => (teamFilter = f)} class="px-2.5 py-1 rounded-full text-[9px] font-bold" style="background: {teamFilter === f ? (f === 'risk' ? '#B85038' : f === 'exceeding' ? '#4E8050' : '#2E5A3E') : 'rgba(46,90,62,0.12)'}; color: {teamFilter === f ? '#E8D4B0' : '#96B496'};">
              {f === 'all' ? `All (${COORD_ACTS.length})` : f === 'risk' ? `At Risk (${COORD_ACTS.filter((a) => actPct(a) < 70).length})` : f === 'ontrack' ? `Watch (${COORD_ACTS.filter((a) => { const p = actPct(a); return p >= 70 && p < 100; }).length})` : `Exceeding (${COORD_ACTS.filter((a) => actPct(a) >= 100).length})`}
            </button>
          {/each}
        </div>

        {#if sortedActs.length === 0}
          <div class="rounded-2xl px-4 py-8 flex flex-col items-center gap-2" style="background: #2E5A3E;">
            <Users size={24} color="#96B496" />
            <p class="text-xs text-[#96B496]">No activators in this filter</p>
          </div>
        {/if}

        {#each sortedActs as act (act.id)}
          {@const cs = getActPeriodStats(act, teamPeriod)}
          {@const pct = Math.min(actPct(act), 100)}
          {@const barColor = pct >= 100 ? '#4E8050' : pct >= 70 ? '#C45C38' : '#B85038'}
          {@const isEditing = editingTarget === act.id}
          {@const sparkData =
            teamPeriod === 'day'
              ? [{ v: cs.earn }, { v: cs.target }]
              : teamPeriod === 'week'
                ? (ACT_WEEKLY[act.id] ?? []).map((earn) => ({ v: earn }))
                : teamPeriod === 'month'
                  ? (ACT_MONTHLY[act.id] ?? []).map((w) => ({ v: w.earn }))
                  : (ACT_YEARLY[act.id] ?? []).map((m) => ({ v: m.earn }))}
          <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid {barColor}22;">
            <button onclick={() => (drillActId = act.id)} class="w-full px-4 pt-4 pb-2 text-left">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: {barColor}22; color: {barColor};">{inits(act.name)}</div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <p class="text-sm font-bold text-[#E8D4B0]">{act.name}</p>
                    {#if act.trend === 'up'}<TrendingUp size={12} color="#4E8050" />{/if}
                    {#if act.trend === 'down'}<TrendingDown size={12} color="#B85038" />{/if}
                    {#if act.trend === 'flat'}<Minus size={12} color="#CC8830" />{/if}
                    {#if act.streak >= 5}<span class="text-[9px]">🔥</span>{/if}
                  </div>
                  <p class="text-[10px] text-[#C4DAC0]">{act.area} · {act.users} users · {act.dormant} dormant</p>
                </div>
                <div class="text-right shrink-0 flex flex-col items-end gap-0.5">
                  <p class="text-base font-bold leading-none" style="color: {barColor};">{pct}%</p>
                  <p class="text-[8px] text-[#96B496]">of {cs.label}</p>
                  <ChevronRight size={12} color="#96B496" />
                </div>
              </div>
              {#if sparkData.length > 0}
                <div class="mt-2.5 mb-1">
                  <BarChartMini data={sparkData} yKey="v" height={32} color={barColor} barSize={teamPeriod === 'year' ? 8 : 10} radius={2} opacity={0.7} showXLabels={false} />
                </div>
              {/if}
            </button>

            <div class="px-4 pb-3">
              <div class="flex justify-between text-[10px] mb-1">
                <span class="text-[#E8D4B0] font-semibold">KES {cs.earn.toLocaleString()}</span>
                {#if teamPeriod === 'week'}
                  <button onclick={() => { editingTarget = isEditing ? null : act.id; targetInput = String(actTargets[act.id] ?? act.weekTarget); }} class="flex items-center gap-1 font-bold" style="color: #C45C38;">
                    <Edit3 size={9} /> KES {cs.target.toLocaleString()} target
                  </button>
                {:else}
                  <span class="text-[#96B496]">target: KES {cs.target.toLocaleString()}</span>
                {/if}
              </div>
              <div class="h-2 rounded-full overflow-hidden mb-2" style="background: rgba(255,255,255,0.18);">
                <div class="h-full rounded-full transition-all" style="width: {pct}%; background: {barColor};"></div>
              </div>

              {#if isEditing && teamPeriod === 'week'}
                <div class="flex gap-2 items-center">
                  <div class="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl" style="background: rgba(0,0,0,0.2);">
                    <span class="text-[10px] text-[#C4DAC0]">KES</span>
                    <input type="number" bind:value={targetInput} class="flex-1 bg-transparent text-sm font-bold text-[#E8D4B0] outline-none min-w-0" />
                  </div>
                  <button onclick={() => { const v = parseInt(targetInput, 10); if (v > 0) actTargets[act.id] = v; editingTarget = null; }} class="px-3 py-1.5 rounded-xl text-xs font-bold" style="background: #C45C38; color: #fff;">Set</button>
                  <button onclick={() => (editingTarget = null)} class="px-2 py-1.5 rounded-xl text-xs font-bold" style="background: rgba(255,255,255,0.14); color: #96B496;">✕</button>
                </div>
              {:else}
                <div class="flex gap-2">
                  <button onclick={() => (nudgedActs[act.id] = true)} disabled={nudgedActs[act.id]} class="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold" style="background: {nudgedActs[act.id] ? 'rgba(78,128,80,0.28)' : 'rgba(196,92,56,0.28)'}; color: {nudgedActs[act.id] ? '#4E8050' : '#C45C38'};">
                    {#if nudgedActs[act.id]}<CheckCircle2 size={10} />Sent{:else}<MessageCircle size={10} />{pct < 70 ? 'Coach' : 'Encourage'}{/if}
                  </button>
                  <button onclick={() => (drillActId = act.id)} class="px-3 flex items-center justify-center gap-1 py-1.5 rounded-xl text-[10px] font-bold" style="background: rgba(255,255,255,0.14); color: #C4DAC0;">
                    <Eye size={10} /> Full View
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/each}
        {/if}
      {/if}

      <!-- ESCALATIONS -->
      {#if tab === 'escalations'}
        <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.35);">
          <button class="w-full flex items-center justify-between px-4 py-3.5" onclick={() => (composing = !composing)}>
            <div class="flex items-center gap-2">
              <Send size={14} color="#C45C38" />
              <p class="text-xs font-bold text-[#E8D4B0]">Escalate to Central Command</p>
            </div>
            <ChevronDown size={14} color="#C4DAC0" style="transform: {composing ? 'rotate(180deg)' : 'none'}; transition: transform 0.2s;" />
          </button>
          {#if composing}
            <div class="px-4 pb-4">
              <textarea bind:value={composeText} placeholder="Describe the issue clearly — include AP IDs, affected users, and steps already tried…" class="w-full rounded-xl px-3 py-2 text-xs text-[#E8D4B0] outline-none resize-none" style="background: rgba(0,0,0,0.2); height: 80px;"></textarea>
              <button onclick={() => { composing = false; composeText = ''; }} class="mt-2 w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2" style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;">
                <Send size={12} /> Send to Central
              </button>
            </div>
          {/if}
        </div>

        {#if escalations.filter((e) => e.status !== 'resolved').length > 0}
          <p class="text-xs text-[#3C6A4A] font-semibold">Open · {openEscs.length} action needed</p>
        {/if}
        {#each escalations.filter((e) => e.status !== 'resolved') as esc (esc.id)}
          {@const pc = ESC_PRIORITY_COLOR[esc.priority]}
          <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; border: 1px solid {pc}30;">
            <div class="px-4 pt-4 pb-3">
              <div class="flex items-start justify-between mb-2">
                <div class="flex-1 min-w-0 pr-2">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize" style="background: {pc}18; color: {pc};">{esc.priority}</span>
                    {#if esc.status === 'escalated'}
                      <span class="text-[9px] font-bold px-2 py-0.5 rounded-full" style="background: rgba(204,136,48,0.15); color: #CC8830;">↑ Sent to Central</span>
                    {/if}
                  </div>
                  <p class="text-xs font-semibold text-[#E8D4B0] leading-snug">{esc.issue}</p>
                  <p class="text-[10px] text-[#C4DAC0] mt-0.5">From {esc.activator} · {esc.time}</p>
                </div>
              </div>
              {#if esc.status === 'open'}
                <div class="flex gap-2 mt-2">
                  <button onclick={() => resolveEsc(esc.id)} class="flex-1 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1" style="background: rgba(78,128,80,0.30); color: #4E8050;">
                    <CheckCircle2 size={11} /> Resolve
                  </button>
                  <button onclick={() => escalateEsc(esc.id)} class="flex-1 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1" style="background: rgba(184,80,56,0.32); color: #B85038;">
                    <Send size={11} /> Escalate ↑
                  </button>
                </div>
              {/if}
            </div>
          </div>
        {/each}

        {#if escalations.filter((e) => e.status === 'resolved').length > 0}
          <p class="text-xs text-[#3C6A4A] font-semibold mt-1">Resolved</p>
          {#each escalations.filter((e) => e.status === 'resolved') as esc (esc.id)}
            <div class="rounded-2xl px-4 py-3 flex items-center gap-3 opacity-60" style="background: #2E5A3E;">
              <CheckCircle2 size={16} color="#4E8050" class="shrink-0" />
              <div class="flex-1 min-w-0">
                <p class="text-xs text-[#E8D4B0] font-medium truncate">{esc.issue}</p>
                <p class="text-[10px] text-[#C4DAC0]">From {esc.activator} · {esc.time}</p>
              </div>
            </div>
          {/each}
        {/if}
      {/if}
    </div>
  </div>
{/if}
