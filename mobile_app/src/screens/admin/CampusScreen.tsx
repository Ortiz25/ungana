// Ported from AdminDashboardScreen.svelte's 'campus' tab (notices, releases,
// events, exam timetable, quick-link resources, polls — institution sites).
// One shared draft + modal for create/edit, same pattern as Sites/Packages.
// No native datetime picker is installed, so event/exam times are typed as
// plain "YYYY-MM-DDTHH:mm" text and converted with `new Date(...)` on
// submit — same conversion the web version's toDatetimeLocal ultimately
// feeds into, just entered by hand instead of a native date widget.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Megaphone, FileText, Calendar, ClipboardCheck, Link2, BarChart3, Edit3, Pause, Play, Pin, Eye, MousePointerClick } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminGetCampusPosts, adminCreateCampusPost, adminUpdateCampusPost, adminGetSites, type CampusPost, type PostPriority, type Site } from "@/lib/adminApi";
import { RESOURCE_CATEGORIES } from "@/lib/campusResourceCategories";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";
import AdminFileField from "@/components/admin/AdminFileField";
import AdminGalleryField from "@/components/admin/AdminGalleryField";
import PollOptionsEditor from "@/components/admin/PollOptionsEditor";

const CAMPUS_TYPES: { id: CampusPost["type"]; label: string }[] = [
  { id: "notice", label: "Notice" },
  { id: "release", label: "Release" },
  { id: "event", label: "Event" },
  { id: "timetable", label: "Timetable" },
  { id: "resource", label: "Resource" },
  { id: "poll", label: "Poll" },
];
const TYPE_ICON = { notice: Megaphone, release: FileText, event: Calendar, timetable: ClipboardCheck, resource: Link2, poll: BarChart3 } as const;
const TYPES_WITH_SCHEDULE: CampusPost["type"][] = ["event", "timetable"];
const TYPES_WITH_PRIORITY: CampusPost["type"][] = ["notice", "release"];
const PRIORITIES: { id: PostPriority; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "important", label: "Important" },
  { id: "urgent", label: "Urgent" },
];
const PRIORITY_COLOR: Record<PostPriority, string> = { normal: "#3C6A4A", important: "#CC8830", urgent: "#C45C38" };

type Draft = {
  siteId: string;
  type: CampusPost["type"];
  title: string;
  body: string;
  category: string;
  priority: PostPriority;
  attachmentUrl: string;
  eventStartsAt: string;
  eventEndsAt: string;
  location: string;
  pollOptions: string[];
  isPinned: boolean;
  images: string[];
};

function freshDraft(sites: Site[]): Draft {
  return { siteId: sites[0]?.id ?? "", type: "notice", title: "", body: "", category: "", priority: "normal", attachmentUrl: "", eventStartsAt: "", eventEndsAt: "", location: "", pollOptions: ["", ""], isPinned: false, images: [] };
}

function toDatetimeLocal(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function draftToBody(draft: Draft) {
  const hasSchedule = TYPES_WITH_SCHEDULE.includes(draft.type);
  const hasExpiry = TYPES_WITH_PRIORITY.includes(draft.type);
  const metadata = draft.type === "poll" ? { options: draft.pollOptions.map((o) => o.trim()).filter(Boolean) } : {};
  return {
    siteId: draft.siteId,
    type: draft.type,
    title: draft.title.trim(),
    body: draft.body.trim() || undefined,
    category: draft.category.trim() || undefined,
    priority: draft.priority,
    attachmentUrl: draft.attachmentUrl.trim() || undefined,
    eventStartsAt: (hasSchedule || hasExpiry) && draft.eventStartsAt ? new Date(draft.eventStartsAt).toISOString() : undefined,
    eventEndsAt: hasSchedule && draft.eventEndsAt ? new Date(draft.eventEndsAt).toISOString() : undefined,
    location: hasSchedule ? draft.location.trim() || undefined : undefined,
    metadata,
    isPinned: draft.isPinned,
    images: draft.type === "event" ? draft.images : [],
  };
}

function Pill({ label, active, onPress, color }: { label: string; active: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable onPress={onPress} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: active ? color ?? "#C45C38" : "rgba(255,255,255,0.1)" }}>
      <Text className="text-[11px] font-sans-semibold" style={{ color: active ? "#fff" : "#C4DAC0" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CampusScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [posts, setPosts] = useState<CampusPost[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [postsResult, sitesResult] = await Promise.all([adminGetCampusPosts(token!), adminGetSites(token!)]);
      if ((!postsResult.ok && "status" in postsResult && postsResult.status === 401) || (!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401)) {
        await logout();
        return;
      }
      if (postsResult.ok) setPosts(postsResult.data.posts ?? []);
      if (sitesResult.ok) setSites(sitesResult.data.sites ?? []);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [postsResult, sitesResult] = await Promise.all([adminGetCampusPosts(token!), adminGetSites(token!)]);
      if (cancelled) return;
      if ((!postsResult.ok && "status" in postsResult && postsResult.status === 401) || (!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401)) {
        await logout();
        return;
      }
      if (postsResult.ok) setPosts(postsResult.data.posts ?? []);
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
  const [draft, setDraft] = useState<Draft>(freshDraft([]));
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTogglingId, setStatusTogglingId] = useState<number | null>(null);
  const [pinTogglingId, setPinTogglingId] = useState<number | null>(null);

  function openCreateForm() {
    setEditingId(null);
    setFormError("");
    setDraft(freshDraft(sites));
    setShowForm(true);
  }

  function startEdit(post: CampusPost) {
    setEditingId(post.id);
    setFormError("");
    const options = post.metadata?.options ?? [];
    setDraft({
      siteId: post.site_id,
      type: post.type,
      title: post.title,
      body: post.body ?? "",
      category: post.category ?? "",
      priority: post.priority,
      attachmentUrl: post.attachment_url ?? "",
      eventStartsAt: post.event_starts_at ? toDatetimeLocal(post.event_starts_at) : "",
      eventEndsAt: post.event_ends_at ? toDatetimeLocal(post.event_ends_at) : "",
      location: post.location ?? "",
      pollOptions: options.length >= 2 ? options : ["", ""],
      isPinned: post.is_pinned,
      images: Array.isArray(post.images) ? post.images : [],
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
  }

  async function submit() {
    if (!draft.siteId || !draft.title.trim()) {
      setFormError("Site and title are required");
      return;
    }
    if (draft.type === "poll" && draft.pollOptions.map((o) => o.trim()).filter(Boolean).length < 2) {
      setFormError("A poll needs at least 2 options");
      return;
    }
    setFormError("");
    setSaving(true);
    const body = draftToBody(draft);
    const result = editingId ? await adminUpdateCampusPost(token!, editingId, body) : await adminCreateCampusPost(token!, body);
    setSaving(false);

    if (!result.ok || !result.data?.success) {
      setFormError(result.data?.message || "Could not save — check your connection");
      return;
    }
    closeForm();
    await load();
  }

  async function toggleActive(post: CampusPost) {
    setStatusTogglingId(post.id);
    await adminUpdateCampusPost(token!, post.id, { isActive: !post.is_active });
    setStatusTogglingId(null);
    await load();
  }

  async function togglePinned(post: CampusPost) {
    setPinTogglingId(post.id);
    await adminUpdateCampusPost(token!, post.id, { isPinned: !post.is_pinned });
    setPinTogglingId(null);
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
          <Text className="font-bold text-sm text-white">Add campus post</Text>
        </Pressable>

        <Text className="text-xs font-sans-semibold px-1" style={{ color: "#3C6A4A" }}>
          {posts.length} posts
        </Text>

        {posts.map((post) => {
          const Icon = TYPE_ICON[post.type];
          const color = PRIORITY_COLOR[post.priority] ?? PRIORITY_COLOR.normal;
          const postSite = sites.find((s) => s.id === post.site_id);
          return (
            <View key={post.id} className="rounded-2xl overflow-hidden flex-row items-center gap-3 px-4 py-3.5" style={{ backgroundColor: "#2E5A3E", opacity: post.is_active ? 1 : 0.5, borderLeftWidth: 3, borderLeftColor: color }}>
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: `${color}30` }}>
                <Icon size={16} color={color} />
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                  {post.title}
                </Text>
                <Text numberOfLines={1} className="text-[10px]" style={{ color: "#AECAAE" }}>
                  <Text style={{ color, fontWeight: "600" }}>{CAMPUS_TYPES.find((t) => t.id === post.type)?.label ?? post.type}</Text>
                  {postSite ? ` · ${postSite.name}` : ""}
                  {post.category ? ` · ${post.category}` : ""}
                  {post.is_pinned ? " · Pinned" : ""}
                </Text>
                {post.type === "resource" ? (
                  <View className="flex-row items-center gap-1 mt-0.5">
                    <MousePointerClick size={9} color="#96B496" />
                    <Text className="text-[10px]" style={{ color: "#96B496" }}>
                      {Number(post.clicks ?? 0).toLocaleString()} clicks
                    </Text>
                  </View>
                ) : (
                  (post.type === "notice" || post.type === "release") && (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <Eye size={9} color="#96B496" />
                      <Text className="text-[10px]" style={{ color: "#96B496" }}>
                        {Number(post.read_count ?? 0).toLocaleString()} read
                      </Text>
                    </View>
                  )
                )}
              </View>
              <View className="items-end" style={{ gap: 6 }}>
                <Pressable onPress={() => startEdit(post)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Edit3 size={10} color="#C4DAC0" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C4DAC0" }}>
                    Edit
                  </Text>
                </Pressable>
                <View className="flex-row" style={{ gap: 6 }}>
                  <Pressable
                    onPress={() => togglePinned(post)}
                    disabled={pinTogglingId === post.id}
                    className="items-center justify-center px-2 py-1.5 rounded-full"
                    style={{ backgroundColor: post.is_pinned ? "rgba(204,136,48,0.30)" : "rgba(255,255,255,0.1)" }}
                  >
                    <Pin size={10} color={post.is_pinned ? "#CC8830" : "#C4DAC0"} />
                  </Pressable>
                  <Pressable
                    onPress={() => toggleActive(post)}
                    disabled={statusTogglingId === post.id}
                    className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                    style={{ backgroundColor: post.is_active ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)" }}
                  >
                    {post.is_active ? <Pause size={10} color="#4E8050" /> : <Play size={10} color="#B85038" />}
                    <Text className="text-[10px] font-bold" style={{ color: post.is_active ? "#4E8050" : "#B85038" }}>
                      {post.is_active ? "Active" : "Off"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <AdminModal visible={showForm} title={editingId ? "Edit campus post" : "Add campus post"} onClose={closeForm}>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Site
          </Text>
          {sites.length === 0 ? (
            <Text className="text-xs" style={{ color: "#96B496" }}>
              Add a site first (Sites tab) — a post belongs to exactly one site.
            </Text>
          ) : (
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {sites.map((s) => (
                <Pill key={s.id} label={s.name} active={draft.siteId === s.id} onPress={() => setDraft((d) => ({ ...d, siteId: s.id }))} />
              ))}
            </View>
          )}
        </View>

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Type
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {CAMPUS_TYPES.map((t) => (
              <Pill key={t.id} label={t.label} active={draft.type === t.id} onPress={() => setDraft((d) => ({ ...d, type: t.id }))} />
            ))}
          </View>
        </View>

        <AdminTextField label="Title" value={draft.title} onChangeText={(t) => setDraft((d) => ({ ...d, title: t }))} />
        <AdminTextField label="Category (optional)" value={draft.category} onChangeText={(t) => setDraft((d) => ({ ...d, category: t }))} placeholder="e.g. Exams, Fees, Library" />

        {draft.type === "resource" && (
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {RESOURCE_CATEGORIES.map((c) => (
              <Pill key={c.id} label={c.label} active={draft.category === c.label} color={c.color} onPress={() => setDraft((d) => ({ ...d, category: c.label }))} />
            ))}
          </View>
        )}

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Body (optional)
          </Text>
          <TextInput
            value={draft.body}
            onChangeText={(t) => setDraft((d) => ({ ...d, body: t }))}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            placeholderTextColor="#4A6842"
            className="rounded-xl px-3 py-2.5 text-sm"
            style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#E8D4B0", minHeight: 90 }}
          />
        </View>

        {TYPES_WITH_PRIORITY.includes(draft.type) && (
          <>
            <View>
              <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
                Priority
              </Text>
              <View className="flex-row" style={{ gap: 6 }}>
                {PRIORITIES.map((p) => (
                  <Pill key={p.id} label={p.label} active={draft.priority === p.id} color={PRIORITY_COLOR[p.id]} onPress={() => setDraft((d) => ({ ...d, priority: p.id }))} />
                ))}
              </View>
            </View>
            <AdminTextField label="Relevant until (optional)" value={draft.eventStartsAt} onChangeText={(t) => setDraft((d) => ({ ...d, eventStartsAt: t }))} placeholder="YYYY-MM-DDTHH:mm" />
          </>
        )}

        {TYPES_WITH_SCHEDULE.includes(draft.type) && (
          <>
            <View className="flex-row" style={{ gap: 12 }}>
              <AdminTextField label={draft.type === "timetable" ? "Exam starts" : "Starts"} value={draft.eventStartsAt} onChangeText={(t) => setDraft((d) => ({ ...d, eventStartsAt: t }))} placeholder="YYYY-MM-DDTHH:mm" />
              <AdminTextField label="Ends (optional)" value={draft.eventEndsAt} onChangeText={(t) => setDraft((d) => ({ ...d, eventEndsAt: t }))} placeholder="YYYY-MM-DDTHH:mm" />
            </View>
            <AdminTextField
              label={draft.type === "timetable" ? "Venue" : "Location"}
              value={draft.location}
              onChangeText={(t) => setDraft((d) => ({ ...d, location: t }))}
              placeholder={draft.type === "timetable" ? "e.g. Exam Hall B" : "e.g. Main Auditorium"}
            />
          </>
        )}

        {draft.type === "poll" && <PollOptionsEditor options={draft.pollOptions} onChange={(opts) => setDraft((d) => ({ ...d, pollOptions: opts }))} />}

        {draft.type !== "poll" && (
          <AdminFileField
            label={draft.type === "resource" ? "Link or file" : draft.type === "event" ? "Cover photo (optional)" : "Attachment (optional — image or video)"}
            value={draft.attachmentUrl}
            onChangeText={(t) => setDraft((d) => ({ ...d, attachmentUrl: t }))}
            endpoint="/admin/campus-posts/upload"
            mediaTypes="images"
            onError={setFormError}
          />
        )}

        {draft.type === "event" && <AdminGalleryField images={draft.images} onChange={(images) => setDraft((d) => ({ ...d, images }))} endpoint="/admin/campus-posts/upload" onError={setFormError} />}

        <Pill label={draft.isPinned ? "Pinned" : "Pin to top"} active={draft.isPinned} color="#CC8830" onPress={() => setDraft((d) => ({ ...d, isPinned: !d.isPinned }))} />

        {!!formError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {formError}
          </Text>
        )}
        <Pressable onPress={submit} disabled={saving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: saving ? 0.7 : 1 }}>
          <Text className="font-bold text-sm text-white">{saving ? "Saving…" : editingId ? "Save changes" : "Create post"}</Text>
        </Pressable>
      </AdminModal>
    </View>
  );
}
