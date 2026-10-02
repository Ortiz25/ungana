// Coordinator auth state for the app/coordinator/* route subtree — same
// shape as ActivatorAuthContext.tsx/AdminAuthContext.tsx (see AdminAuthContext
// for the SecureStore/localStorage split rationale).
import { createContext, useContext, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { CoordinatorProfile } from "@/lib/coordinatorApi";

const SESSION_KEY = "ungana_coordinator_session";

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

type StoredSession = { token: string; coordinator: CoordinatorProfile };

export type CoordinatorAuthContextValue = {
  token: string | null;
  coordinator: CoordinatorProfile | null;
  isRestoring: boolean;
  login: (token: string, coordinator: CoordinatorProfile) => Promise<void>;
  logout: () => Promise<void>;
};

const CoordinatorAuthContext = createContext<CoordinatorAuthContextValue | null>(null);

export function CoordinatorAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [coordinator, setCoordinator] = useState<CoordinatorProfile | null>(null);
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
          setCoordinator(stored.coordinator);
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

  const login = useCallback(async (newToken: string, newCoordinator: CoordinatorProfile) => {
    setToken(newToken);
    setCoordinator(newCoordinator);
    await sessionStore.set(SESSION_KEY, JSON.stringify({ token: newToken, coordinator: newCoordinator } satisfies StoredSession));
  }, []);

  const logout = useCallback(async () => {
    setToken(null);
    setCoordinator(null);
    await sessionStore.remove(SESSION_KEY);
  }, []);

  const value = useMemo<CoordinatorAuthContextValue>(
    () => ({ token, coordinator, isRestoring, login, logout }),
    [token, coordinator, isRestoring, login, logout]
  );

  return <CoordinatorAuthContext.Provider value={value}>{children}</CoordinatorAuthContext.Provider>;
}

export function useCoordinatorAuth(): CoordinatorAuthContextValue {
  const ctx = useContext(CoordinatorAuthContext);
  if (!ctx) throw new Error("useCoordinatorAuth() must be used within <CoordinatorAuthProvider>");
  return ctx;
}
