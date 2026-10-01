// Ported from AdminDashboardScreen.svelte's 'content' tab. Unlike the web
// version (separate create/edit drafts + modals), this uses one shared
// draft + one modal for both, same pattern as Sites/Packages/Coordinators —
// simpler, and the web's split is an artifact of incremental growth rather
// than a deliberate UX need.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Video, FileText, ClipboardList, BookOpen, Edit3, Pause, Play, Eye, Repeat } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminGetContent, adminCreateContent, adminUpdateContent, adminGetSites, type ContentItem, type ContentSection, type ViewFrequency, type SurveyQuestion, type Site } from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";
import AdminFileField from "@/components/admin/AdminFileField";
import SurveyQuestionsEditor from "@/components/admin/SurveyQuestionsEditor";

const TYPE_ICON = { video: Video, article: FileText, survey: ClipboardList, lesson: BookOpen } as const;
const CONTENT_TYPES: ContentItem["type"][] = ["video", "article", "survey", "lesson"];
const SECTIONS: { id: ContentSection; label: string }[] = [
  { id: "hero", label: "Hero" },
  { id: "whats_new", label: "What's New" },
  { id: "survey", label: "Survey Card" },
  { id: "news", label: "News & Stories" },
  { id: "watch_earn", label: "Watch & Earn" },
];
const SECTION_LABEL = Object.fromEntries(SECTIONS.map((s) => [s.id, s.label]));
const VIEW_FREQUENCIES: { id: ViewFrequency; label: string }[] = [
  { id: "once", label: "Once" },
  { id: "daily", label: "Daily" },
  { id: "weekly", label: "Weekly" },
  { id: "monthly", label: "Monthly" },
  { id: "session", label: "Per Session" },
];
const VIEW_FREQUENCY_LABEL = Object.fromEntries(VIEW_FREQUENCIES.map((f) => [f.id, f.label]));

function formatEarn(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.round((secs % 3600) / 60);
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
}

type Draft = {
  type: ContentItem["type"];
  section: ContentSection;
  viewFrequency: ViewFrequency;
  title: string;
  category: string;
  durationLabel: string;
  earnMinutes: string;
  minWatchSecs: string;
  imgUrl: string;
  bodyUrl: string;
  surveyQuestions: SurveyQuestion[];
  siteIds: string[];
};

function freshDraft(): Draft {
  return { type: "video", section: "whats_new", viewFrequency: "once", title: "", category: "", durationLabel: "", earnMinutes: "30", minWatchSecs: "0", imgUrl: "", bodyUrl: "", surveyQuestions: [{ question: "", answers: ["", ""] }], siteIds: [] };
}

function normalizeSurveyQuestions(raw: ContentItem["survey_questions"]): SurveyQuestion[] {
  const questions = (raw ?? []).map((q: any) => (typeof q === "string" ? { question: q, answers: ["Disagree", "Neutral", "Agree"] } : { question: q.question ?? "", answers: [...(q.answers ?? [])] }));
  return questions.length > 0 ? questions : [{ question: "", answers: ["", ""] }];
}

function Pill({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: active ? "#C45C38" : "rgba(255,255,255,0.1)" }}>
      {icon}
      <Text className="text-[11px] font-sans-semibold" style={{ color: active ? "#fff" : "#C4DAC0" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ContentScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [itemsResult, sitesResult] = await Promise.all([adminGetContent(token!), adminGetSites(token!)]);
      if ((!itemsResult.ok && "status" in itemsResult && itemsResult.status === 401) || (!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401)) {
        await logout();
        return;
      }
      if (itemsResult.ok) setItems(itemsResult.data.items ?? []);
      if (sitesResult.ok) setSites(sitesResult.data.sites ?? []);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [itemsResult, sitesResult] = await Promise.all([adminGetContent(token!), adminGetSites(token!)]);
      if (cancelled) return;
      if ((!itemsResult.ok && "status" in itemsResult && itemsResult.status === 401) || (!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401)) {
        await logout();
        return;
      }
      if (itemsResult.ok) setItems(itemsResult.data.items ?? []);
      if (sitesResult.ok) setSites(sitesResult.data.sites ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(freshDraft());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTogglingId, setStatusTogglingId] = useState<number | null>(null);

  function openCreateForm() {
    setEditingId(null);
    setDraft(freshDraft());
    setFormError("");
    setShowForm(true);
  }

  function startEdit(item: ContentItem) {
    setEditingId(item.id);
    setFormError("");
    setDraft({
      type: item.type,
      section: item.section,
      viewFrequency: item.view_frequency,
      title: item.title,
      category: item.category ?? "",
      durationLabel: item.duration_label ?? "",
      earnMinutes: String(Math.round(item.earn_secs / 60)),
      minWatchSecs: String(item.min_watch_secs ?? 0),
      imgUrl: item.img_url ?? "",
      bodyUrl: item.body_url ?? "",
      surveyQuestions: normalizeSurveyQuestions(item.survey_questions),
      siteIds: item.site_ids ?? [],
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function submit() {
    if (!draft.title.trim() || !Number(draft.earnMinutes)) {
      setFormError("Title and a reward (in minutes) are required");
      return;
    }
    setFormError("");
    setSaving(true);
    const body = {
      type: draft.type,
      section: draft.section,
      viewFrequency: draft.viewFrequency,
      title: draft.title.trim(),
      category: draft.category.trim() || undefined,
      durationLabel: draft.durationLabel.trim() || undefined,
      earnSecs: Math.round(Number(draft.earnMinutes) * 60),
      minWatchSecs: draft.type === "survey" || draft.type === "article" ? 0 : Number(draft.minWatchSecs) || 0,
      imgUrl: draft.imgUrl.trim() || undefined,
      bodyUrl: draft.bodyUrl.trim() || undefined,
      surveyQuestions:
        draft.type === "survey" || draft.type === "lesson"
          ? draft.surveyQuestions.map((q) => ({ question: q.question.trim(), answers: q.answers.map((a) => a.trim()).filter(Boolean) })).filter((q) => q.question && q.answers.length > 0)
          : undefined,
      siteIds: draft.siteIds,
    };
    const result = editingId ? await adminUpdateContent(token!, editingId, body) : await adminCreateContent(token!, body);
    setSaving(false);

    if (!result.ok || !result.data?.success) {
      setFormError(result.data?.message || `Could not ${editingId ? "save" : "create"} content — check your connection`);
      return;
    }
    closeForm();
    await load();
  }

  async function toggleActive(item: ContentItem) {
    setStatusTogglingId(item.id);
    await adminUpdateContent(token!, item.id, { isActive: !item.is_active });
    setStatusTogglingId(null);
    await load();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#1D3C2A" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#c29d53" />}>
        <Pressable onPress={openCreateForm} className="py-3 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95" style={{ backgroundColor: "#C45C38" }}>
          <Plus size={15} color="#fff" />
          <Text className="font-bold text-sm text-white">Add content</Text>
        </Pressable>

        <Text className="text-xs font-sans-semibold px-1" style={{ color: "#3C6A4A" }}>
          {items.length} items
        </Text>

        {items.map((item) => {
          const Icon = TYPE_ICON[item.type];
          return (
            <View key={item.id} className="rounded-2xl overflow-hidden flex-row items-center gap-3 px-4 py-3.5" style={{ backgroundColor: "#2E5A3E", opacity: item.is_active ? 1 : 0.5 }}>
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                <Icon size={16} color="#C45C38" />
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                  {item.title}
                </Text>
                <Text numberOfLines={2} className="text-[10px]" style={{ color: "#AECAAE" }}>
                  <Text style={{ color: "#C45C38", fontWeight: "600" }}>{SECTION_LABEL[item.section] ?? item.section}</Text>
                  {` · ${item.category || item.type} · ${formatEarn(item.earn_secs)} reward`}
                  {item.min_watch_secs > 0 ? ` · ${item.min_watch_secs}s min` : ""}
                  {item.view_frequency !== "once" && <Text style={{ color: "#CC8830" }}>{` · ${VIEW_FREQUENCY_LABEL[item.view_frequency]}`}</Text>}
                  {item.type === "lesson" && (item.survey_questions?.length ?? 0) > 0 && <Text style={{ color: "#5C8C3C" }}>{` · + quiz (${item.survey_questions!.length})`}</Text>}
                </Text>
                <View className="flex-row items-center gap-1 mt-0.5">
                  <Eye size={9} color="#96B496" />
                  <Text className="text-[10px]" style={{ color: "#96B496" }}>
                    {Number(item.impressions ?? 0).toLocaleString()} views
                  </Text>
                </View>
              </View>
              <View className="items-end" style={{ gap: 6 }}>
                <Pressable onPress={() => startEdit(item)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Edit3 size={10} color="#C4DAC0" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C4DAC0" }}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleActive(item)}
                  disabled={statusTogglingId === item.id}
                  className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                  style={{ backgroundColor: item.is_active ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)", opacity: statusTogglingId === item.id ? 0.6 : 1 }}
                >
                  {statusTogglingId === item.id ? (
                    <ActivityIndicator size="small" color={item.is_active ? "#4E8050" : "#B85038"} />
                  ) : item.is_active ? (
                    <Pause size={10} color="#4E8050" />
                  ) : (
                    <Play size={10} color="#B85038" />
                  )}
                  <Text className="text-[10px] font-bold" style={{ color: item.is_active ? "#4E8050" : "#B85038" }}>
                    {item.is_active ? "Active" : "Off"}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <AdminModal visible={showForm} title={editingId ? "Edit content" : "Add content"} onClose={closeForm}>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Type
          </Text>
          <View className="flex-row" style={{ gap: 8 }}>
            {CONTENT_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setDraft((d) => ({ ...d, type: t }))} className="flex-1 py-2 rounded-xl items-center" style={{ backgroundColor: draft.type === t ? "#C45C38" : "rgba(255,255,255,0.1)" }}>
                <Text className="text-[11px] font-sans-semibold capitalize" style={{ color: draft.type === t ? "#fff" : "#C4DAC0" }}>
                  {t}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Landing feed section
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {SECTIONS.map((s) => (
              <Pill key={s.id} label={s.label} active={draft.section === s.id} onPress={() => setDraft((d) => ({ ...d, section: s.id }))} />
            ))}
          </View>
        </View>

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            View frequency — how often it resets
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {VIEW_FREQUENCIES.map((f) => (
              <Pill
                key={f.id}
                label={f.label}
                active={draft.viewFrequency === f.id}
                icon={f.id !== "once" ? <Repeat size={10} color={draft.viewFrequency === f.id ? "#fff" : "#C4DAC0"} /> : undefined}
                onPress={() => setDraft((d) => ({ ...d, viewFrequency: f.id }))}
              />
            ))}
          </View>
        </View>

        {sites.length > 0 && (
          <View>
            <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
              Visible on sites
            </Text>
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              <Pill label="All sites" active={draft.siteIds.length === 0} onPress={() => setDraft((d) => ({ ...d, siteIds: [] }))} />
              {sites.map((s) => (
                <Pill
                  key={s.id}
                  label={s.name}
                  active={draft.siteIds.includes(s.id)}
                  onPress={() => setDraft((d) => ({ ...d, siteIds: d.siteIds.includes(s.id) ? d.siteIds.filter((id) => id !== s.id) : [...d.siteIds, s.id] }))}
                />
              ))}
            </View>
          </View>
        )}

        <AdminTextField label="Title" value={draft.title} onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))} />
        <AdminTextField label="Category" value={draft.category} onChangeText={(t) => setDraft((d) => ({ ...d, category: t }))} placeholder="e.g. Education" />
        <AdminTextField label="Duration label" value={draft.durationLabel} onChangeText={(t) => setDraft((d) => ({ ...d, durationLabel: t }))} placeholder="e.g. 5 min" />

        {draft.type === "survey" || draft.type === "article" ? (
          <AdminTextField label="Reward (minutes)" value={draft.earnMinutes} onChangeText={(t) => setDraft((d) => ({ ...d, earnMinutes: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" />
        ) : (
          <View className="flex-row" style={{ gap: 12 }}>
            <AdminTextField label="Reward (minutes)" value={draft.earnMinutes} onChangeText={(t) => setDraft((d) => ({ ...d, earnMinutes: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" />
            <AdminTextField label="Min watch (seconds)" value={draft.minWatchSecs} onChangeText={(t) => setDraft((d) => ({ ...d, minWatchSecs: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" />
          </View>
        )}

        <AdminFileField
          label={draft.type === "survey" ? "Image (background behind the survey icon)" : "Image"}
          value={draft.imgUrl}
          onChangeText={(t) => setDraft((d) => ({ ...d, imgUrl: t }))}
          endpoint="/admin/content/upload"
          mediaTypes="images"
          onError={setFormError}
        />

        {draft.type === "survey" ? (
          <SurveyQuestionsEditor questions={draft.surveyQuestions} onChange={(qs) => setDraft((d) => ({ ...d, surveyQuestions: qs }))} />
        ) : draft.type === "article" ? (
          <View>
            <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
              Article body
            </Text>
            <TextInput
              value={draft.bodyUrl}
              onChangeText={(t) => setDraft((d) => ({ ...d, bodyUrl: t }))}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              placeholder={"Write the article, or paste a https:// link to an external article.\n\nSupports ## headings, - bullets, 1. numbered lists, **bold**."}
              placeholderTextColor="#4A6842"
              className="rounded-xl px-3 py-2.5 text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#E8D4B0", minHeight: 140 }}
            />
          </View>
        ) : (
          <>
            <AdminFileField label="Video" value={draft.bodyUrl} onChangeText={(t) => setDraft((d) => ({ ...d, bodyUrl: t }))} endpoint="/admin/content/upload" mediaTypes="videos" onError={setFormError} />
            {draft.type === "lesson" && (
              <SurveyQuestionsEditor questions={draft.surveyQuestions} onChange={(qs) => setDraft((d) => ({ ...d, surveyQuestions: qs }))} heading="Quiz — questions & answer options (optional)" />
            )}
          </>
        )}

        {!!formError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {formError}
          </Text>
        )}
        <Pressable onPress={submit} disabled={saving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: saving ? 0.7 : 1 }}>
          <Text className="font-bold text-sm text-white">{saving ? "Saving…" : editingId ? "Save changes" : "Create content item"}</Text>
        </Pressable>
      </AdminModal>
    </View>
  );
}
