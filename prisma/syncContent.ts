import path from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient, type MindsetCategory, type SessionMode } from "@prisma/client";
import {
  AUDIO_MODES,
  MUSIC_VARIANTS,
  readCatalog,
  readManifest,
  summaryFromMarkdown,
  type AudioMode,
  type CatalogSession,
  type MediaManifest,
} from "./contentCatalog";

/**
 * Runs on every container start, after migrations. Brings the database in
 * line with content/: sessions (descriptions, audio versions, coming-soon
 * entries) and programmes. A session becomes playable only once all six of
 * its audio files are recorded as uploaded in content/media-manifest.json.
 * Sessions that aren't in content/ (e.g. ones created through the admin API)
 * are left alone.
 */

const MODE_TO_DB: Record<AudioMode, SessionMode> = {
  interactive: "INTERACTIVE",
  guidance: "GUIDANCE",
  relaxation: "RELAXATION",
};

/** The legacy mindset enum is still required; map catalog categories onto it. */
function mindsetFor(category: string): MindsetCategory {
  const c = category.toLowerCase();
  if (c.includes("confidence")) return "CONFIDENCE";
  if (c.includes("resilience") || c.includes("injur")) return "RESILIENCE";
  if (c.includes("focus") || c.includes("flow")) return "FOCUS";
  if (c.includes("anxiety") || c.includes("anger")) return "CALM";
  return "PERFORMANCE";
}

function playableAudio(session: CatalogSession, manifest: MediaManifest) {
  if (session.status !== "ready") return null;
  const entries = manifest.sessions[session.slug];
  const rows = [];
  for (const mode of AUDIO_MODES) {
    for (const variant of MUSIC_VARIANTS) {
      const entry = entries?.[mode]?.[variant];
      if (!entry?.uploaded) return null;
      rows.push({ mode: MODE_TO_DB[mode], withMusic: variant === "music", url: entry.key, durationSeconds: entry.durationSeconds });
    }
  }
  return rows;
}

export async function syncContent(prisma: PrismaClient, contentRoot: string) {
  const { sessions, programmes } = readCatalog(contentRoot);
  const manifest = readManifest(contentRoot);
  const audioBySlug = new Map(sessions.map((session) => [session.slug, playableAudio(session, manifest)]));
  const playableCount = Array.from(audioBySlug.values()).filter(Boolean).length;

  for (const session of sessions) {
    const audio = audioBySlug.get(session.slug) ?? null;
    const interactive = audio?.find((row) => row.mode === "INTERACTIVE" && row.withMusic);
    const fields = {
      title: session.title,
      subtitle: summaryFromMarkdown(session.descriptionMarkdown),
      category: mindsetFor(session.category),
      focusArea: session.category,
      sortOrder: session.sortOrder,
      descriptionMarkdown: session.descriptionMarkdown,
      mentorName: session.mentor.name,
      mentorTitle: session.mentor.title,
      comingSoon: !audio,
      videoUrl: audio && manifest.videos?.[session.slug]?.uploaded ? manifest.videos[session.slug]!.key : null,
      videoDurationSeconds:
        audio && manifest.videos?.[session.slug]?.uploaded ? manifest.videos[session.slug]!.durationSeconds : null,
      tagline: session.tagline,
      tags: session.tags,
      // Keep the legacy single-file fields meaningful for older clients.
      defaultDuration: interactive?.durationSeconds ?? 600,
      voiceStreamUrl: interactive?.url ?? "",
      musicBedUrl: null,
    };
    const existing = await prisma.session.findUnique({ where: { slug: session.slug } });
    // Until real sessions are playable, leave anything already live exactly as
    // it is (the built-in sample shares a slug with a coming-soon entry).
    if (!audio && playableCount === 0 && existing?.isPublished) continue;
    const isPublished = Boolean(audio);

    await prisma.$transaction(async (tx) => {
      const saved = await tx.session.upsert({
        where: { slug: session.slug },
        update: { ...fields, isPublished },
        create: { ...fields, slug: session.slug, isPublished, transcriptText: "" },
      });
      await tx.sessionAudio.deleteMany({ where: { sessionId: saved.id } });
      if (audio) {
        await tx.sessionAudio.createMany({ data: audio.map((row) => ({ ...row, sessionId: saved.id })) });
      }
    });
  }

  for (const programme of programmes) {
    const members = await prisma.session.findMany({
      where: { slug: { in: programme.sessions } },
      select: { id: true, slug: true },
    });
    const idBySlug = new Map(members.map((member) => [member.slug, member.id]));
    await prisma.$transaction(async (tx) => {
      const saved = await tx.programme.upsert({
        where: { slug: programme.slug },
        update: {
          title: programme.title,
          tagline: programme.tagline,
          description: programme.description,
          sortOrder: programme.sortOrder,
          isPublished: true,
        },
        create: {
          slug: programme.slug,
          title: programme.title,
          tagline: programme.tagline,
          description: programme.description,
          sortOrder: programme.sortOrder,
          isPublished: true,
        },
      });
      await tx.programmeSession.deleteMany({ where: { programmeId: saved.id } });
      await tx.programmeSession.createMany({
        data: programme.sessions
          .filter((slug) => idBySlug.has(slug))
          .map((slug, index) => ({ programmeId: saved.id, sessionId: idBySlug.get(slug)!, position: index + 1 })),
      });
    });
  }

  return { sessions: sessions.length, playable: playableCount, programmes: programmes.length };
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const result = await syncContent(prisma, path.resolve(import.meta.dirname, "..", "content"));
    console.log(
      `Content: ${result.sessions} sessions (${result.playable} playable), ${result.programmes} programmes synced.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Never block the server from starting over content problems.
    console.error("Content sync failed:", error);
  });
}
