import { useEffect, useState } from "react";
import type { AthleteProgress, SessionLibraryResponse } from "../../../shared/types";
import type { OnboardingPlan } from "../../../shared/onboarding";
import { useSession } from "../session";
import { getApiFacade, LocalApiError } from "./apiFacade";
import { addConnectivityListener } from "./offlineCompletionQueue";
import { loadPlan } from "./plan";

/**
 * Library, progress, saved plan and offline queue for the athlete's main
 * screens. Queued completions sync when the device comes back online.
 */
export function useAthleteData() {
  const { state } = useSession();
  const api = getApiFacade({ role: state?.currentRole ?? "athlete" });
  const account = state?.currentUser;
  const [library, setLibrary] = useState<SessionLibraryResponse | null>(null);
  const [progress, setProgress] = useState<AthleteProgress | null>(null);
  const [plan, setPlan] = useState<OnboardingPlan | null | undefined>(undefined);
  const [pendingCompletions, setPendingCompletions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!account?.id) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    loadPlan(account.id).then((saved) => mounted && setPlan(saved));
    Promise.all([api.getSessionLibrary(), api.getAthleteProgress(), api.getOfflineQueueStatus()])
      .then(([libraryResult, progressResult, queueStatus]) => {
        if (!mounted) return;
        setLibrary(libraryResult);
        setProgress(progressResult);
        setPendingCompletions(queueStatus.pending);
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(caught instanceof LocalApiError ? caught.message : "Unable to load your training.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account?.id, state?.pairing?.id]);

  useEffect(() => {
    if (!account?.id) return undefined;
    return addConnectivityListener(() => {
      api
        .syncOfflineCompletions()
        .then((result) => {
          if (result.synced > 0) setPendingCompletions((current) => Math.max(0, current - result.synced));
        })
        .catch(() => null);
    });
  }, [account?.id]);

  return {
    account,
    library,
    progress: progress ?? state?.athleteProgress ?? null,
    plan,
    pendingCompletions,
    loading,
    error,
  };
}
