import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import type { ReactNode } from "react";
import type { SessionPackage } from "../../../shared/types";

export const colors = {
  background: "#050A19",
  card: "#0D1730",
  cardStrong: "#0B1635",
  cyan: "#5EEAD4",
  cyanStrong: "#00D8CC",
  magenta: "#C13BFF",
  muted: "#A8B3C7",
  line: "#243455",
  white: "#F8FAFC",
  success: "#54D6AE",
  danger: "#FF7C72",
};

interface ScreenProps {
  children: ReactNode;
  tone?: "default" | "soft";
  testID?: string;
}

export function Screen({ children, tone = "default", testID }: ScreenProps) {
  return (
    <SafeAreaView
      style={[styles.safeArea, tone === "soft" && styles.softArea]}
      testID={testID}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[styles.brand, compact && styles.brandCompact]}
      accessibilityLabel="Fearless Footballer"
    >
      <Text style={styles.brandMain}>FEARLESS</Text>
      <Text style={styles.brandSub}>Footballer</Text>
    </View>
  );
}

export function PageTitle({
  eyebrow,
  title,
  copy,
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
}) {
  return (
    <View style={styles.titleBlock}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {copy ? <Text style={styles.copy}>{copy}</Text> : null}
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress?: () => void | Promise<unknown>;
  variant?: "primary" | "secondary" | "danger" | "quiet";
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const isBusy = disabled || loading;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ disabled: isBusy }}
      disabled={isBusy}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "primary" && styles.buttonPrimary,
        variant === "secondary" && styles.buttonSecondary,
        variant === "danger" && styles.buttonDanger,
        variant === "quiet" && styles.buttonQuiet,
        isBusy && styles.buttonDisabled,
        pressed && !isBusy && styles.buttonPressed,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#050A19" : colors.cyan}
        />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === "danger" && styles.buttonTextLight,
            variant !== "primary" &&
              variant !== "danger" &&
              styles.buttonTextMuted,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
}

export function Field({
  label,
  error,
  hint,
  multiline = false,
  style,
  ...inputProps
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...inputProps}
        multiline={multiline}
        placeholderTextColor={colors.muted}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          error && styles.inputError,
          style,
        ]}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

interface ChoiceCardProps {
  title: string;
  description: string;
  selected?: boolean;
  onPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

export function ChoiceCard({
  title,
  description,
  selected = false,
  onPress,
  accessibilityLabel,
  testID,
}: ChoiceCardProps) {
  return (
    <Pressable
      accessibilityLabel={
        accessibilityLabel ?? `${title}. ${description}`
      }
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceCard,
        selected && styles.choiceSelected,
        pressed && styles.choicePressed,
      ]}
      testID={testID}
    >
      <View style={styles.choiceMark}>
        {selected ? <View style={styles.choiceSelectedMark} /> : null}
      </View>
      <Text style={styles.choiceTitle}>{title}</Text>
      {selected ? <Text style={styles.choiceSelectedLabel}>Selected</Text> : null}
      <Text style={styles.choiceDescription}>{description}</Text>
    </Pressable>
  );
}

export function StatusCard({
  tone = "info",
  title,
  children,
  testID,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: string;
  children: ReactNode;
  testID?: string;
}) {
  const labels = {
    info: "Status",
    success: "Ready",
    warning: "Action needed",
    danger: "Access blocked",
  };
  return (
    <View
      testID={testID}
      accessibilityRole="summary"
      style={[
        styles.statusCard,
        tone === "success" && styles.statusSuccess,
        tone === "warning" && styles.statusWarning,
        tone === "danger" && styles.statusDanger,
      ]}
    >
      <Text style={styles.statusTitle}>{title ?? labels[tone]}</Text>
      <Text style={styles.statusCopy}>{children}</Text>
    </View>
  );
}

export function PairingCodeDisplay({
  code,
  expiresAt,
  testID,
}: {
  code: string;
  expiresAt: string;
  testID?: string;
}) {
  return (
    <View style={styles.codeCard} testID={testID}>
      <Text style={styles.codeLabel}>SHARE ONLY WITH YOUR PARENT OR GUARDIAN</Text>
      <Text style={styles.codeValue}>{code}</Text>
      <Text style={styles.codeExpiry}>
        Expires {new Date(expiresAt).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

export function SessionMetadataCard({ session }: { session: SessionPackage }) {
  return (
    <View style={styles.sessionCard} testID="session-metadata-card">
      <Text style={styles.sessionEyebrow}>ONE BETA SESSION</Text>
      <Text style={styles.sessionTitle}>{session.title}</Text>
      <Text style={styles.sessionSubtitle}>{session.subtitle}</Text>
      <View style={styles.sessionMetaRow}>
        <Text style={styles.sessionMeta}>{session.category}</Text>
        <Text style={styles.sessionMeta}>
          {Math.round(session.defaultDurationSeconds / 60)} min
        </Text>
        <Text style={styles.sessionMeta}>{session.availableModes[0]}</Text>
      </View>
    </View>
  );
}

export function ProgressBar({
  value,
  maximumValue = 100,
  label,
  testID,
}: {
  value: number;
  maximumValue?: number;
  label?: string;
  testID?: string;
}) {
  const safeMaximum = Math.max(0, maximumValue);
  const percentage = safeMaximum > 0 ? clamp(value / safeMaximum, 0, 1) : 0;
  return (
    <View testID={testID}>
      <View style={styles.progressBarTrack}>
        <View
          style={[
            styles.progressBarFill,
            { width: `${Math.round(percentage * 100)}%` },
          ]}
        />
      </View>
      {label ? <Text style={styles.progressLabel}>{label}</Text> : null}
    </View>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <View
      style={[styles.privacyNotice, compact && styles.privacyCompact]}
      accessibilityRole="text"
    >
      <Text style={styles.privacyLabel}>PRIVATE BY DESIGN</Text>
      <Text style={styles.privacyText}>
        Reflections stay with the athlete. Caregivers see progress patterns,
        never transcripts, audio, or playback controls.
      </Text>
    </View>
  );
}

export function LoadingRow({ label = "Working…" }: { label?: string }) {
  return (
    <View style={styles.loadingRow}>
      <ActivityIndicator color={colors.cyan} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  softArea: { backgroundColor: colors.cardStrong },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingBottom: 36,
  },
  brand: { alignItems: "center", marginBottom: 26 },
  brandCompact: { marginBottom: 18 },
  brandMain: {
    color: colors.white,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 3,
  },
  brandSub: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 4,
    marginTop: 3,
    textTransform: "uppercase",
  },
  titleBlock: { marginBottom: 22 },
  eyebrow: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  title: {
    color: colors.white,
    fontSize: 27,
    fontWeight: "800",
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  copy: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  button: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 12,
  },
  buttonPrimary: { backgroundColor: colors.cyanStrong },
  buttonSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonQuiet: { backgroundColor: "transparent" },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: "#050A19", fontSize: 15, fontWeight: "800" },
  buttonTextLight: { color: "#16070d" },
  buttonTextMuted: { color: colors.cyan },
  field: { marginBottom: 16 },
  fieldLabel: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.card,
    color: colors.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 6 },
  hintText: { color: colors.muted, fontSize: 13, marginTop: 6 },
  choiceCard: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
  },
  choiceSelected: { borderColor: colors.cyan, borderWidth: 2 },
  choiceSelectedMark: {
    backgroundColor: colors.cyan,
    borderWidth: 0,
  },
  choiceSelectedLabel: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 4,
  },
  choicePressed: { opacity: 0.8 },
  choiceMark: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: colors.muted,
    marginBottom: 14,
  },
  choiceTitle: {
    color: colors.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  choiceDescription: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  statusCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    padding: 16,
    marginBottom: 14,
  },
  statusSuccess: { borderColor: colors.success },
  statusWarning: { borderColor: colors.magenta },
  statusDanger: { borderColor: colors.danger },
  statusTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  statusCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
  },
  codeCard: {
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cyan,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 22,
    marginBottom: 16,
  },
  codeLabel: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textAlign: "center",
  },
  codeValue: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 3,
    marginVertical: 12,
  },
  codeExpiry: { color: colors.muted, fontSize: 13 },
  sessionCard: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  sessionEyebrow: {
    color: colors.magenta,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  sessionTitle: {
    color: colors.white,
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 6,
  },
  sessionSubtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  sessionMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 14,
    gap: 8,
  },
  sessionMeta: {
    color: colors.cyan,
    fontSize: 12,
    fontWeight: "700",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  privacyNotice: {
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftColor: colors.cyan,
    borderLeftWidth: 3,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 16,
    marginTop: 18,
  },
  privacyCompact: { padding: 12, marginTop: 12 },
  privacyLabel: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  privacyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  progressBarTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#1B2948",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.cyan,
  },
  progressLabel: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 6,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  loadingText: { color: colors.muted, marginLeft: 10 },
});
