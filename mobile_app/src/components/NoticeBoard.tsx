// Ported from frontend/src/lib/components/NoticeBoard.svelte. The source's
// canvas-based flood-fill transparency cutout on /pin.webp (built at
// runtime) has no RN equivalent and isn't needed anyway — this just uses
// lucide's Pin icon directly instead of a custom pin graphic.
import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView } from "react-native";
import { Pin, FileText, Megaphone, ExternalLink, ChevronDown, ChevronRight, Search, X } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";

export type NoticePost = {
  id: number | string;
  type: "notice" | "release";
  title: string;
  body?: string | null;
  category?: string | null;
  priority?: "normal" | "important" | "urgent";
  is_pinned?: boolean;
  attachment_url?: string | null;
  event_starts_at?: string | null;
  published_at: string;
};

export type NoticeTheme = {
  bg: string;
  bgAlt: string;
  border: string;
  borderAlt: string;
  accent: string;
  accentSoft: string;
  accentGradA: string;
  accentGradB: string;
  bannerGradA: string;
  bannerGradB: string;
  bannerBorder: string;
};

const DEFAULT_THEME: NoticeTheme = {
  bg: "#0b1e13",
  bgAlt: "#0a1b11",
  border: "#12301e",
  borderAlt: "#163a23",
  accent: "#c29d53",
  accentSoft: "rgba(194,157,83,0.18)",
  accentGradA: "#d4af6a",
  accentGradB: "#8b6a35",
  bannerGradA: "#123420",
  bannerGradB: "#0d2317",
  bannerBorder: "#1c472e",
};

const PRIORITY_COLOR: Record<string, string> = { urgent: "#C45C38", important: "#c29d53", normal: "#5b6b60" };
const TYPE_LABEL: Record<string, string> = { notice: "Notice", release: "Release" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function NoticeBoard({
  posts = [],
  pastPosts = [],
  theme = DEFAULT_THEME,
  readIds = new Set<number | string>(),
  onMarkRead = () => {},
}: {
  posts?: NoticePost[];
  pastPosts?: NoticePost[];
  theme?: NoticeTheme;
  readIds?: Set<number | string>;
  onMarkRead?: (id: number | string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "current" | "past">("current");
  const [query, setQuery] = useState("");

  const visiblePosts = activeTab === "all" ? [...posts, ...pastPosts] : activeTab === "current" ? posts : pastPosts;
  const q = query.trim().toLowerCase();
  const filteredVisiblePosts = !q
    ? visiblePosts
    : visiblePosts.filter((p) => [p.title, p.category, p.body].some((f) => (f || "").toLowerCase().includes(q)));

  const topPost = posts[0];
  const urgentCount = posts.filter((p) => p.priority === "urgent").length;
  const unreadCount = posts.filter((p) => !readIds.has(p.id)).length;

  function toggle(id: number | string) {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next === id && !readIds.has(id)) onMarkRead(id);
  }

  function openModal() {
    setModalOpen(true);
    setExpandedId(null);
    setQuery("");
    setActiveTab(posts.length > 0 ? "current" : "past");
  }

  if (posts.length === 0 && pastPosts.length === 0) return null;

  return (
    <>
      <Pressable
        onPress={openModal}
        className="w-full rounded-2xl overflow-hidden"
        style={{ backgroundColor: theme.bannerGradA, borderWidth: 1, borderColor: theme.bannerBorder }}
      >
        <View className="flex-row items-center gap-3.5 px-5 py-4">
          <View className="w-11 h-11 rounded-xl items-center justify-center relative" style={{ backgroundColor: theme.accentGradA }}>
            <Pin size={20} color="#fdf6e3" fill="#fdf6e3" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full items-center justify-center" style={{ backgroundColor: "#C45C38" }}>
                <Text className="text-white text-[9px] font-sans-semibold">{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="text-xs font-sans-semibold uppercase tracking-wider" style={{ color: theme.accent }}>
                Notice Board
              </Text>
              {urgentCount > 0 && (
                <View className="px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(196,92,56,0.22)" }}>
                  <Text className="text-[9px] font-sans-semibold uppercase" style={{ color: "#E08A6A" }}>
                    {urgentCount} urgent
                  </Text>
                </View>
              )}
            </View>
            <Text className="text-sm font-sans-semibold" numberOfLines={1} style={{ color: posts.length > 0 ? "#f3f4f6" : "#9ca3af" }}>
              {posts.length > 0 ? topPost?.title : "No current notices"}
            </Text>
          </View>
          <View className="items-end gap-1.5">
            <View className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: theme.accentSoft }}>
              <Text className="text-[10px] font-sans-semibold" style={{ color: theme.accent }}>
                View all
              </Text>
              <ChevronRight size={11} color={theme.accent} />
            </View>
            <Text className="text-[10px]" style={{ color: "#6b7280" }}>
              {posts.length > 0 ? (unreadCount > 0 ? `${unreadCount} unread` : `${posts.length} notice${posts.length === 1 ? "" : "s"}`) : `${pastPosts.length} past`}
            </Text>
          </View>
        </View>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setModalOpen(false)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
              <View>
                <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                  Notice Board
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                  {filteredVisiblePosts.length} of {visiblePosts.length} notices
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <X size={14} color="#9ca3af" />
              </Pressable>
            </View>

            <View className="flex-row gap-2 px-5 pt-3">
              {(["all", "current", "past"] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: activeTab === tab ? theme.accent : theme.bgAlt,
                    borderWidth: activeTab === tab ? 0 : 1,
                    borderColor: theme.borderAlt,
                  }}
                >
                  <Text className="text-[11px] font-sans-semibold" style={{ color: activeTab === tab ? theme.bg : "#9ca3af" }}>
                    {tab === "all" ? `All (${posts.length + pastPosts.length})` : tab === "current" ? `Current (${posts.length})` : `Past (${pastPosts.length})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View className="px-5 pt-3 pb-3">
              <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: theme.bgAlt, borderWidth: 1, borderColor: theme.borderAlt }}>
                <Search size={14} color={theme.accent} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search notices…" placeholderTextColor="#6b7280" className="flex-1 text-sm" style={{ color: "#e5e7eb" }} />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={13} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>

            <ScrollView className="px-5 pb-4" style={{ gap: 10 }}>
              {filteredVisiblePosts.length === 0 ? (
                <Text className="text-sm text-center py-8" style={{ color: "#9ca3af" }}>
                  {query ? `No notices match "${query}".` : activeTab === "all" ? "No notices yet." : `No ${activeTab} notices.`}
                </Text>
              ) : (
                filteredVisiblePosts.map((post) => {
                  const color = PRIORITY_COLOR[post.priority ?? "normal"] ?? PRIORITY_COLOR.normal;
                  const open = expandedId === post.id;
                  const isRead = readIds.has(post.id);
                  return (
                    <Pressable
                      key={post.id}
                      onPress={() => toggle(post.id)}
                      className="rounded-xl overflow-hidden mb-2.5"
                      style={{ backgroundColor: "rgba(255,255,255,0.04)", borderLeftWidth: 3, borderLeftColor: color, opacity: isRead ? 0.65 : 1 }}
                    >
                      <View className="flex-row items-start gap-3 px-4 py-3.5">
                        <View className="w-8 h-8 rounded-lg items-center justify-center mt-0.5" style={{ backgroundColor: `${color}30` }}>
                          <Megaphone size={14} color={color} />
                        </View>
                        <View className="flex-1 min-w-0">
                          <View className="flex-row items-center gap-1.5 flex-wrap mb-1">
                            <View className="px-1.5 py-0.5 rounded" style={{ backgroundColor: `${color}25` }}>
                              <Text className="text-[9px] font-sans-semibold uppercase" style={{ color }}>
                                {TYPE_LABEL[post.type] ?? post.type}
                              </Text>
                            </View>
                            {!!post.category && (
                              <Text className="text-[10px]" style={{ color: "#9ca3af" }}>
                                {post.category}
                              </Text>
                            )}
                            {post.is_pinned && <Pin size={10} color={theme.accent} fill={theme.accent} />}
                          </View>
                          <View className="flex-row items-center gap-1.5">
                            {!isRead && <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.accent }} />}
                            <Text className="text-sm flex-1" style={{ color: "#f3f4f6", fontWeight: isRead ? "500" : "700" }}>
                              {post.title}
                            </Text>
                          </View>
                          {!open && !!post.body && (
                            <Text className="text-[11px] mt-0.5" numberOfLines={1} style={{ color: "#6b7280" }}>
                              {post.body}
                            </Text>
                          )}
                        </View>
                        <View className="items-end gap-1">
                          <Text className="text-[10px]" style={{ color: "#6b7280" }}>
                            {formatDate(post.published_at)}
                          </Text>
                          <ChevronDown size={13} color="#6b7280" style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }} />
                        </View>
                      </View>

                      {open && (
                        <View className="px-4 pb-4" style={{ paddingLeft: 52 }}>
                          {!!post.event_starts_at && (
                            <Text className="text-[11px] mb-2" style={{ color: "#9ca3af" }}>
                              {new Date(post.event_starts_at) < new Date() ? "Expired" : "Relevant until"} {formatDate(post.event_starts_at)}
                            </Text>
                          )}
                          {!!post.body && (
                            <Text className="text-[12.5px] leading-relaxed mb-3" style={{ color: "#d1d5db" }}>
                              {post.body}
                            </Text>
                          )}
                          {!!post.attachment_url && (
                            <Pressable
                              onPress={() => WebBrowser.openBrowserAsync(post.attachment_url!)}
                              className="flex-row items-center gap-1.5 px-3 py-2 rounded-full self-start"
                              style={{ backgroundColor: theme.accentSoft }}
                            >
                              <FileText size={12} color={theme.accent} />
                              <Text className="text-[11px] font-sans-semibold" style={{ color: theme.accent }}>
                                View attachment
                              </Text>
                              <ExternalLink size={10} color={theme.accent} />
                            </Pressable>
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
