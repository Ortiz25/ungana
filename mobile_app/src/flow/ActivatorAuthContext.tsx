// Activator auth state for the app/activator/* route subtree — same shape
// and reasoning as AdminAuthContext.tsx (see its header comment for the
// SecureStore-native/localStorage-web split and the "no proactive expiry
// timer" rationale). A separate file rather than a shared factory: this is
// the second of three near-identical ~70-line contexts (Admin/Activator/
// Coordinator), which doesn't clear the bar for a shared abstraction yet,
// and keeps each one's auth logic trivially greppable on its own.
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { ActivatorProfile } from "@/lib/activatorApi";

const SESSION_KEY = "ungana_activator_session";

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

type StoredSession = { token: string; activator: ActivatorProfile };

export type ActivatorAuthContextValue = {
  token: string | null;
  activator: ActivatorProfile | null;
  isRestoring: boolean;
  login: (token: string, activator: ActivatorProfile) => Promise<void>;
  updateProfile: (activator: ActivatorProfile) => Promise<void>;
  logout: () => Promise<void>;
};

const ActivatorAuthContext = createContext<ActivatorAuthContextValue | null>(null);

export function ActivatorAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [activator, setActivator] = useState<ActivatorProfile | null>(null);
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
          setActivator(stored.activator);
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

  const login = useCallback(async (newToken: string, newActivator: ActivatorProfile) => {
    setToken(newToken);
    setActivator(newActivator);
    await sessionStore.set(SESSION_KEY, JSON.stringify({ token: newToken, activator: newActivator } satisfies StoredSession));
  }, []);

  // Goal/notification-pref updates return the fresh activator row — persist
  // it back into the stored session too, so a reload restores the latest
  // values rather than the ones from login time.
  const updateProfile = useCallback(
    async (newActivator: ActivatorProfile) => {
      setActivator(newActivator);
      if (token) await sessionStore.set(SESSION_KEY, JSON.stringify({ token, activator: newActivator } satisfies StoredSession));
    },
    [token]
  );

  const logout = useCallback(async () => {
    setToken(null);
    setActivator(null);
    await sessionStore.remove(SESSION_KEY);
  }, []);

  const value = useMemo<ActivatorAuthContextValue>(
    () => ({ token, activator, isRestoring, login, updateProfile, logout }),
    [token, activator, isRestoring, login, updateProfile, logout]
  );

  return <ActivatorAuthContext.Provider value={value}>{children}</ActivatorAuthContext.Provider>;
}

export function useActivatorAuth(): ActivatorAuthContextValue {
  const ctx = useContext(ActivatorAuthContext);
  if (!ctx) throw new Error("useActivatorAuth() must be used within <ActivatorAuthProvider>");
  return ctx;
}
