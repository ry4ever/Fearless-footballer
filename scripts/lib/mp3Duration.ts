/**
 * Duration of an MP3 file in seconds, by walking its MPEG audio frames.
 * Works for constant and variable bitrate files without external tools.
 */

const BITRATES_KBPS = {
  mpeg1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000], // MPEG-1
  2: [22050, 24000, 16000], // MPEG-2
  0: [11025, 12000, 8000], // MPEG-2.5
};

export function mp3DurationSeconds(data: Uint8Array): number {
  let offset = 0;
  // Skip an ID3v2 tag (album art and the like) if present.
  if (data[0] === 0x49 && data[1] === 0x44 && data[2] === 0x33) {
    offset = 10 + ((data[6]! << 21) | (data[7]! << 14) | (data[8]! << 7) | data[9]!);
  }

  let seconds = 0;
  while (offset + 4 <= data.length) {
    const b1 = data[offset + 1]!;
    const b2 = data[offset + 2]!;
    if (data[offset] !== 0xff || (b1 & 0xe0) !== 0xe0) {
      offset += 1;
      continue;
    }
    const version = (b1 >> 3) & 3;
    const layer = (b1 >> 1) & 3;
    const bitrateIndex = (b2 >> 4) & 15;
    const sampleRateIndex = (b2 >> 2) & 3;
    const padding = (b2 >> 1) & 1;
    // Only Layer III frames with valid headers count.
    if (version === 1 || layer !== 1 || bitrateIndex === 0 || bitrateIndex === 15 || sampleRateIndex === 3) {
      offset += 1;
      continue;
    }
    const sampleRate = SAMPLE_RATES[version]![sampleRateIndex]!;
    const bitrate = (version === 3 ? BITRATES_KBPS.mpeg1 : BITRATES_KBPS.mpeg2)[bitrateIndex]! * 1000;
    const samplesPerFrame = version === 3 ? 1152 : 576;
    const frameBytes = Math.floor(((samplesPerFrame / 8) * bitrate) / sampleRate) + padding;
    if (frameBytes <= 4) {
      offset += 1;
      continue;
    }
    seconds += samplesPerFrame / sampleRate;
    offset += frameBytes;
  }
  return seconds;
}
