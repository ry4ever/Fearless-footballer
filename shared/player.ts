import type { PhotoName } from "./onboarding";
import type { SessionMode, SessionPackage } from "./types";

/** The three training styles, in Mark's words. Shared by web and mobile. */
export const TRAINING_STYLES: Record<SessionMode, { label: string; detail: string }> = {
  interactive: {
    label: "Interactive",
    detail:
      "Train with Mark's guidance, with short periods where you'll mentally rehearse the situations yourself before Mark brings you back in and guides the next part.",
  },
  guidance: {
    label: "Full Guidance",
    detail: "Mark guides you throughout the entire session, without the independent rehearsal periods.",
  },
  relaxation: {
    label: "Relaxation",
    detail: "A slower, more relaxed version of the session. Ideal after training, during recovery or before bed.",
  },
};

const SESSION_PHOTOS: Record<string, PhotoName> = {
  "back-to-your-best": "focus",
  "better-final-ball": "energy",
  "defensive-aerial-duels": "centre-back",
  "dominate-the-midfield": "midfielder",
  "ice-cold-finisher": "striker",
  "play-your-next-game": "matchday",
  "scanning-and-awareness": "decision",
};

/** Cinematic image at the top of the player. */
export function sessionPhoto(session: Pick<SessionPackage, "slug">): PhotoName {
  return SESSION_PHOTOS[session.slug] ?? "profile";
}

/** Title over two lines: the first half white, the second half in brand blue. */
export function splitTitle(title: string): [string, string] {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return [title, ""];
  const cut = Math.ceil(words.length / 2);
  return [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
}

/** Labels under the title (e.g. Confidence · Self-Belief), falling back to the focus area. */
export function sessionTags(session: Pick<SessionPackage, "tags" | "focusArea">): string[] {
  return session.tags?.length ? session.tags : session.focusArea ? [session.focusArea] : [];
}

/** "2 MIN" for a video's length (at least 1). */
export function videoLengthLabel(seconds: number | undefined): string | null {
  if (!seconds) return null;
  return `${Math.max(1, Math.round(seconds / 60))} MIN`;
}
