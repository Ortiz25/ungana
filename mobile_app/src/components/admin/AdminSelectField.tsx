// RN equivalent of the web admin dashboard's native <select> (e.g.
// "Reports to coordinator") — same tap-to-open-a-modal-list pattern already
// established in this app by ActivatorDropdown.tsx, simplified (no search —
// admin option lists here are short) and generalized for reuse across
// future admin forms (site picker, package-visibility picker, etc.).
import { useState } from "react";
import { View, Text, Pressable, Modal, FlatList } from "react-native";
import { ChevronDown, Check } from "lucide-react-native";

export type AdminSelectOption = { label: string; value: string };

export default function AdminSelectField({
  label,
  value,
  options,
  onChange,
  placeholder = "None",
}: {
  label: string;
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const allOptions: AdminSelectOption[] = [{ label: placeholder, value: "" }, ...options];

  return (
    <View>
      <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
        {label}
      </Text>
      <Pressable
        onPress={() => setOpen(true)}
        className="flex-row items-center justify-between rounded-xl px-3 py-2.5"
        style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}
      >
        <Text className="text-sm" style={{ color: selected ? "#E8D4B0" : "#7A9E7A" }}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={14} color="#AECAAE" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="w-full rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#2E5A3E", maxHeight: 340, borderWidth: 1, borderColor: "rgba(196,92,56,0.35)" }}
          >
            <FlatList
              data={allOptions}
              keyExtractor={(o) => o.value}
              renderItem={({ item, index }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.value);
                      setOpen(false);
                    }}
                    className="flex-row items-center justify-between px-4 py-3"
                    style={{
                      backgroundColor: isSelected ? "rgba(196,92,56,0.28)" : "transparent",
                      borderTopWidth: index > 0 ? 1 : 0,
                      borderTopColor: "rgba(255,255,255,0.14)",
                    }}
                  >
                    <Text className="text-sm" style={{ color: "#E8D4B0" }}>
                      {item.label}
                    </Text>
                    {isSelected && <Check size={14} color="#C45C38" />}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
