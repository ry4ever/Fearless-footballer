import { useCallback, useEffect, useState } from "react";
import type { AthleteProgress, SessionLibraryResponse } from "@shared/types";
import { apiClient } from "../lib/apiClient";
import { offlineQueue } from "../lib/offlineQueue";
import { programmeViewPhoto } from "@shared/player";
import type { ProgrammeView } from "@shared/training";
import { photo } from "../lib/onboardingOptions";
import { useSession } from "./session";

/** Progress and the session library, reloaded when queued offline reps sync. */
export function useAthleteData() {
  const { user } = useSession();
  const [progress, setProgress] = useState<AthleteProgress | null>(null);
  const [library, setLibrary] = useState<SessionLibraryResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => (user ? offlineQueue.pendingCount(user.id) : 0));

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextProgress, nextLibrary] = await Promise.all([apiClient.getAthleteProgress(), apiClient.getLibrary()]);
      setProgress(nextProgress);
      setLibrary(nextLibrary);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load your training.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    return offlineQueue.subscribe(() => {
      const next = offlineQueue.pendingCount(user.id);
      setPending((previous) => {
        if (next < previous) void load();
        return next;
      });
    });
  }, [user, load]);

  return { progress, library, error, pending, reload: load };
}

export {
  currentProgramme,
  isCoachPlan,
  lastSevenDayLabels,
  nextSession,
  programmeViews,
  type ProgrammeView,
} from "@shared/training";

/** Card photo for a programme (a coach's plan uses its first session's). */
export const programmePhoto = (view: ProgrammeView) => photo(programmeViewPhoto(view));
