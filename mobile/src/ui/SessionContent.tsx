import { Pressable, Text, View } from "react-native";
import type { SessionPackage } from "../../../shared/types";
import { colors } from "./index";
import { fonts } from "./fonts";

/**
 * One session in a list: title and category. Playable sessions open on
 * press; coming-soon ones are listed only.
 */
export function SessionRow({
  session,
  onPress,
}: {
  session: SessionPackage;
  onPress: () => void;
}) {
  const content = (
    <>
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
  rowText: { flex: 1 },
  title: { fontFamily: fonts.w800, color: colors.white, fontSize: 15 },
  meta: { fontFamily: fonts.w400, color: colors.muted, fontSize: 12, marginTop: 2 },
  badge: {
    fontFamily: fonts.w900,
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  chevron: { fontFamily: fonts.w700, color: colors.cyan, fontSize: 24 },
} as const;
