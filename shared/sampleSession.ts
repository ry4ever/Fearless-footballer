import type { SessionPackage } from "./types";

export const sampleSessionPackage: SessionPackage = {
  id: "ses_nerves_performance_v1",
  slug: "nerves-equals-performance",
  version: "1.0.0",
  title: "Nerves = Performance",
  subtitle: "Turn adrenaline into information.",
  category: "composure",
  mindset: "calm",
  defaultDurationSeconds: 300,
  mentor: {
    id: "men_alex_rivera",
    name: "Alex Rivera",
    title: "FOOTBALL MENTOR",
    avatarUrl: "/assets/session-player-screen.png",
    bio: "Former professional midfielder specializing in matchday psychological preparation and composure under high-pressure conditions.",
  },
  thumbnailUrl: "/assets/hq-active-screen.jpg",
  heroImageUrl: "/assets/session-player-screen.png",
  availableModes: ["interactive"] as const,
  media: {
    voiceUrl: "https://cdn.fearlessfootballer.com/audio/v1/nerves_voice_stem.aac",
    musicBedUrl: "https://cdn.fearlessfootballer.com/audio/v1/stadium_ambient_bed.aac",
    captionsUrl: "https://cdn.fearlessfootballer.com/captions/v1/nerves_en.vtt",
    transcriptUrl: "https://cdn.fearlessfootballer.com/transcripts/v1/nerves_en.txt",
    transcriptLocale: "en",
  },
  phases: [
    {
      number: 1,
      label: "Center",
      startSeconds: 0,
      endSeconds: 90,
    },
    {
      number: 2,
      label: "Reframe",
      startSeconds: 90,
      endSeconds: 210,
    },
    {
      number: 3,
      label: "Rehearse",
      startSeconds: 210,
      endSeconds: 300,
    },
  ],
  prompts: [
    {
      timestampSeconds: 15,
      promptText: "Notice the adrenaline. It is information.",
      subText: "Your racing heart is not weakness; it is your body powering up for matchday execution.",
    },
    {
      timestampSeconds: 100,
      promptText: "Name the first action you want available under pressure.",
      subText: "A crisp one-touch pass? A solid shoulder shield? Lock in one anchor.",
    },
    {
      timestampSeconds: 220,
      promptText: "Picture the opposition pressing fast. You are calm. You execute.",
      subText: "Feel your cleats in the turf. Own the space before you move.",
    },
  ],
};
