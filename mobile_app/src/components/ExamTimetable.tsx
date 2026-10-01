// Ported from frontend/src/lib/components/ExamTimetable.svelte. The
// day-grouped sticky headers use RN's SectionList (stickySectionHeadersEnabled)
// instead of hand-rolled CSS position:sticky.
import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, SectionList } from "react-native";
import { MapPin, Search, X, CalendarDays, ChevronRight } from "lucide-react-native";

export type TimetablePost = {
  id: number | string;
  title: string;
  category?: string | null;
  location?: string | null;
  event_starts_at: string;
};

function dayNum(iso: string) {
  return new Date(iso).getDate();
}
function monthAbbrev(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short" });
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
function fullDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
function relativeLabel(iso: string): string | null {
  const now = new Date();
  const target = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return null;
}

export default function ExamTimetable({ posts = [] }: { posts?: TimetablePost[] }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");

  const nextExam = posts[0] ?? null;
  const remainingCount = Math.max(posts.length - 1, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => [p.title, p.category, p.location].some((f) => (f || "").toLowerCase().includes(q)));
  }, [posts, query]);

  const sections = useMemo(() => {
    const groups: { key: string; iso: string; title: string; data: TimetablePost[] }[] = [];
    const byKey = new Map<string, (typeof groups)[number]>();
    for (const post of filtered) {
      const key = new Date(post.event_starts_at).toDateString();
      let group = byKey.get(key);
      if (!group) {
        group = { key, iso: post.event_starts_at, title: key, data: [] };
        byKey.set(key, group);
        groups.push(group);
      }
      group.data.push(post);
    }
    return groups;
  }, [filtered]);

  if (!nextExam) return null;

  return (
    <>
      <Pressable onPress={() => setModalOpen(true)} className="w-full h-full rounded-xl p-4" style={{ backgroundColor: "#0b1e13", borderWidth: 1, borderColor: "#12301e", gap: 12 }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-lg px-3 py-1.5" style={{ backgroundColor: "#d4af6a", minWidth: 52 }}>
            <Text className="text-[9px] uppercase" style={{ color: "#fdf6e3" }}>
              {monthAbbrev(nextExam.event_starts_at)}
            </Text>
            <Text className="text-lg font-sans-semibold leading-none my-0.5" style={{ color: "#fdf6e3" }}>
              {dayNum(nextExam.event_starts_at)}
            </Text>
          </View>
          <View className="flex-1 min-w-0">
            <View className="flex-row items-center gap-1.5">
              <CalendarDays size={10} color="#9ca3af" />
              <Text className="text-[11px]" style={{ color: "#9ca3af" }}>
                {relativeLabel(nextExam.event_starts_at) ?? fullDateLabel(nextExam.event_starts_at)} · {timeLabel(nextExam.event_starts_at)}
              </Text>
            </View>
            <Text className="text-sm font-sans-semibold mt-0.5" numberOfLines={1} style={{ color: "#f3f4f6" }}>
              {nextExam.title}
            </Text>
            {!!nextExam.location && (
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={10} color="#6b7280" />
                <Text className="text-xs" numberOfLines={1} style={{ color: "#6b7280" }}>
                  {nextExam.location}
                </Text>
              </View>
            )}
          </View>
          <ChevronRight size={13} color="#6b7280" />
        </View>
        <View className="flex-row items-center justify-between pt-2.5" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" }}>
          <View className="flex-row items-center gap-1">
            <Search size={10} color="#6b7280" />
            <Text className="text-[11px]" style={{ color: "#6b7280" }}>
              Tap to search the timetable
            </Text>
          </View>
          {remainingCount > 0 && (
            <Text className="text-[11px] font-sans-semibold" style={{ color: "#c29d53" }}>
              +{remainingCount} more
            </Text>
          )}
        </View>
      </Pressable>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setModalOpen(false)}>
          <Pressable style={{ backgroundColor: "#0b1e13", maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View>
                <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: "#c29d53" }}>
                  Exam Timetable
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                  {filtered.length} of {posts.length} upcoming exams
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <X size={14} color="#9ca3af" />
              </Pressable>
            </View>

            <View className="px-5 pb-3">
              <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "#0a1b11", borderWidth: 1, borderColor: "#163a23" }}>
                <Search size={14} color="#c29d53" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search course, program, or venue…"
                  placeholderTextColor="#6b7280"
                  className="flex-1 text-sm"
                  style={{ color: "#e5e7eb" }}
                />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={13} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>

            {filtered.length === 0 ? (
              <Text className="text-sm text-center py-8" style={{ color: "#9ca3af" }}>
                No exams match "{query}".
              </Text>
            ) : (
              <SectionList
                sections={sections}
                keyExtractor={(item) => String(item.id)}
                stickySectionHeadersEnabled
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
                renderSectionHeader={({ section }) => (
                  <View className="flex-row items-center gap-2 pt-3 pb-2" style={{ backgroundColor: "#0b1e13" }}>
                    <Text className="text-[11px] font-sans-semibold uppercase tracking-wider" style={{ color: relativeLabel(section.iso) ? "#c29d53" : "#9ca3af" }}>
                      {relativeLabel(section.iso) ?? fullDateLabel(section.iso)}
                    </Text>
                    {!!relativeLabel(section.iso) && (
                      <Text className="text-[10px]" style={{ color: "#6b7280" }}>
                        {fullDateLabel(section.iso)}
                      </Text>
                    )}
                    <View className="flex-1 h-px" style={{ backgroundColor: "rgba(255,255,255,0.08)" }} />
                  </View>
                )}
                renderItem={({ item: post }) => (
                  <View className="rounded-xl p-3.5 flex-row items-center justify-between gap-3 mb-2" style={{ backgroundColor: "rgba(255,255,255,0.04)" }}>
                    <View className="min-w-0 flex-1">
                      {!!post.category && (
                        <Text className="text-[9px] font-sans-semibold uppercase tracking-wider mb-0.5" numberOfLines={1} style={{ color: "#9ca3af" }}>
                          {post.category}
                        </Text>
                      )}
                      <Text className="text-sm font-sans-semibold" numberOfLines={1} style={{ color: "#f3f4f6" }}>
                        {post.title}
                      </Text>
                      {!!post.location && (
                        <View className="flex-row items-center gap-1 mt-0.5">
                          <MapPin size={9} color="#6b7280" />
                          <Text className="text-[10px]" style={{ color: "#6b7280" }}>
                            {post.location}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: "rgba(194,157,83,0.15)", color: "#c29d53" }}>
                      {timeLabel(post.event_starts_at)}
                    </Text>
                  </View>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
