// Ported from AdminDashboardScreen.svelte's 'sites' tab — Sites and their
// Packages are one combined screen here too (the source renders Packages as
// a second list beneath Sites within the same tab, not a separate one), so
// this stays a single drawer entry rather than two.
import { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus, Radio, GraduationCap, Users, Bitcoin, Edit3, Pause, Play, Star, Bot } from "lucide-react-native";
import { useAdminAuth } from "@/flow/AdminAuthContext";
import {
  adminGetSites,
  adminGetUnifiSiteOptions,
  adminCreateSite,
  adminUpdateSite,
  adminDeleteSite,
  adminGetPackages,
  adminCreatePackage,
  adminUpdatePackage,
  adminSetPackageFeatured,
  adminDeletePackage,
  type Site,
  type Package,
} from "@/lib/adminApi";
import AdminModal from "@/components/admin/AdminModal";
import AdminTextField from "@/components/admin/AdminTextField";
import AdminSelectField from "@/components/admin/AdminSelectField";
import ArmedDeleteButton from "@/components/admin/ArmedDeleteButton";

const SITE_MODES: { id: Site["mode"]; label: string }[] = [
  { id: "both", label: "Pay + Earn" },
  { id: "pay_only", label: "Pay only" },
  { id: "earn_only", label: "Earn only" },
];
const SITE_VERTICALS: { id: Site["vertical"]; label: string }[] = [
  { id: "general", label: "General" },
  { id: "institution", label: "Institution" },
  { id: "community", label: "Community" },
];
function availableSiteModes(vertical: Site["vertical"]) {
  return vertical === "institution" ? SITE_MODES.filter((m) => m.id !== "pay_only") : SITE_MODES;
}

const EMPTY_SITE_DRAFT = { id: "", name: "", mode: "both" as Site["mode"], btcEnabled: true, vertical: "general" as Site["vertical"], assistantEnabled: false };

const PACKAGE_BADGE_PRESETS = ["Best Value", "Test", "Popular", "Limited"];
const EMPTY_PACKAGE_DRAFT = { id: "", label: "", priceKes: "", durationSecs: "", badge: "", isActive: true, siteIds: [] as string[] };

function Pill({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-1 px-3 py-1.5 rounded-full"
      style={{ backgroundColor: active ? "#C45C38" : "rgba(255,255,255,0.1)" }}
    >
      {icon}
      <Text className="text-[11px] font-sans-semibold" style={{ color: active ? "#fff" : "#C4DAC0" }}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function SitesScreen() {
  const insets = useSafeAreaInsets();
  const { token, logout } = useAdminAuth();
  const [sites, setSites] = useState<Site[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      const [sitesResult, packagesResult] = await Promise.all([adminGetSites(token!), adminGetPackages(token!)]);
      if ((!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401) || (!packagesResult.ok && "status" in packagesResult && packagesResult.status === 401)) {
        await logout();
        return;
      }
      if (sitesResult.ok) setSites(sitesResult.data.sites ?? []);
      if (packagesResult.ok) setPackages(packagesResult.data.packages ?? []);
      setRefreshing(false);
    },
    [token, logout]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [sitesResult, packagesResult] = await Promise.all([adminGetSites(token!), adminGetPackages(token!)]);
      if (cancelled) return;
      if ((!sitesResult.ok && "status" in sitesResult && sitesResult.status === 401) || (!packagesResult.ok && "status" in packagesResult && packagesResult.status === 401)) {
        await logout();
        return;
      }
      if (sitesResult.ok) setSites(sitesResult.data.sites ?? []);
      if (packagesResult.ok) setPackages(packagesResult.data.packages ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Site form ──────────────────────────────────────────────────────────
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteDraft, setSiteDraft] = useState(EMPTY_SITE_DRAFT);
  const [siteFormError, setSiteFormError] = useState("");
  const [siteSaving, setSiteSaving] = useState(false);
  const [unifiOptions, setUnifiOptions] = useState<{ id: string; name: string }[]>([]);
  const [unifiOptionsLoading, setUnifiOptionsLoading] = useState(false);
  const [statusTogglingSiteId, setStatusTogglingSiteId] = useState<string | null>(null);
  const [siteDeleteError, setSiteDeleteError] = useState("");

  async function openSiteForm() {
    setEditingSiteId(null);
    setSiteDraft(EMPTY_SITE_DRAFT);
    setSiteFormError("");
    setShowSiteForm(true);
    if (unifiOptions.length === 0) {
      setUnifiOptionsLoading(true);
      const result = await adminGetUnifiSiteOptions(token!);
      setUnifiOptionsLoading(false);
      if (result.ok) setUnifiOptions(result.data.options ?? []);
    }
  }

  function startEditSite(s: Site) {
    setEditingSiteId(s.id);
    setSiteFormError("");
    setSiteDraft({ id: s.id, name: s.name, mode: s.mode, btcEnabled: s.btc_enabled, vertical: s.vertical, assistantEnabled: s.assistant_enabled });
    setShowSiteForm(true);
  }

  function closeSiteForm() {
    setShowSiteForm(false);
    setEditingSiteId(null);
  }

  async function submitSite() {
    if (!siteDraft.id.trim() || !siteDraft.name.trim()) {
      setSiteFormError("Site id and name are required");
      return;
    }
    setSiteFormError("");
    setSiteSaving(true);
    const result = editingSiteId
      ? await adminUpdateSite(token!, editingSiteId, { name: siteDraft.name.trim(), mode: siteDraft.mode, btcEnabled: siteDraft.btcEnabled, vertical: siteDraft.vertical, assistantEnabled: siteDraft.assistantEnabled })
      : await adminCreateSite(token!, { id: siteDraft.id.trim(), name: siteDraft.name.trim(), mode: siteDraft.mode, btcEnabled: siteDraft.btcEnabled, vertical: siteDraft.vertical });
    setSiteSaving(false);

    if (!result.ok || !result.data?.success) {
      setSiteFormError(result.data?.message || `Could not ${editingSiteId ? "save" : "create"} site — check your connection`);
      return;
    }
    closeSiteForm();
    await load();
  }

  async function toggleSiteStatus(s: Site) {
    setStatusTogglingSiteId(s.id);
    await adminUpdateSite(token!, s.id, { status: s.status === "active" ? "suspended" : "active" });
    setStatusTogglingSiteId(null);
    await load();
  }

  async function removeSite(s: Site) {
    const result = await adminDeleteSite(token!, s.id);
    if (!result.ok || !result.data?.success) {
      setSiteDeleteError(result.data?.message || `Could not delete "${s.name}" — check your connection`);
      return;
    }
    setSiteDeleteError("");
    await load();
  }

  // ── Package form ───────────────────────────────────────────────────────
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [packageDraft, setPackageDraft] = useState(EMPTY_PACKAGE_DRAFT);
  const [packageFormError, setPackageFormError] = useState("");
  const [packageSaving, setPackageSaving] = useState(false);
  const [statusTogglingPackageId, setStatusTogglingPackageId] = useState<string | null>(null);
  const [featuringPackageId, setFeaturingPackageId] = useState<string | null>(null);
  const [packageDeleteError, setPackageDeleteError] = useState("");

  function openPackageForm() {
    setEditingPackageId(null);
    setPackageDraft(EMPTY_PACKAGE_DRAFT);
    setPackageFormError("");
    setShowPackageForm(true);
  }

  function startEditPackage(pkg: Package) {
    setEditingPackageId(pkg.id);
    setPackageFormError("");
    setPackageDraft({
      id: pkg.id,
      label: pkg.label,
      priceKes: String(pkg.price_kes),
      durationSecs: String(Math.round(pkg.duration_secs / 60)),
      badge: pkg.badge ?? "",
      isActive: pkg.is_active,
      siteIds: [...(pkg.site_ids ?? [])],
    });
    setShowPackageForm(true);
  }

  function closePackageForm() {
    setShowPackageForm(false);
    setEditingPackageId(null);
  }

  function toggleDraftPackageSite(siteId: string) {
    setPackageDraft((d) => ({ ...d, siteIds: d.siteIds.includes(siteId) ? d.siteIds.filter((id) => id !== siteId) : [...d.siteIds, siteId] }));
  }

  async function submitPackage() {
    if ((!editingPackageId && !packageDraft.id.trim()) || !packageDraft.label.trim() || !packageDraft.priceKes || !packageDraft.durationSecs) {
      setPackageFormError(editingPackageId ? "Label, price and duration are required" : "Id, label, price and duration are required");
      return;
    }
    setPackageFormError("");
    setPackageSaving(true);
    const body = {
      label: packageDraft.label.trim(),
      priceKes: Number(packageDraft.priceKes),
      durationSecs: Math.round(Number(packageDraft.durationSecs) * 60),
      badge: packageDraft.badge.trim() || null,
      isActive: packageDraft.isActive,
      siteIds: packageDraft.siteIds,
    };
    const result = editingPackageId ? await adminUpdatePackage(token!, editingPackageId, body) : await adminCreatePackage(token!, { ...body, id: packageDraft.id.trim() });
    setPackageSaving(false);

    if (!result.ok || !result.data?.success) {
      setPackageFormError(result.data?.message || `Could not ${editingPackageId ? "save" : "create"} package — check your connection`);
      return;
    }
    closePackageForm();
    await load();
  }

  async function togglePackageActive(pkg: Package) {
    setStatusTogglingPackageId(pkg.id);
    await adminUpdatePackage(token!, pkg.id, { isActive: !pkg.is_active });
    setStatusTogglingPackageId(null);
    await load();
  }

  async function toggleFeaturedPackage(pkg: Package) {
    setFeaturingPackageId(pkg.id);
    await adminSetPackageFeatured(token!, pkg.id, !pkg.is_featured);
    setFeaturingPackageId(null);
    await load();
  }

  async function removePackage(pkg: Package) {
    const result = await adminDeletePackage(token!, pkg.id);
    if (!result.ok || !result.data?.success) {
      setPackageDeleteError(result.data?.message || `Could not delete "${pkg.label}" — check your connection`);
      return;
    }
    setPackageDeleteError("");
    await load();
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
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor="#c29d53" />}>
        <Pressable onPress={openSiteForm} className="py-3 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95" style={{ backgroundColor: "#C45C38" }}>
          <Plus size={15} color="#fff" />
          <Text className="font-bold text-sm text-white">Add site</Text>
        </Pressable>

        <Text className="text-xs font-sans-semibold px-1" style={{ color: "#3C6A4A" }}>
          {sites.length} sites
        </Text>
        {!!siteDeleteError && (
          <Text className="text-xs px-1" style={{ color: "#E08A6A" }}>
            {siteDeleteError}
          </Text>
        )}

        {sites.map((s) => (
          <View key={s.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#2E5A3E", opacity: s.status === "active" ? 1 : 0.5, gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}>
            <View className="flex-row items-center gap-3">
              <View className="w-9 h-9 rounded-xl items-center justify-center" style={{ backgroundColor: "rgba(196,92,56,0.28)" }}>
                <Radio size={16} color="#C45C38" />
              </View>
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                    {s.name}
                  </Text>
                  {s.vertical === "institution" && <GraduationCap size={11} color="#CC8830" />}
                  {s.vertical === "community" && <Users size={11} color="#CC8830" />}
                </View>
                <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                  id: {s.id}
                </Text>
              </View>
              <Pressable
                onPress={() => toggleSiteStatus(s)}
                disabled={statusTogglingSiteId === s.id}
                className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                style={{ backgroundColor: s.status === "active" ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)", opacity: statusTogglingSiteId === s.id ? 0.6 : 1 }}
              >
                {statusTogglingSiteId === s.id ? (
                  <ActivityIndicator size="small" color={s.status === "active" ? "#4E8050" : "#B85038"} />
                ) : s.status === "active" ? (
                  <Pause size={10} color="#4E8050" />
                ) : (
                  <Play size={10} color="#B85038" />
                )}
                <Text className="text-[10px] font-bold" style={{ color: s.status === "active" ? "#4E8050" : "#B85038" }}>
                  {s.status === "active" ? "Active" : "Off"}
                </Text>
              </Pressable>
            </View>

            <View className="flex-row items-center gap-1.5 flex-wrap">
              <Text className="text-[10px] font-sans-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#C4DAC0" }}>
                {availableSiteModes(s.vertical).find((m) => m.id === s.mode)?.label ?? s.mode}
              </Text>
              <Text className="text-[10px] font-sans-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#C4DAC0" }}>
                {SITE_VERTICALS.find((v) => v.id === s.vertical)?.label ?? s.vertical}
              </Text>
              <Text className="text-[10px] font-sans-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#C4DAC0" }}>
                {s.btc_enabled ? "BTC on" : "BTC off"}
              </Text>
              {s.assistant_enabled && (
                <View className="flex-row items-center gap-1 px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(196,92,56,0.18)" }}>
                  <Bot size={10} color="#C45C38" />
                  <Text className="text-[10px] font-sans-semibold" style={{ color: "#C45C38" }}>
                    Assistant on
                  </Text>
                </View>
              )}
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => startEditSite(s)} className="flex-1 flex-row items-center justify-center gap-1.5 px-2.5 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                <Edit3 size={11} color="#E8D4B0" />
                <Text className="text-[11px] font-bold" style={{ color: "#E8D4B0" }}>
                  Edit
                </Text>
              </Pressable>
              <ArmedDeleteButton onConfirm={() => removeSite(s)} />
            </View>
          </View>
        ))}

        <View className="flex-row items-center justify-between px-1 mt-2">
          <Text className="text-xs font-sans-semibold" style={{ color: "#3C6A4A" }}>
            Packages
          </Text>
          <Pressable onPress={openPackageForm} className="flex-row items-center gap-1 px-3 py-1.5 rounded-full" style={{ backgroundColor: "#C45C38" }}>
            <Plus size={12} color="#fff" />
            <Text className="text-[11px] font-bold text-white">Add package</Text>
          </Pressable>
        </View>
        {!!packageDeleteError && (
          <Text className="text-xs px-1" style={{ color: "#E08A6A" }}>
            {packageDeleteError}
          </Text>
        )}

        {packages.map((pkg) => (
          <View
            key={pkg.id}
            className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: "#2E5A3E", opacity: pkg.is_active ? 1 : 0.5, borderWidth: 2, borderColor: pkg.is_featured ? "#CC8830" : "transparent", gap: 10, paddingHorizontal: 16, paddingVertical: 14 }}
          >
            <View className="flex-row items-center gap-3">
              <View className="flex-1 min-w-0">
                <View className="flex-row items-center gap-1.5">
                  <Text numberOfLines={1} className="text-sm font-sans-semibold" style={{ color: "#E8D4B0" }}>
                    {pkg.label}
                  </Text>
                  {!!pkg.badge && (
                    <Text className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#C45C38", color: "#fff" }}>
                      {pkg.badge}
                    </Text>
                  )}
                  {pkg.is_featured && <Star size={11} color="#CC8830" fill="#CC8830" />}
                </View>
                <Text className="text-[10px]" style={{ color: "#AECAAE" }}>
                  KES {Number(pkg.price_kes).toLocaleString()} · {Math.round(pkg.duration_secs / 60)} min
                </Text>
              </View>
              <Pressable
                onPress={() => togglePackageActive(pkg)}
                disabled={statusTogglingPackageId === pkg.id}
                className="flex-row items-center gap-1 px-2.5 py-1.5 rounded-full"
                style={{ backgroundColor: pkg.is_active ? "rgba(78,128,80,0.30)" : "rgba(192,97,74,0.20)", opacity: statusTogglingPackageId === pkg.id ? 0.6 : 1 }}
              >
                {statusTogglingPackageId === pkg.id ? (
                  <ActivityIndicator size="small" color={pkg.is_active ? "#4E8050" : "#B85038"} />
                ) : pkg.is_active ? (
                  <Pause size={10} color="#4E8050" />
                ) : (
                  <Play size={10} color="#B85038" />
                )}
                <Text className="text-[10px] font-bold" style={{ color: pkg.is_active ? "#4E8050" : "#B85038" }}>
                  {pkg.is_active ? "Active" : "Off"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => toggleFeaturedPackage(pkg)}
              disabled={featuringPackageId === pkg.id}
              className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full self-start"
              style={{ backgroundColor: pkg.is_featured ? "rgba(204,136,48,0.22)" : "rgba(255,255,255,0.1)", opacity: featuringPackageId === pkg.id ? 0.6 : 1 }}
            >
              {featuringPackageId === pkg.id ? (
                <ActivityIndicator size="small" color={pkg.is_featured ? "#CC8830" : "#96B496"} />
              ) : (
                <Star size={11} color={pkg.is_featured ? "#CC8830" : "#96B496"} fill={pkg.is_featured ? "#CC8830" : "none"} />
              )}
              <Text className="text-[11px] font-sans-semibold" style={{ color: pkg.is_featured ? "#CC8830" : "#96B496" }}>
                {featuringPackageId === pkg.id ? "Updating…" : pkg.is_featured ? "Featured plan" : "Set as featured"}
              </Text>
            </Pressable>

            <View className="flex-row items-start gap-1.5">
              <Text className="text-[10px] mt-1" style={{ color: "#96B496" }}>
                Sites
              </Text>
              <View className="flex-row items-center gap-1 flex-wrap flex-1">
                {(pkg.site_ids ?? []).length === 0 ? (
                  <Text className="text-[10px] font-sans-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#C4DAC0" }}>
                    All sites
                  </Text>
                ) : (
                  pkg.site_ids.map((siteId) => (
                    <Text key={siteId} className="text-[10px] font-sans-semibold px-2 py-1 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)", color: "#C4DAC0" }}>
                      {sites.find((s) => s.id === siteId)?.name ?? siteId}
                    </Text>
                  ))
                )}
              </View>
            </View>

            <View className="flex-row items-center gap-2">
              <Pressable onPress={() => startEditPackage(pkg)} className="flex-1 flex-row items-center justify-center gap-1.5 px-2.5 py-2 rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.12)" }}>
                <Edit3 size={11} color="#E8D4B0" />
                <Text className="text-[11px] font-bold" style={{ color: "#E8D4B0" }}>
                  Edit
                </Text>
              </Pressable>
              <ArmedDeleteButton onConfirm={() => removePackage(pkg)} />
            </View>
          </View>
        ))}
      </ScrollView>

      <AdminModal visible={showSiteForm} title={editingSiteId ? "Edit site" : "Add site"} onClose={closeSiteForm}>
        {!editingSiteId && (
          <>
            {unifiOptionsLoading ? (
              <View className="flex-row items-center gap-1.5">
                <ActivityIndicator size="small" color="#96B496" />
                <Text className="text-xs" style={{ color: "#96B496" }}>
                  Loading UniFi sites…
                </Text>
              </View>
            ) : (
              unifiOptions.length > 0 && (
                <AdminSelectField
                  label="UniFi site (optional — fills id/name)"
                  value=""
                  options={unifiOptions.map((o) => ({ label: o.name, value: o.id }))}
                  onChange={(v) => {
                    const opt = unifiOptions.find((o) => o.id === v);
                    if (opt) setSiteDraft((d) => ({ ...d, id: opt.id, name: opt.name }));
                  }}
                  placeholder="Choose or enter manually below"
                />
              )
            )}
          </>
        )}
        <View className="flex-row" style={{ gap: 12 }}>
          <AdminTextField label="Site id" value={siteDraft.id} onChangeText={(t) => setSiteDraft((d) => ({ ...d, id: t }))} placeholder="e.g. 99kv3joz" editable={!editingSiteId} />
          <AdminTextField label="Name" value={siteDraft.name} onChangeText={(t) => setSiteDraft((d) => ({ ...d, name: t }))} placeholder="e.g. Nairobi CBD Cafe" />
        </View>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Mode
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {availableSiteModes(siteDraft.vertical).map((m) => (
              <Pill key={m.id} label={m.label} active={siteDraft.mode === m.id} onPress={() => setSiteDraft((d) => ({ ...d, mode: m.id }))} />
            ))}
          </View>
        </View>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Type
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            {SITE_VERTICALS.map((v) => (
              <Pill
                key={v.id}
                label={v.label}
                active={siteDraft.vertical === v.id}
                icon={v.id === "institution" ? <GraduationCap size={12} color={siteDraft.vertical === v.id ? "#fff" : "#C4DAC0"} /> : v.id === "community" ? <Users size={12} color={siteDraft.vertical === v.id ? "#fff" : "#C4DAC0"} /> : undefined}
                onPress={() => setSiteDraft((d) => ({ ...d, vertical: v.id, mode: v.id === "institution" && d.mode === "pay_only" ? "both" : d.mode }))}
              />
            ))}
          </View>
        </View>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            BTC payments
          </Text>
          <Pill label={siteDraft.btcEnabled ? "Enabled" : "Disabled"} active={siteDraft.btcEnabled} icon={<Bitcoin size={12} color={siteDraft.btcEnabled ? "#fff" : "#C4DAC0"} />} onPress={() => setSiteDraft((d) => ({ ...d, btcEnabled: !d.btcEnabled }))} />
        </View>
        {!!editingSiteId && (
          <View>
            <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
              AI assistant
            </Text>
            <Pill
              label={siteDraft.assistantEnabled ? "Enabled" : "Disabled"}
              active={siteDraft.assistantEnabled}
              icon={<Bot size={12} color={siteDraft.assistantEnabled ? "#fff" : "#C4DAC0"} />}
              onPress={() => setSiteDraft((d) => ({ ...d, assistantEnabled: !d.assistantEnabled }))}
            />
            <Text className="text-[10px] mt-1" style={{ color: "#96B496" }}>
              Lets guests at this site chat with the in-app AI assistant.
            </Text>
          </View>
        )}
        {!!siteFormError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {siteFormError}
          </Text>
        )}
        <Pressable onPress={submitSite} disabled={siteSaving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: siteSaving ? 0.7 : 1 }}>
          <Text className="font-bold text-sm text-white">{siteSaving ? "Saving…" : editingSiteId ? "Save changes" : "Create site"}</Text>
        </Pressable>
      </AdminModal>

      <AdminModal visible={showPackageForm} title={editingPackageId ? "Edit package" : "Add package"} onClose={closePackageForm}>
        <AdminTextField label="Package id" value={packageDraft.id} onChangeText={(t) => setPackageDraft((d) => ({ ...d, id: t }))} placeholder="e.g. hourly" editable={!editingPackageId} />
        <AdminTextField label="Label" value={packageDraft.label} onChangeText={(t) => setPackageDraft((d) => ({ ...d, label: t }))} placeholder="e.g. 1 Hour Pass" />
        <View className="flex-row" style={{ gap: 12 }}>
          <AdminTextField label="Price (KES)" value={packageDraft.priceKes} onChangeText={(t) => setPackageDraft((d) => ({ ...d, priceKes: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" />
          <AdminTextField label="Duration (minutes)" value={packageDraft.durationSecs} onChangeText={(t) => setPackageDraft((d) => ({ ...d, durationSecs: t.replace(/[^0-9.]/g, "") }))} keyboardType="decimal-pad" />
        </View>
        <View>
          <AdminTextField label="Badge (optional)" value={packageDraft.badge} onChangeText={(t) => setPackageDraft((d) => ({ ...d, badge: t }))} placeholder="e.g. Best Value" />
          <View className="flex-row flex-wrap mt-1.5" style={{ gap: 6 }}>
            <Pill label="None" active={packageDraft.badge === ""} onPress={() => setPackageDraft((d) => ({ ...d, badge: "" }))} />
            {PACKAGE_BADGE_PRESETS.map((preset) => (
              <Pill key={preset} label={preset} active={packageDraft.badge === preset} onPress={() => setPackageDraft((d) => ({ ...d, badge: preset }))} />
            ))}
          </View>
        </View>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Status
          </Text>
          <Pill
            label={packageDraft.isActive ? "Active" : "Off"}
            active={packageDraft.isActive}
            icon={packageDraft.isActive ? <Pause size={11} color="#fff" /> : <Play size={11} color="#C4DAC0" />}
            onPress={() => setPackageDraft((d) => ({ ...d, isActive: !d.isActive }))}
          />
        </View>
        <View>
          <Text className="text-[10px] font-sans-semibold mb-1 uppercase" style={{ color: "#AECAAE", letterSpacing: 1 }}>
            Visible on sites
          </Text>
          <View className="flex-row flex-wrap" style={{ gap: 6 }}>
            <Pill label="All sites" active={packageDraft.siteIds.length === 0} onPress={() => setPackageDraft((d) => ({ ...d, siteIds: [] }))} />
            {sites.map((s) => (
              <Pill key={s.id} label={s.name} active={packageDraft.siteIds.includes(s.id)} onPress={() => toggleDraftPackageSite(s.id)} />
            ))}
          </View>
        </View>
        {!!packageFormError && (
          <Text className="text-xs" style={{ color: "#E08A6A" }}>
            {packageFormError}
          </Text>
        )}
        <Pressable onPress={submitPackage} disabled={packageSaving} className="w-full py-3 rounded-2xl items-center" style={{ backgroundColor: "#C45C38", opacity: packageSaving ? 0.7 : 1 }}>
          <Text className="font-bold text-sm text-white">{packageSaving ? "Saving…" : editingPackageId ? "Save changes" : "Create package"}</Text>
        </Pressable>
      </AdminModal>
    </View>
  );
}
