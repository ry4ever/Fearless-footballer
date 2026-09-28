import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { SessionPackage } from "../../../shared/types";
import { lengthLabel } from "../lib/sessionVersions";
import { colors } from "./index";

/** One session in a list: number (in programmes), title, length and category. */
export function SessionRow({
  session,
  index,
  onPress,
}: {
  session: SessionPackage;
  index?: number;
  onPress: () => void;
}) {
  const meta = session.comingSoon
    ? session.focusArea ?? ""
    : [lengthLabel(session), session.focusArea].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${session.title}${session.comingSoon ? ", coming soon" : `, ${meta}`}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, session.comingSoon && styles.rowSoon, pressed && styles.pressed]}
      testID={`session-row-${session.slug}`}
    >
      {index !== undefined ? (
        <View style={styles.index}>
          <Text style={styles.indexText}>{index}</Text>
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.title}>{session.title}</Text>
        {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      </View>
      {session.comingSoon ? (
        <Text style={styles.badge}>SOON</Text>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </Pressable>
  );
}

/**
 * Renders the Markdown subset used in session descriptions: "## " headings,
 * "- " bullets, paragraphs and **bold**, all as plain Text.
 */
export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let bullets: string[] = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    blocks.push(
      <Text key={blocks.length} style={styles.paragraph}>
        {inline(paragraph.join(" "))}
      </Text>,
    );
    paragraph = [];
  };
  const flushBullets = () => {
    if (!bullets.length) return;
    blocks.push(
      <View key={blocks.length} style={styles.list}>
        {bullets.map((item, index) => (
          <View key={index} style={styles.bulletRow}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{inline(item)}</Text>
          </View>
        ))}
      </View>,
    );
    bullets = [];
  };

  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushBullets();
    } else if (line.startsWith("## ")) {
      flushParagraph();
      flushBullets();
      blocks.push(
        <Text key={blocks.length} style={styles.heading} accessibilityRole="header">
          {line.slice(3)}
        </Text>,
      );
    } else if (line.startsWith("- ")) {
      flushParagraph();
      bullets.push(line.slice(2));
    } else if (!line.startsWith(">")) {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return <View>{blocks}</View>;
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <Text key={index} style={styles.bold}>
        {part.slice(2, -2)}
      </Text>
    ) : (
      part
    ),
  );
}

const styles = {
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    marginBottom: 8,
  },
  rowSoon: { opacity: 0.6 },
  pressed: { opacity: 0.8 },
  index: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(94, 234, 212, 0.14)",
  },
  indexText: { color: colors.cyan, fontSize: 12, fontWeight: "900" },
  rowText: { flex: 1 },
  title: { color: colors.white, fontSize: 15, fontWeight: "800" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  chevron: { color: colors.cyan, fontSize: 24, fontWeight: "700" },
  heading: { color: colors.white, fontSize: 16, fontWeight: "900", marginTop: 16, marginBottom: 6 },
  paragraph: { color: colors.muted, fontSize: 15, lineHeight: 23, marginBottom: 10 },
  list: { marginBottom: 10, gap: 6 },
  bulletRow: { flexDirection: "row", gap: 8 },
  bulletMark: { color: colors.cyan, fontSize: 15, lineHeight: 23 },
  bulletText: { flex: 1, color: colors.muted, fontSize: 15, lineHeight: 23 },
  bold: { color: colors.white, fontWeight: "800" },
} as const;
