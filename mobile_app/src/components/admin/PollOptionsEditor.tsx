// Ported from AdminDashboardScreen.svelte's inline poll-options builder
// (campusDraft/communityDraft.pollOptions) — shared since Campus and
// Community polls use the exact same shape and rules (2+ non-empty options).
import { View, Text, TextInput, Pressable } from "react-native";
import { Plus, X } from "lucide-react-native";

export default function PollOptionsEditor({ options, onChange }: { options: string[]; onChange: (options: string[]) => void }) {
  return (
    <View>
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        Options (2+)
      </Text>
      <View style={{ gap: 8 }}>
        {options.map((opt, i) => (
          <View key={i} className="flex-row items-center gap-2">
            <TextInput
              value={opt}
              onChangeText={(t) => onChange(options.map((o, idx) => (idx === i ? t : o)))}
              placeholder={`Option ${i + 1}`}
              placeholderTextColor="#4A6842"
              className="flex-1 rounded-xl px-3 py-2.5 text-sm"
              style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#E8D4B0" }}
            />
            {options.length > 2 && (
              <Pressable onPress={() => onChange(options.filter((_, idx) => idx !== i))} className="items-center justify-center rounded-full" style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.1)" }}>
                <X size={12} color="#C4DAC0" />
              </Pressable>
            )}
          </View>
        ))}
      </View>
      <Pressable onPress={() => onChange([...options, ""])} className="mt-2 self-start flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
        <Plus size={10} color="#C4DAC0" />
        <Text className="text-[11px] font-bold" style={{ color: "#C4DAC0" }}>
          Add option
        </Text>
      </Pressable>
    </View>
  );
}
