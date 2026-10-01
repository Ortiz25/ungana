// Ported from AdminDashboardScreen.svelte's 'coordinators' tab (script +
// template). Calls useAdminAuth()/useAdminAuth() directly rather than taking
// the token as a prop — this screen is part of the admin subtree that all
// shares one AdminAuthProvider, same "screen reads its own subtree context"
// convention already used by CampusCommunityScreen/TimelineHeader for the
// Timeline subtree, as opposed to the flatter prop-only screens like
// ActiveScreen/PackageScreen.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, ShieldCheck, Phone, MapPin, TrendingUp, Edit3, Pause, Play } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminGetCoordinators, adminCreateCoordinator, adminUpdateCoordinator, type Coordinator } from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";

const EMPTY_DRAFT = { name: "", phone: "", pin: "", territory: "" };

export default function CoordinatorsScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; territory: string; pin: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const result = await adminGetCoordinators(token!);
      if (!result.ok && "status" in result && result.status === 401) {
        await logout();
        return;
      }
      if (result.ok) setCoordinators(result.data.coordinators ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await adminGetCoordinators(token!);
      if (cancelled) return;
      if (!result.ok && "status" in result && result.status === 401) {
        await logout();
        return;
      }
      if (result.ok) setCoordinators(result.data.coordinators ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCreate() {
    if (!createDraft.name.trim() || !createDraft.phone.trim() || createDraft.pin.length < 4) {
      setCreateError("Name, phone, and a 4+ digit PIN are required");
      return;
    }
    setCreateError("");
    setCreating(true);
    const result = await adminCreateCoordinator(token!, {
      name: createDraft.name.trim(),
      phone: createDraft.phone.trim(),
      pin: createDraft.pin,
      territory: createDraft.territory.trim() || undefined,
    });
    setCreating(false);

    if (!result.ok || !result.data?.success) {
      setCreateError(result.data?.message || "Could not create coordinator — check your connection");
      return;
    }
    setCreateDraft(EMPTY_DRAFT);
    setShowCreate(false);
    await load();
  }

  async function toggleStatus(c: Coordinator) {
    await adminUpdateCoordinator(token!, c.id, { status: c.status === "active" ? "suspended" : "active" });
    await load();
  }

  function startEdit(c: Coordinator) {
    setEditingId(c.id);
    setEditError("");
    setEditDraft({ name: c.name, territory: c.territory ?? "", pin: "" });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit() {
    if (!editDraft || editingId == null) return;
    if (!editDraft.name.trim()) {
      setEditError("Name is required");
      return;
    }
    setEditError("");
    setEditSaving(true);
    const result = await adminUpdateCoordinator(token!, editingId, {
      name: editDraft.name.trim(),
      territory: editDraft.territory.trim() || null,
      ...(editDraft.pin ? { pin: editDraft.pin } : {}),
    });
    setEditSaving(false);

    if (!result.ok || !result.data?.success) {
      setEditError(result.data?.message || "Could not save — check your connection");
      return;
    }
    cancelEdit();
    await load();
  }

  const editingCoordinator = coordinators.find((c) => c.id === editingId) ?? null;

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#1D3C2A" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#c29d53" />}
      >
        <Pressable
          onPress={() => {
            setCreateDraft(EMPTY_DRAFT);
            setCreateError("");
            setShowCreate(true);
          }}
          className="py-3 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95"
          style={{ backgroundColor: "#C45C38" }}
        >
          <Plus size={15} color="#fff" />
          <Text className="font-bold text-sm text-white">Add coordinator</Text>
        </Pressable>

        <Text className="text-xs font-sans-semibold px-1" style={{ color: "#3C6A4A" }}>
          {coordinators.length} coordinators
        </Text>

        {coordinators.map((c) => (
          <View key={c.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", opacity: c.status === "active" ? 1 : 0.5 }}>
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                <ShieldCheck size={16} color="#C45C38" />
              </View>
              <View className="flex-1 min-w-0">
                <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                  {c.name}
                </Text>
                <View className="flex-row items-center gap-1">
                  <Phone size={9} color="#AECAAE" />
                  <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                    {c.phone}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  {!!c.territory && (
                    <>
                      <MapPin size={9} color="#AECAAE" />
                      <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                        {c.territory} ·{" "}
                      </Text>
                    </>
                  )}
                  <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                    {c.activator_count} activators
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <TrendingUp size={9} color="#C45C38" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C45C38" }}>
                    {c.paid_sessions} sessions · KES {Number(c.commission_kes).toLocaleString()} team earnings
                  </Text>
                </View>
              </View>
              <View className="items-end" style={{ gap: 6 }}>
                <Pressable onPress={() => startEdit(c)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Edit3 size={10} color="#C4DAC0" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C4DAC0" }}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleStatus(c)}
                  className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                  style={{ backgroundColor: c.status === "active" ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)" }}
                >
                  {c.status === "active" ? <Pause size={10} color="#4E8050" /> : <Play size={10} color="#B85038" />}
                  <Text className="text-[10px] font-bold" style={{ color: c.status === "active" ? "#4E8050" : "#B85038" }}>
                    {c.status === "active" ? "Active" : "Off"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <AdminModal visible={showCreate} title="Add coordinator" onClose={() => setShowCreate(false)}>
        <AdminTextField label="Name" value={createDraft.name} onChangeText={(t) => setCreateDraft((d) => ({ ...d, name: t }))} />
        <View className="flex-row" style={{ gap: 12 }}>
          <AdminTextField label="Phone" value={createDraft.phone} onChangeText={(t) => setCreateDraft((d) => ({ ...d, phone: t }))} placeholder="254700000000" keyboardType="phone-pad" />
          <AdminTextField
            label="PIN"
            value={createDraft.pin}
            onChangeText={(t) => setCreateDraft((d) => ({ ...d, pin: t.replace(/\D/g, "").slice(0, 6) }))}
            placeholder="4-digit"
            secureTextEntry
            keyboardType="number-pad"
          />
        </View>
        <AdminTextField label="Territory" value={createDraft.territory} onChangeText={(t) => setCreateDraft((d) => ({ ...d, territory: t }))} placeholder="e.g. Nairobi Central" />
        {!!createError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {createError}
          </Text>
        )}
        <Pressable
          onPress={submitCreate}
          disabled={creating}
          className="w-full py-3 rounded-2xl items-center"
          style={{ backgroundColor: "#C45C38", opacity: creating ? 0.7 : 1 }}
        >
          <Text className="font-bold text-sm text-white">{creating ? "Saving…" : "Create coordinator"}</Text>
        </Pressable>
      </AdminModal>

      <AdminModal visible={!!editingId && !!editDraft} title="Edit coordinator" onClose={cancelEdit}>
        {editDraft && (
          <>
            {!!editingCoordinator && (
              <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <Phone size={12} color="#96B496" />
                <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                  Login phone: <Text style={{ color: "#E8D4B0", fontWeight: "700" }}>{editingCoordinator.phone}</Text>{" "}
                  <Text style={{ color: "#96B496" }}>(not editable here)</Text>
                </Text>
              </View>
            )}
            <AdminTextField label="Name" value={editDraft.name} onChangeText={(t) => setEditDraft((d) => (d ? { ...d, name: t } : d))} />
            <AdminTextField label="Territory" value={editDraft.territory} onChangeText={(t) => setEditDraft((d) => (d ? { ...d, territory: t } : d))} placeholder="e.g. Nairobi Central" />
            <AdminTextField
              label="Reset PIN (optional)"
              value={editDraft.pin}
              onChangeText={(t) => setEditDraft((d) => (d ? { ...d, pin: t.replace(/\D/g, "").slice(0, 6) } : d))}
              placeholder="leave blank to keep current"
              secureTextEntry
              keyboardType="number-pad"
            />
            {!!editError && (
              <Text className="text-xs" style={{ color: "#E08A6A" }}>
                {editError}
              </Text>
            )}
            <Pressable
              onPress={saveEdit}
              disabled={editSaving}
              className="w-full py-2.5 rounded-xl items-center"
              style={{ backgroundColor: "#C45C38", opacity: editSaving ? 0.7 : 1 }}
            >
              <Text className="font-bold text-xs text-white">{editSaving ? "Saving…" : "Save changes"}</Text>
            </Pressable>
          </>
        )}
      </AdminModal>
    </View>
  );
}
