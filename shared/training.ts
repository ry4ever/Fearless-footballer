import type { OnboardingPlan } from "./onboarding";
import type { AthleteProgress, ProgrammeSummary, SessionLibraryResponse, SessionPackage } from "./types";

/**
 * What HQ recommends, worked out from the library and the athlete's
 * completions. Shared by web and mobile so both show the same session.
 */

export interface ProgrammeView {
  programme: ProgrammeSummary;
  sessions: SessionPackage[];
}

/** Slug of the plan a coach sets; it's shown like a programme. */
export const COACH_PLAN_SLUG = "coach-plan";

/** Programmes with their sessions, in order – the coach's plan first, when there is one. */
export function programmeViews(library: SessionLibraryResponse): ProgrammeView[] {
  const byId = new Map(library.sessions.map((session) => [session.id, session]));
  const sessionsFor = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((session): session is SessionPackage => Boolean(session));
  const views = library.programmes
    .map((programme) => ({ programme, sessions: sessionsFor(programme.sessionIds) }))
    .filter((view) => view.sessions.length > 0);
  const coach = library.coachPlan;
  if (coach && sessionsFor(coach.sessionIds).length > 0) {
    views.unshift({
      programme: {
        slug: COACH_PLAN_SLUG,
        title: `${coach.coachName}'s plan`,
        tagline: "Picked for you by your coach.",
        description: `${coach.coachName} chose these sessions for you, in this order. Your next one is always on Home.`,
        sessionIds: coach.sessionIds,
      },
      sessions: sessionsFor(coach.sessionIds),
    });
  }
  return views;
}

export function isCoachPlan(view: ProgrammeView | undefined): boolean {
  return view?.programme.slug === COACH_PLAN_SLUG;
}

/**
 * The programme the player is working on: their coach's plan if they have
 * one, then the one they chose, otherwise the midfield programme for
 * midfielders and the goalscorer one for everyone else.
 */
export function currentProgramme(views: ProgrammeView[], plan: OnboardingPlan | null): ProgrammeView | undefined {
  const coach = views.find(isCoachPlan);
  if (coach) return coach;
  const chosen = plan?.programme && views.find((view) => view.programme.slug === plan.programme);
  if (chosen) return chosen;
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
