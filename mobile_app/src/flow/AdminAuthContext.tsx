// Admin auth state for the app/admin/* route subtree — scoped there (not
// the root layout) since it's only relevant inside the admin section, same
// convention as TimelineContext being scoped to app/timeline/*. Backed by
// expo-secure-store rather than AsyncStorage (used elsewhere in this app for
// the guest-flow's mac/site/username) because a staff JWT is meaningfully
// more sensitive than those.
//
// The backend issues a 12h JWT with no refresh endpoint (see
// backend/src/middleware/auth.js's signAdminToken) — there is deliberately
// no proactive expiry timer here, matching the web dashboard's own
// reactive-only handling: each admin screen's data load checks for a 401
// and calls logout() when it sees one.
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { AdminInfo } from "@/lib/adminApi";

const SESSION_KEY = "ungana_admin_session";

// expo-secure-store has no web implementation at all (not degraded, just
// absent — calling setItemAsync/deleteItemAsync throws "is not a function"),
// unlike AsyncStorage which works everywhere. Native keeps the Keychain/
// Keystore-backed store; web falls back to localStorage, which is the best
// this platform can offer for a JWT anyway (this app's web target is mainly
// for dev/preview convenience, not where staff are expected to sign in).
const sessionStore = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === "web") return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === "web") {
      if (typeof localStorage !== "undefined") localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

type StoredSession = { token: string; admin: AdminInfo };

export type AdminAuthContextValue = {
  // undefined = still restoring from SecureStore; null = restored, no session.
  token: string | null;
  admin: AdminInfo | null;
  isRestoring: boolean;
  isSuperAdmin: boolean;
  login: (token: string, admin: AdminInfo) => Promise<void>;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await sessionStore.get(SESSION_KEY).catch(() => null);
      if (cancelled) return;
      if (raw) {
        try {
          const stored: StoredSession = JSON.parse(raw);
          setToken(stored.token);
          setAdmin(stored.admin);
        } catch {
          // corrupt/unparseable — treat as no session rather than crash
        }
      }
      setIsRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Stable across renders (useCallback/useMemo below) — otherwise every
  // render of this provider handed consumers a brand-new context object and
  // brand-new login/logout function identities, which is exactly the kind
  // of unnecessary churn that can cascade into a render loop once something
  // downstream (a screen's data-loading useCallback, a nav header render
  // prop) depends on them.
  const login = useCallback(async (newToken: string, newAdmin: AdminInfo) => {
    setToken(newToken);
    setAdmin(newAdmin);
    await sessionStore.set(SESSION_KEY, JSON.stringify({ token: newToken, admin: newAdmin } satisfies StoredSession));
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setAdmin(null);
    await sessionStore.remove(SESSION_KEY);
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      token,
      admin,
      isRestoring,
      isSuperAdmin: admin?.role === "super_admin",
      login,
      logout,
    }),
    [token, admin, isRestoring, login, logout]
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth() must be used within <AdminAuthProvider>");
  return ctx;
}
