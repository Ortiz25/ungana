// Ported from AdminDashboardScreen.svelte's 'settings' tab: platform
// tunables (everyone) + Admin accounts management (super_admin only — the
// real enforcement is server-side requireSuperAdmin on every /admin/admins
// route; isSuperAdmin here purely hides a control that would just 403).
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Zap, Percent, Trash2, Shield, Crown, Plus, Edit3, Eye, EyeOff } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import { adminGetSettings, adminUpdateSettings, adminGetAdmins, adminCreateAdmin, adminUpdateAdmin, adminDeleteAdmin, type AdminAccount } from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";
import ArmedDeleteButton from "@/components/admin/ArmedDeleteButton";

function Pill({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable onPress={onPress} className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: active ? "#C45C38" : "rgba(255,255,255,0.1)" }}>
      {icon}
      <Text className="text-[11px] font-sans-semibold" style={{ color: active ? "#fff" : "#C4DAC0" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { token, admin, isSuperAdmin, logout } = useAdminAuth();
  const [loading, setLoading] = useState(true);

  const [earnConnectThresholdMinutes, setEarnConnectThresholdMinutes] = useState("30");
  const [defaultActivatorCommissionPct, setDefaultActivatorCommissionPct] = useState("20");
  const [notificationRetentionDays, setNotificationRetentionDays] = useState("30");
  const [settingsError, setSettingsError] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadAdmins = useCallback(async () => {
    if (!isSuperAdmin) return;
    const result = await adminGetAdmins(token!);
    if (result.ok) setAdmins(result.data.admins ?? []);
  }, [token, isSuperAdmin]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const settingsResult = await adminGetSettings(token!);
    if (!settingsResult.ok && "status" in settingsResult && settingsResult.status === 401) {
      await logout();
      return;
    }
    if (settingsResult.ok && settingsResult.data.settings) {
      setEarnConnectThresholdMinutes(String(Math.round(settingsResult.data.settings.earnConnectThresholdSecs / 60)));
      setDefaultActivatorCommissionPct(String(Math.round(settingsResult.data.settings.defaultActivatorCommissionRate * 100)));
      setNotificationRetentionDays(String(settingsResult.data.settings.notificationRetentionDays));
    }
    await loadAdmins();
    setRefreshing(false);
  }, [token, logout, loadAdmins]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const settingsResult = await adminGetSettings(token!);
      if (cancelled) return;
      if (!settingsResult.ok && "status" in settingsResult && settingsResult.status === 401) {
        await logout();
        return;
      }
      if (settingsResult.ok && settingsResult.data.settings) {
        setEarnConnectThresholdMinutes(String(Math.round(settingsResult.data.settings.earnConnectThresholdSecs / 60)));
        setDefaultActivatorCommissionPct(String(Math.round(settingsResult.data.settings.defaultActivatorCommissionRate * 100)));
        setNotificationRetentionDays(String(settingsResult.data.settings.notificationRetentionDays));
      }
      if (isSuperAdmin) {
        const adminsResult = await adminGetAdmins(token!);
        if (!cancelled && adminsResult.ok) setAdmins(adminsResult.data.admins ?? []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSettings() {
    if (!(Number(earnConnectThresholdMinutes) >= 0)) {
      setSettingsError("Enter a non-negative number of minutes");
      return;
    }
    if (!(Number(defaultActivatorCommissionPct) >= 0 && Number(defaultActivatorCommissionPct) <= 100)) {
      setSettingsError("Commission % must be between 0 and 100");
      return;
    }
    if (!(Number(notificationRetentionDays) >= 0)) {
      setSettingsError("Enter a non-negative number of days (0 = keep forever)");
      return;
    }
    setSettingsError("");
    setSettingsSaving(true);
    const result = await adminUpdateSettings(token!, {
      earnConnectThresholdMinutes: Number(earnConnectThresholdMinutes),
      defaultActivatorCommissionPct: Number(defaultActivatorCommissionPct),
      notificationRetentionDays: Number(notificationRetentionDays),
    });
    setSettingsSaving(false);

    if (!result.ok || !result.data?.success) {
      setSettingsError(result.data?.message || "Could not save — check your connection");
      return;
    }
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  }

  // ── Admin accounts form ────────────────────────────────────────────────
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<number | null>(null);
  const [adminDraft, setAdminDraft] = useState({ username: "", password: "", passwordConfirm: "", role: "admin" as "admin" | "super_admin" });
  const [adminFormError, setAdminFormError] = useState("");
  const [adminSaving, setAdminSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [adminDeleteError, setAdminDeleteError] = useState("");

  function openAdminForm() {
    setEditingAdminId(null);
    setAdminDraft({ username: "", password: "", passwordConfirm: "", role: "admin" });
    setAdminFormError("");
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setShowAdminForm(true);
  }

  function startEditAdmin(a: AdminAccount) {
    setEditingAdminId(a.id);
    setAdminFormError("");
    setAdminDraft({ username: a.username, password: "", passwordConfirm: "", role: a.role });
    setShowPassword(false);
    setShowPasswordConfirm(false);
    setShowAdminForm(true);
  }

  function closeAdminForm() {
    setShowAdminForm(false);
    setEditingAdminId(null);
  }

  async function submitAdmin() {
    if (!editingAdminId && (!adminDraft.username.trim() || !adminDraft.password)) {
      setAdminFormError("Username and password are required");
      return;
    }
    if (adminDraft.password && adminDraft.password.length < 8) {
      setAdminFormError("Password must be at least 8 characters");
      return;
    }
    if (adminDraft.password && adminDraft.password !== adminDraft.passwordConfirm) {
      setAdminFormError("Passwords do not match");
      return;
    }
    setAdminFormError("");
    setAdminSaving(true);
    const result = editingAdminId
      ? await adminUpdateAdmin(token!, editingAdminId, { role: adminDraft.role, ...(adminDraft.password ? { password: adminDraft.password } : {}) })
      : await adminCreateAdmin(token!, { username: adminDraft.username.trim(), password: adminDraft.password, role: adminDraft.role });
    setAdminSaving(false);

    if (!result.ok || !result.data?.success) {
      setAdminFormError(result.data?.message || `Could not ${editingAdminId ? "save" : "create"} admin — check your connection`);
      return;
    }
    closeAdminForm();
    await loadAdmins();
  }

  async function removeAdmin(a: AdminAccount) {
    const result = await adminDeleteAdmin(token!, a.id);
    if (!result.ok || !result.data?.success) {
      setAdminDeleteError(result.data?.message || `Could not delete "${a.username}" — check your connection`);
      return;
    }
    setAdminDeleteError("");
    await loadAdmins();
  }

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: "#1D3C2A" }}>
        <ActivityIndicator color="#c29d53" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: "#1D3C2A" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#c29d53" />}>
        <View className="rounded-3xl p-5" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(196,92,56,0.15)", gap: 12 }}>
          <View className="flex-row items-center gap-2">
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
              <Zap size={16} color="#C45C38" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                Earn Free Access — Connect threshold
              </Text>
              <Text className="text-[10px]" style={{ color: "#96B496" }}>
                Minutes of earned content required before &quot;Connect Now&quot; unlocks
              </Text>
            </View>
          </View>
          <AdminTextField label="Minutes required" value={earnConnectThresholdMinutes} onChangeText={(t) => setEarnConnectThresholdMinutes(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />

          <View className="flex-row items-center gap-2" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 16 }}>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(204,136,48,0.28)" }}>
              <Percent size={16} color="#CC8830" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                Default activator commission
              </Text>
              <Text className="text-[10px]" style={{ color: "#96B496" }}>
                Pre-fills new activators&apos; commission rate — existing ones are unaffected
              </Text>
            </View>
          </View>
          <AdminTextField label="Commission %" value={defaultActivatorCommissionPct} onChangeText={(t) => setDefaultActivatorCommissionPct(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />

          <View className="flex-row items-center gap-2" style={{ borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.1)", paddingTop: 16 }}>
            <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(78,128,80,0.28)" }}>
              <Trash2 size={16} color="#4E8050" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                Notification cleanup
              </Text>
              <Text className="text-[10px]" style={{ color: "#96B496" }}>
                Read notifications older than this are auto-deleted. 0 = keep forever.
              </Text>
            </View>
          </View>
          <AdminTextField label="Days (e.g. 7 for a week, 30 for a month)" value={notificationRetentionDays} onChangeText={(t) => setNotificationRetentionDays(t.replace(/[^0-9]/g, ""))} keyboardType="number-pad" />

          {!!settingsError && (
            <Text className="text-xs" style={{ color: "#E08A6A" }}>
              {settingsError}
            </Text>
          )}
          {settingsSaved && (
            <Text className="text-xs" style={{ color: "#4E8050" }}>
              Saved.
            </Text>
          )}
          <Pressable onPress={saveSettings} disabled={settingsSaving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: settingsSaving ? 0.7 : 1 }}>
            <Text className="font-bold text-sm text-white">{settingsSaving ? "Saving…" : "Save"}</Text>
          </Pressable>
        </View>

        {isSuperAdmin && (
          <View className="rounded-3xl p-5" style={{ backgroundColor: "#2E5A3E", borderWidth: 1, borderColor: "rgba(196,92,56,0.15)", gap: 10 }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2 flex-1">
                <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                  <Shield size={16} color="#C45C38" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold" style={{ color: "#E8D4B0" }}>
                    Admin accounts
                  </Text>
                  <Text className="text-[10px]" style={{ color: "#96B496" }}>
                    Create, re-role, and remove other admin accounts
                  </Text>
                </View>
              </View>
              <Pressable onPress={openAdminForm} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
                <Plus size={12} color="#fff" />
                <Text className="text-[11px] font-bold text-white">Add admin</Text>
              </Pressable>
            </View>

            {!!adminDeleteError && (
              <Text className="text-xs" style={{ color: "#E08A6A" }}>
                {adminDeleteError}
              </Text>
            )}

            {admins.map((a) => (
              <View key={a.id} className="rounded-2xl px-4 py-3 flex-row items-center gap-3" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
                <View className="w-8 h-8 rounded-xl items-center justify-center" style={{ backgroundColor: a.role === "super_admin" ? "rgba(204,136,48,0.28)" : "rgba(255,255,255,0.1)" }}>
                  {a.role === "super_admin" ? <Crown size={14} color="#CC8830" /> : <Shield size={14} color="#96B496" />}
                </View>
                <View className="flex-1 min-w-0">
                  <View className="flex-row items-center gap-1.5">
                    <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                      {a.username}
                    </Text>
                    {a.id === admin?.id && (
                      <Text className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#96B496" }}>
                        You
                      </Text>
                    )}
                  </View>
                  <Text className="text-[10px]" style={{ color: a.role === "super_admin" ? "#CC8830" : "#96B496" }}>
                    {a.role === "super_admin" ? "Super admin" : "Admin"}
                  </Text>
                </View>
                <View className="flex-row items-center" style={{ gap: 8 }}>
                  <Pressable onPress={() => startEditAdmin(a)} className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <Edit3 size={11} color="#E8D4B0" />
                    <Text className="text-[11px] font-bold" style={{ color: "#E8D4B0" }}>
                      Edit
                    </Text>
                  </Pressable>
                  {a.id !== admin?.id && <ArmedDeleteButton onConfirm={() => removeAdmin(a)} confirmLabel="Confirm" />}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <AdminModal visible={showAdminForm} title={editingAdminId ? "Edit admin" : "Add admin"} onClose={closeAdminForm}>
        <AdminTextField label="Username" value={adminDraft.username} onChangeText={(t) => setAdminDraft((d) => ({ ...d, username: t }))} placeholder="e.g. jane" editable={!editingAdminId} />

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            {editingAdminId ? "New password (optional)" : "Password"}
          </Text>
          <View className="flex-row items-center rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
            <AdminTextFieldInner value={adminDraft.password} onChangeText={(t) => setAdminDraft((d) => ({ ...d, password: t }))} secureTextEntry={!showPassword} placeholder={editingAdminId ? "Leave blank to keep current" : "At least 8 characters"} />
            <Pressable onPress={() => setShowPassword((s) => !s)} className="px-3">
              {showPassword ? <EyeOff size={14} color="#AECAAE" /> : <Eye size={14} color="#AECAAE" />}
            </Pressable>
          </View>
        </View>

        {!!adminDraft.password && (
          <View>
            <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
              Confirm password
            </Text>
            <View className="flex-row items-center rounded-xl overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)" }}>
              <AdminTextFieldInner value={adminDraft.passwordConfirm} onChangeText={(t) => setAdminDraft((d) => ({ ...d, passwordConfirm: t }))} secureTextEntry={!showPasswordConfirm} placeholder="Re-enter the password above" />
              <Pressable onPress={() => setShowPasswordConfirm((s) => !s)} className="px-3">
                {showPasswordConfirm ? <EyeOff size={14} color="#AECAAE" /> : <Eye size={14} color="#AECAAE" />}
              </Pressable>
            </View>
          </View>
        )}

        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Role
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            <Pill label="Admin" active={adminDraft.role === "admin"} icon={<Shield size={12} color={adminDraft.role === "admin" ? "#fff" : "#C4DAC0"} />} onPress={() => setAdminDraft((d) => ({ ...d, role: "admin" }))} />
            <Pill label="Super admin" active={adminDraft.role === "super_admin"} icon={<Crown size={12} color={adminDraft.role === "super_admin" ? "#fff" : "#C4DAC0"} />} onPress={() => setAdminDraft((d) => ({ ...d, role: "super_admin" }))} />
          </View>
          <Text className="text-[10px] mt-1.5" style={{ color: "#96B496" }}>
            Super admins can manage other admin accounts and every privileged setting; a plain admin gets everything else.
          </Text>
        </View>

        {!!adminFormError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {adminFormError}
          </Text>
        )}
        <Pressable onPress={submitAdmin} disabled={adminSaving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: adminSaving ? 0.7 : 1 }}>
          <Text className="font-bold text-sm text-white">{adminSaving ? "Saving…" : editingAdminId ? "Save changes" : "Create admin"}</Text>
        </Pressable>
      </AdminModal>
    </View>
  );
}

// Bare TextInput matching AdminTextField's visual style, without its own
// label/wrapper — needed here since the password/confirm fields wrap a
// show/hide toggle button inside the same bordered box as the input, which
// AdminTextField's self-contained layout doesn't support.
function AdminTextFieldInner({ value, onChangeText, secureTextEntry, placeholder }: { value: string; onChangeText: (t: string) => void; secureTextEntry: boolean; placeholder: string }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#4A6842"
      secureTextEntry={secureTextEntry}
      autoCapitalize="none"
      className="flex-1 px-3 py-2.5 text-sm"
      style={{ color: "#E8D4B0" }}
    />
  );
}
