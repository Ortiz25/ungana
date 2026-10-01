// Ported from frontend/src/lib/components/AdminModal.svelte — the shared
// dialog shell for every admin create/edit form. Centered, not a bottom
// sheet (unlike e.g. WatchEarnOverlays' modals) — the web version is
// deliberately centered too, since the admin dashboard supports a wide
// desktop layout where a centered dialog reads better than an edge-anchored
// sheet. Same <Modal transparent animationType="fade"> + backdrop-Pressable
// + stopPropagation-Pressable convention already used elsewhere in this app
// (see CampusEventsStrip.tsx).
import type { ReactNode } from "react";
import { View, Text, Pressable, ScrollView, Modal } from "react-native";
import { X } from "lucide-react-native";

export default function AdminModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onPress={onClose}>
        <Pressable
          onPress={(e) => e.stopPropagation()}
          className="w-full rounded-3xl overflow-hidden"
          style={{ backgroundColor: "#2E5A3E", maxWidth: 480, maxHeight: "90%", borderWidth: 1, borderColor: "rgba(196,92,56,0.15)" }}
        >
          <View className="flex-row items-center justify-between px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.1)" }}>
            <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
              {title}
            </Text>
            <Pressable onPress={onClose} className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <X size={14} color="#C4DAC0" />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 16, gap: 12 }}>{children}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
