<script>
  import { onMount } from 'svelte';
  import {
    LogOut, Plus, X, Video, FileText, ClipboardList, BookOpen, Users, MapPin,
    ShieldCheck, Pause, Play, TrendingUp, Upload, Edit3, Save, Phone, Settings2, Zap,
    BarChart3, Eye, CheckCircle2, Wallet, Radio, Award, Repeat, Menu, Percent, RefreshCw, ChevronLeft, Bitcoin, Trash2
  } from '@lucide/svelte';
  import BarChartMini from '$lib/components/BarChartMini.svelte';
  import MultiLineChartMini from '$lib/components/MultiLineChartMini.svelte';
  import AdminModal from '$lib/components/AdminModal.svelte';
  import {
    adminGetContent, adminCreateContent, adminUpdateContent,
    adminGetActivators, adminCreateActivator, adminUpdateActivator,
    adminGetCoordinators, adminCreateCoordinator, adminUpdateCoordinator,
    adminUploadContentFile, adminGetSettings, adminUpdateSettings, adminGetAnalytics, adminGetContentAnalytics,
    adminGetPurchasesBySite,
    adminGetSites, adminCreateSite, adminUpdateSite, adminDeleteSite, adminGetUnifiSiteOptions,
    adminGetPackages, adminUpdatePackage
  } from '$lib/api.js';

  let { token, username, onLogout } = $props();

  let tab = $state('analytics');
  // Sidebar is always visible on wide screens (md:), and an off-canvas
  // drawer toggled by the hamburger button on narrow ones — see the
  // `md:` variants in the markup below.
  let sidebarOpen = $state(false);
  const TABS = [
    { id: 'analytics', label: 'Analytics', Icon: BarChart3 },
    { id: 'content', label: 'Content', Icon: FileText },
    { id: 'activators', label: 'Activators', Icon: Users },
    { id: 'coordinators', label: 'Coordinators', Icon: ShieldCheck },
    { id: 'sites', label: 'Sites', Icon: Radio },
    { id: 'settings', label: 'Settings', Icon: Settings2 }
  ];

  const TYPE_ICON = { video: Video, article: FileText, survey: ClipboardList, lesson: BookOpen };
  // Matches the fixed five zones of the Earn Free Access landing feed
  // (TimelineScreen.svelte) — 'hero' and 'survey' are meant to hold one
  // active item at a time.
  const SECTIONS = [
    { id: 'hero', label: 'Hero' },
    { id: 'whats_new', label: "What's New" },
    { id: 'survey', label: 'Survey Card' },
    { id: 'news', label: 'News & Stories' },
    { id: 'watch_earn', label: 'Watch & Earn' }
  ];
  const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));

  // How often a client can re-earn a content item's reward. 'session' ties
  // to a fresh internet session (paid or earned) rather than a calendar
  // boundary — see backend/src/utils/periodKey.js.
  const VIEW_FREQUENCIES = [
    { id: 'once', label: 'Once' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'session', label: 'Per Session' }
  ];
  const VIEW_FREQUENCY_LABEL = Object.fromEntries(VIEW_FREQUENCIES.map((f) => [f.id, f.label]));

  let contentItems = $state([]);
  let activators = $state([]);
  let coordinators = $state([]);
  let sites = $state([]);
  let packages = $state([]);
  let loading = $state(true);

  async function loadContent() {
    const r = await adminGetContent(token);
    if (r.ok) contentItems = r.data.items;
    return r;
  }
  async function loadActivators() {
    const r = await adminGetActivators(token);
    if (r.ok) activators = r.data.activators;
  }
  async function loadCoordinators() {
    const r = await adminGetCoordinators(token);
    if (r.ok) coordinators = r.data.coordinators;
  }
  async function loadSites() {
    const r = await adminGetSites(token);
    if (r.ok) sites = r.data.sites;
  }
  async function loadPackages() {
    const r = await adminGetPackages(token);
    if (r.ok) packages = r.data.packages;
  }

  let earnConnectThresholdMinutes = $state('30');
  let defaultActivatorCommissionPct = $state('20');
  let notificationRetentionDays = $state('30');
  async function loadSettings() {
    const r = await adminGetSettings(token);
    if (!r.ok) return;
    earnConnectThresholdMinutes = String(Math.round((r.data.settings?.earnConnectThresholdSecs ?? 1800) / 60));
    defaultActivatorCommissionPct = String(Math.round((r.data.settings?.defaultActivatorCommissionRate ?? 0.2) * 100));
    notificationRetentionDays = String(r.data.settings?.notificationRetentionDays ?? 30);
  }

  let analytics = $state(null);
  let analyticsLoading = $state(true);
  async function loadAnalytics() {
    analyticsLoading = true;
    const r = await adminGetAnalytics(token);
    if (r.ok) analytics = r.data.analytics;
    analyticsLoading = false;
  }
  // Scales the per-item inline bars in Content Overview relative to the
  // single most-seen item, so bar length is comparable across rows.
  const maxContentImpressions = $derived(
    Math.max(1, ...(analytics?.earned.contentOverview.map((c) => c.impressions) ?? [1]))
  );

  // ── Purchases by Site — detail view ("View more" behind the compact chart) ──
  const SITE_TIMELINE_GRANULARITIES = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' }
  ];
  let showSiteDetail = $state(false);
  let siteDetailGranularity = $state('day');
  let siteDetailSiteId = $state(''); // '' = every site
  let siteDetailData = $state(null);
  let siteDetailLoading = $state(false);

  async function loadSiteDetail() {
    siteDetailLoading = true;
    const r = await adminGetPurchasesBySite(token, {
      granularity: siteDetailGranularity,
      siteId: siteDetailSiteId || undefined
    });
    if (r.ok) siteDetailData = r.data.timeline;
    siteDetailLoading = false;
  }

  function openSiteDetail() {
    showSiteDetail = true;
  }

  // Re-fetches whenever the detail view is open and either filter changes
  // — covers the initial load (showSiteDetail flipping true) and every
  // subsequent granularity/site pill click in one place.
  $effect(() => {
    if (!showSiteDetail) return;
    siteDetailGranularity;
    siteDetailSiteId;
    loadSiteDetail();
  });

  // Site totals for the selected window, sorted by revenue — the "more
  // than just the chart" part of "View more".
  const siteDetailTotals = $derived.by(() => {
    if (!siteDetailData) return [];
    return [...siteDetailData.series]
      .map((s) => ({
        siteId: s.siteId,
        siteName: s.siteName,
        revenueKes: s.data.reduce((sum, v) => sum + v, 0),
        sessions: s.counts.reduce((sum, v) => sum + v, 0)
      }))
      .sort((a, b) => b.revenueKes - a.revenueKes);
  });

  // Per-content drill-down (impressions/completions/survey answer
  // breakdown) — expanded inline under the clicked row in Content Overview.
  let expandedContentId = $state(null);
  let contentDetail = $state(null);
  let contentDetailLoading = $state(false);

  async function toggleContentAnalytics(id) {
    if (expandedContentId === id) {
      expandedContentId = null;
      contentDetail = null;
      return;
    }
    expandedContentId = id;
    contentDetail = null;
    contentDetailLoading = true;
    const r = await adminGetContentAnalytics(token, id);
    contentDetailLoading = false;
    if (r.ok) contentDetail = r.data.detail;
  }

  onMount(async () => {
    const [contentResult] = await Promise.all([
      loadContent(),
      loadActivators(),
      loadCoordinators(),
      loadSites(),
      loadPackages(),
      loadSettings(),
      loadAnalytics()
    ]);

    // Reconciles a dashboard restored from a persisted session (see
    // dashboardSession.js) on reload — every admin route shares the same
    // auth middleware, so checking this one call's status is enough to
    // catch an expired/revoked token. Bounces to login (which also clears
    // the stale persisted session) instead of leaving a dead dashboard up.
    if (contentResult?.status === 401) {
      onLogout();
      return;
    }

    loading = false;
  });

  // ── Content form ─────────────────────────────────────────────────────────
  const DEFAULT_CONTENT_DRAFT = {
    type: 'video', section: 'whats_new', viewFrequency: 'once', title: '', category: '', durationLabel: '', earnMinutes: '30',
    minWatchSecs: '0', imgUrl: '', bodyUrl: '', surveyQuestions: [{ question: '', answers: ['', ''] }],
    siteIds: [] // [] = visible on every site
  };
  let showContentForm = $state(false);
  let contentDraft = $state({ ...DEFAULT_CONTENT_DRAFT });
  let contentFormError = $state('');
  let contentSaving = $state(false);

  function draftToBody(draft) {
    return {
      type: draft.type,
      section: draft.section,
      viewFrequency: draft.viewFrequency,
      title: draft.title.trim(),
      category: draft.category.trim() || undefined,
      durationLabel: draft.durationLabel.trim() || undefined,
      earnSecs: Math.round(Number(draft.earnMinutes) * 60),
      // Surveys and articles have no dwell-time UI — always save 0 rather
      // than resubmitting a stale value from before that field was hidden.
      minWatchSecs: draft.type === 'survey' || draft.type === 'article' ? 0 : Number(draft.minWatchSecs) || 0,
      imgUrl: draft.imgUrl.trim() || undefined,
      bodyUrl: draft.bodyUrl.trim() || undefined,
      surveyQuestions:
        draft.type === 'survey'
          ? draft.surveyQuestions
              .map((q) => ({ question: q.question.trim(), answers: q.answers.map((a) => a.trim()).filter(Boolean) }))
              .filter((q) => q.question && q.answers.length > 0)
          : undefined,
      siteIds: draft.siteIds
    };
  }

  async function submitContent() {
    if (!contentDraft.title.trim() || !Number(contentDraft.earnMinutes)) {
      contentFormError = 'Title and a reward (in minutes) are required';
      return;
    }
    contentFormError = '';
    contentSaving = true;

    const result = await adminCreateContent(token, draftToBody(contentDraft));
    contentSaving = false;

    if (!result.ok || !result.data?.success) {
      contentFormError = result.data?.message || 'Could not create content — check your connection';
      return;
    }

    contentDraft = { ...DEFAULT_CONTENT_DRAFT };
    showContentForm = false;
    await loadContent();
  }

  async function toggleContentActive(item) {
    await adminUpdateContent(token, item.id, { isActive: !item.is_active });
    await loadContent();
  }

  // Upload-in-place for the two file fields — fills the same text input a
  // pasted URL would, so "upload" and "enter a URL" are just two ways to
  // populate one field rather than a separate code path. Takes the target
  // draft object explicitly so it works for both the create and edit forms.
  let imgUploading = $state(false);
  let bodyUploading = $state(false);

  async function handleFileUpload(e, targetDraft, field, setUploading, setError) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setUploading(true);
    const result = await adminUploadContentFile(token, file);
    setUploading(false);

    if (!result.ok || !result.data?.url) {
      setError(result.data?.message || 'Upload failed — check your connection');
      return;
    }
    targetDraft[field] = result.data.url;
  }

  // ── Content edit ─────────────────────────────────────────────────────────
  let editingContentId = $state(null);
  let contentEditDraft = $state(null);
  let contentEditError = $state('');
  let contentEditSaving = $state(false);
  let editImgUploading = $state(false);
  let editBodyUploading = $state(false);

  function startEditContent(item) {
    editingContentId = item.id;
    contentEditError = '';
    contentEditDraft = {
      type: item.type,
      section: item.section,
      viewFrequency: item.view_frequency,
      title: item.title,
      category: item.category ?? '',
      durationLabel: item.duration_label ?? '',
      earnMinutes: String(Math.round(item.earn_secs / 60)),
      minWatchSecs: String(item.min_watch_secs ?? 0),
      imgUrl: item.img_url ?? '',
      bodyUrl: item.body_url ?? '',
      surveyQuestions: normalizeSurveyQuestionsForEdit(item.survey_questions),
      siteIds: item.site_ids ?? []
    };
  }

  // survey_questions is opaque JSONB — older rows (or a pre-migration
  // remote DB) may still be plain strings. Upgrade to the {question,
  // answers} shape the editor works with, and always leave at least one
  // blank row so "add a survey" starts from something editable.
  function normalizeSurveyQuestionsForEdit(raw) {
    const questions = (raw ?? []).map((q) =>
      typeof q === 'string'
        ? { question: q, answers: ['Disagree', 'Neutral', 'Agree'] }
        : { question: q.question ?? '', answers: [...(q.answers ?? [])] }
    );
    return questions.length > 0 ? questions : [{ question: '', answers: ['', ''] }];
  }

  function cancelEditContent() {
    editingContentId = null;
    contentEditDraft = null;
  }

  async function saveEditContent(id) {
    if (!contentEditDraft.title.trim() || !Number(contentEditDraft.earnMinutes)) {
      contentEditError = 'Title and a reward (in minutes) are required';
      return;
    }
    contentEditError = '';
    contentEditSaving = true;

    const result = await adminUpdateContent(token, id, draftToBody(contentEditDraft));
    contentEditSaving = false;

    if (!result.ok || !result.data?.success) {
      contentEditError = result.data?.message || 'Could not save — check your connection';
      return;
    }

    cancelEditContent();
    await loadContent();
  }

  // ── Activator form ───────────────────────────────────────────────────────
  // commissionRate pre-fills from the admin-configured default (Settings
  // tab) — evaluated fresh each time rather than baked into a static
  // object, so it reflects whatever's currently loaded, not whatever was
  // loaded when the component first mounted.
  function freshActivatorDraft() {
    return { code: '', name: '', phone: '', pin: '', territory: '', mpesaNumber: '', commissionRate: defaultActivatorCommissionPct, coordinatorId: '' };
  }
  let showActivatorForm = $state(false);
  let activatorDraft = $state(freshActivatorDraft());
  let activatorFormError = $state('');
  let activatorSaving = $state(false);

  async function submitActivator() {
    if (!activatorDraft.code.trim() || !activatorDraft.name.trim() || !activatorDraft.phone.trim() || activatorDraft.pin.length < 4) {
      activatorFormError = 'Code, name, phone, and a 4+ digit PIN are required';
      return;
    }
    activatorFormError = '';
    activatorSaving = true;

    const body = {
      code: activatorDraft.code.trim(),
      name: activatorDraft.name.trim(),
      phone: activatorDraft.phone.trim(),
      pin: activatorDraft.pin,
      territory: activatorDraft.territory.trim() || undefined,
      mpesaNumber: activatorDraft.mpesaNumber.trim() || undefined,
      commissionRate: Number(activatorDraft.commissionRate) / 100,
      coordinatorId: activatorDraft.coordinatorId ? Number(activatorDraft.coordinatorId) : undefined
    };

    const result = await adminCreateActivator(token, body);
    activatorSaving = false;

    if (!result.ok || !result.data?.success) {
      activatorFormError = result.data?.message || 'Could not create activator — check your connection';
      return;
    }

    activatorDraft = freshActivatorDraft();
    showActivatorForm = false;
    await loadActivators();
  }

  async function toggleActivatorStatus(a) {
    await adminUpdateActivator(token, a.id, { status: a.status === 'active' ? 'suspended' : 'active' });
    await loadActivators();
  }

  // ── Activator edit ───────────────────────────────────────────────────────
  let editingActivatorId = $state(null);
  let activatorEditDraft = $state(null);
  let activatorEditError = $state('');
  let activatorEditSaving = $state(false);

  function startEditActivator(a) {
    editingActivatorId = a.id;
    activatorEditError = '';
    activatorEditDraft = {
      name: a.name,
      territory: a.territory ?? '',
      mpesaNumber: a.mpesa_number ?? '',
      commissionRate: String(Math.round(Number(a.commission_rate) * 100)),
      coordinatorId: a.coordinator_id ?? '',
      pin: ''
    };
  }

  function cancelEditActivator() {
    editingActivatorId = null;
    activatorEditDraft = null;
  }

  async function saveEditActivator(id) {
    if (!activatorEditDraft.name.trim()) {
      activatorEditError = 'Name is required';
      return;
    }
    activatorEditError = '';
    activatorEditSaving = true;

    const body = {
      name: activatorEditDraft.name.trim(),
      territory: activatorEditDraft.territory.trim() || null,
      mpesaNumber: activatorEditDraft.mpesaNumber.trim() || null,
      commissionRate: Number(activatorEditDraft.commissionRate) / 100,
      coordinatorId: activatorEditDraft.coordinatorId ? Number(activatorEditDraft.coordinatorId) : null,
      ...(activatorEditDraft.pin ? { pin: activatorEditDraft.pin } : {})
    };

    const result = await adminUpdateActivator(token, id, body);
    activatorEditSaving = false;

    if (!result.ok || !result.data?.success) {
      activatorEditError = result.data?.message || 'Could not save — check your connection';
      return;
    }

    cancelEditActivator();
    await loadActivators();
  }

  // ── Coordinator form ─────────────────────────────────────────────────────
  const DEFAULT_COORDINATOR_DRAFT = { name: '', phone: '', pin: '', territory: '' };
  let showCoordinatorForm = $state(false);
  let coordinatorDraft = $state({ ...DEFAULT_COORDINATOR_DRAFT });
  let coordinatorFormError = $state('');
  let coordinatorSaving = $state(false);

  async function submitCoordinator() {
    if (!coordinatorDraft.name.trim() || !coordinatorDraft.phone.trim() || coordinatorDraft.pin.length < 4) {
      coordinatorFormError = 'Name, phone, and a 4+ digit PIN are required';
      return;
    }
    coordinatorFormError = '';
    coordinatorSaving = true;

    const body = {
      name: coordinatorDraft.name.trim(),
      phone: coordinatorDraft.phone.trim(),
      pin: coordinatorDraft.pin,
      territory: coordinatorDraft.territory.trim() || undefined
    };

    const result = await adminCreateCoordinator(token, body);
    coordinatorSaving = false;

    if (!result.ok || !result.data?.success) {
      coordinatorFormError = result.data?.message || 'Could not create coordinator — check your connection';
      return;
    }

    coordinatorDraft = { ...DEFAULT_COORDINATOR_DRAFT };
    showCoordinatorForm = false;
    await loadCoordinators();
  }

  async function toggleCoordinatorStatus(c) {
    await adminUpdateCoordinator(token, c.id, { status: c.status === 'active' ? 'suspended' : 'active' });
    await loadCoordinators();
  }

  // ── Coordinator edit ─────────────────────────────────────────────────────
  let editingCoordinatorId = $state(null);
  let coordinatorEditDraft = $state(null);
  let coordinatorEditError = $state('');
  let coordinatorEditSaving = $state(false);

  function startEditCoordinator(c) {
    editingCoordinatorId = c.id;
    coordinatorEditError = '';
    coordinatorEditDraft = { name: c.name, territory: c.territory ?? '', pin: '' };
  }

  function cancelEditCoordinator() {
    editingCoordinatorId = null;
    coordinatorEditDraft = null;
  }

  async function saveEditCoordinator(id) {
    if (!coordinatorEditDraft.name.trim()) {
      coordinatorEditError = 'Name is required';
      return;
    }
    coordinatorEditError = '';
    coordinatorEditSaving = true;

    const body = {
      name: coordinatorEditDraft.name.trim(),
      territory: coordinatorEditDraft.territory.trim() || null,
      ...(coordinatorEditDraft.pin ? { pin: coordinatorEditDraft.pin } : {})
    };

    const result = await adminUpdateCoordinator(token, id, body);
    coordinatorEditSaving = false;

    if (!result.ok || !result.data?.success) {
      coordinatorEditError = result.data?.message || 'Could not save — check your connection';
      return;
    }

    cancelEditCoordinator();
    await loadCoordinators();
  }

  // ── Site form ────────────────────────────────────────────────────────────
  const SITE_MODES = [
    { id: 'both', label: 'Pay + Earn' },
    { id: 'pay_only', label: 'Pay only' },
    { id: 'earn_only', label: 'Earn only' }
  ];
  const SITE_MODE_LABEL = Object.fromEntries(SITE_MODES.map((m) => [m.id, m.label]));

  function freshSiteDraft() {
    return { id: '', name: '', mode: 'both', btcEnabled: true };
  }
  let showSiteForm = $state(false);
  let siteDraft = $state(freshSiteDraft());
  let siteFormError = $state('');
  let siteSaving = $state(false);
  // Real sites known to the UniFi controller, fetched lazily the first
  // time the form opens — lets the admin pick an id instead of typing one
  // by hand (it has to match the controller's own site id exactly, see
  // schema.sql's comment on sites.id). [] if the controller's unreachable;
  // the id field stays a plain text input either way.
  let unifiSiteOptions = $state([]);
  let unifiSiteOptionsLoading = $state(false);

  async function openSiteForm() {
    siteDraft = freshSiteDraft();
    siteFormError = '';
    showSiteForm = true;
    if (unifiSiteOptions.length === 0) {
      unifiSiteOptionsLoading = true;
      const r = await adminGetUnifiSiteOptions(token);
      unifiSiteOptionsLoading = false;
      if (r.ok) unifiSiteOptions = r.data?.options ?? [];
    }
  }

  async function submitSite() {
    if (!siteDraft.id.trim() || !siteDraft.name.trim()) {
      siteFormError = 'Site id and name are required';
      return;
    }
    siteFormError = '';
    siteSaving = true;

    const result = await adminCreateSite(token, {
      id: siteDraft.id.trim(),
      name: siteDraft.name.trim(),
      mode: siteDraft.mode,
      btcEnabled: siteDraft.btcEnabled
    });
    siteSaving = false;

    if (!result.ok || !result.data?.success) {
      siteFormError = result.data?.message || 'Could not create site — check your connection';
      return;
    }

    siteDraft = freshSiteDraft();
    showSiteForm = false;
    await loadSites();
  }

  async function toggleSiteStatus(s) {
    await adminUpdateSite(token, s.id, { status: s.status === 'active' ? 'suspended' : 'active' });
    await loadSites();
  }

  async function setSiteMode(s, mode) {
    await adminUpdateSite(token, s.id, { mode });
    await loadSites();
  }

  async function toggleSiteBtc(s) {
    await adminUpdateSite(token, s.id, { btcEnabled: !s.btc_enabled });
    await loadSites();
  }

  // Two-tap delete (id armed by the first click, cleared after 4s or on the
  // second click) — a site delete is permanent, unlike the soft
  // suspend/activate toggle above, so it gets a confirmation step instead
  // of a native confirm() dialog to stay consistent with the rest of the UI.
  let armedDeleteSiteId = $state(null);
  let siteDeleteError = $state('');

  async function removeSite(s) {
    if (armedDeleteSiteId !== s.id) {
      armedDeleteSiteId = s.id;
      siteDeleteError = '';
      setTimeout(() => {
        if (armedDeleteSiteId === s.id) armedDeleteSiteId = null;
      }, 4000);
      return;
    }
    armedDeleteSiteId = null;
    const result = await adminDeleteSite(token, s.id);
    if (!result.ok || !result.data?.success) {
      siteDeleteError = result.data?.message || `Could not delete "${s.name}" — check your connection`;
      return;
    }
    siteDeleteError = '';
    await loadSites();
  }

  // ── Package site assignment ──────────────────────────────────────────────
  // No create/delete — packages are a small fixed set of plan types (see
  // services/catalog.js) — this only toggles which sites each is sold on
  // and whether it's active at all.
  async function togglePackageSite(pkg, siteId) {
    const current = pkg.site_ids ?? [];
    const siteIds = current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId];
    await adminUpdatePackage(token, pkg.id, { siteIds });
    await loadPackages();
  }

  /** Clears a package's site restriction back to [] ("visible everywhere") — the "All sites" pill's click handler. */
  async function clearPackageSites(pkg) {
    await adminUpdatePackage(token, pkg.id, { siteIds: [] });
    await loadPackages();
  }

  async function togglePackageActive(pkg) {
    await adminUpdatePackage(token, pkg.id, { isActive: !pkg.is_active });
    await loadPackages();
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  let settingsSaving = $state(false);
  let settingsError = $state('');
  let settingsSaved = $state(false);

  async function saveSettings() {
    if (!(Number(earnConnectThresholdMinutes) >= 0)) {
      settingsError = 'Enter a non-negative number of minutes';
      return;
    }
    if (!(Number(defaultActivatorCommissionPct) >= 0 && Number(defaultActivatorCommissionPct) <= 100)) {
      settingsError = 'Commission % must be between 0 and 100';
      return;
    }
    if (!(Number(notificationRetentionDays) >= 0)) {
      settingsError = 'Enter a non-negative number of days (0 = keep forever)';
      return;
    }
    settingsError = '';
    settingsSaving = true;

    const result = await adminUpdateSettings(token, {
      earnConnectThresholdMinutes: Number(earnConnectThresholdMinutes),
      defaultActivatorCommissionPct: Number(defaultActivatorCommissionPct),
      notificationRetentionDays: Number(notificationRetentionDays)
    });
    settingsSaving = false;

    if (!result.ok || !result.data?.success) {
      settingsError = result.data?.message || 'Could not save — check your connection';
      return;
    }

    settingsSaved = true;
    setTimeout(() => (settingsSaved = false), 2500);
  }

  function formatEarn(secs) {
    const h = Math.floor(secs / 3600);
    const m = Math.round((secs % 3600) / 60);
    return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`;
  }
</script>

{#snippet inputField(label, value, oninput, opts = {})}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">{label}</p>
    <input
      type={opts.type || 'text'}
      {value}
      {oninput}
      placeholder={opts.placeholder || ''}
      class="w-full bg-transparent px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none"
      style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
    />
  </div>
{/snippet}

{#snippet fileOrUrlField(label, value, oninput, uploading, onFileChange, accept)}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">{label}</p>
    <div class="flex items-center gap-2">
      <input
        type="text"
        {value}
        {oninput}
        placeholder="https://… or upload a file"
        class="flex-1 min-w-0 bg-transparent px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none"
        style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
      />
      <label
        class="shrink-0 flex items-center gap-1 px-3 py-2.5 rounded-xl text-[11px] font-semibold cursor-pointer"
        style="background: {uploading ? 'rgba(196,92,56,0.35)' : 'rgba(255,255,255,0.14)'}; color: {uploading ? '#C45C38' : '#C4DAC0'};"
      >
        {#if uploading}
          <div class="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin"></div>
        {:else}
          <Upload size={12} />
        {/if}
        Upload
        <input type="file" {accept} onchange={onFileChange} disabled={uploading} class="hidden" />
      </label>
    </div>
  </div>
{/snippet}

{#snippet sectionPicker(value, onSelect)}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Landing feed section</p>
    <div class="flex gap-1.5 flex-wrap">
      {#each SECTIONS as s (s.id)}
        <button
          type="button"
          onclick={() => onSelect(s.id)}
          class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
          style="background: {value === s.id ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {value === s.id ? '#fff' : '#C4DAC0'};"
        >
          {s.label}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet statCard(Icon, label, value, color)}
  <div class="rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-md" style="background: #2E5A3E; border: 1px solid {color}22;">
    <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: {color}22;">
      <Icon size={16} color={color} />
    </div>
    <div class="min-w-0">
      <p class="text-base font-bold text-[#E8D4B0] truncate">{value}</p>
      <p class="text-[10px] text-[#96B496] uppercase tracking-wider">{label}</p>
    </div>
  </div>
{/snippet}

{#snippet viewFrequencyPicker(value, onSelect)}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">View frequency — how often it resets</p>
    <div class="flex gap-1.5 flex-wrap">
      {#each VIEW_FREQUENCIES as f (f.id)}
        <button
          type="button"
          onclick={() => onSelect(f.id)}
          class="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-semibold"
          style="background: {value === f.id ? '#CC8830' : 'rgba(255,255,255,0.1)'}; color: {value === f.id ? '#fff' : '#C4DAC0'};"
        >
          {#if f.id !== 'once'}<Repeat size={10} />{/if}
          {f.label}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet sitePicker(draft)}
  {#if sites.length > 0}
    <div>
      <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Visible on sites</p>
      <div class="flex gap-1.5 flex-wrap">
        <button
          type="button"
          onclick={() => (draft.siteIds = [])}
          class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
          style="background: {draft.siteIds.length === 0 ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {draft.siteIds.length === 0 ? '#fff' : '#C4DAC0'};"
        >
          All sites
        </button>
        {#each sites as s (s.id)}
          {@const selected = draft.siteIds.includes(s.id)}
          <button
            type="button"
            onclick={() => (draft.siteIds = selected ? draft.siteIds.filter((id) => id !== s.id) : [...draft.siteIds, s.id])}
            class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style="background: {selected ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {selected ? '#fff' : '#C4DAC0'};"
          >
            {s.name}
          </button>
        {/each}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet articleBodyField(draft, oninput)}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Article body</p>
    <textarea
      value={draft.bodyUrl}
      {oninput}
      rows="8"
      class="w-full bg-transparent px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none resize-none"
      style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
      placeholder={'Write the article — start with a short intro paragraph (the hook), then structure the rest with:\n\n## A subheading\n### A smaller subheading\n- a bullet point\n- another bullet point\n1. a numbered step\n**bold** for key terms\n\nEnd with a citation if this references an outside source:\nSource: Smith, J. (2026, February 25). Title of article. Site Name. example.com\n\nOr just paste a https:// link here instead to send readers to an external article.'}
    ></textarea>
    <p class="text-[10px] text-[#7A9E7A] mt-1">
      Supports ## headings, ### subheadings, - bullets, 1. numbered lists, **bold**, and a trailing "Source: …" citation line.
    </p>
  </div>
{/snippet}

{#snippet surveyQuestionsEditor(draft)}
  <div>
    <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Questions & answer options</p>
    <div class="flex flex-col gap-2.5">
      {#each draft.surveyQuestions as q, qi (qi)}
        <div class="rounded-xl p-3" style="background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);">
          <div class="flex items-center gap-2 mb-2">
            <input
              type="text"
              value={q.question}
              oninput={(e) => (draft.surveyQuestions[qi].question = e.currentTarget.value)}
              placeholder={`Question ${qi + 1}`}
              class="flex-1 min-w-0 bg-transparent px-3 py-2 rounded-lg text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none"
              style="background: rgba(255,255,255,0.08);"
            />
            <button
              type="button"
              onclick={() => (draft.surveyQuestions = draft.surveyQuestions.filter((_, i) => i !== qi))}
              disabled={draft.surveyQuestions.length <= 1}
              class="shrink-0 w-7 h-7 rounded-full flex items-center justify-center"
              style="background: rgba(184,80,56,0.2); opacity: {draft.surveyQuestions.length <= 1 ? 0.4 : 1};"
            >
              <X size={12} color="#E08A6A" />
            </button>
          </div>
          <div class="flex flex-col gap-1.5 pl-1">
            {#each q.answers as a, ai (ai)}
              <div class="flex items-center gap-2">
                <input
                  type="text"
                  value={a}
                  oninput={(e) => (draft.surveyQuestions[qi].answers[ai] = e.currentTarget.value)}
                  placeholder={`Answer option ${ai + 1}`}
                  class="flex-1 min-w-0 bg-transparent px-3 py-1.5 rounded-lg text-xs text-[#C4DAC0] placeholder-[#4A6842] outline-none"
                  style="background: rgba(255,255,255,0.05);"
                />
                <button
                  type="button"
                  onclick={() => (draft.surveyQuestions[qi].answers = q.answers.filter((_, i) => i !== ai))}
                  disabled={q.answers.length <= 1}
                  class="shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                  style="opacity: {q.answers.length <= 1 ? 0.3 : 1};"
                >
                  <X size={10} color="#96B496" />
                </button>
              </div>
            {/each}
            <button
              type="button"
              onclick={() => (draft.surveyQuestions[qi].answers = [...q.answers, ''])}
              class="text-[10px] font-semibold self-start px-2.5 py-1 rounded-full mt-0.5"
              style="background: rgba(196,92,56,0.15); color: #C45C38;"
            >
              + Add answer option
            </button>
          </div>
        </div>
      {/each}
      <button
        type="button"
        onclick={() => (draft.surveyQuestions = [...draft.surveyQuestions, { question: '', answers: ['', ''] }])}
        class="py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5"
        style="background: rgba(196,92,56,0.15); color: #C45C38;"
      >
        <Plus size={13} /> Add question
      </button>
    </div>
  </div>
{/snippet}

<div class="flex" style="height: 100dvh; overflow: hidden; background: #E8D4B0;">
  <!-- Mobile sidebar backdrop -->
  {#if sidebarOpen}
    <button
      type="button"
      aria-label="Close menu"
      onclick={() => (sidebarOpen = false)}
      class="fixed inset-0 z-40 md:hidden"
      style="background: rgba(0,0,0,0.55); border: none; padding: 0; cursor: default;"
    ></button>
  {/if}

  <!-- Sidebar — fixed off-canvas drawer on mobile (toggled by the hamburger
       button in the top bar below), always-visible fixed-height column on
       md+. The outer shell is viewport-locked (height: 100dvh; overflow:
       hidden) and only the main content column scrolls, so this never
       moves or leaves a gap below the sign-out button no matter how tall
       the active tab's content gets. -->
  <aside
    class="fixed md:relative top-0 left-0 h-dvh w-64 z-50 flex flex-col shrink-0 transition-transform duration-300 ease-out {sidebarOpen
      ? 'translate-x-0'
      : '-translate-x-full'} md:translate-x-0"
    style="background: linear-gradient(180deg, #1D3C2A 0%, #16311F 60%, #122A1A 100%); box-shadow: {sidebarOpen ? '8px 0 24px rgba(0,0,0,0.3)' : 'none'};"
  >
    <div class="px-5 pt-6 pb-5 flex items-center justify-between shrink-0" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-10 h-10 rounded-2xl flex items-center justify-center shadow-md shrink-0" style="background: linear-gradient(135deg, rgba(196,92,56,0.4), rgba(204,136,48,0.3)); border: 1px solid rgba(196,92,56,0.35);">
          <ShieldCheck size={18} color="#C45C38" />
        </div>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <p class="text-[9px] text-[#96B496] font-semibold uppercase tracking-widest">Admin</p>
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background: #4E8050; box-shadow: 0 0 6px #4E8050;"></span>
          </div>
          <p class="text-sm font-bold text-[#E8D4B0] truncate" style="font-family: 'Playfair Display', serif;">{username}</p>
        </div>
      </div>
      <button onclick={() => (sidebarOpen = false)} class="w-8 h-8 rounded-full flex items-center justify-center shrink-0 md:hidden" style="background: rgba(255,255,255,0.1);">
        <X size={15} color="#C4DAC0" />
      </button>
    </div>

    <nav class="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
      {#each TABS as t (t.id)}
        {@const Icon = t.Icon}
        <button
          onclick={() => { tab = t.id; sidebarOpen = false; }}
          class="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left transition-all"
          style="background: {tab === t.id ? 'linear-gradient(135deg, rgba(196,92,56,0.28), rgba(204,136,48,0.16))' : 'transparent'}; border: 1px solid {tab === t.id ? 'rgba(196,92,56,0.35)' : 'transparent'};"
        >
          <Icon size={16} color={tab === t.id ? '#C45C38' : '#C4DAC0'} />
          <span class="text-sm font-semibold" style="color: {tab === t.id ? '#E8D4B0' : '#C4DAC0'};">{t.label}</span>
        </button>
      {/each}
    </nav>

    <div class="p-3 shrink-0" style="border-top: 1px solid rgba(255,255,255,0.08);">
      <button onclick={onLogout} class="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all active:scale-[0.98]" style="background: rgba(184,80,56,0.12);">
        <LogOut size={15} color="#E08A6A" />
        <span class="text-sm font-semibold" style="color: #E08A6A;">Sign out</span>
      </button>
    </div>
  </aside>

  <!-- Main content — the only part of this screen that scrolls; the
       sidebar stays put regardless of how tall this gets. -->
  <div class="flex-1 min-w-0 h-full overflow-y-auto">
    <!-- Mobile top bar (hidden on md+, where the sidebar is always visible) -->
    <div class="sticky top-0 z-30 px-4 py-3.5 flex items-center gap-3 md:hidden shadow-md" style="background: #1D3C2A;">
      <button onclick={() => (sidebarOpen = true)} class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.1);">
        <Menu size={16} color="#C4DAC0" />
      </button>
      <p class="text-sm font-bold text-[#E8D4B0]">{TABS.find((t) => t.id === tab)?.label}</p>
    </div>

  <div class="px-4 py-5 pb-10 md:px-8 md:py-8 flex flex-col gap-3 md:max-w-6xl">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div>
      </div>
    {:else if tab === 'content'}
      <button
        onclick={() => (showContentForm = true)}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
      >
        <Plus size={15} /> Add content
      </button>

      {#if showContentForm}
        <AdminModal title="Add content" onClose={() => (showContentForm = false)}>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Type</p>
            <div class="flex gap-2">
              {#each ['video', 'article', 'survey', 'lesson'] as t (t)}
                <button
                  onclick={() => (contentDraft.type = t)}
                  class="flex-1 py-2 rounded-xl text-[11px] font-semibold capitalize"
                  style="background: {contentDraft.type === t ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {contentDraft.type === t ? '#fff' : '#C4DAC0'};"
                >
                  {t}
                </button>
              {/each}
            </div>
          </div>
          {@render sectionPicker(contentDraft.section, (id) => (contentDraft.section = id))}
          {@render viewFrequencyPicker(contentDraft.viewFrequency, (id) => (contentDraft.viewFrequency = id))}
          {@render sitePicker(contentDraft)}
          {@render inputField('Title', contentDraft.title, (e) => (contentDraft.title = e.currentTarget.value))}
          {@render inputField('Category', contentDraft.category, (e) => (contentDraft.category = e.currentTarget.value), { placeholder: 'e.g. Education' })}
          {@render inputField('Duration label', contentDraft.durationLabel, (e) => (contentDraft.durationLabel = e.currentTarget.value), { placeholder: 'e.g. 5 min' })}
          {#if contentDraft.type === 'survey' || contentDraft.type === 'article'}
            {@render inputField('Reward (minutes)', contentDraft.earnMinutes, (e) => (contentDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
          {:else}
            <div class="grid grid-cols-2 gap-3">
              {@render inputField('Reward (minutes)', contentDraft.earnMinutes, (e) => (contentDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
              {@render inputField('Min watch (seconds)', contentDraft.minWatchSecs, (e) => (contentDraft.minWatchSecs = e.currentTarget.value), { type: 'number' })}
            </div>
          {/if}
          {@render fileOrUrlField(
            contentDraft.type === 'survey' ? 'Image (background behind the survey icon)' : 'Image',
            contentDraft.imgUrl,
            (e) => (contentDraft.imgUrl = e.currentTarget.value),
            imgUploading,
            (e) => handleFileUpload(e, contentDraft, 'imgUrl', (v) => (imgUploading = v), (m) => (contentFormError = m)),
            'image/*'
          )}
          {#if contentDraft.type === 'survey'}
            {@render surveyQuestionsEditor(contentDraft)}
          {:else if contentDraft.type === 'article'}
            {@render articleBodyField(contentDraft, (e) => (contentDraft.bodyUrl = e.currentTarget.value))}
          {:else}
            {@render fileOrUrlField(
              contentDraft.type === 'video' ? 'Video' : 'Article',
              contentDraft.bodyUrl,
              (e) => (contentDraft.bodyUrl = e.currentTarget.value),
              bodyUploading,
              (e) => handleFileUpload(e, contentDraft, 'bodyUrl', (v) => (bodyUploading = v), (m) => (contentFormError = m)),
              contentDraft.type === 'video' ? 'video/*' : undefined
            )}
          {/if}

          {#if contentFormError}
            <p class="text-xs text-[#E08A6A]">{contentFormError}</p>
          {/if}

          <button
            onclick={submitContent}
            disabled={contentSaving}
            class="w-full py-3 rounded-2xl font-bold text-sm text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {contentSaving ? 0.7 : 1};"
          >
            {contentSaving ? 'Saving…' : 'Create content item'}
          </button>
        </AdminModal>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{contentItems.length} items</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {#each contentItems as item (item.id)}
        {@const Icon = TYPE_ICON[item.type]}
        <div class="rounded-2xl overflow-hidden shadow-sm" style="background: #2E5A3E; opacity: {item.is_active ? 1 : 0.5};">
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
              <Icon size={16} color="#C45C38" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{item.title}</p>
              <p class="text-[10px] text-[#AECAAE]">
                <span class="font-semibold" style="color: #C45C38;">{SECTION_LABEL[item.section] ?? item.section}</span>
                · {item.category || item.type} · {formatEarn(item.earn_secs)} reward{item.min_watch_secs > 0 ? ` · ${item.min_watch_secs}s min` : ''}
                {#if item.view_frequency && item.view_frequency !== 'once'}
                  · <span style="color: #CC8830;">{VIEW_FREQUENCY_LABEL[item.view_frequency]}</span>
                {/if}
              </p>
              <p class="text-[10px] text-[#96B496] flex items-center gap-1 mt-0.5"><Eye size={9} />{Number(item.impressions ?? 0).toLocaleString()} views</p>
            </div>
            <div class="flex flex-col gap-1.5 shrink-0 items-end">
              <button
                onclick={() => startEditContent(item)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                <Edit3 size={10} /> Edit
              </button>
              <button
                onclick={() => toggleContentActive(item)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: {item.is_active ? 'rgba(78,128,80,0.30)' : 'rgba(192,97,74,0.20)'}; color: {item.is_active ? '#4E8050' : '#B85038'};"
              >
                {#if item.is_active}<Pause size={10} /> Active{:else}<Play size={10} /> Off{/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
      </div>

      {#if editingContentId && contentEditDraft}
        <AdminModal title="Edit content" onClose={cancelEditContent}>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Type</p>
            <div class="flex gap-2">
              {#each ['video', 'article', 'survey', 'lesson'] as t (t)}
                <button
                  type="button"
                  onclick={() => (contentEditDraft.type = t)}
                  class="flex-1 py-2 rounded-xl text-[11px] font-semibold capitalize"
                  style="background: {contentEditDraft.type === t ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {contentEditDraft.type === t ? '#fff' : '#C4DAC0'};"
                >
                  {t}
                </button>
              {/each}
            </div>
          </div>
          {@render sectionPicker(contentEditDraft.section, (id) => (contentEditDraft.section = id))}
          {@render viewFrequencyPicker(contentEditDraft.viewFrequency, (id) => (contentEditDraft.viewFrequency = id))}
          {@render sitePicker(contentEditDraft)}
          {@render inputField('Title', contentEditDraft.title, (e) => (contentEditDraft.title = e.currentTarget.value))}
          {@render inputField('Category', contentEditDraft.category, (e) => (contentEditDraft.category = e.currentTarget.value), { placeholder: 'e.g. Education' })}
          {@render inputField('Duration label', contentEditDraft.durationLabel, (e) => (contentEditDraft.durationLabel = e.currentTarget.value), { placeholder: 'e.g. 5 min' })}
          {#if contentEditDraft.type === 'survey' || contentEditDraft.type === 'article'}
            {@render inputField('Reward (minutes)', contentEditDraft.earnMinutes, (e) => (contentEditDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
          {:else}
            <div class="grid grid-cols-2 gap-3">
              {@render inputField('Reward (minutes)', contentEditDraft.earnMinutes, (e) => (contentEditDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
              {@render inputField('Min watch (seconds)', contentEditDraft.minWatchSecs, (e) => (contentEditDraft.minWatchSecs = e.currentTarget.value), { type: 'number' })}
            </div>
          {/if}
          {@render fileOrUrlField(
            contentEditDraft.type === 'survey' ? 'Image (background behind the survey icon)' : 'Image',
            contentEditDraft.imgUrl,
            (e) => (contentEditDraft.imgUrl = e.currentTarget.value),
            editImgUploading,
            (e) => handleFileUpload(e, contentEditDraft, 'imgUrl', (v) => (editImgUploading = v), (m) => (contentEditError = m)),
            'image/*'
          )}
          {#if contentEditDraft.type === 'survey'}
            {@render surveyQuestionsEditor(contentEditDraft)}
          {:else if contentEditDraft.type === 'article'}
            {@render articleBodyField(contentEditDraft, (e) => (contentEditDraft.bodyUrl = e.currentTarget.value))}
          {:else}
            {@render fileOrUrlField(
              contentEditDraft.type === 'video' ? 'Video' : 'Article',
              contentEditDraft.bodyUrl,
              (e) => (contentEditDraft.bodyUrl = e.currentTarget.value),
              editBodyUploading,
              (e) => handleFileUpload(e, contentEditDraft, 'bodyUrl', (v) => (editBodyUploading = v), (m) => (contentEditError = m)),
              contentEditDraft.type === 'video' ? 'video/*' : undefined
            )}
          {/if}

          {#if contentEditError}
            <p class="text-xs text-[#E08A6A]">{contentEditError}</p>
          {/if}

          <button
            onclick={() => saveEditContent(editingContentId)}
            disabled={contentEditSaving}
            class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {contentEditSaving ? 0.7 : 1};"
          >
            <Save size={12} />{contentEditSaving ? 'Saving…' : 'Save changes'}
          </button>
        </AdminModal>
      {/if}
    {:else if tab === 'activators'}
      <button
        onclick={() => {
          activatorDraft = freshActivatorDraft();
          showActivatorForm = true;
        }}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
      >
        <Plus size={15} /> Add activator
      </button>

      {#if showActivatorForm}
        <AdminModal title="Add activator" onClose={() => (showActivatorForm = false)}>
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('Code', activatorDraft.code, (e) => (activatorDraft.code = e.currentTarget.value), { placeholder: 'ACT-009' })}
            {@render inputField('Name', activatorDraft.name, (e) => (activatorDraft.name = e.currentTarget.value))}
          </div>
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('Phone', activatorDraft.phone, (e) => (activatorDraft.phone = e.currentTarget.value), { placeholder: '254700000000' })}
            {@render inputField('PIN', activatorDraft.pin, (e) => (activatorDraft.pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)), { type: 'password', placeholder: '4-digit' })}
          </div>
          {@render inputField('Territory', activatorDraft.territory, (e) => (activatorDraft.territory = e.currentTarget.value), { placeholder: 'e.g. Nairobi CBD' })}
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('M-PESA number', activatorDraft.mpesaNumber, (e) => (activatorDraft.mpesaNumber = e.currentTarget.value), { placeholder: 'if different' })}
            {@render inputField('Commission %', activatorDraft.commissionRate, (e) => (activatorDraft.commissionRate = e.currentTarget.value), { type: 'number' })}
          </div>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Reports to coordinator</p>
            <select
              value={activatorDraft.coordinatorId}
              onchange={(e) => (activatorDraft.coordinatorId = e.currentTarget.value)}
              class="w-full px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] outline-none"
              style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
            >
              <option value="" style="color: #1D3C2A;">None</option>
              {#each coordinators as c (c.id)}
                <option value={c.id} style="color: #1D3C2A;">{c.name}</option>
              {/each}
            </select>
          </div>

          {#if activatorFormError}
            <p class="text-xs text-[#E08A6A]">{activatorFormError}</p>
          {/if}

          <button
            onclick={submitActivator}
            disabled={activatorSaving}
            class="w-full py-3 rounded-2xl font-bold text-sm text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {activatorSaving ? 0.7 : 1};"
          >
            {activatorSaving ? 'Saving…' : 'Create activator'}
          </button>
        </AdminModal>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{activators.length} activators</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {#each activators as a (a.id)}
        <div class="rounded-2xl overflow-hidden shadow-sm" style="background: #2E5A3E; opacity: {a.status === 'active' ? 1 : 0.5};">
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold" style="background: rgba(196,92,56,0.28); color: #C45C38;">
              {a.code.slice(-2)}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{a.name} <span class="text-[10px] text-[#96B496] font-normal">· {a.code}</span></p>
              <p class="text-[10px] text-[#AECAAE] flex items-center gap-1"><Phone size={9} />{a.phone}</p>
              <p class="text-[10px] text-[#AECAAE] flex items-center gap-1">
                {#if a.territory}<MapPin size={9} />{a.territory} · {/if}
                {(Number(a.commission_rate) * 100).toFixed(0)}% comm.{a.coordinator_name ? ` · reports to ${a.coordinator_name}` : ''}
              </p>
              <p class="text-[10px] font-bold text-[#C45C38] flex items-center gap-1"><TrendingUp size={9} />{a.paid_sessions} sessions · KES {Number(a.commission_kes).toLocaleString()} earned</p>
            </div>
            <div class="flex flex-col gap-1.5 shrink-0 items-end">
              <button
                onclick={() => startEditActivator(a)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                <Edit3 size={10} /> Edit
              </button>
              <button
                onclick={() => toggleActivatorStatus(a)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: {a.status === 'active' ? 'rgba(78,128,80,0.30)' : 'rgba(192,97,74,0.20)'}; color: {a.status === 'active' ? '#4E8050' : '#B85038'};"
              >
                {#if a.status === 'active'}<Pause size={10} /> Active{:else}<Play size={10} /> Off{/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
      </div>

      {#if editingActivatorId && activatorEditDraft}
        {@const a = activators.find((x) => x.id === editingActivatorId)}
        <AdminModal title="Edit activator" onClose={cancelEditActivator}>
          {#if a}
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(255,255,255,0.06);">
              <Phone size={12} color="#96B496" />
              <p class="text-xs text-[#C4DAC0]">Login phone: <span class="font-semibold text-[#E8D4B0]">{a.phone}</span> <span class="text-[#96B496]">(code {a.code}, not editable here)</span></p>
            </div>
          {/if}
          {@render inputField('Name', activatorEditDraft.name, (e) => (activatorEditDraft.name = e.currentTarget.value))}
          {@render inputField('Territory', activatorEditDraft.territory, (e) => (activatorEditDraft.territory = e.currentTarget.value), { placeholder: 'e.g. Nairobi CBD' })}
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('M-PESA number', activatorEditDraft.mpesaNumber, (e) => (activatorEditDraft.mpesaNumber = e.currentTarget.value), { placeholder: 'if different' })}
            {@render inputField('Commission %', activatorEditDraft.commissionRate, (e) => (activatorEditDraft.commissionRate = e.currentTarget.value), { type: 'number' })}
          </div>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Reports to coordinator</p>
            <select
              value={activatorEditDraft.coordinatorId}
              onchange={(e) => (activatorEditDraft.coordinatorId = e.currentTarget.value)}
              class="w-full px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] outline-none"
              style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
            >
              <option value="" style="color: #1D3C2A;">None</option>
              {#each coordinators as c (c.id)}
                <option value={c.id} style="color: #1D3C2A;">{c.name}</option>
              {/each}
            </select>
          </div>
          {@render inputField('Reset PIN (optional)', activatorEditDraft.pin, (e) => (activatorEditDraft.pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)), { type: 'password', placeholder: 'leave blank to keep current' })}

          {#if activatorEditError}
            <p class="text-xs text-[#E08A6A]">{activatorEditError}</p>
          {/if}

          <button
            onclick={() => saveEditActivator(editingActivatorId)}
            disabled={activatorEditSaving}
            class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {activatorEditSaving ? 0.7 : 1};"
          >
            <Save size={12} />{activatorEditSaving ? 'Saving…' : 'Save changes'}
          </button>
        </AdminModal>
      {/if}
    {:else if tab === 'coordinators'}
      <button
        onclick={() => (showCoordinatorForm = true)}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: linear-gradient(135deg, #C45C38, #CC8830); color: #fff;"
      >
        <Plus size={15} /> Add coordinator
      </button>

      {#if showCoordinatorForm}
        <AdminModal title="Add coordinator" onClose={() => (showCoordinatorForm = false)}>
          {@render inputField('Name', coordinatorDraft.name, (e) => (coordinatorDraft.name = e.currentTarget.value))}
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('Phone', coordinatorDraft.phone, (e) => (coordinatorDraft.phone = e.currentTarget.value), { placeholder: '254700000000' })}
            {@render inputField('PIN', coordinatorDraft.pin, (e) => (coordinatorDraft.pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)), { type: 'password', placeholder: '4-digit' })}
          </div>
          {@render inputField('Territory', coordinatorDraft.territory, (e) => (coordinatorDraft.territory = e.currentTarget.value), { placeholder: 'e.g. Nairobi Central' })}

          {#if coordinatorFormError}
            <p class="text-xs text-[#E08A6A]">{coordinatorFormError}</p>
          {/if}

          <button
            onclick={submitCoordinator}
            disabled={coordinatorSaving}
            class="w-full py-3 rounded-2xl font-bold text-sm text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {coordinatorSaving ? 0.7 : 1};"
          >
            {coordinatorSaving ? 'Saving…' : 'Create coordinator'}
          </button>
        </AdminModal>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{coordinators.length} coordinators</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {#each coordinators as c (c.id)}
        <div class="rounded-2xl overflow-hidden shadow-sm" style="background: #2E5A3E; opacity: {c.status === 'active' ? 1 : 0.5};">
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
              <ShieldCheck size={16} color="#C45C38" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{c.name}</p>
              <p class="text-[10px] text-[#AECAAE] flex items-center gap-1"><Phone size={9} />{c.phone}</p>
              <p class="text-[10px] text-[#AECAAE] flex items-center gap-1">
                {#if c.territory}<MapPin size={9} />{c.territory} · {/if}{c.activator_count} activators
              </p>
              <p class="text-[10px] font-bold text-[#C45C38] flex items-center gap-1"><TrendingUp size={9} />{c.paid_sessions} sessions · KES {Number(c.commission_kes).toLocaleString()} team earnings</p>
            </div>
            <div class="flex flex-col gap-1.5 shrink-0 items-end">
              <button
                onclick={() => startEditCoordinator(c)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                <Edit3 size={10} /> Edit
              </button>
              <button
                onclick={() => toggleCoordinatorStatus(c)}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: {c.status === 'active' ? 'rgba(78,128,80,0.30)' : 'rgba(192,97,74,0.20)'}; color: {c.status === 'active' ? '#4E8050' : '#B85038'};"
              >
                {#if c.status === 'active'}<Pause size={10} /> Active{:else}<Play size={10} /> Off{/if}
              </button>
            </div>
          </div>
        </div>
      {/each}
      </div>

      {#if editingCoordinatorId && coordinatorEditDraft}
        {@const c = coordinators.find((x) => x.id === editingCoordinatorId)}
        <AdminModal title="Edit coordinator" onClose={cancelEditCoordinator}>
          {#if c}
            <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(255,255,255,0.06);">
              <Phone size={12} color="#96B496" />
              <p class="text-xs text-[#C4DAC0]">Login phone: <span class="font-semibold text-[#E8D4B0]">{c.phone}</span> <span class="text-[#96B496]">(not editable here)</span></p>
            </div>
          {/if}
          {@render inputField('Name', coordinatorEditDraft.name, (e) => (coordinatorEditDraft.name = e.currentTarget.value))}
          {@render inputField('Territory', coordinatorEditDraft.territory, (e) => (coordinatorEditDraft.territory = e.currentTarget.value), { placeholder: 'e.g. Nairobi Central' })}
          {@render inputField('Reset PIN (optional)', coordinatorEditDraft.pin, (e) => (coordinatorEditDraft.pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)), { type: 'password', placeholder: 'leave blank to keep current' })}

          {#if coordinatorEditError}
            <p class="text-xs text-[#E08A6A]">{coordinatorEditError}</p>
          {/if}

          <button
            onclick={() => saveEditCoordinator(editingCoordinatorId)}
            disabled={coordinatorEditSaving}
            class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {coordinatorEditSaving ? 0.7 : 1};"
          >
            <Save size={12} />{coordinatorEditSaving ? 'Saving…' : 'Save changes'}
          </button>
        </AdminModal>
      {/if}
    {:else if tab === 'analytics'}
      <div class="flex items-center justify-between px-1 mb-1">
        {#if showSiteDetail}
          <button
            onclick={() => (showSiteDetail = false)}
            class="flex items-center gap-1 text-sm font-bold text-[#1D3C2A]"
          >
            <ChevronLeft size={16} /> Purchases by Site
          </button>
        {:else}
          <h2 class="text-sm font-bold text-[#1D3C2A]">Analytics overview</h2>
        {/if}
        <button
          onclick={showSiteDetail ? loadSiteDetail : loadAnalytics}
          disabled={showSiteDetail ? siteDetailLoading : analyticsLoading}
          class="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-full transition-all active:scale-95"
          style="background: rgba(29,60,42,0.1); color: #1D3C2A; opacity: {(showSiteDetail ? siteDetailLoading : analyticsLoading) ? 0.6 : 1};"
        >
          <RefreshCw size={12} class={(showSiteDetail ? siteDetailLoading : analyticsLoading) ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {#if showSiteDetail}
        <div class="flex gap-1.5 flex-wrap px-1">
          {#each SITE_TIMELINE_GRANULARITIES as g (g.id)}
            <button
              type="button"
              onclick={() => (siteDetailGranularity = g.id)}
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style="background: {siteDetailGranularity === g.id ? '#C45C38' : 'rgba(29,60,42,0.1)'}; color: {siteDetailGranularity === g.id ? '#fff' : '#1D3C2A'};"
            >
              {g.label}
            </button>
          {/each}
        </div>
        <div class="flex gap-1.5 flex-wrap px-1">
          <button
            type="button"
            onclick={() => (siteDetailSiteId = '')}
            class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
            style="background: {siteDetailSiteId === '' ? '#C45C38' : 'rgba(29,60,42,0.1)'}; color: {siteDetailSiteId === '' ? '#fff' : '#1D3C2A'};"
          >
            All sites
          </button>
          {#each sites as s (s.id)}
            <button
              type="button"
              onclick={() => (siteDetailSiteId = s.id)}
              class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style="background: {siteDetailSiteId === s.id ? '#C45C38' : 'rgba(29,60,42,0.1)'}; color: {siteDetailSiteId === s.id ? '#fff' : '#1D3C2A'};"
            >
              {s.name}
            </button>
          {/each}
        </div>

        {#if siteDetailLoading && !siteDetailData}
          <div class="flex items-center justify-center py-12">
            <div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div>
          </div>
        {:else if siteDetailData}
          <div class="rounded-2xl overflow-hidden shadow-md px-4 pt-3.5 pb-4" style="background: #2E5A3E; opacity: {siteDetailLoading ? 0.6 : 1};">
            {#if siteDetailData.series.length === 0}
              <p class="text-xs text-[#96B496] text-center py-8">No purchases in this window.</p>
            {:else}
              <MultiLineChartMini
                days={siteDetailData.periods}
                series={siteDetailData.series}
                height={200}
                showGrid
                showYLabels
              />
            {/if}
          </div>

          {#if siteDetailTotals.length > 0}
            <div class="rounded-2xl overflow-hidden shadow-md" style="background: #2E5A3E;">
              <div class="px-4 pt-3.5 pb-2">
                <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Totals for this window</p>
              </div>
              {#each siteDetailTotals as t, i (t.siteId ?? i)}
                <div class="flex items-center justify-between px-4 py-2.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none'};">
                  <span class="text-xs text-[#E8D4B0]">{t.siteName}</span>
                  <span class="text-xs text-[#96B496]">{t.sessions} sessions · <span class="font-bold" style="color: #C45C38;">KES {t.revenueKes.toLocaleString()}</span></span>
                </div>
              {/each}
            </div>
          {/if}
        {/if}
      {:else if analyticsLoading}
        <div class="flex items-center justify-center py-12">
          <div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div>
        </div>
      {:else if !analytics}
        <p class="text-xs text-[#96B496] text-center py-8">Could not load analytics — check your connection.</p>
      {:else}
        <div class="flex items-center gap-2 mb-1 px-1">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background: rgba(196,92,56,0.28);">
            <Zap size={14} color="#C45C38" />
          </div>
          <h3 class="text-sm font-bold text-[#1D3C2A]">Watch & Earn</h3>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          {@render statCard(Eye, 'Impressions', analytics.earned.totalImpressions.toLocaleString(), '#C45C38')}
          {@render statCard(CheckCircle2, 'Completions', analytics.earned.totalCompletions.toLocaleString(), '#4E8050')}
          {@render statCard(Users, 'Clients Engaged', analytics.earned.uniqueClientsEngaged.toLocaleString(), '#5B8ED6')}
          {@render statCard(Award, 'Granted Sessions', analytics.earned.sessionsGrantedViaEarning.toLocaleString(), '#CC8830')}
          {@render statCard(Radio, 'Active Now', analytics.earned.activeSessionsNow.toLocaleString(), '#5B8ED6')}
        </div>

        <div class="grid md:grid-cols-2 gap-3 items-start">
          <div class="rounded-2xl px-4 py-3.5 shadow-md" style="background: #2E5A3E;">
            <p class="text-[10px] text-[#96B496] uppercase tracking-wider mb-1">Reward time earned / claimed</p>
            <p class="text-lg font-bold text-[#E8D4B0]">
              {formatEarn(analytics.earned.totalEarnedSecs)} <span class="text-xs text-[#96B496] font-normal">earned</span>
              <span class="text-[#4A6842] mx-1">·</span>
              {formatEarn(analytics.earned.totalClaimedSecs)} <span class="text-xs text-[#96B496] font-normal">claimed</span>
            </p>
          </div>

          {#if analytics.earned.contentOverview.length > 0}
            <div class="rounded-2xl overflow-hidden shadow-md" style="background: #2E5A3E;">
              <div class="px-4 pt-3.5 pb-2">
                <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Content Overview</p>
                <p class="text-[10px] text-[#96B496]">Tap an item for interaction details</p>
              </div>
              {#each analytics.earned.contentOverview as c, i (c.id)}
                {@const impressionsPct = Math.round((c.impressions / maxContentImpressions) * 100)}
                {@const completionRate = c.impressions > 0 ? c.completions / c.impressions : 0}
                {@const completionsPct = impressionsPct * completionRate}
                <button
                  type="button"
                  onclick={() => toggleContentAnalytics(c.id)}
                  class="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                  style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none'}; opacity: {c.isActive ? 1 : 0.55};"
                >
                  <span class="text-xs font-bold w-4 shrink-0 text-center" style="color: #96B496;">{i + 1}</span>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1">
                      <p class="min-w-0 text-xs text-[#E8D4B0] truncate">{c.title}</p>
                      <span class="text-[9px] font-bold shrink-0" style="color: #4E8050;">
                        {Math.round(completionRate * 100)}%
                      </span>
                    </div>
                    <div class="relative h-1.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.08);">
                      <div class="absolute inset-y-0 left-0 rounded-full" style="width: {impressionsPct}%; background: rgba(150,180,150,0.4);"></div>
                      <div class="absolute inset-y-0 left-0 rounded-full" style="width: {completionsPct}%; background: #4E8050;"></div>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-0.5 shrink-0">
                    <span class="text-[10px] text-[#96B496] flex items-center gap-1"><Eye size={9} />{c.impressions}</span>
                    <span class="text-[10px] font-bold" style="color: #4E8050;">{c.completions} done</span>
                  </div>
                </button>

                {#if expandedContentId === c.id}
                  <div class="px-4 py-3" style="background: rgba(0,0,0,0.15); border-top: 1px solid rgba(255,255,255,0.08);">
                    {#if contentDetailLoading}
                      <div class="flex justify-center py-4"><div class="w-5 h-5 rounded-full border-2 border-white/20 border-t-white/70 animate-spin"></div></div>
                    {:else if contentDetail}
                      <div class="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <p class="text-[9px] text-[#96B496] uppercase tracking-wider">Impressions</p>
                          <p class="text-sm font-bold text-[#E8D4B0]">{contentDetail.impressions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p class="text-[9px] text-[#96B496] uppercase tracking-wider">Completions</p>
                          <p class="text-sm font-bold text-[#E8D4B0]">{contentDetail.completions.toLocaleString()}</p>
                        </div>
                        <div>
                          <p class="text-[9px] text-[#96B496] uppercase tracking-wider">Unique Clients</p>
                          <p class="text-sm font-bold text-[#E8D4B0]">{contentDetail.uniqueClients.toLocaleString()}</p>
                        </div>
                        <div>
                          <p class="text-[9px] text-[#96B496] uppercase tracking-wider">Completion Rate</p>
                          <p class="text-sm font-bold text-[#E8D4B0]">{contentDetail.completionRate != null ? `${Math.round(contentDetail.completionRate * 100)}%` : '—'}</p>
                        </div>
                      </div>
                      <p class="text-[10px] text-[#96B496] mb-3">Total reward time awarded: <span class="font-bold text-[#C45C38]">{formatEarn(contentDetail.totalEarnSecsAwarded)}</span></p>

                      {#if contentDetail.type === 'survey' && contentDetail.surveyQuestions}
                        <p class="text-[10px] font-bold text-[#C4DAC0] uppercase tracking-wider mb-2">Answer breakdown</p>
                        {#each contentDetail.surveyQuestions as q, qi (qi)}
                          {@const answers = contentDetail.surveyBreakdown?.[String(qi)] ?? []}
                          {@const totalAnswers = answers.reduce((s, a) => s + a.count, 0)}
                          <div class="mb-3 last:mb-0">
                            <p class="text-xs text-[#E8D4B0] mb-1.5">{q.question ?? q}</p>
                            {#if totalAnswers === 0}
                              <p class="text-[10px] text-[#96B496]">No answers yet</p>
                            {:else}
                              {#each answers as a (a.answer)}
                                {@const pct = Math.round((a.count / totalAnswers) * 100)}
                                <div class="flex items-center gap-2 mb-1 last:mb-0">
                                  <span class="text-[10px] w-16 shrink-0 text-right" style="color: #C4DAC0;">{a.answer}</span>
                                  <div class="flex-1 h-2 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.1);">
                                    <div class="h-full rounded-full" style="width: {pct}%; background: #C45C38;"></div>
                                  </div>
                                  <span class="text-[10px] w-10 shrink-0" style="color: #96B496;">{pct}%</span>
                                </div>
                              {/each}
                            {/if}
                          </div>
                        {/each}
                      {/if}
                    {:else}
                      <p class="text-[10px] text-[#96B496] text-center py-2">Could not load details.</p>
                    {/if}
                  </div>
                {/if}
              {/each}
            </div>
          {/if}
        </div>

        <div class="h-px my-1" style="background: rgba(29,60,42,0.12);"></div>

        <div class="flex items-center gap-2 mb-1 px-1">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background: rgba(78,128,80,0.28);">
            <Wallet size={14} color="#4E8050" />
          </div>
          <h3 class="text-sm font-bold text-[#1D3C2A]">Purchases</h3>
        </div>
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {@render statCard(CheckCircle2, 'Paid Sessions', analytics.purchased.totalPaidSessions.toLocaleString(), '#4E8050')}
          {@render statCard(Radio, 'Active Now', analytics.purchased.activeSessionsNow.toLocaleString(), '#5B8ED6')}
          {@render statCard(Wallet, 'Revenue', `KES ${analytics.purchased.totalRevenueKes.toLocaleString()}`, '#C45C38')}
          {@render statCard(Award, 'Commission Paid', `KES ${analytics.purchased.totalCommissionKes.toLocaleString()}`, '#CC8830')}
        </div>

        {#if analytics.purchased.bySiteTimeline?.series.length > 0}
          <div class="rounded-2xl overflow-hidden shadow-md px-4 pt-3.5 pb-4" style="background: #2E5A3E;">
            <div class="flex items-center justify-between mb-2">
              <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Purchases by Site (last 14 days)</p>
              <button
                type="button"
                onclick={openSiteDetail}
                class="text-[11px] font-bold shrink-0"
                style="color: #C45C38;"
              >
                View more →
              </button>
            </div>
            <MultiLineChartMini
              days={analytics.purchased.bySiteTimeline.days}
              series={analytics.purchased.bySiteTimeline.series}
              height={160}
              showGrid
              showYLabels
            />
          </div>
        {/if}

        <div class="grid md:grid-cols-2 gap-3 items-start">
          {#if analytics.purchased.byPackage.length > 0}
            <div class="rounded-2xl overflow-hidden shadow-md" style="background: #2E5A3E;">
              <div class="px-4 pt-3.5 pb-1">
                <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">Revenue by Package</p>
              </div>
              <div style="height: 120px; margin: 8px 8px 4px 4px;">
                <BarChartMini data={analytics.purchased.byPackage} yKey="revenueKes" xKey="packageId" height={120} color="#C45C38" barSize={26} radius={4} showGrid showYLabels yAxisWidth={28} />
              </div>
            </div>
          {/if}

          {#if analytics.purchased.byProvider.length > 0}
            <div class="rounded-2xl overflow-hidden shadow-md" style="background: #2E5A3E;">
              <div class="px-4 pt-3.5 pb-2">
                <p class="text-xs font-bold text-[#C4DAC0] uppercase tracking-wider">By Payment Provider</p>
              </div>
              {#each analytics.purchased.byProvider as p, i (p.provider)}
                <div class="flex items-center justify-between px-4 py-2.5" style="border-top: {i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none'};">
                  <span class="text-xs text-[#E8D4B0] capitalize">{p.provider}</span>
                  <span class="text-xs text-[#96B496]">{p.count} sessions · <span class="font-bold" style="color: #C45C38;">KES {p.revenueKes.toLocaleString()}</span></span>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    {:else if tab === 'sites'}
      <button
        onclick={() => {
          if (showSiteForm) {
            showSiteForm = false;
          } else {
            openSiteForm();
          }
        }}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: {showSiteForm ? 'rgba(29,60,42,0.1)' : 'linear-gradient(135deg, #C45C38, #CC8830)'}; color: {showSiteForm ? '#1D3C2A' : '#fff'};"
      >
        {#if showSiteForm}<X size={15} /> Cancel{:else}<Plus size={15} /> Add site{/if}
      </button>

      {#if showSiteForm}
        <div class="rounded-3xl p-5 flex flex-col gap-3 shadow-md" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.15);">
          {#if unifiSiteOptionsLoading}
            <p class="text-xs text-[#96B496]">Loading UniFi sites…</p>
          {:else if unifiSiteOptions.length > 0}
            <div>
              <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">UniFi site (optional — fills id/name)</p>
              <select
                onchange={(e) => {
                  const opt = unifiSiteOptions.find((o) => o.id === e.currentTarget.value);
                  if (opt) {
                    siteDraft.id = opt.id;
                    siteDraft.name = opt.name;
                  }
                }}
                class="w-full px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] outline-none"
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
              >
                <option value="" style="color: #1D3C2A;">Choose or enter manually below</option>
                {#each unifiSiteOptions as o (o.id)}
                  <option value={o.id} style="color: #1D3C2A;">{o.name}</option>
                {/each}
              </select>
            </div>
          {/if}
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('Site id', siteDraft.id, (e) => (siteDraft.id = e.currentTarget.value), { placeholder: 'e.g. 99kv3joz' })}
            {@render inputField('Name', siteDraft.name, (e) => (siteDraft.name = e.currentTarget.value), { placeholder: 'e.g. Nairobi CBD Cafe' })}
          </div>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Mode</p>
            <div class="flex gap-1.5 flex-wrap">
              {#each SITE_MODES as m (m.id)}
                <button
                  type="button"
                  onclick={() => (siteDraft.mode = m.id)}
                  class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style="background: {siteDraft.mode === m.id ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {siteDraft.mode === m.id ? '#fff' : '#C4DAC0'};"
                >
                  {m.label}
                </button>
              {/each}
            </div>
          </div>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">BTC payments</p>
            <button
              type="button"
              onclick={() => (siteDraft.btcEnabled = !siteDraft.btcEnabled)}
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold"
              style="background: {siteDraft.btcEnabled ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {siteDraft.btcEnabled ? '#fff' : '#C4DAC0'};"
            >
              <Bitcoin size={12} />
              {siteDraft.btcEnabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>

          {#if siteFormError}
            <p class="text-xs text-[#E08A6A]">{siteFormError}</p>
          {/if}

          <button
            onclick={submitSite}
            disabled={siteSaving}
            class="w-full py-3 rounded-2xl font-bold text-sm text-white"
            style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {siteSaving ? 0.7 : 1};"
          >
            {siteSaving ? 'Saving…' : 'Create site'}
          </button>
        </div>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{sites.length} sites</p>
      {#if siteDeleteError}
        <p class="text-xs text-[#E08A6A] px-1">{siteDeleteError}</p>
      {/if}
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {#each sites as s (s.id)}
        <div class="rounded-2xl overflow-hidden shadow-sm px-4 py-3.5 flex flex-col gap-2.5" style="background: #2E5A3E; opacity: {s.status === 'active' ? 1 : 0.5};">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
              <Radio size={16} color="#C45C38" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{s.name}</p>
              <p class="text-[10px] text-[#AECAAE]">id: {s.id}</p>
            </div>
            <button
              onclick={() => toggleSiteStatus(s)}
              class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full shrink-0"
              style="background: {s.status === 'active' ? 'rgba(78,128,80,0.30)' : 'rgba(192,97,74,0.20)'}; color: {s.status === 'active' ? '#4E8050' : '#B85038'};"
            >
              {#if s.status === 'active'}<Pause size={10} /> Active{:else}<Play size={10} /> Off{/if}
            </button>
          </div>
          <div class="flex items-center justify-between gap-2">
            <div class="flex gap-1.5 flex-wrap">
              {#each SITE_MODES as m (m.id)}
                <button
                  type="button"
                  onclick={() => setSiteMode(s, m.id)}
                  class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style="background: {s.mode === m.id ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {s.mode === m.id ? '#fff' : '#C4DAC0'};"
                >
                  {m.label}
                </button>
              {/each}
            </div>
            <button
              type="button"
              onclick={() => removeSite(s)}
              class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full shrink-0"
              style="background: {armedDeleteSiteId === s.id ? '#B85038' : 'rgba(192,97,74,0.15)'}; color: {armedDeleteSiteId === s.id ? '#fff' : '#E08A6A'};"
            >
              <X size={10} />{armedDeleteSiteId === s.id ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[10px] text-[#96B496]">BTC payments</span>
            <button
              type="button"
              onclick={() => toggleSiteBtc(s)}
              class="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold"
              style="background: {s.btc_enabled ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {s.btc_enabled ? '#fff' : '#C4DAC0'};"
            >
              <Bitcoin size={11} />
              {s.btc_enabled ? 'Enabled' : 'Disabled'}
            </button>
          </div>
        </div>
      {/each}
      </div>

      <p class="text-xs text-[#3C6A4A] font-semibold px-1 mt-4">Packages</p>
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
      {#each packages as pkg (pkg.id)}
        <div class="rounded-2xl overflow-hidden shadow-sm px-4 py-3.5 flex flex-col gap-2.5" style="background: #2E5A3E; opacity: {pkg.is_active ? 1 : 0.5};">
          <div class="flex items-center gap-3">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{pkg.label}</p>
              <p class="text-[10px] text-[#AECAAE]">KES {Number(pkg.price_kes).toLocaleString()} · {Math.round(pkg.duration_secs / 60)} min</p>
            </div>
            <button
              onclick={() => togglePackageActive(pkg)}
              class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full shrink-0"
              style="background: {pkg.is_active ? 'rgba(78,128,80,0.30)' : 'rgba(192,97,74,0.20)'}; color: {pkg.is_active ? '#4E8050' : '#B85038'};"
            >
              {#if pkg.is_active}<Pause size={10} /> Active{:else}<Play size={10} /> Off{/if}
            </button>
          </div>
          <div>
            <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Visible on sites</p>
            <div class="flex gap-1.5 flex-wrap">
              <button
                type="button"
                onclick={() => clearPackageSites(pkg)}
                class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                style="background: {(pkg.site_ids ?? []).length === 0 ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {(pkg.site_ids ?? []).length === 0 ? '#fff' : '#C4DAC0'};"
              >
                All sites
              </button>
              {#each sites as s (s.id)}
                {@const selected = (pkg.site_ids ?? []).includes(s.id)}
                <button
                  type="button"
                  onclick={() => togglePackageSite(pkg, s.id)}
                  class="px-3 py-1.5 rounded-full text-[11px] font-semibold"
                  style="background: {selected ? '#C45C38' : 'rgba(255,255,255,0.1)'}; color: {selected ? '#fff' : '#C4DAC0'};"
                >
                  {s.name}
                </button>
              {/each}
            </div>
          </div>
        </div>
      {/each}
      </div>
    {:else if tab === 'settings'}
      <div class="rounded-3xl p-5 flex flex-col gap-3 shadow-md" style="background: #2E5A3E; border: 1px solid rgba(196,92,56,0.15);">
        <div class="flex items-center gap-2 mb-1">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
            <Zap size={16} color="#C45C38" />
          </div>
          <div>
            <p class="text-sm font-bold text-[#E8D4B0]">Earn Free Access — Connect threshold</p>
            <p class="text-[10px] text-[#96B496]">Minutes of earned content required before "Connect Now" unlocks</p>
          </div>
        </div>
        {@render inputField('Minutes required', earnConnectThresholdMinutes, (e) => (earnConnectThresholdMinutes = e.currentTarget.value), { type: 'number' })}

        <div class="flex items-center gap-2 mb-1 mt-2" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(204,136,48,0.28);">
            <Percent size={16} color="#CC8830" />
          </div>
          <div>
            <p class="text-sm font-bold text-[#E8D4B0]">Default activator commission</p>
            <p class="text-[10px] text-[#96B496]">Pre-fills new activators' commission rate — each activator's own rate can still be changed individually afterward</p>
          </div>
        </div>
        {@render inputField('Commission %', defaultActivatorCommissionPct, (e) => (defaultActivatorCommissionPct = e.currentTarget.value), { type: 'number' })}

        <div class="flex items-center gap-2 mb-1 mt-2" style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 16px;">
          <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(78,128,80,0.28);">
            <Trash2 size={16} color="#4E8050" />
          </div>
          <div>
            <p class="text-sm font-bold text-[#E8D4B0]">Notification cleanup</p>
            <p class="text-[10px] text-[#96B496]">Read notifications older than this are auto-deleted (checked every 5 min) — unread ones are never touched. 0 = keep forever.</p>
          </div>
        </div>
        {@render inputField('Days (e.g. 7 for a week, 30 for a month)', notificationRetentionDays, (e) => (notificationRetentionDays = e.currentTarget.value), { type: 'number' })}

        {#if settingsError}
          <p class="text-xs text-[#E08A6A]">{settingsError}</p>
        {/if}
        {#if settingsSaved}
          <p class="text-xs" style="color: #4E8050;">Saved.</p>
        {/if}

        <button
          onclick={saveSettings}
          disabled={settingsSaving}
          class="w-full py-3 rounded-2xl font-bold text-sm text-white"
          style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {settingsSaving ? 0.7 : 1};"
        >
          {settingsSaving ? 'Saving…' : 'Save'}
        </button>
      </div>
    {/if}
  </div>
  </div>
</div>
