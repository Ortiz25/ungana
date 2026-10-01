// Ported from frontend/src/lib/components/PastEvents.svelte.
import { useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, Image } from "react-native";
import { X, ChevronLeft, ChevronRight, MapPin, CalendarDays, Images, Search } from "lucide-react-native";

export type PastEventPost = {
  id: number | string;
  title: string;
  category?: string | null;
  location?: string | null;
  body?: string | null;
  is_pinned?: boolean;
  attachment_url?: string | null;
  images?: string[];
  event_starts_at: string;
};

const DEFAULT_THEME = { bg: "#0b1e13", border: "#12301e", accent: "#c29d53", placeholderIcon: "#3a5240", carouselBg: "#05140b" };
const VISIBLE_LIMIT = 6;

function dayNum(iso: string) {
  return new Date(iso).getDate();
}
function monthAbbrev(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short" });
}
function fullDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function EventCard({ post, theme }: { post: PastEventPost; theme: typeof DEFAULT_THEME; onPress: () => void }) {
  const galleryCount = (post.images?.length ?? 0) + (post.attachment_url ? 1 : 0);
  return (
    <View className="rounded-2xl overflow-hidden relative" style={{ height: 128, borderWidth: post.is_pinned ? 2 : 0, borderColor: theme.accent }}>
      {post.attachment_url ? (
        <Image source={{ uri: post.attachment_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
      ) : (
        <View className="w-full h-full items-center justify-center" style={{ backgroundColor: theme.border }}>
          <CalendarDays size={22} color={theme.placeholderIcon} />
        </View>
      )}
      <View className="absolute inset-0" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} />
      <View className="absolute top-2.5 left-2.5 px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Text className="text-[9px] font-sans-semibold uppercase" style={{ color: theme.accent }}>
          {monthAbbrev(post.event_starts_at)} {dayNum(post.event_starts_at)}
        </Text>
      </View>
      {galleryCount > 1 && (
        <View className="absolute top-2.5 right-2.5 flex-row items-center gap-0.5 px-1.5 py-1 rounded-lg" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
          <Images size={9} color="#fff" />
          <Text className="text-[9px] font-sans-semibold text-white">{galleryCount}</Text>
        </View>
      )}
      <View className="absolute bottom-0 left-0 right-0 p-2.5">
        {!!post.location && (
          <View className="flex-row items-center gap-1 mb-0.5">
            <MapPin size={8} color="#C4DAC0" />
            <Text className="text-[9px] font-sans-semibold" numberOfLines={1} style={{ color: "#C4DAC0" }}>
              {post.location}
            </Text>
          </View>
        )}
        <Text className="text-xs font-sans-semibold text-white leading-tight" numberOfLines={2}>
          {post.title}
        </Text>
      </View>
    </View>
  );
}

export default function PastEvents({ posts = [], theme = DEFAULT_THEME }: { posts?: PastEventPost[]; theme?: typeof DEFAULT_THEME }) {
  const overflow = Math.max(posts.length - (VISIBLE_LIMIT - 1), 0);
  const stripPosts = overflow > 0 ? posts.slice(0, VISIBLE_LIMIT - 1) : posts;

  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = !q ? posts : posts.filter((p) => [p.title, p.category, p.location, p.body].some((f) => (f || "").toLowerCase().includes(q)));

  const [selected, setSelected] = useState<PastEventPost | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const photos = selected ? [selected.attachment_url, ...(selected.images ?? [])].filter(Boolean) as string[] : [];

  function open(post: PastEventPost) {
    setSelected(post);
    setPhotoIndex(0);
  }

  if (posts.length === 0) return null;

  return (
    <>
      <View className="pt-2 pb-2">
        <View className="flex-row items-center justify-between px-4 mb-3">
          <Text className="text-sm font-sans-semibold" style={{ color: "#f3f4f6" }}>
            Past Events
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
          {stripPosts.map((post) => (
            <Pressable key={post.id} onPress={() => open(post)} style={{ width: 158 }}>
              <EventCard post={post} theme={theme} onPress={() => open(post)} />
            </Pressable>
          ))}
          {overflow > 0 && (
            <Pressable
              onPress={() => setModalOpen(true)}
              className="rounded-2xl items-center justify-center"
              style={{ width: 158, height: 128, backgroundColor: theme.bg, borderWidth: 1, borderStyle: "dashed", borderColor: theme.border, gap: 6 }}
            >
              <CalendarDays size={18} color={theme.accent} />
              <Text className="text-xs font-sans-semibold" style={{ color: "#e5e7eb" }}>
                +{overflow} more
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setModalOpen(false)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View>
                <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                  Past Events
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                  {filtered.length} of {posts.length} events
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <X size={14} color="#9ca3af" />
              </Pressable>
            </View>
            <View className="px-5 pb-3">
              <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border }}>
                <Search size={14} color={theme.accent} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search past events…" placeholderTextColor="#6b7280" className="flex-1 text-sm" style={{ color: "#e5e7eb" }} />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={13} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" }}>
              {filtered.length === 0 ? (
                <Text className="text-sm text-center py-8 w-full" style={{ color: "#9ca3af" }}>
                  {query ? `No events match "${query}".` : "Nothing here yet."}
                </Text>
              ) : (
                filtered.map((post) => (
                  <Pressable
                    key={post.id}
                    onPress={() => {
                      setModalOpen(false);
                      open(post);
                    }}
                    style={{ width: "47%" }}
                  >
                    <EventCard post={post} theme={theme} onPress={() => open(post)} />
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} onPress={() => setSelected(null)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "90%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" }} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <View className="relative" style={{ aspectRatio: 4 / 3, backgroundColor: theme.carouselBg }}>
                  {photos.length > 0 ? (
                    <>
                      <Image source={{ uri: photos[photoIndex] }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                      {photos.length > 1 && (
                        <>
                          <Pressable
                            onPress={() => setPhotoIndex((i) => (i - 1 + photos.length) % photos.length)}
                            className="absolute left-2 top-1/2 w-8 h-8 rounded-full items-center justify-center"
                            style={{ backgroundColor: "rgba(0,0,0,0.5)", marginTop: -16 }}
                          >
                            <ChevronLeft size={16} color="#fff" />
                          </Pressable>
                          <Pressable
                            onPress={() => setPhotoIndex((i) => (i + 1) % photos.length)}
                            className="absolute right-2 top-1/2 w-8 h-8 rounded-full items-center justify-center"
                            style={{ backgroundColor: "rgba(0,0,0,0.5)", marginTop: -16 }}
                          >
                            <ChevronRight size={16} color="#fff" />
                          </Pressable>
                          <View className="absolute bottom-3 left-0 right-0 flex-row items-center justify-center gap-1.5">
                            {photos.map((_, i) => (
                              <View key={i} style={{ width: i === photoIndex ? 14 : 5, height: 5, borderRadius: 3, backgroundColor: i === photoIndex ? theme.accent : "rgba(255,255,255,0.4)" }} />
                            ))}
                          </View>
                        </>
                      )}
                    </>
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <CalendarDays size={32} color={theme.placeholderIcon} />
                    </View>
                  )}
                  <Pressable onPress={() => setSelected(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
                    <X size={14} color="#fff" />
                  </Pressable>
                </View>
                <ScrollView className="px-5 py-4" style={{ gap: 8 }}>
                  <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                    {fullDate(selected.event_starts_at)}
                  </Text>
                  <Text className="text-lg font-serif leading-snug mt-1" style={{ color: "#f3f4f6" }}>
                    {selected.title}
                  </Text>
                  {!!selected.location && (
                    <View className="flex-row items-center gap-1.5 mt-1.5">
                      <MapPin size={12} color="#9ca3af" />
                      <Text className="text-xs" style={{ color: "#9ca3af" }}>
                        {selected.location}
                      </Text>
                    </View>
                  )}
                  {!!selected.body && (
                    <Text className="text-[12.5px] leading-relaxed mt-2" style={{ color: "#d1d5db" }}>
                      {selected.body}
                    </Text>
                  )}
                </ScrollView>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
