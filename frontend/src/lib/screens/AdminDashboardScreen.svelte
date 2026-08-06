<script>
  import { onMount } from 'svelte';
  import {
    LogOut, Plus, X, Video, FileText, ClipboardList, BookOpen, Users, MapPin,
    ShieldCheck, Pause, Play, TrendingUp, Upload, Edit3, Save, Phone
  } from '@lucide/svelte';
  import {
    adminGetContent, adminCreateContent, adminUpdateContent,
    adminGetActivators, adminCreateActivator, adminUpdateActivator,
    adminGetCoordinators, adminCreateCoordinator, adminUpdateCoordinator,
    adminUploadContentFile
  } from '$lib/api.js';

  let { token, username, onLogout } = $props();

  let tab = $state('content');
  const TABS = [
    { id: 'content', label: 'Content', Icon: FileText },
    { id: 'activators', label: 'Activators', Icon: Users },
    { id: 'coordinators', label: 'Coordinators', Icon: ShieldCheck }
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

  let contentItems = $state([]);
  let activators = $state([]);
  let coordinators = $state([]);
  let loading = $state(true);

  async function loadContent() {
    const r = await adminGetContent(token);
    if (r.ok) contentItems = r.data.items;
  }
  async function loadActivators() {
    const r = await adminGetActivators(token);
    if (r.ok) activators = r.data.activators;
  }
  async function loadCoordinators() {
    const r = await adminGetCoordinators(token);
    if (r.ok) coordinators = r.data.coordinators;
  }

  onMount(async () => {
    await Promise.all([loadContent(), loadActivators(), loadCoordinators()]);
    loading = false;
  });

  // ── Content form ─────────────────────────────────────────────────────────
  const DEFAULT_CONTENT_DRAFT = {
    type: 'video', section: 'whats_new', title: '', category: '', durationLabel: '', earnMinutes: '30', minWatchSecs: '0',
    imgUrl: '', bodyUrl: '', surveyQuestionsText: ''
  };
  let showContentForm = $state(false);
  let contentDraft = $state({ ...DEFAULT_CONTENT_DRAFT });
  let contentFormError = $state('');
  let contentSaving = $state(false);

  function draftToBody(draft) {
    return {
      type: draft.type,
      section: draft.section,
      title: draft.title.trim(),
      category: draft.category.trim() || undefined,
      durationLabel: draft.durationLabel.trim() || undefined,
      earnSecs: Math.round(Number(draft.earnMinutes) * 60),
      minWatchSecs: Number(draft.minWatchSecs) || 0,
      imgUrl: draft.imgUrl.trim() || undefined,
      bodyUrl: draft.bodyUrl.trim() || undefined,
      surveyQuestions:
        draft.type === 'survey' ? draft.surveyQuestionsText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined
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
      title: item.title,
      category: item.category ?? '',
      durationLabel: item.duration_label ?? '',
      earnMinutes: String(Math.round(item.earn_secs / 60)),
      minWatchSecs: String(item.min_watch_secs ?? 0),
      imgUrl: item.img_url ?? '',
      bodyUrl: item.body_url ?? '',
      surveyQuestionsText: (item.survey_questions ?? []).join('\n')
    };
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
  const DEFAULT_ACTIVATOR_DRAFT = {
    code: '', name: '', phone: '', pin: '', territory: '', mpesaNumber: '', commissionRate: '20', coordinatorId: ''
  };
  let showActivatorForm = $state(false);
  let activatorDraft = $state({ ...DEFAULT_ACTIVATOR_DRAFT });
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

    activatorDraft = { ...DEFAULT_ACTIVATOR_DRAFT };
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

<div style="min-height: 100dvh; background: #E8D4B0;">
  <!-- Header -->
  <div class="px-5 pt-6 pb-5" style="background: #1D3C2A;">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-2xl flex items-center justify-center" style="background: rgba(196,92,56,0.30);">
          <ShieldCheck size={17} color="#C45C38" />
        </div>
        <div>
          <p class="text-[9px] text-[#96B496] font-semibold uppercase tracking-widest">Admin</p>
          <p class="text-sm font-bold text-[#E8D4B0]">{username}</p>
        </div>
      </div>
      <button onclick={onLogout} class="w-8 h-8 rounded-full flex items-center justify-center" style="background: rgba(255,255,255,0.1);">
        <LogOut size={14} color="#C4DAC0" />
      </button>
    </div>
  </div>

  <!-- Tab bar -->
  <div class="flex mx-4 -mt-3 mb-4 rounded-2xl overflow-hidden p-1 gap-0.5 shadow-lg" style="background: #2E5A3E;">
    {#each TABS as t (t.id)}
      {@const Icon = t.Icon}
      <button onclick={() => (tab = t.id)} class="flex-1 py-2.5 rounded-xl flex flex-col items-center gap-0.5 transition-all" style="background: {tab === t.id ? '#162C1E' : 'transparent'};">
        <Icon size={14} color={tab === t.id ? '#C45C38' : '#C4DAC0'} />
        <span class="text-[10px] font-bold" style="color: {tab === t.id ? '#E8D4B0' : '#C4DAC0'};">{t.label}</span>
      </button>
    {/each}
  </div>

  <div class="px-4 pb-10 flex flex-col gap-3">
    {#if loading}
      <div class="flex items-center justify-center py-12">
        <div class="w-6 h-6 rounded-full border-2 border-[#1D3C2A]/30 border-t-[#1D3C2A] animate-spin"></div>
      </div>
    {:else if tab === 'content'}
      <button
        onclick={() => (showContentForm = !showContentForm)}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: {showContentForm ? 'rgba(29,60,42,0.1)' : 'linear-gradient(135deg, #C45C38, #CC8830)'}; color: {showContentForm ? '#1D3C2A' : '#fff'};"
      >
        {#if showContentForm}<X size={15} /> Cancel{:else}<Plus size={15} /> Add content{/if}
      </button>

      {#if showContentForm}
        <div class="rounded-3xl p-5 flex flex-col gap-3" style="background: #2E5A3E;">
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
          {@render inputField('Title', contentDraft.title, (e) => (contentDraft.title = e.currentTarget.value))}
          {@render inputField('Category', contentDraft.category, (e) => (contentDraft.category = e.currentTarget.value), { placeholder: 'e.g. Education' })}
          {@render inputField('Duration label', contentDraft.durationLabel, (e) => (contentDraft.durationLabel = e.currentTarget.value), { placeholder: 'e.g. 5 min' })}
          <div class="grid grid-cols-2 gap-3">
            {@render inputField('Reward (minutes)', contentDraft.earnMinutes, (e) => (contentDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
            {@render inputField('Min watch (seconds)', contentDraft.minWatchSecs, (e) => (contentDraft.minWatchSecs = e.currentTarget.value), { type: 'number' })}
          </div>
          {@render fileOrUrlField(
            'Image',
            contentDraft.imgUrl,
            (e) => (contentDraft.imgUrl = e.currentTarget.value),
            imgUploading,
            (e) => handleFileUpload(e, contentDraft, 'imgUrl', (v) => (imgUploading = v), (m) => (contentFormError = m)),
            'image/*'
          )}
          {#if contentDraft.type !== 'survey'}
            {@render fileOrUrlField(
              contentDraft.type === 'video' ? 'Video' : 'Article',
              contentDraft.bodyUrl,
              (e) => (contentDraft.bodyUrl = e.currentTarget.value),
              bodyUploading,
              (e) => handleFileUpload(e, contentDraft, 'bodyUrl', (v) => (bodyUploading = v), (m) => (contentFormError = m)),
              contentDraft.type === 'video' ? 'video/*' : undefined
            )}
          {:else}
            <div>
              <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Survey questions (one per line)</p>
              <textarea
                value={contentDraft.surveyQuestionsText}
                oninput={(e) => (contentDraft.surveyQuestionsText = e.currentTarget.value)}
                rows="3"
                class="w-full bg-transparent px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none resize-none"
                style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
                placeholder={'How do you use the internet?\nWhat content matters most?'}
              ></textarea>
            </div>
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
        </div>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{contentItems.length} items</p>
      {#each contentItems as item (item.id)}
        {@const Icon = TYPE_ICON[item.type]}
        <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; opacity: {item.is_active ? 1 : 0.5};">
          <div class="flex items-center gap-3 px-4 py-3.5">
            <div class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background: rgba(196,92,56,0.28);">
              <Icon size={16} color="#C45C38" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-semibold text-[#E8D4B0] truncate">{item.title}</p>
              <p class="text-[10px] text-[#AECAAE]">
                <span class="font-semibold" style="color: #C45C38;">{SECTION_LABEL[item.section] ?? item.section}</span>
                · {item.category || item.type} · {formatEarn(item.earn_secs)} reward{item.min_watch_secs > 0 ? ` · ${item.min_watch_secs}s min` : ''}
              </p>
            </div>
            <div class="flex flex-col gap-1.5 shrink-0 items-end">
              <button
                onclick={() => (editingContentId === item.id ? cancelEditContent() : startEditContent(item))}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                {#if editingContentId === item.id}<X size={10} /> Close{:else}<Edit3 size={10} /> Edit{/if}
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

          {#if editingContentId === item.id && contentEditDraft}
            <div class="px-4 pb-4 flex flex-col gap-3" style="border-top: 1px solid rgba(255,255,255,0.14); padding-top: 14px;">
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
              {@render inputField('Title', contentEditDraft.title, (e) => (contentEditDraft.title = e.currentTarget.value))}
              {@render inputField('Category', contentEditDraft.category, (e) => (contentEditDraft.category = e.currentTarget.value), { placeholder: 'e.g. Education' })}
              {@render inputField('Duration label', contentEditDraft.durationLabel, (e) => (contentEditDraft.durationLabel = e.currentTarget.value), { placeholder: 'e.g. 5 min' })}
              <div class="grid grid-cols-2 gap-3">
                {@render inputField('Reward (minutes)', contentEditDraft.earnMinutes, (e) => (contentEditDraft.earnMinutes = e.currentTarget.value), { type: 'number' })}
                {@render inputField('Min watch (seconds)', contentEditDraft.minWatchSecs, (e) => (contentEditDraft.minWatchSecs = e.currentTarget.value), { type: 'number' })}
              </div>
              {@render fileOrUrlField(
                'Image',
                contentEditDraft.imgUrl,
                (e) => (contentEditDraft.imgUrl = e.currentTarget.value),
                editImgUploading,
                (e) => handleFileUpload(e, contentEditDraft, 'imgUrl', (v) => (editImgUploading = v), (m) => (contentEditError = m)),
                'image/*'
              )}
              {#if contentEditDraft.type !== 'survey'}
                {@render fileOrUrlField(
                  contentEditDraft.type === 'video' ? 'Video' : 'Article',
                  contentEditDraft.bodyUrl,
                  (e) => (contentEditDraft.bodyUrl = e.currentTarget.value),
                  editBodyUploading,
                  (e) => handleFileUpload(e, contentEditDraft, 'bodyUrl', (v) => (editBodyUploading = v), (m) => (contentEditError = m)),
                  contentEditDraft.type === 'video' ? 'video/*' : undefined
                )}
              {:else}
                <div>
                  <p class="text-[10px] text-[#AECAAE] font-semibold mb-1 uppercase tracking-wider">Survey questions (one per line)</p>
                  <textarea
                    value={contentEditDraft.surveyQuestionsText}
                    oninput={(e) => (contentEditDraft.surveyQuestionsText = e.currentTarget.value)}
                    rows="3"
                    class="w-full bg-transparent px-3 py-2.5 rounded-xl text-sm text-[#E8D4B0] placeholder-[#4A6842] outline-none resize-none"
                    style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.1);"
                  ></textarea>
                </div>
              {/if}

              {#if contentEditError}
                <p class="text-xs text-[#E08A6A]">{contentEditError}</p>
              {/if}

              <button
                onclick={() => saveEditContent(item.id)}
                disabled={contentEditSaving}
                class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
                style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {contentEditSaving ? 0.7 : 1};"
              >
                <Save size={12} />{contentEditSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {:else if tab === 'activators'}
      <button
        onclick={() => (showActivatorForm = !showActivatorForm)}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: {showActivatorForm ? 'rgba(29,60,42,0.1)' : 'linear-gradient(135deg, #C45C38, #CC8830)'}; color: {showActivatorForm ? '#1D3C2A' : '#fff'};"
      >
        {#if showActivatorForm}<X size={15} /> Cancel{:else}<Plus size={15} /> Add activator{/if}
      </button>

      {#if showActivatorForm}
        <div class="rounded-3xl p-5 flex flex-col gap-3" style="background: #2E5A3E;">
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
        </div>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{activators.length} activators</p>
      {#each activators as a (a.id)}
        <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; opacity: {a.status === 'active' ? 1 : 0.5};">
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
                onclick={() => (editingActivatorId === a.id ? cancelEditActivator() : startEditActivator(a))}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                {#if editingActivatorId === a.id}<X size={10} /> Close{:else}<Edit3 size={10} /> Edit{/if}
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

          {#if editingActivatorId === a.id && activatorEditDraft}
            <div class="px-4 pb-4 flex flex-col gap-3" style="border-top: 1px solid rgba(255,255,255,0.14); padding-top: 14px;">
              <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(255,255,255,0.06);">
                <Phone size={12} color="#96B496" />
                <p class="text-xs text-[#C4DAC0]">Login phone: <span class="font-semibold text-[#E8D4B0]">{a.phone}</span> <span class="text-[#96B496]">(code {a.code}, not editable here)</span></p>
              </div>
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
                onclick={() => saveEditActivator(a.id)}
                disabled={activatorEditSaving}
                class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
                style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {activatorEditSaving ? 0.7 : 1};"
              >
                <Save size={12} />{activatorEditSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {:else if tab === 'coordinators'}
      <button
        onclick={() => (showCoordinatorForm = !showCoordinatorForm)}
        class="w-full py-3 rounded-2xl flex items-center justify-center gap-2 font-bold text-sm"
        style="background: {showCoordinatorForm ? 'rgba(29,60,42,0.1)' : 'linear-gradient(135deg, #C45C38, #CC8830)'}; color: {showCoordinatorForm ? '#1D3C2A' : '#fff'};"
      >
        {#if showCoordinatorForm}<X size={15} /> Cancel{:else}<Plus size={15} /> Add coordinator{/if}
      </button>

      {#if showCoordinatorForm}
        <div class="rounded-3xl p-5 flex flex-col gap-3" style="background: #2E5A3E;">
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
        </div>
      {/if}

      <p class="text-xs text-[#3C6A4A] font-semibold px-1">{coordinators.length} coordinators</p>
      {#each coordinators as c (c.id)}
        <div class="rounded-2xl overflow-hidden" style="background: #2E5A3E; opacity: {c.status === 'active' ? 1 : 0.5};">
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
                onclick={() => (editingCoordinatorId === c.id ? cancelEditCoordinator() : startEditCoordinator(c))}
                class="flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-full"
                style="background: rgba(255,255,255,0.12); color: #C4DAC0;"
              >
                {#if editingCoordinatorId === c.id}<X size={10} /> Close{:else}<Edit3 size={10} /> Edit{/if}
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

          {#if editingCoordinatorId === c.id && coordinatorEditDraft}
            <div class="px-4 pb-4 flex flex-col gap-3" style="border-top: 1px solid rgba(255,255,255,0.14); padding-top: 14px;">
              <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background: rgba(255,255,255,0.06);">
                <Phone size={12} color="#96B496" />
                <p class="text-xs text-[#C4DAC0]">Login phone: <span class="font-semibold text-[#E8D4B0]">{c.phone}</span> <span class="text-[#96B496]">(not editable here)</span></p>
              </div>
              {@render inputField('Name', coordinatorEditDraft.name, (e) => (coordinatorEditDraft.name = e.currentTarget.value))}
              {@render inputField('Territory', coordinatorEditDraft.territory, (e) => (coordinatorEditDraft.territory = e.currentTarget.value), { placeholder: 'e.g. Nairobi Central' })}
              {@render inputField('Reset PIN (optional)', coordinatorEditDraft.pin, (e) => (coordinatorEditDraft.pin = e.currentTarget.value.replace(/\D/g, '').slice(0, 6)), { type: 'password', placeholder: 'leave blank to keep current' })}

              {#if coordinatorEditError}
                <p class="text-xs text-[#E08A6A]">{coordinatorEditError}</p>
              {/if}

              <button
                onclick={() => saveEditCoordinator(c.id)}
                disabled={coordinatorEditSaving}
                class="w-full py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-xs text-white"
                style="background: linear-gradient(135deg, #C45C38, #CC8830); opacity: {coordinatorEditSaving ? 0.7 : 1};"
              >
                <Save size={12} />{coordinatorEditSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>
</div>
