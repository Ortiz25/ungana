// Ported from AdminDashboardScreen.svelte's 'activators' tab. One layer past
// CoordinatorsScreen: adds a coordinator picker (AdminSelectField) plus
// M-PESA number and commission-rate fields.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Zap, Phone, MapPin, TrendingUp, Users, Edit3, Pause, Play } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import {
  adminGetActivators,
  adminCreateActivator,
  adminUpdateActivator,
  adminGetCoordinators,
  type Activator,
  type Coordinator,
} from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";
import AdminSelectField from "@/components/admin/AdminSelectField";

const EMPTY_DRAFT = { code: "", name: "", phone: "", pin: "", territory: "", mpesaNumber: "", commissionRate: "", coordinatorId: "" };

export default function ActivatorsScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [activators, setActivators] = useState<Activator[]>([]);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState(EMPTY_DRAFT);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; territory: string; mpesaNumber: string; commissionRate: string; coordinatorId: string; pin: string } | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [activatorsResult, coordinatorsResult] = await Promise.all([adminGetActivators(token!), adminGetCoordinators(token!)]);
      if ((!activatorsResult.ok && "status" in activatorsResult && activatorsResult.status === 401) || (!coordinatorsResult.ok && "status" in coordinatorsResult && coordinatorsResult.status === 401)) {
        await logout();
        return;
      }
      if (activatorsResult.ok) setActivators(activatorsResult.data.activators ?? []);
      if (coordinatorsResult.ok) setCoordinators(coordinatorsResult.data.coordinators ?? []);
      setLoading(false);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [activatorsResult, coordinatorsResult] = await Promise.all([adminGetActivators(token!), adminGetCoordinators(token!)]);
      if (cancelled) return;
      if ((!activatorsResult.ok && "status" in activatorsResult && activatorsResult.status === 401) || (!coordinatorsResult.ok && "status" in coordinatorsResult && coordinatorsResult.status === 401)) {
        await logout();
        return;
      }
      if (activatorsResult.ok) setActivators(activatorsResult.data.activators ?? []);
      if (coordinatorsResult.ok) setCoordinators(coordinatorsResult.data.coordinators ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const coordinatorOptions = coordinators.map((c) => ({ label: c.name, value: String(c.id) }));

  async function submitCreate() {
    if (!createDraft.code.trim() || !createDraft.name.trim() || !createDraft.phone.trim() || createDraft.pin.length < 4) {
      setCreateError("Code, name, phone, and a 4+ digit PIN are required");
      return;
    }
    setCreateError("");
    setCreating(true);
    const result = await adminCreateActivator(token!, {
      code: createDraft.code.trim(),
      name: createDraft.name.trim(),
      phone: createDraft.phone.trim(),
      pin: createDraft.pin,
      territory: createDraft.territory.trim() || undefined,
      mpesaNumber: createDraft.mpesaNumber.trim() || undefined,
      commissionRate: createDraft.commissionRate ? Number(createDraft.commissionRate) : undefined,
      coordinatorId: createDraft.coordinatorId ? Number(createDraft.coordinatorId) : undefined,
    });
    setCreating(false);

    if (!result.ok || !result.data?.success) {
      setCreateError(result.data?.message || "Could not create activator — check your connection");
      return;
    }
    setCreateDraft(EMPTY_DRAFT);
    setShowCreate(false);
    await load();
  }

  async function toggleStatus(a: Activator) {
    await adminUpdateActivator(token!, a.id, { status: a.status === "active" ? "suspended" : "active" });
    await load();
  }

  function startEdit(a: Activator) {
    setEditingId(a.id);
    setEditError("");
    setEditDraft({
      name: a.name,
      territory: a.territory ?? "",
      mpesaNumber: a.mpesa_number ?? "",
      commissionRate: String(a.commission_rate ?? ""),
      coordinatorId: a.coordinator_id ? String(a.coordinator_id) : "",
      pin: "",
    });
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
    const result = await adminUpdateActivator(token!, editingId, {
      name: editDraft.name.trim(),
      territory: editDraft.territory.trim() || null,
      mpesaNumber: editDraft.mpesaNumber.trim() || null,
      commissionRate: editDraft.commissionRate ? Number(editDraft.commissionRate) : undefined,
      coordinatorId: editDraft.coordinatorId ? Number(editDraft.coordinatorId) : null,
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

  const editingActivator = activators.find((a) => a.id === editingId) ?? null;

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
          <Text className="font-bold text-sm text-white">Add activator</Text>
        </Pressable>

        <Text className="text-xs font-sans-semibold px-1" style={{ color: "#3C6A4A" }}>
          {activators.length} activators
        </Text>

        {activators.map((a) => (
          <View key={a.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", opacity: a.status === "active" ? 1 : 0.5 }}>
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                <Zap size={16} color="#C45C38" />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                    {a.name}
                  </Text>
                  <Text className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ color: "#AECAAE", backgroundColor: "rgba(255,255,255,0.1)" }}>
                    {a.code}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Phone size={9} color="#AECAAE" />
                  <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                    {a.phone}
                  </Text>
                </View>
                {!!a.coordinator_name && (
                  <View className="flex-row items-center gap-1">
                    <Users size={9} color="#AECAAE" />
                    <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                      Reports to {a.coordinator_name}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center gap-1">
                  {!!a.territory && (
                    <>
                      <MapPin size={9} color="#AECAAE" />
                      <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                        {a.territory} ·{" "}
                      </Text>
                    </>
                  )}
                  <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                    {a.commission_rate}% commission
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <TrendingUp size={9} color="#C45C38" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C45C38" }}>
                    {a.paid_sessions} sessions · KES {Number(a.commission_kes).toLocaleString()} earned
                  </Text>
                </View>
              </View>
              <View className="items-end" style={{ gap: 6 }}>
                <Pressable onPress={() => startEdit(a)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                  <Edit3 size={10} color="#C4DAC0" />
                  <Text className="text-[10px] font-bold" style={{ color: "#C4DAC0" }}>
                    Edit
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleStatus(a)}
                  className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                  style={{ backgroundColor: a.status === "active" ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)" }}
                >
                  {a.status === "active" ? <Pause size={10} color="#4E8050" /> : <Play size={10} color="#B85038" />}
                  <Text className="text-[10px] font-bold" style={{ color: a.status === "active" ? "#4E8050" : "#B85038" }}>
                    {a.status === "active" ? "Active" : "Off"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <AdminModal visible={showCreate} title="Add activator" onClose={() => setShowCreate(false)}>
        <View className="flex-row" style={{ gap: 12 }}>
          <AdminTextField label="Code" value={createDraft.code} onChangeText={(t) => setCreateDraft((d) => ({ ...d, code: t.toUpperCase() }))} placeholder="e.g. NBI01" />
          <AdminTextField label="Name" value={createDraft.name} onChangeText={(t) => setCreateDraft((d) => ({ ...d, name: t }))} />
        </View>
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
        <View className="flex-row" style={{ gap: 12 }}>
          <AdminTextField label="M-PESA number" value={createDraft.mpesaNumber} onChangeText={(t) => setCreateDraft((d) => ({ ...d, mpesaNumber: t }))} placeholder="254700000000" keyboardType="phone-pad" />
          <AdminTextField
            label="Commission %"
            value={createDraft.commissionRate}
            onChangeText={(t) => setCreateDraft((d) => ({ ...d, commissionRate: t.replace(/[^0-9.]/g, "") }))}
            placeholder="e.g. 20"
            keyboardType="decimal-pad"
          />
        </View>
        <AdminSelectField label="Reports to coordinator" value={createDraft.coordinatorId} options={coordinatorOptions} onChange={(v) => setCreateDraft((d) => ({ ...d, coordinatorId: v }))} />
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
          <Text className="font-bold text-sm text-white">{creating ? "Saving…" : "Create activator"}</Text>
        </Pressable>
      </AdminModal>

      <AdminModal visible={!!editingId && !!editDraft} title="Edit activator" onClose={cancelEdit}>
        {editDraft && (
          <>
            {!!editingActivator && (
              <View className="flex-row items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
                <Phone size={12} color="#96B496" />
                <Text className="text-xs" style={{ color: "#C4DAC0" }}>
                  Login phone: <Text style={{ color: "#E8D4B0", fontWeight: "700" }}>{editingActivator.phone}</Text>{" "}
                  <Text style={{ color: "#96B496" }}>(not editable here)</Text>
                </Text>
              </View>
            )}
            <AdminTextField label="Name" value={editDraft.name} onChangeText={(t) => setEditDraft((d) => (d ? { ...d, name: t } : d))} />
            <AdminTextField label="Territory" value={editDraft.territory} onChangeText={(t) => setEditDraft((d) => (d ? { ...d, territory: t } : d))} placeholder="e.g. Nairobi Central" />
            <View className="flex-row" style={{ gap: 12 }}>
              <AdminTextField label="M-PESA number" value={editDraft.mpesaNumber} onChangeText={(t) => setEditDraft((d) => (d ? { ...d, mpesaNumber: t } : d))} keyboardType="phone-pad" />
              <AdminTextField
                label="Commission %"
                value={editDraft.commissionRate}
                onChangeText={(t) => setEditDraft((d) => (d ? { ...d, commissionRate: t.replace(/[^0-9.]/g, "") } : d))}
                keyboardType="decimal-pad"
              />
            </View>
            <AdminSelectField label="Reports to coordinator" value={editDraft.coordinatorId} options={coordinatorOptions} onChange={(v) => setEditDraft((d) => (d ? { ...d, coordinatorId: v } : d))} />
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
