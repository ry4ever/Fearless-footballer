import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Shrinks the "Why this works?" videos for streaming. The originals are
 * 1080x1920 at ~15 Mbit/s (50–140 MB for under a minute); phones don't need
 * that. Output: 720 px wide H.264 + AAC MP4 with the index at the front, so
 * playback starts before the whole file has downloaded.
 */

export function hasFfmpeg(): boolean {
  // One fixed command string (no user input), so running it through the shell
  // is safe; the shell lets Windows find Chocolatey's ffmpeg shim.
  const result = spawnSync("ffmpeg -version", { stdio: "ignore", shell: true });
  return result.status === 0;
}

/** Re-encodes `source` into `cacheDir/<name>.mp4`, reusing it if newer than the source. */
export function shrinkVideo(source: string, cacheDir: string, name: string): string {
  mkdirSync(cacheDir, { recursive: true });
  const output = path.join(cacheDir, `${name}.mp4`);
  if (existsSync(output) && statSync(output).mtimeMs > statSync(source).mtimeMs) return output;

  const result = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-loglevel", "error",
      "-i", source,
      // 720 wide, height kept in proportion (and even, as H.264 requires).
      "-vf", "scale=720:-2",
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", "26",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      output,
    ],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.status !== 0) throw new Error(`ffmpeg couldn't convert ${path.basename(source)}`);
  return output;
}

/** Duration in seconds from an MP4/MOV's movie header ("mvhd" box). */
export function mp4DurationSeconds(data: Uint8Array): number {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 4; i + 32 < data.length; i += 1) {
    // "mvhd"
    if (data[i] === 0x6d && data[i + 1] === 0x76 && data[i + 2] === 0x68 && data[i + 3] === 0x64) {
      const version = data[i + 4];
      if (version === 1) {
        const timescale = view.getUint32(i + 24);
        const duration = Number(view.getBigUint64(i + 28));
        return timescale ? duration / timescale : 0;
      }
      const timescale = view.getUint32(i + 16);
      const duration = view.getUint32(i + 20);
      return timescale ? duration / timescale : 0;
    }
  }
  return 0;
}
