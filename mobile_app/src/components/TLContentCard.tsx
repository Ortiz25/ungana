// Ported from frontend/src/lib/components/TLContentCard.svelte.
import { View, Text, Image, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, Zap } from "lucide-react-native";
import { TL_TYPE_ICON, doneLabelForFrequency, type TLItem } from "@/lib/data";

export default function TLContentCard({
  item,
  completedIds,
  onStart,
  width = 140,
  height = 175,
}: {
  item: TLItem;
  completedIds: Set<string | number>;
  onStart: (item: TLItem) => void;
  width?: number;
  height?: number;
}) {
  const Icon = TL_TYPE_ICON[item.type];
  const done = completedIds.has(item.id);
  const hasQuiz = item.type === "lesson" && (item.surveyQuestions?.length ?? 0) > 0;
  // Says WHEN it re-unlocks (e.g. "Viewed today") rather than a flat "Done"
  // — see doneLabelForFrequency's own header comment.
  const badgeLabel = done ? doneLabelForFrequency(item.viewFrequency) : item.earnLabel;

  return (
    <Pressable
      onPress={() => onStart(item)}
      disabled={done}
      className="shrink-0 rounded-3xl overflow-hidden active:scale-95"
      style={{ width, height, opacity: done ? 0.75 : 1 }}
    >
      {item.img ? (
        <Image source={{ uri: item.img }} className="absolute inset-0 w-full h-full" resizeMode="cover" />
      ) : (
        <View className="absolute inset-0" style={{ backgroundColor: "#1D3C2A" }} />
      )}
      <LinearGradient
        colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0.08)", "transparent"]}
        locations={[0, 0.55, 1]}
        className="absolute inset-0"
      />

      {/* earn badge */}
      <View
        className="absolute top-2.5 right-2.5 flex-row items-center gap-0.5 px-2 py-1 rounded-full"
        style={{ backgroundColor: done ? "#2E5A3E" : "#C45C38" }}
      >
        {done ? <CheckCircle2 size={9} color="#fff" /> : <Zap size={9} color="#fff" />}
        <Text className="text-[9px] font-bold text-white ml-0.5">{badgeLabel}</Text>
      </View>

      {/* type badge */}
      <View className="absolute top-2.5 left-2.5 w-6 h-6 rounded-lg items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
        <Icon size={11} color="#fff" />
      </View>

      {/* bottom info */}
      <View className="absolute bottom-0 left-0 right-0 p-2.5">
        <Text className="text-[9px] font-semibold mb-0.5" style={{ color: "#C4DAC0" }}>
          {item.category} · {item.duration}
          {hasQuiz ? " · + Quiz" : ""}
        </Text>
        <Text numberOfLines={2} className="text-xs font-bold text-white leading-tight">
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}
