// Ported from frontend/src/lib/components/QuickLinksBoard.svelte.
import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Grid3x3, Search, X, ChevronRight, Phone, ExternalLink, type LucideIcon } from "lucide-react-native";
import CampusResources, { type ResourcePost } from "@/components/CampusResources";
import { matchResourceCategory } from "@/lib/campusResourceCategories";

const DEFAULT_THEME = { bg: "#0b1e13", bgAlt: "#0a1b11", border: "#12301e", borderAlt: "#163a23", borderDashed: "#2a5c3a", accent: "#c29d53", accentSoft: "rgba(194,157,83,0.18)" };
const VISIBLE_LIMIT = 6;

export default function QuickLinksBoard({
  posts = [],
  theme = DEFAULT_THEME,
  matchCategory = matchResourceCategory,
  categoryIcons,
  recordClick,
  detailModal = false,
}: {
  posts?: ResourcePost[];
  theme?: typeof DEFAULT_THEME;
  matchCategory?: typeof matchResourceCategory;
  categoryIcons?: Record<string, LucideIcon>;
  recordClick?: (id: number | string) => void;
  detailModal?: boolean;
}) {
  const [selected, setSelected] = useState<ResourcePost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");

  const overflow = Math.max(posts.length - (VISIBLE_LIMIT - 1), 0);
  const gridPosts = overflow > 0 ? posts.slice(0, VISIBLE_LIMIT - 1) : posts;

  const presentCategories = useMemo(() => {
    const seen = new Map();
    for (const post of posts) {
      const cat = matchCategory(post.category, post.title);
      if (!seen.has(cat.id)) seen.set(cat.id, cat);
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [posts, matchCategory]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((post) => {
      if (activeCategory !== "all" && matchCategory(post.category, post.title).id !== activeCategory) return false;
      if (!q) return true;
      return [post.title, post.category, post.body].some((f) => (f || "").toLowerCase().includes(q));
    });
  }, [posts, query, activeCategory, matchCategory]);

  function openModal() {
    setModalOpen(true);
    setQuery("");
    setActiveCategory("all");
  }

  async function handleContact(post: ResourcePost) {
    recordClick?.(post.id);
    const url = post.attachment_url || "";
    if (url.startsWith("tel:")) Linking.openURL(url);
    else WebBrowser.openBrowserAsync(url);
  }

  const selectedCat = selected ? matchCategory(selected.category, selected.title) : null;
  const SelectedIcon = selectedCat && categoryIcons ? categoryIcons[selectedCat.id] : undefined;
  const isTel = (selected?.attachment_url || "").startsWith("tel:");

  return (
    <>
      <View className="flex-col" style={{ gap: 12 }}>
        {gridPosts.map((post) => (
          <CampusResources key={post.id} post={post} theme={theme} matchCategory={matchCategory} categoryIcons={categoryIcons} recordClick={recordClick} onOpen={detailModal ? setSelected : undefined} />
        ))}
        {overflow > 0 && (
          <Pressable onPress={openModal} className="rounded-xl p-4 flex-row items-center justify-between gap-3" style={{ backgroundColor: theme.bg, borderWidth: 1, borderStyle: "dashed", borderColor: theme.borderDashed }}>
            <View className="flex-row items-center gap-3 flex-1 min-w-0">
              <View className="w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: theme.accentSoft }}>
                <Grid3x3 size={15} color={theme.accent} />
              </View>
              <View className="min-w-0">
                <Text className="text-sm font-sans-semibold" style={{ color: "#e5e7eb" }}>
                  +{overflow} more
                </Text>
                <Text className="text-xs mt-0.5" style={{ color: "#6b7280" }}>
                  View all services
                </Text>
              </View>
            </View>
            <ChevronRight size={13} color="#6b7280" />
          </Pressable>
        )}
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setModalOpen(false)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View>
                <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                  Quick Links
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                  {filtered.length} of {posts.length} services
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <X size={14} color="#9ca3af" />
              </Pressable>
            </View>

            <View className="px-5 pb-3">
              <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: theme.bgAlt, borderWidth: 1, borderColor: theme.borderAlt }}>
                <Search size={14} color={theme.accent} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search services…" placeholderTextColor="#6b7280" className="flex-1 text-sm" style={{ color: "#e5e7eb" }} />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={13} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>

            {presentCategories.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
                <Pressable onPress={() => setActiveCategory("all")} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: activeCategory === "all" ? theme.accent : theme.bgAlt, borderWidth: activeCategory === "all" ? 0 : 1, borderColor: theme.borderAlt }}>
                  <Text className="text-[11px] font-sans-semibold" style={{ color: activeCategory === "all" ? theme.bg : "#9ca3af" }}>
                    All
                  </Text>
                </Pressable>
                {presentCategories.map((cat) => (
                  <Pressable key={cat.id} onPress={() => setActiveCategory(cat.id)} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: activeCategory === cat.id ? cat.color : theme.bgAlt, borderWidth: activeCategory === cat.id ? 0 : 1, borderColor: theme.borderAlt }}>
                    <Text className="text-[11px] font-sans-semibold" style={{ color: activeCategory === cat.id ? "#fdf6e3" : "#9ca3af" }}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
              {filtered.length === 0 ? (
                <Text className="text-sm text-center py-8" style={{ color: "#9ca3af" }}>
                  {query ? `No services match "${query}".` : "Nothing in this category."}
                </Text>
              ) : (
                filtered.map((post) => (
                  <CampusResources
                    key={post.id}
                    post={post}
                    theme={theme}
                    matchCategory={matchCategory}
                    categoryIcons={categoryIcons}
                    recordClick={recordClick}
                    onOpen={detailModal ? (p) => { setModalOpen(false); setSelected(p); } : undefined}
                  />
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.75)" }} onPress={() => setSelected(null)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            {selected && selectedCat && (
              <>
                <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
                  <View className="flex-row items-center gap-3 flex-1 min-w-0">
                    <View className="w-10 h-10 rounded-xl items-center justify-center" style={{ backgroundColor: selectedCat.color }}>
                      {SelectedIcon && <SelectedIcon size={16} color="#fdf6e3" />}
                    </View>
                    <View className="min-w-0">
                      <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                        {selectedCat.label}
                      </Text>
                      <Text className="text-sm font-sans-semibold" numberOfLines={1} style={{ color: "#f3f4f6" }}>
                        {selected.title}
                      </Text>
                    </View>
                  </View>
                  <Pressable onPress={() => setSelected(null)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                    <X size={14} color="#9ca3af" />
                  </Pressable>
                </View>
                <View className="px-5 py-4" style={{ gap: 12 }}>
                  <Text className="text-[12.5px] leading-relaxed" style={{ color: selected.body ? "#d1d5db" : "#6b7280" }}>
                    {selected.body || "No description added yet."}
                  </Text>
                  {!!selected.attachment_url && (
                    <Pressable onPress={() => handleContact(selected)} className="w-full py-3 rounded-2xl flex-row items-center justify-center gap-2" style={{ backgroundColor: theme.accent }}>
                      {isTel ? <Phone size={15} color={theme.bg} /> : <ExternalLink size={15} color={theme.bg} />}
                      <Text className="text-sm font-sans-semibold" style={{ color: theme.bg }}>
                        {isTel ? "Contact Business" : "Visit / Learn More"}
                      </Text>
                    </Pressable>
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
