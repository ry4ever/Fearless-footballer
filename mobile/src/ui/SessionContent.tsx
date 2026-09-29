import { Pressable, Text, View } from "react-native";
import type { SessionPackage } from "../../../shared/types";
import { colors } from "./index";

/**
 * One session in a list: number (in programmes), title and category. Playable
 * sessions open on press; coming-soon ones are listed only.
 */
export function SessionRow({
  session,
  index,
  done = false,
  onPress,
}: {
  session: SessionPackage;
  index?: number;
  /** Completed at least once (programme lists fill the number in). */
  done?: boolean;
  onPress: () => void;
}) {
  const content = (
    <>
      {index !== undefined ? (
        <View style={[styles.index, done && styles.indexDone]}>
          <Text style={[styles.indexText, done && styles.indexTextDone]}>{index}</Text>
        </View>
      ) : null}
      <View style={styles.rowText}>
        <Text style={styles.title}>{session.title}</Text>
        {session.focusArea ? <Text style={styles.meta}>{session.focusArea}</Text> : null}
      </View>
      {session.comingSoon ? <Text style={styles.badge}>SOON</Text> : <Text style={styles.chevron}>›</Text>}
    </>
  );
  if (session.comingSoon) {
    return (
      <View
        accessible
        accessibilityLabel={`${session.title}, coming soon`}
        style={[styles.row, styles.rowSoon]}
        testID={`session-row-${session.slug}`}
      >
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={session.focusArea ? `${session.title}, ${session.focusArea}` : session.title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`session-row-${session.slug}`}
    >
      {content}
    </Pressable>
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
  indexDone: { backgroundColor: colors.cyan },
  indexTextDone: { color: "#041126" },
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
} as const;
