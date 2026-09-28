import { pathToFileURL } from "node:url";
import { PrismaClient, MindsetCategory } from "@prisma/client";
import { sampleSessionPackage } from "../shared/sampleSession";

/** Create or refresh the built-in sample session. */
export async function seedSampleSession(prisma: PrismaClient) {
  return prisma.session.upsert({
    where: { slug: sampleSessionPackage.slug },
    update: {
      title: sampleSessionPackage.title,
      subtitle: sampleSessionPackage.subtitle,
      category: MindsetCategory.CALM,
      defaultDuration: sampleSessionPackage.defaultDurationSeconds,
      mentorName: sampleSessionPackage.mentor.name,
      mentorTitle: sampleSessionPackage.mentor.title,
      mentorAvatarUrl: sampleSessionPackage.mentor.avatarUrl,
      heroImageUrl: sampleSessionPackage.heroImageUrl,
      isPublished: true,
      comingSoon: false,
      voiceStreamUrl: sampleSessionPackage.media.voiceUrl,
      musicBedUrl: sampleSessionPackage.media.musicBedUrl,
      captionsUrl: sampleSessionPackage.media.captionsUrl,
      transcriptText: sampleSessionPackage.media.transcriptUrl ?? "",
      phases: {
        deleteMany: {},
        create: sampleSessionPackage.phases.map((phase) => ({
          phaseNumber: phase.number,
          label: phase.label,
          startSeconds: phase.startSeconds,
          endSeconds: phase.endSeconds,
        })),
      },
      prompts: {
        deleteMany: {},
        create: sampleSessionPackage.prompts.map((prompt) => ({
          timestampSeconds: prompt.timestampSeconds,
          promptText: prompt.promptText,
          subText: prompt.subText,
        })),
      },
    },
    create: {
      slug: sampleSessionPackage.slug,
      version: sampleSessionPackage.version,
      title: sampleSessionPackage.title,
      subtitle: sampleSessionPackage.subtitle,
      category: MindsetCategory.CALM,
      defaultDuration: sampleSessionPackage.defaultDurationSeconds,
      mentorName: sampleSessionPackage.mentor.name,
      mentorTitle: sampleSessionPackage.mentor.title,
      mentorAvatarUrl: sampleSessionPackage.mentor.avatarUrl,
      heroImageUrl: sampleSessionPackage.heroImageUrl,
      isPublished: true,
      comingSoon: false,
      voiceStreamUrl: sampleSessionPackage.media.voiceUrl,
      musicBedUrl: sampleSessionPackage.media.musicBedUrl,
      captionsUrl: sampleSessionPackage.media.captionsUrl,
      transcriptText: sampleSessionPackage.media.transcriptUrl ?? "",
      phases: {
        create: sampleSessionPackage.phases.map((phase) => ({
          phaseNumber: phase.number,
          label: phase.label,
          startSeconds: phase.startSeconds,
          endSeconds: phase.endSeconds,
        })),
      },
      prompts: {
        create: sampleSessionPackage.prompts.map((prompt) => ({
          timestampSeconds: prompt.timestampSeconds,
          promptText: prompt.promptText,
          subText: prompt.subText,
        })),
      },
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const session = await seedSampleSession(prisma);
    console.log(`Seeded session: ${session.title}`);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (pnpm prisma:seed), not when imported.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
