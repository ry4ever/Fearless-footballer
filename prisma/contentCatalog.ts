import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

/**
 * Reads the session catalog in content/ (see content/README.md). Shared by
 * the upload script and the database sync, so both agree on what exists.
 */

export const AUDIO_MODES = ["interactive", "guidance", "relaxation"] as const;
export type AudioMode = (typeof AUDIO_MODES)[number];
export const MUSIC_VARIANTS = ["music", "noMusic"] as const;
export type MusicVariant = (typeof MUSIC_VARIANTS)[number];

export interface CatalogSession {
  slug: string;
  title: string;
  category: string;
  mentor: { name: string; title: string };
  status: "ready" | "coming-soon";
  sortOrder: number;
  audioSourceFolder?: string;
  /** Source file names per mode and music variant. */
  audio: Record<AudioMode, Record<MusicVariant, string>> | null;
  /** Source file name of the "Why this works?" video, in the audio folder. */
  video?: string;
  /** Short labels shown under the title in the player. */
  tags: string[];
  descriptionMarkdown: string | null;
}

export interface CatalogProgramme {
  slug: string;
  title: string;
  description: string;
  sortOrder: number;
  sessions: string[];
}

export interface ManifestEntry {
  key: string;
  bytes: number;
  durationSeconds: number;
  /** True once the file is confirmed in the bucket with the same size. */
  uploaded: boolean;
}

export type MediaManifest = {
  sessions: Record<string, Partial<Record<AudioMode, Partial<Record<MusicVariant, ManifestEntry>>>>>;
  /** "Why this works?" videos, by session slug (re-encoded MP4s). */
  videos?: Record<string, ManifestEntry>;
};

export function mediaKey(slug: string, mode: AudioMode, variant: MusicVariant): string {
  return `audio/${slug}/${mode}-${variant === "music" ? "music" : "no-music"}.mp3`;
}

export function videoKey(slug: string): string {
  return `video/${slug}/why-this-works.mp4`;
}

export function readCatalog(root: string): { sessions: CatalogSession[]; programmes: CatalogProgramme[] } {
  const sessionsDir = path.join(root, "sessions");
  const sessions: CatalogSession[] = [];
  for (const slug of readdirSync(sessionsDir).sort()) {
    const metaPath = path.join(sessionsDir, slug, "session.json");
    if (!existsSync(metaPath)) continue;
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    const descriptionPath = path.join(sessionsDir, slug, "description.md");
    sessions.push({
      slug: meta.slug ?? slug,
      title: meta.title,
      category: meta.category,
      mentor: meta.mentor ?? { name: "Mark Bowden", title: "Football Mentor" },
      status: meta.status === "ready" ? "ready" : "coming-soon",
      sortOrder: typeof meta.sortOrder === "number" ? meta.sortOrder : 1000,
      audioSourceFolder: meta.audioSourceFolder,
      audio: meta.audio ?? null,
      video: typeof meta.video === "string" ? meta.video : undefined,
      tags: stringList(meta.tags),
      descriptionMarkdown: existsSync(descriptionPath) ? playerFacing(readFileSync(descriptionPath, "utf8")) : null,
    });
  }

  const programmesDir = path.join(root, "programmes");
  const programmes: CatalogProgramme[] = existsSync(programmesDir)
    ? readdirSync(programmesDir)
        .filter((file) => file.endsWith(".json"))
        .map((file) => JSON.parse(readFileSync(path.join(programmesDir, file), "utf8")))
        .map((programme) => ({
          slug: programme.slug,
          title: programme.title,
          description: programme.description ?? "",
          sortOrder: programme.sortOrder ?? 1000,
          sessions: programme.sessions ?? [],
        }))
    : [];

  return { sessions, programmes };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim() !== "") : [];
}

/** Editorial notes ("> **Draft for Mark to review**…") stay out of the app. */
function playerFacing(markdown: string): string {
  return markdown
    .split("\n")
    .filter((line) => !/^>\s*\*\*Draft/i.test(line))
    .join("\n")
    .trim()
    .concat("\n");
}

export function readManifest(root: string): MediaManifest {
  const manifestPath = path.join(root, "media-manifest.json");
  return existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { sessions: {} };
}

/**
 * First paragraph of a description, without its heading or draft note, cut
 * to a sentence or two. Used as the short subtitle in the library.
 */
export function summaryFromMarkdown(markdown: string | null, maxLength = 160): string {
  if (!markdown) return "";
  const paragraph =
    markdown
      .split(/\n\s*\n/)
      .map((block) => block.trim())
      .find((block) => block && !block.startsWith("#") && !block.startsWith(">") && !block.startsWith("- ")) ?? "";
  const text = paragraph.replace(/\s+/g, " ");
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const sentenceEnd = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return sentenceEnd > 40 ? cut.slice(0, sentenceEnd + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}
