// The two-tap "tap to arm, tap again within 4s to confirm" delete pattern
// the web dashboard reimplements per-section (removeSite/removePackage/...)
// — built once here so every future admin section reuses it instead of
// re-deriving the arm/timeout state each time. Self-contained: callers just
// pass onConfirm, not the armed/timeout bookkeeping.
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, ActivityIndicator } from "react-native";
import { Trash2 } from "lucide-react-native";

export default function ArmedDeleteButton({
  onConfirm,
  label = "Delete",
  confirmLabel = "Confirm delete",
}: {
  onConfirm: () => Promise<void> | void;
  label?: string;
  confirmLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  async function handlePress() {
    if (!armed) {
      setArmed(true);
      timeoutRef.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setArmed(false);
    setBusy(true);
    await onConfirm();
    setBusy(false);
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={busy}
      className="flex-row items-center gap-1 px-3 py-2 rounded-full"
      style={{ backgroundColor: armed ? "#B85038" : "rgba(192,97,74,0.15)", opacity: busy ? 0.6 : 1 }}
    >
      {busy ? <ActivityIndicator size="small" color={armed ? "#fff" : "#E08A6A"} /> : <Trash2 size={10} color={armed ? "#fff" : "#E08A6A"} />}
      <Text className="text-[10px] font-bold" style={{ color: armed ? "#fff" : "#E08A6A" }}>
        {busy ? "Deleting…" : armed ? confirmLabel : label}
      </Text>
    </Pressable>
  );
}
