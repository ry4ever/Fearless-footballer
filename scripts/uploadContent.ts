/**
 * Uploads session audio to Cloudflare R2 and records each file's length.
 *
 *   pnpm content:upload            upload anything missing or changed
 *   pnpm content:upload --dry-run  measure files and refresh the manifest only
 *
 * "Why this works?" videos (session.json "video") are shrunk with ffmpeg
 * first (see scripts/lib/videoTools.ts) and cached in .content-cache/.
 *
 * Reads the audio mapping from content/sessions/<slug>/session.json and the
 * MP3s from project_details/Sessions/<audioSourceFolder>/. Writes
 * content/media-manifest.json, which the server uses to publish sessions.
 * Credentials come from .env (R2_ENDPOINT, R2_ACCESS_KEY_ID,
 * R2_SECRET_ACCESS_KEY, R2_BUCKET); they are never written anywhere else.
 */
import { readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  AUDIO_MODES,
  MUSIC_VARIANTS,
  mediaKey,
  readCatalog,
  videoKey,
  readManifest,
  type MediaManifest,
} from "../prisma/contentCatalog";
import { mp3DurationSeconds } from "./lib/mp3Duration";
import { hasFfmpeg, mp4DurationSeconds, shrinkVideo } from "./lib/videoTools";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT = path.join(ROOT, "content");
const AUDIO_SOURCE = path.join(ROOT, "project_details", "Sessions");
const VIDEO_CACHE = path.join(ROOT, ".content-cache", "video");
const dryRun = process.argv.includes("--dry-run");

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is missing from .env (see content/README.md).`);
  return value;
}

async function remoteSize(client: S3Client, bucket: string, key: string): Promise<number | null> {
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return head.ContentLength ?? null;
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404) return null;
    throw error;
  }
}

async function main() {
  const { sessions } = readCatalog(CONTENT);
  const previous = readManifest(CONTENT);
  const manifest: MediaManifest = { sessions: {}, videos: {} };
  const canShrinkVideos = !dryRun && hasFfmpeg();
  let videosSkippedForFfmpeg = 0;

  let client: S3Client | null = null;
  let bucket = "";
  if (!dryRun) {
    bucket = requireEnv("R2_BUCKET");
    client = new S3Client({
      region: "auto",
      endpoint: requireEnv("R2_ENDPOINT"),
      credentials: { accessKeyId: requireEnv("R2_ACCESS_KEY_ID"), secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY") },
    });
  }

  let uploaded = 0;
  let skipped = 0;

  /** Uploads unless the bucket already holds a file of the same size. */
  async function putIfChanged(key: string, file: string, contentType: string) {
    const bytes = statSync(file).size;
    if ((await remoteSize(client!, bucket, key)) === bytes) {
      skipped += 1;
      return;
    }
    process.stdout.write(`Uploading ${key} (${(bytes / 1e6).toFixed(1)} MB)… `);
    await client!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: readFileSync(file),
        ContentType: contentType,
        // Keys change when content changes, so browsers can cache for a year.
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    uploaded += 1;
    console.log("done");
  }

  for (const session of sessions) {
    if (session.status !== "ready" || !session.audio || !session.audioSourceFolder) continue;
    manifest.sessions[session.slug] = {};
    for (const mode of AUDIO_MODES) {
      for (const variant of MUSIC_VARIANTS) {
        const fileName = session.audio[mode]?.[variant];
        const source = fileName ? path.join(AUDIO_SOURCE, session.audioSourceFolder, fileName) : "";
        if (!fileName || !existsSync(source)) {
          throw new Error(`${session.slug}: missing ${mode}/${variant} file "${fileName ?? "(none)"}" in ${session.audioSourceFolder}`);
        }
        const bytes = statSync(source).size;
        const key = mediaKey(session.slug, mode, variant);
        const durationSeconds = Math.round(mp3DurationSeconds(readFileSync(source)));
        const before = previous.sessions[session.slug]?.[mode]?.[variant];

        let isUploaded = Boolean(before?.uploaded && before.bytes === bytes);
        if (client) {
          await putIfChanged(key, source, "audio/mpeg");
          isUploaded = true;
        }

        manifest.sessions[session.slug]![mode] ??= {};
        manifest.sessions[session.slug]![mode]![variant] = { key, bytes, durationSeconds, uploaded: isUploaded };
        const minutes = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
        if (dryRun) console.log(`${key.padEnd(60)} ${minutes}`);
      }
    }

    if (session.video) {
      const source = path.join(AUDIO_SOURCE, session.audioSourceFolder, session.video);
      if (!existsSync(source)) throw new Error(`${session.slug}: missing video "${session.video}"`);
      const previousVideo = previous.videos?.[session.slug];
      if (!canShrinkVideos) {
        // Dry run, or no ffmpeg: keep whatever was uploaded before.
        if (previousVideo) manifest.videos![session.slug] = previousVideo;
        if (!dryRun) videosSkippedForFfmpeg += 1;
        continue;
      }
      process.stdout.write(`Shrinking ${session.video}… `);
      const shrunk = shrinkVideo(source, VIDEO_CACHE, session.slug);
      const bytes = statSync(shrunk).size;
      console.log(`${(statSync(source).size / 1e6).toFixed(0)} MB → ${(bytes / 1e6).toFixed(1)} MB`);
      const key = videoKey(session.slug);
      await putIfChanged(key, shrunk, "video/mp4");
      manifest.videos![session.slug] = {
        key,
        bytes,
        durationSeconds: Math.round(mp4DurationSeconds(readFileSync(shrunk))),
        uploaded: true,
      };
    }
  }

  writeFileSync(path.join(CONTENT, "media-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (dryRun) {
    console.log("\nDry run: manifest refreshed, nothing uploaded.");
  } else {
    console.log(`\nUploaded ${uploaded} file(s), ${skipped} already up to date.`);
    if (videosSkippedForFfmpeg > 0) {
      console.log(
        `Skipped ${videosSkippedForFfmpeg} video(s): ffmpeg isn't installed. Install it ` +
          "(choco install ffmpeg -y, in an administrator PowerShell), open a new terminal, and run this again.",
      );
    }
    const base = process.env.MEDIA_PUBLIC_BASE_URL?.trim().replace(/\/$/, "");
    const firstKey = Object.values(manifest.sessions)[0]?.interactive?.music?.key;
    if (base && firstKey) {
      const response = await fetch(`${base}/${firstKey}`, { method: "HEAD" });
      console.log(
        response.ok
          ? `Public URL check passed: ${base}/${firstKey}`
          : `Public URL check FAILED (${response.status}) for ${base}/${firstKey}. Is public access enabled on the bucket?`,
      );
    }
    console.log("Commit content/media-manifest.json to publish these sessions.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
