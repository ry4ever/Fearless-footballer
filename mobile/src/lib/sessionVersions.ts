import { TRAINING_STYLES } from "../../../shared/player";
import type { SessionAudioVariant, SessionMode, SessionPackage } from "../../../shared/types";

/**
 * Each session is recorded in up to three versions, each with and without
 * music, and every recording has its own length. These helpers pick the
 * recording the athlete chose and describe it consistently across screens.
 */

export const MODE_ORDER: SessionMode[] = ["interactive", "guidance", "relaxation"];

/** Training style names and Mark's one-line explanations (shared with web). */
export const MODE_COPY = TRAINING_STYLES;

export function isSessionMode(value: unknown): value is SessionMode {
  return value === "interactive" || value === "guidance" || value === "relaxation";
}

/** The modes this session was recorded in, in display order. */
export function availableModes(session: SessionPackage): SessionMode[] {
  const recorded = new Set((session.audio ?? []).map((variant) => variant.mode));
  return MODE_ORDER.filter((mode) => recorded.has(mode));
}

/**
 * The recording for a mode and music choice. Falls back to the other music
 * option for that mode; null for older single-file sessions.
 */
export function pickVariant(
  session: SessionPackage,
  mode: SessionMode,
  withMusic: boolean,
): SessionAudioVariant | null {
  const variants = session.audio ?? [];
  return (
    variants.find((variant) => variant.mode === mode && variant.withMusic === withMusic) ??
    variants.find((variant) => variant.mode === mode) ??
    null
  );
}

export function hasMusicChoice(session: SessionPackage, mode: SessionMode): boolean {
  const variants = (session.audio ?? []).filter((variant) => variant.mode === mode);
  return variants.some((variant) => variant.withMusic) && variants.some((variant) => !variant.withMusic);
}

/** Playback progress is kept per recording, since each has its own timeline. */
export function progressKey(sessionId: string, variant: SessionAudioVariant | null): string {
  return variant ? `${sessionId}:${variant.mode}:${variant.withMusic ? "music" : "no-music"}` : sessionId;
}

/** Route query for a chosen recording, read back by the player and check-in. */
export function versionQuery(variant: SessionAudioVariant | null): string {
  return variant ? `?mode=${variant.mode}&music=${variant.withMusic ? "1" : "0"}` : "";
}

export function variantFromParams(
  session: SessionPackage,
  params: { mode?: string | string[]; music?: string | string[] },
): SessionAudioVariant | null {
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const music = Array.isArray(params.music) ? params.music[0] : params.music;
  if (!session.audio?.length) return null;
  const chosenMode = isSessionMode(mode) ? mode : availableModes(session)[0] ?? "interactive";
  return pickVariant(session, chosenMode, music !== "0");
}
