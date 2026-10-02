import { Pressable, Text, View } from "react-native";
import { colors } from "./index";
import { fonts } from "./fonts";

/** Two or three tabs in a pill, e.g. Programmes | My Sessions. */
export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.bar} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[styles.tab, selected && styles.tabSelected]}
            testID={`tab-${option.value}`}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = {
  bar: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(143, 176, 220, 0.16)",
    backgroundColor: "rgba(11, 22, 53, 0.85)",
  },
  tab: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10 },
  tabSelected: { backgroundColor: colors.cyan },
  label: { fontFamily: fonts.w700, color: "#B8C9E4", fontSize: 14 },
  labelSelected: { color: "#041126" },
} as const;
