// Ported from TimelineScreen.svelte's Campus (`isInstitution`) and Community
// (`isCommunity`) template branches — the two mirror each other closely in
// the source (same header/search/filter structure, same section order),
// reproduced here as one component that switches on `isCommunity` rather
// than duplicating the whole layout twice.
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";
import { useTimeline } from "@/flow/TimelineContext";
import TimelineHeader from "@/components/TimelineHeader";
import CommunityPoll from "@/components/CommunityPoll";
import NoticeBoard from "@/components/NoticeBoard";
import QuickLinksBoard from "@/components/QuickLinksBoard";
import ExamTimetable from "@/components/ExamTimetable";
import CampusEventsStrip from "@/components/CampusEventsStrip";
import PastEvents from "@/components/PastEvents";
import MarketplaceBoard from "@/components/MarketplaceBoard";
import { castCampusPollVote, recordCommunityPostClick } from "@/lib/api";
import { matchResourceCategory as matchCommunityCategory } from "@/lib/communityResourceCategories";
import { Truck, Wrench, Dumbbell, Cpu, Bus, Building2, Wallet, Link2 } from "lucide-react-native";

const COMMUNITY_THEME = {
  bg: "#0b1e13",
  bgAlt: "#0a1b11",
  border: "#12301e",
  borderAlt: "#163a23",
  borderHover: "#2a5c3a",
  borderDashed: "#2a5c3a",
  pinnedHoverBorder: "#d4af6a",
  accent: "#c29d53",
  accentSoft: "rgba(194,157,83,0.18)",
  accentGradA: "#d4af6a",
  accentGradB: "#8b6a35",
  bannerGradA: "#123420",
  bannerGradB: "#0d2317",
  bannerBorder: "#1c472e",
  glow: "rgba(212,175,106,0.22)",
  placeholderIcon: "#3a5240",
  carouselBg: "#05140b",
  featured: "#d4af6a",
};
const COMMUNITY_CATEGORY_ICON = {
  food_delivery: Truck,
  home_services: Wrench,
  fitness: Dumbbell,
  tech_support: Cpu,
  transport: Bus,
  coworking: Building2,
  finance: Wallet,
  general: Link2,
};

function CategoryPills({ categories, active, onSelect }: { categories: string[]; active: string; onSelect: (c: string) => void }) {
  if (categories.length <= 1) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 12 }}>
      <Pressable onPress={() => onSelect("all")} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: active === "all" ? "#c29d53" : "#0a1b11", borderWidth: active === "all" ? 0 : 1, borderColor: "#163a23" }}>
        <Text className="text-[11px] font-sans-semibold" style={{ color: active === "all" ? "#0b1e13" : "#9ca3af" }}>
          All
        </Text>
      </Pressable>
      {categories.map((cat) => (
        <Pressable key={cat} onPress={() => onSelect(cat)} className="px-3 py-1.5 rounded-full" style={{ backgroundColor: active === cat ? "#c29d53" : "#0a1b11", borderWidth: active === cat ? 0 : 1, borderColor: "#163a23" }}>
          <Text className="text-[11px] font-sans-semibold" style={{ color: active === cat ? "#0b1e13" : "#9ca3af" }}>
            {cat}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

function EmptyState({ query, category }: { query: string; category: string }) {
  const message = query ? `Nothing matches "${query}".` : category !== "all" ? `Nothing in ${category} yet.` : "Nothing posted here yet — check back soon.";
  return (
    <View className="pt-6 pb-4 items-center">
      <Text className="text-sm" style={{ color: "#6b7280" }}>
        {message}
      </Text>
    </View>
  );
}

export default function CampusCommunityScreen({ onBack }: { onBack: () => void }) {
  const t = useTimeline();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1" style={{ backgroundColor: "#05140b" }}>
      <TimelineHeader onBack={onBack} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View className="px-4 pt-5 pb-6">
          <View className="flex-row items-center gap-2 mb-1">
            <View className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "#c29d53" }} />
            <Text className="text-[10px] font-sans-semibold uppercase tracking-[3px]" style={{ color: "#c29d53" }}>
              {t.siteInfo?.name ?? (t.isCommunity ? "Community Hub" : "Campus Hub")}
            </Text>
          </View>
          <Text className="text-2xl font-serif mb-4" style={{ color: "#f3f4f6" }}>
            {t.campusGreeting()}
          </Text>

          <View className="flex-row items-center gap-2 rounded-lg px-3.5 py-2.5" style={{ backgroundColor: "#0a1b11", borderWidth: 1, borderColor: "#163a23" }}>
            <Search size={13} color="#6b7280" />
            <TextInput
              value={t.isCommunity ? t.communityQuery : t.campusQuery}
              onChangeText={t.isCommunity ? t.setCommunityQuery : t.setCampusQuery}
              placeholder={t.isCommunity ? "Search Community…" : "Search Campus…"}
              placeholderTextColor="#6b7280"
              className="flex-1 text-sm"
              style={{ color: "#e5e7eb" }}
            />
            {!!(t.isCommunity ? t.communityQuery : t.campusQuery) && (
              <Pressable onPress={() => (t.isCommunity ? t.setCommunityQuery("") : t.setCampusQuery(""))}>
                <X size={13} color="#9ca3af" />
              </Pressable>
            )}
          </View>

          <CategoryPills
            categories={t.isCommunity ? t.communityCategories : t.campusCategories}
            active={t.isCommunity ? t.communityCategory : t.campusCategory}
            onSelect={t.isCommunity ? t.setCommunityCategory : t.setCampusCategory}
          />
        </View>

        <View className="px-4 pb-6" style={{ gap: 24 }}>
          {t.isCommunity ? (
            <>
              {t.communityPolls.map((poll) => (
                <CommunityPoll key={poll.id} post={poll} theme={COMMUNITY_THEME} />
              ))}

              {(t.filteredCurrentAnnouncements.length > 0 || t.filteredPastAnnouncements.length > 0) && (
                <NoticeBoard posts={t.filteredCurrentAnnouncements} pastPosts={t.filteredPastAnnouncements} theme={COMMUNITY_THEME} readIds={t.communityReadIds} onMarkRead={t.markCommunityRead} />
              )}

              {t.filteredCommunityMarketplace.length > 0 && (
                <View>
                  <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                    Marketplace
                  </Text>
                  <MarketplaceBoard posts={t.filteredCommunityMarketplace} theme={COMMUNITY_THEME} />
                </View>
              )}

              {t.filteredCommunityServices.length > 0 && (
                <View>
                  <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                    Local services
                  </Text>
                  <QuickLinksBoard
                    posts={t.filteredCommunityServices}
                    theme={COMMUNITY_THEME}
                    matchCategory={matchCommunityCategory}
                    categoryIcons={COMMUNITY_CATEGORY_ICON}
                    recordClick={recordCommunityPostClick}
                    detailModal
                  />
                </View>
              )}

              {t.filteredUpcomingCommunityEvents.length > 0 && (
                <View>
                  <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                    Community events
                  </Text>
                  <CampusEventsStrip posts={t.filteredUpcomingCommunityEvents} theme={COMMUNITY_THEME} />
                </View>
              )}

              {t.filteredPastCommunityEvents.length > 0 && <PastEvents posts={t.filteredPastCommunityEvents} theme={COMMUNITY_THEME} />}

              {!t.communityHasAnyResults && <EmptyState query={t.communityQuery} category={t.communityCategory} />}
            </>
          ) : (
            <>
              {t.campusPolls.map((poll) => (
                <CommunityPoll key={poll.id} post={poll} castVote={castCampusPollVote} />
              ))}

              {(t.filteredCurrentNotices.length > 0 || t.filteredPastNotices.length > 0) && (
                <NoticeBoard posts={t.filteredCurrentNotices} pastPosts={t.filteredPastNotices} readIds={t.campusReadIds} onMarkRead={t.markCampusRead} />
              )}

              {t.filteredCampusResources.length > 0 && (
                <View>
                  <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                    Quick links
                  </Text>
                  <QuickLinksBoard posts={t.filteredCampusResources} />
                </View>
              )}

              {(t.filteredUpcomingTimetable.length > 0 || t.filteredUpcomingEvents.length > 0) && (
                <View className="flex-row flex-wrap" style={{ gap: 16 }}>
                  {t.filteredUpcomingTimetable.length > 0 && (
                    <View style={{ flex: 1, minWidth: 260 }}>
                      <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                        Exam timetable
                      </Text>
                      <ExamTimetable posts={t.filteredUpcomingTimetable} />
                    </View>
                  )}
                  {t.filteredUpcomingEvents.length > 0 && (
                    <View style={{ flex: 1, minWidth: 260 }}>
                      <Text className="text-xs font-sans-semibold uppercase tracking-wider mb-2 pl-1" style={{ color: "#9ca3af" }}>
                        Campus events
                      </Text>
                      <CampusEventsStrip posts={t.filteredUpcomingEvents} />
                    </View>
                  )}
                </View>
              )}

              {t.filteredPastEvents.length > 0 && <PastEvents posts={t.filteredPastEvents} />}

              {!t.campusHasAnyResults && <EmptyState query={t.campusQuery} category={t.campusCategory} />}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
