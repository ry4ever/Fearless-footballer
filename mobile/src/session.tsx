import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, AppState, Text, View } from "react-native";
import { Redirect } from "expo-router";
import { canAthleteAccessSession, canCaregiverAccessDashboard } from "./lib/sessionGuard";
import {
  clearSessionState,
  loadSessionState,
  signOutSession,
  type LoadedSessionState,
} from "./lib/sessionStore";
import { getApiFacade, getSessionApiFacade } from "./lib/apiFacade";
import { fonts } from "./ui/fonts";

interface SessionContextValue {
  state: LoadedSessionState | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<LoadedSessionState>;
  switchRole: (role: LoadedSessionState["currentRole"]) => Promise<LoadedSessionState>;
  reset: () => Promise<LoadedSessionState>;
  signOut: () => Promise<LoadedSessionState>;
  /** Pull pairing changes made on another device, then reload local state. */
  syncPairing: () => Promise<LoadedSessionState>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<LoadedSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextState = await loadSessionState();
      setState(nextState);
      return nextState;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load local account state.";
      setError(message);
      setState(null);
      throw caught;
    } finally {
      setLoading(false);
    }
  }, []);

  const syncPairing = useCallback(async () => {
    const api = await getSessionApiFacade();
    await api.syncPairing();
    return refresh();
  }, [refresh]);

  useEffect(() => {
    // Show local state immediately, then pick up remote pairing changes.
    refresh()
      .then(() => syncPairing())
      .catch(() => null);
    const subscription = AppState.addEventListener("change", (appState) => {
      if (appState === "active") syncPairing().catch(() => null);
    });
    return () => subscription.remove();
  }, [refresh, syncPairing]);

  const switchRoleAction = useCallback(
    async (role: LoadedSessionState["currentRole"]) => {
      if (!role) {
        const nextState = await refresh();
        return nextState;
      }
      const api = getApiFacade({ role: "athlete" });
      await api.switchAccountRole(role);
      return refresh();
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    await clearSessionState();
    return refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutSession();
    return refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ state, loading, error, refresh, switchRole: switchRoleAction, reset, signOut, syncPairing }),
    [state, loading, error, refresh, switchRoleAction, reset, signOut, syncPairing],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}

export function AthleteAccountGuard({ children }: PropsWithChildren) {
  const { state, loading } = useSession();
  if (loading && !state) return <SessionLoading />;

  if (
    !state?.currentUser ||
    !state.hasTokens ||
    state.currentUser.role !== "athlete"
  ) {
    return <Redirect href="/athlete/register" />;
  }
  return children;
}

export function CaregiverAccountGuard({ children }: PropsWithChildren) {
  const { state, loading } = useSession();
  if (loading && !state) return <SessionLoading />;

  if (
    !state?.currentUser ||
    !state.hasTokens ||
    state.currentUser.role !== "caregiver"
  ) {
    return <Redirect href="/caregiver/register" />;
  }
  return children;
}

export function AthleteRouteGuard({ children }: PropsWithChildren) {
  const { state, loading } = useSession();
  if (loading && !state) return <SessionLoading />;

  if (
    !state?.currentUser ||
    !state.hasTokens ||
    state.currentUser.role !== "athlete"
  ) {
    return <Redirect href="/athlete/register" />;
  }
  if (!canAthleteAccessSession(state.currentUser, state.pairing)) {
    return <Redirect href="/athlete/restricted" />;
  }
  return children;
}

export function CaregiverRouteGuard({ children }: PropsWithChildren) {
  const { state, loading } = useSession();
  if (loading && !state) return <SessionLoading />;

  if (
    !state?.currentUser ||
    !state.hasTokens ||
    state.currentUser.role !== "caregiver"
  ) {
    return <Redirect href="/caregiver/register" />;
  }
  if (!canCaregiverAccessDashboard(state.currentUser, state.pairing)) {
    return <Redirect href="/caregiver/unlinked" />;
  }
  return children;
}

function SessionLoading() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050A19",
      }}
    >
      <ActivityIndicator color="#69E0FA" />
      <Text style={{ color: "#A8B3C7", marginTop: 12 }}>
        Loading your safe space…
      </Text>
    </View>
  );
}

export function SessionErrorScreen() {
  const { error } = useSession();
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#050A19",
        padding: 24,
      }}
    >
      <Text
        style={{
          fontFamily: fonts.w800,
          color: "#F8FAFC",
          fontSize: 22,
          textAlign: "center",
        }}
      >
        We could not load this device state
      </Text>
      <Text
        style={{
          fontFamily: fonts.w400,
          color: "#A8B3C7",
          fontSize: 15,
          lineHeight: 22,
          marginTop: 10,
          textAlign: "center",
        }}
      >
        {error ?? "Please restart the app and try again."}
      </Text>
    </View>
  );
}
