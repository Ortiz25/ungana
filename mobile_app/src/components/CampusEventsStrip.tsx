// Ported from frontend/src/lib/components/CampusEventsStrip.svelte.
import { useState } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { MapPin, CalendarDays, Clock, X, Pin } from "lucide-react-native";
import type { NoticeTheme } from "@/components/NoticeBoard";

export type EventPost = {
  id: number | string;
  title: string;
  category?: string | null;
  location?: string | null;
  body?: string | null;
  is_pinned?: boolean;
  event_starts_at: string;
  event_ends_at?: string | null;
};

const DEFAULT_THEME: NoticeTheme & { borderHover: string; accentGradA: string; accentGradB: string } = {
  bg: "#0b1e13",
  bgAlt: "#0a1b11",
  border: "#12301e",
  borderAlt: "#163a23",
  borderHover: "#1c492e",
  accent: "#c29d53",
  accentSoft: "rgba(194,157,83,0.18)",
  accentGradA: "#d4af6a",
  accentGradB: "#8b6a35",
  bannerGradA: "#123420",
  bannerGradB: "#0d2317",
  bannerBorder: "#1c472e",
};

function dayNum(iso: string) {
  return new Date(iso).getDate();
}
function monthAbbrev(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short" });
}
function timeRange(startIso: string, endIso?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { hour: "numeric", minute: "2-digit" };
  const start = new Date(startIso).toLocaleTimeString(undefined, opts);
  if (!endIso) return start;
  return `${start} – ${new Date(endIso).toLocaleTimeString(undefined, opts)}`;
}
function relativeLabel(iso: string) {
  const now = new Date();
  const target = new Date(iso);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(target) - startOfDay(now)) / 86400000);
  if (diffDays < 0) return "Past";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return `in ${diffDays}d`;
}

export default function CampusEventsStrip({ posts = [], theme = DEFAULT_THEME }: { posts?: EventPost[]; theme?: typeof DEFAULT_THEME }) {
  const [selected, setSelected] = useState<EventPost | null>(null);

  if (posts.length === 0) return null;

  return (
    <>
      <View style={{ gap: 12 }}>
        {posts.map((post) => (
          <Pressable
            key={post.id}
            onPress={() => setSelected(post)}
            className="rounded-xl p-4 relative"
            style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: post.is_pinned ? theme.accent : theme.border }}
          >
            {post.is_pinned && (
              <View className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: theme.accent }}>
                <Pin size={9} color={theme.bg} fill={theme.bg} />
              </View>
            )}
            <View className="flex-row items-center gap-3">
              <View className="items-center justify-center rounded-lg px-3 py-1.5" style={{ backgroundColor: theme.accentGradA, minWidth: 56 }}>
                <Text className="text-[10px] uppercase" style={{ color: "#fdf6e3" }}>
                  {monthAbbrev(post.event_starts_at)}
                </Text>
                <Text className="text-xl font-sans-semibold leading-none my-0.5" style={{ color: "#fdf6e3" }}>
                  {dayNum(post.event_starts_at)}
                </Text>
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <CalendarDays size={10} color="#9ca3af" />
                  <Text className="text-[11px]" style={{ color: "#9ca3af" }}>
                    {relativeLabel(post.event_starts_at)}
                  </Text>
                </View>
                <Text className="text-sm font-sans-semibold mt-0.5" numberOfLines={1} style={{ color: "#f3f4f6" }}>
                  {post.title}
                </Text>
                {!!post.location && (
                  <View className="flex-row items-center gap-1 mt-1">
                    <MapPin size={10} color="#6b7280" />
                    <Text className="text-xs" numberOfLines={1} style={{ color: "#6b7280" }}>
                      {post.location}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable className="flex-1 items-center justify-center px-4" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setSelected(null)}>
          <Pressable className="w-full rounded-3xl" style={{ backgroundColor: theme.bg, maxWidth: 480, maxHeight: "85%", borderWidth: 1, borderColor: theme.border }} onPress={(e) => e.stopPropagation()}>
            {selected && (
              <>
                <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" }}>
                  <Text className="text-sm font-sans-semibold" style={{ color: "#f3f4f6" }}>
                    Campus Event
                  </Text>
                  <Pressable onPress={() => setSelected(null)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <X size={14} color="#9ca3af" />
                  </Pressable>
                </View>
                <View className="px-5 py-4" style={{ gap: 12 }}>
                  <View className="flex-row items-center gap-3">
                    <View className="items-center justify-center rounded-lg px-3 py-2" style={{ backgroundColor: theme.border, borderWidth: 1, borderColor: theme.borderHover }}>
                      <Text className="text-[10px] uppercase" style={{ color: "#9ca3af" }}>
                        {monthAbbrev(selected.event_starts_at)}
                      </Text>
                      <Text className="text-xl font-sans-semibold leading-none my-0.5" style={{ color: theme.accent }}>
                        {dayNum(selected.event_starts_at)}
                      </Text>
                    </View>
                    <View className="flex-1 min-w-0">
                      <View className="flex-row items-center gap-1.5">
                        <Text className="text-base font-serif" style={{ color: "#f3f4f6" }}>
                          {selected.title}
                        </Text>
                        {selected.is_pinned && <Pin size={12} color={theme.accent} fill={theme.accent} />}
                      </View>
                      {!!selected.category && (
                        <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                          {selected.category}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <Clock size={12} color="#9ca3af" />
                    <Text className="text-xs" style={{ color: "#d1d5db" }}>
                      {timeRange(selected.event_starts_at, selected.event_ends_at)}
                    </Text>
                  </View>
                  {!!selected.location && (
                    <View className="flex-row items-center gap-1.5">
                      <MapPin size={12} color="#9ca3af" />
                      <Text className="text-xs" style={{ color: "#d1d5db" }}>
                        {selected.location}
                      </Text>
                    </View>
                  )}
                  {!!selected.body && (
                    <Text className="text-[12.5px] leading-relaxed" style={{ color: "#d1d5db" }}>
                      {selected.body}
                    </Text>
                  )}
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
