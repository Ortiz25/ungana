// Ported from frontend/src/lib/components/CampusResources.svelte. The
// source's `<a href>` (opens externally, or is a no-op '#' with no
// attachment) becomes expo-web-browser for a link, or a plain disabled-look
// tile with no press handler when there's nothing to open.
import { View, Text, Pressable } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { Link2, ArrowUpRight, Laptop, BookOpen, Wallet, HeartPulse, ShieldAlert, Bus, Home as HomeIcon, Briefcase, GraduationCap, Users, Pin, type LucideIcon } from "lucide-react-native";
import { matchResourceCategory } from "@/lib/campusResourceCategories";
import { recordCampusPostClick } from "@/lib/api";

export type ResourcePost = {
  id: number | string;
  title: string;
  body?: string | null;
  category?: string | null;
  attachment_url?: string | null;
  is_pinned?: boolean;
};

const CATEGORY_ICON: Record<string, LucideIcon> = {
  library: BookOpen,
  it: Laptop,
  finance: Wallet,
  health: HeartPulse,
  security: ShieldAlert,
  transport: Bus,
  housing: HomeIcon,
  careers: Briefcase,
  admissions: GraduationCap,
  student_affairs: Users,
  general: Link2,
};

const DEFAULT_THEME = { bg: "#0b1e13", border: "#12301e", accent: "#c29d53" };

export default function CampusResources({
  post,
  theme = DEFAULT_THEME,
  matchCategory = matchResourceCategory,
  categoryIcons = CATEGORY_ICON,
  recordClick = recordCampusPostClick,
  onOpen,
}: {
  post: ResourcePost;
  theme?: typeof DEFAULT_THEME;
  matchCategory?: typeof matchResourceCategory;
  categoryIcons?: Record<string, LucideIcon>;
  recordClick?: (id: number | string) => void;
  onOpen?: (post: ResourcePost) => void;
}) {
  const category = matchCategory(post.category, post.title);
  const Icon = categoryIcons[category.id] ?? Link2;

  function handlePress() {
    if (onOpen) {
      onOpen(post);
      return;
    }
    if (post.attachment_url) {
      recordClick(post.id);
      WebBrowser.openBrowserAsync(post.attachment_url);
    }
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={!post.attachment_url && !onOpen}
      className="rounded-xl p-4 flex-row items-start justify-between gap-3 relative"
      style={{ backgroundColor: theme.bg, borderWidth: 1, borderColor: post.is_pinned ? theme.accent : theme.border, opacity: post.attachment_url || onOpen ? 1 : 0.6 }}
    >
      {post.is_pinned && (
        <View className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full items-center justify-center" style={{ backgroundColor: theme.accent }}>
          <Pin size={9} color={theme.bg} fill={theme.bg} />
        </View>
      )}
      <View className="flex-row items-start gap-3 flex-1 min-w-0">
        <View className="w-9 h-9 rounded-lg items-center justify-center" style={{ backgroundColor: category.color }}>
          <Icon size={15} color="#fdf6e3" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-sans-semibold leading-snug" numberOfLines={1} style={{ color: "#e5e7eb" }}>
            {post.title}
          </Text>
          {!!post.body && (
            <Text className="text-xs mt-0.5" numberOfLines={2} style={{ color: "#6b7280" }}>
              {post.body}
            </Text>
          )}
        </View>
      </View>
      {!!post.attachment_url && !onOpen && <ArrowUpRight size={12} color="#6b7280" />}
    </Pressable>
  );
}
