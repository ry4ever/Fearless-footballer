/**
 * Uploads session audio to Cloudflare R2 and records each file's length.
 *
 *   pnpm content:upload            upload anything missing or changed
 *   pnpm content:upload --dry-run  measure files and refresh the manifest only
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
  readManifest,
  type MediaManifest,
} from "../prisma/contentCatalog";
import { mp3DurationSeconds } from "./lib/mp3Duration";

const ROOT = path.resolve(import.meta.dirname, "..");
const CONTENT = path.join(ROOT, "content");
const AUDIO_SOURCE = path.join(ROOT, "project_details", "Sessions");
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
  const manifest: MediaManifest = { sessions: {} };

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
          if ((await remoteSize(client, bucket, key)) === bytes) {
            skipped += 1;
          } else {
            process.stdout.write(`Uploading ${key} (${(bytes / 1e6).toFixed(1)} MB)… `);
            await client.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: key,
                Body: readFileSync(source),
                ContentType: "audio/mpeg",
                // Keys change when content changes, so browsers can cache for a year.
                CacheControl: "public, max-age=31536000, immutable",
              }),
            );
            uploaded += 1;
            console.log("done");
          }
          isUploaded = true;
        }

        manifest.sessions[session.slug]![mode] ??= {};
        manifest.sessions[session.slug]![mode]![variant] = { key, bytes, durationSeconds, uploaded: isUploaded };
        const minutes = `${Math.floor(durationSeconds / 60)}:${String(durationSeconds % 60).padStart(2, "0")}`;
        if (dryRun) console.log(`${key.padEnd(60)} ${minutes}`);
      }
    }
  }

  writeFileSync(path.join(CONTENT, "media-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  if (dryRun) {
    console.log("\nDry run: manifest refreshed, nothing uploaded.");
  } else {
    console.log(`\nUploaded ${uploaded} file(s), ${skipped} already up to date.`);
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
