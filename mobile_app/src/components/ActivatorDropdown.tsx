// Ported from frontend/src/lib/components/ActivatorDropdown.svelte. The
// source's absolute-positioned floating panel (relying on CSS z-index to
// escape its parent) has no reliable RN equivalent — React Native has no
// stacking-context concept the way CSS does — so the panel is a real RN
// <Modal> here instead (a transparent overlay + centered sheet), same
// content/behavior otherwise (search, locked state, selected checkmark).
import { useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Modal, FlatList } from "react-native";
import { UserCheck, ChevronDown, Search, CheckCircle2, Lock } from "lucide-react-native";
import { ACTIVATORS, type Activator } from "@/lib/data";
import { getActivators } from "@/lib/api";

function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export default function ActivatorDropdown({
  value,
  onChange,
  error = false,
  locked = false,
}: {
  value: Activator | null;
  onChange: (a: Activator) => void;
  error?: boolean;
  locked?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activators, setActivators] = useState<Activator[]>(ACTIVATORS);

  useEffect(() => {
    (async () => {
      const result = await getActivators();
      if (!result.ok || !result.data?.activators) return;
      const fetched = result.data.activators.map((a: any) => ({ id: a.code, name: a.name, area: a.territory ?? "", sessions: 0 }));
      const self = ACTIVATORS.find((a) => a.id === "SELF");
      setActivators(self ? [self, ...fetched] : fetched);
    })();
  }, []);

  const filtered = activators.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.area.toLowerCase().includes(query.toLowerCase()) ||
      a.id.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <View>
      <Pressable
        disabled={locked}
        onPress={() => {
          if (locked) return;
          setOpen(true)
          setQuery("");
        }}
        className="w-full flex-row items-center gap-2 px-4 py-3.5 rounded-2xl"
        style={{
          backgroundColor: "rgba(46,90,62,0.08)",
          opacity: locked ? 0.8 : 1,
          borderWidth: 1.5,
          borderColor: error ? "#B85038" : "transparent",
        }}
      >
        <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: value ? "rgba(196,92,56,0.35)" : "rgba(46,90,62,0.12)" }}>
          <UserCheck size={16} color={value ? "#C45C38" : "#3C6A4A"} />
        </View>
        <View className="flex-1 min-w-0">
          {value ? (
            <>
              <Text className="text-sm font-sans-semibold" numberOfLines={1} style={{ color: "#1D3C2A" }}>
                {value.name}
              </Text>
              <Text className="text-[11px]" numberOfLines={1} style={{ color: "#3C6A4A" }}>
                {value.area} · {value.id}
              </Text>
            </>
          ) : (
            <Text className="text-sm" style={{ color: "#9AB498" }}>
              Select your activator
            </Text>
          )}
        </View>
        {locked ? <Lock size={14} color="#3C6A4A" /> : <ChevronDown size={16} color="#3C6A4A" />}
      </Pressable>

      {locked && (
        <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#9AB498" }}>
          {value ? "Locked to your activator from a previous purchase" : "Locked — you started self-onboarded"}
        </Text>
      )}
      {error && !open && !locked && (
        <Text className="text-[11px] mt-1.5 px-1" style={{ color: "#B85038" }}>
          Please select an activator to continue
        </Text>
      )}

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setOpen(false)}>
          <Pressable
            className="w-full rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#2E5A3E", maxHeight: 380, borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}
            onPress={(e) => e.stopPropagation()}
          >
            <View className="px-3 pt-3 pb-2">
              <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "#3C6A4A" }}>
                <Search size={13} color="#AECAAE" />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search activator…"
                  placeholderTextColor="#7A9E7A"
                  autoFocus
                  className="flex-1 text-xs"
                  style={{ color: "#E8D4B0" }}
                />
              </View>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(a) => a.id}
              style={{ maxHeight: 220 }}
              ListEmptyComponent={
                <Text className="text-xs text-center py-6" style={{ color: "#AECAAE" }}>
                  No activators found
                </Text>
              }
              renderItem={({ item: a, index: i }) => {
                const isSelected = value?.id === a.id;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(a);
                      setOpen(false);
                      setQuery("");
                    }}
                    className="w-full flex-row items-center gap-3 px-4 py-3"
                    style={{
                      backgroundColor: isSelected ? "rgba(196,92,56,0.28)" : "transparent",
                      borderTopWidth: i > 0 ? 1 : 0,
                      borderTopColor: "rgba(255,255,255,0.14)",
                    }}
                  >
                    <View
                      className="w-8 h-8 rounded-xl items-center justify-center"
                      style={{ backgroundColor: isSelected ? "rgba(196,92,56,0.35)" : "rgba(255,255,255,0.14)" }}
                    >
                      {a.id === "SELF" ? (
                        <UserCheck size={15} color={isSelected ? "#C45C38" : "#C4DAC0"} />
                      ) : (
                        <Text className="text-xs font-sans-semibold" style={{ color: isSelected ? "#C45C38" : "#C4DAC0" }}>
                          {initials(a.name)}
                        </Text>
                      )}
                    </View>
                    <View className="flex-1 min-w-0">
                      <Text className="text-sm font-sans-semibold" numberOfLines={1} style={{ color: "#E8D4B0" }}>
                        {a.name}
                      </Text>
                      <Text className="text-[11px]" style={{ color: "#C4DAC0" }}>
                        {a.area}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Text className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "#AECAAE" }}>
                        {a.id}
                      </Text>
                      {isSelected && <CheckCircle2 size={13} color="#C45C38" />}
                    </View>
                  </Pressable>
                );
              }}
            />
            <View className="px-4 py-2.5" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)" }}>
              <Text className="text-[10px] text-center" style={{ color: "#AECAAE" }}>
                {activators.length} activators · tap to select
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
