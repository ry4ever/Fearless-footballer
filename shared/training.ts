import type { OnboardingPlan } from "./onboarding";
import type { AthleteProgress, ProgrammeSummary, SessionLibraryResponse, SessionPackage } from "./types";

/**
 * What HQ recommends, worked out from the library and the athlete's
 * completions. Shared by web and mobile so both show the same session.
 */

export interface ProgrammeView {
  programme: ProgrammeSummary;
  sessions: SessionPackage[];
  completed: number;
}

/** Programmes with their sessions (in order) and how many the athlete has done. */
export function programmeViews(library: SessionLibraryResponse, progress: AthleteProgress): ProgrammeView[] {
  const byId = new Map(library.sessions.map((session) => [session.id, session]));
  const done = new Set(progress.completedSessionIds ?? []);
  return library.programmes
    .map((programme) => {
      const sessions = programme.sessionIds
        .map((id) => byId.get(id))
        .filter((session): session is SessionPackage => Boolean(session));
      return { programme, sessions, completed: sessions.filter((session) => done.has(session.id)).length };
    })
    .filter((view) => view.sessions.length > 0);
}

/** Midfielders start on the midfield programme; everyone else on the goalscorer one. */
export function currentProgramme(views: ProgrammeView[], plan: OnboardingPlan | null): ProgrammeView | undefined {
  const wanted = plan?.position === "midfielder" ? "midfield" : "goalscorer";
  return views.find((view) => view.programme.slug.includes(wanted)) ?? views[0];
}

/** Next session in a programme: the first never done, then the first not done today. */
export function nextSession(view: ProgrammeView, progress: AthleteProgress): { session: SessionPackage; index: number } {
  const done = new Set(progress.completedSessionIds ?? []);
  const doneToday = new Set(progress.completedTodaySessionIds ?? []);
  let index = view.sessions.findIndex((session) => !done.has(session.id));
  if (index < 0) index = view.sessions.findIndex((session) => !doneToday.has(session.id));
  if (index < 0) index = 0;
  return { session: view.sessions[index]!, index };
}

/** Single-letter weekday labels for the 7 days ending today (matches sevenDayPattern). */
export function lastSevenDayLabels(now = new Date()): string[] {
  const letters = ["S", "M", "T", "W", "T", "F", "S"];
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (6 - index));
    return letters[day.getDay()]!;
  });
}

export function greetingFor(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function firstName(fullName: string | undefined): string {
  return fullName?.trim().split(/\s+/)[0] || "Player";
}
