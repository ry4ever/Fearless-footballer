import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { colors } from "./index";

export type AthleteTab = "home" | "training" | "progress" | "more";

const TABS: Array<{ id: AthleteTab; label: string; glyph: string; href: string }> = [
  { id: "home", label: "Home", glyph: "⌂", href: "/athlete/home" },
  { id: "training", label: "Training", glyph: "▶", href: "/athlete/training" },
  { id: "progress", label: "Progress", glyph: "▮▮", href: "/athlete/progress" },
  { id: "more", label: "More", glyph: "•••", href: "/athlete/settings" },
];

/** Bottom navigation for the athlete's four main screens. */
export function TabBar({ active }: { active: AthleteTab }) {
  const router = useRouter();
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(tab.href as never);
            }}
            style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            testID={`tab-${tab.id}`}
          >
            <Text style={[styles.glyph, selected && styles.selected]}>{tab.glyph}</Text>
            <Text style={[styles.label, selected && styles.selected]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = {
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(94, 234, 212, 0.18)",
    backgroundColor: "rgba(5, 10, 25, 0.97)",
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", gap: 3 },
  pressed: { opacity: 0.7 },
  glyph: { color: "#7593BD", fontSize: 16, fontWeight: "900", letterSpacing: -1 },
  label: { color: "#7593BD", fontSize: 11, fontWeight: "700" },
  selected: { color: colors.cyan },
} as const;
