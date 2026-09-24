import { PrismaClient, MindsetCategory } from "@prisma/client";
import { sampleSessionPackage } from "../shared/sampleSession";

const prisma = new PrismaClient();

async function main() {
  const session = await prisma.session.upsert({
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

  console.log(`Seeded session: ${session.title}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
