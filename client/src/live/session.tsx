import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { PairingLink, UserAccount } from "@shared/types";
import { apiClient } from "../lib/apiClient";
import { offlineQueue } from "../lib/offlineQueue";

interface SessionState {
  user: UserAccount | null;
  /** undefined until the first fetch finishes; null when there is no link. */
  pairing: PairingLink | null | undefined;
  refreshPairing: () => Promise<PairingLink | null>;
  signOut: () => void;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserAccount | null>(() => apiClient.getStoredUser());
  const [pairing, setPairing] = useState<PairingLink | null | undefined>(undefined);

  useEffect(
    () =>
      apiClient.onSessionChange((next) => {
        setUser(next);
        setPairing(undefined);
      }),
    [],
  );

  const refreshPairing = useCallback(async () => {
    const next = await apiClient.getPairing();
    setPairing(next);
    return next;
  }, []);

  // Load the link for whoever is signed in, and send anything queued offline.
  useEffect(() => {
    if (!user) return;
    refreshPairing().catch(() => setPairing(null));
    void offlineQueue.flush();
  }, [user, refreshPairing]);

  // Pick up changes the other person made on their own device.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshPairing().catch(() => undefined);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [user, refreshPairing]);

  const signOut = useCallback(() => apiClient.signOut(), []);

  const value = useMemo(
    () => ({ user, pairing, refreshPairing, signOut }),
    [user, pairing, refreshPairing, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}

export function isLinkActive(pairing: PairingLink | null | undefined): pairing is PairingLink {
  return pairing?.status === "active";
}
