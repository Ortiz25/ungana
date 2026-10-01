// Ported from frontend/src/lib/components/MarketplaceBoard.svelte.
import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, TextInput, ScrollView, Image, Linking } from "react-native";
import { ShoppingBag, Search, X, MessageCircle } from "lucide-react-native";
import { recordCommunityPostClick } from "@/lib/api";

export type ListingPost = {
  id: number | string;
  title: string;
  category?: string | null;
  body?: string | null;
  is_pinned?: boolean;
  attachment_url?: string | null;
  price_kes?: number | string | null;
  metadata?: { condition?: string; contactPhone?: string };
};

const DEFAULT_THEME = { bg: "#0b1e13", bgAlt: "#0a1b11", border: "#12301e", accent: "#c29d53", featured: "#d4af6a" };
const VISIBLE_LIMIT = 6;
const CONDITION_LABEL: Record<string, string> = { new: "New", like_new: "Like new", used: "Used" };

function formatPrice(priceKes: unknown): string | null {
  const n = Number(priceKes);
  return Number.isFinite(n) && priceKes != null ? `KES ${n.toLocaleString()}` : null;
}

function whatsAppLink(post: ListingPost): string | null {
  const phone = post.metadata?.contactPhone;
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, "");
  const normalized = digits.startsWith("254") ? digits : `254${digits.replace(/^0/, "")}`;
  return `https://wa.me/${normalized}`;
}

function ListingTile({ post, theme, onPress }: { post: ListingPost; theme: typeof DEFAULT_THEME; onPress: () => void }) {
  const price = formatPrice(post.price_kes);
  return (
    <Pressable onPress={onPress} className="rounded-xl overflow-hidden" style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: post.is_pinned ? theme.featured : theme.border }}>
      <View className="relative" style={{ aspectRatio: 16 / 9, backgroundColor: theme.bgAlt }}>
        {post.attachment_url ? (
          <Image source={{ uri: post.attachment_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <ShoppingBag size={16} color={theme.border} />
          </View>
        )}
        {!!price && (
          <View className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
            <Text className="text-[9px] font-sans-semibold" style={{ color: theme.accent }}>
              {price}
            </Text>
          </View>
        )}
      </View>
      <View className="p-2">
        <Text className="text-[11px] font-sans-semibold leading-snug" numberOfLines={1} style={{ color: "#e5e7eb" }}>
          {post.title}
        </Text>
        {!!post.metadata?.condition && (
          <Text className="text-[9px] mt-0.5" style={{ color: "#6b7280" }}>
            {CONDITION_LABEL[post.metadata.condition] ?? post.metadata.condition}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function MarketplaceBoard({ posts = [], theme = DEFAULT_THEME }: { posts?: ListingPost[]; theme?: typeof DEFAULT_THEME }) {
  const overflow = Math.max(posts.length - (VISIBLE_LIMIT - 1), 0);
  const gridPosts = overflow > 0 ? posts.slice(0, VISIBLE_LIMIT - 1) : posts;

  const [modalOpen, setModalOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ListingPost | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) => [p.title, p.category, p.body].some((f) => (f || "").toLowerCase().includes(q)));
  }, [posts, query]);

  if (posts.length === 0) return null;

  const price = selected ? formatPrice(selected.price_kes) : null;
  const contactUrl = selected ? whatsAppLink(selected) : null;

  return (
    <>
      <View className="flex-row flex-wrap" style={{ gap: 10 }}>
        {gridPosts.map((post) => (
          <View key={post.id} style={{ width: "31%" }}>
            <ListingTile post={post} theme={theme} onPress={() => setSelected(post)} />
          </View>
        ))}
        {overflow > 0 && (
          <Pressable
            onPress={() => {
              setModalOpen(true);
              setQuery("");
            }}
            className="rounded-xl items-center justify-center p-3"
            style={{ width: "31%", backgroundColor: theme.bgAlt, borderWidth: 1, borderStyle: "dashed", borderColor: theme.border, gap: 6 }}
          >
            <ShoppingBag size={16} color={theme.accent} />
            <Text className="text-xs font-sans-semibold" style={{ color: "#e5e7eb" }}>
              +{overflow} more
            </Text>
          </Pressable>
        )}
      </View>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <Pressable className="flex-1 justify-end" style={{ backgroundColor: "rgba(0,0,0,0.65)" }} onPress={() => setModalOpen(false)}>
          <Pressable style={{ backgroundColor: theme.bg, maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24 }} onPress={(e) => e.stopPropagation()}>
            <View className="flex-row items-center justify-between px-5 pt-5 pb-3">
              <View>
                <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                  Marketplace
                </Text>
                <Text className="text-[11px] mt-0.5" style={{ color: "#9ca3af" }}>
                  {filtered.length} of {posts.length} listings
                </Text>
              </View>
              <Pressable onPress={() => setModalOpen(false)} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.08)" }}>
                <X size={14} color="#9ca3af" />
              </Pressable>
            </View>
            <View className="px-5 pb-3">
              <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: theme.bgAlt, borderWidth: 1, borderColor: theme.border }}>
                <Search size={14} color={theme.accent} />
                <TextInput value={query} onChangeText={setQuery} placeholder="Search listings…" placeholderTextColor="#6b7280" className="flex-1 text-sm" style={{ color: "#e5e7eb" }} />
                {!!query && (
                  <Pressable onPress={() => setQuery("")}>
                    <X size={13} color="#9ca3af" />
                  </Pressable>
                )}
              </View>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {filtered.length === 0 ? (
                <Text className="text-sm text-center py-8 w-full" style={{ color: "#9ca3af" }}>
                  {query ? `No listings match "${query}".` : "Nothing listed yet."}
                </Text>
              ) : (
                filtered.map((post) => (
                  <View key={post.id} style={{ width: "31%" }}>
                    <ListingTile
                      post={post}
                      theme={theme}
                      onPress={() => {
                        setModalOpen(false);
                        setSelected(post);
                      }}
                    />
                  </View>
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
                <View className="relative" style={{ aspectRatio: 16 / 9, backgroundColor: theme.bgAlt }}>
                  {selected.attachment_url ? (
                    <Image source={{ uri: selected.attachment_url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  ) : (
                    <View className="w-full h-full items-center justify-center">
                      <ShoppingBag size={28} color={theme.border} />
                    </View>
                  )}
                  <Pressable onPress={() => setSelected(null)} className="absolute top-3 right-3 w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
                    <X size={14} color="#fff" />
                  </Pressable>
                  {!!price && (
                    <View className="absolute bottom-3 left-3 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(0,0,0,0.65)" }}>
                      <Text className="text-sm font-sans-semibold" style={{ color: theme.accent }}>
                        {price}
                      </Text>
                    </View>
                  )}
                </View>
                <ScrollView className="px-5 py-4" style={{ gap: 10 }}>
                  {!!selected.category && (
                    <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: theme.accent }}>
                      {selected.category}
                    </Text>
                  )}
                  <Text className="text-lg font-serif leading-snug mt-1" style={{ color: "#f3f4f6" }}>
                    {selected.title}
                  </Text>
                  {!!selected.metadata?.condition && (
                    <Text className="text-xs mt-1" style={{ color: "#9ca3af" }}>
                      Condition: {CONDITION_LABEL[selected.metadata.condition] ?? selected.metadata.condition}
                    </Text>
                  )}
                  {!!selected.body && (
                    <Text className="text-[12.5px] leading-relaxed mt-2" style={{ color: "#d1d5db" }}>
                      {selected.body}
                    </Text>
                  )}
                  {!!contactUrl && (
                    <Pressable
                      onPress={() => {
                        recordCommunityPostClick(selected.id);
                        Linking.openURL(contactUrl);
                      }}
                      className="mt-3 w-full py-3 rounded-2xl flex-row items-center justify-center gap-2"
                      style={{ backgroundColor: theme.accent }}
                    >
                      <MessageCircle size={15} color="#0b1120" />
                      <Text className="text-sm font-sans-semibold" style={{ color: "#0b1120" }}>
                        Contact Seller
                      </Text>
                    </Pressable>
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
