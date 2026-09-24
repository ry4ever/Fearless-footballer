import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import { useSession } from "../../src/session";
import {
  Brand,
  Button,
  Field,
  PageTitle,
  PrivacyNotice,
  Screen,
  colors,
} from "../../src/ui";

type Mode = "register" | "signin";

export default function CaregiverRegisterScreen() {
  const router = useRouter();
  const { refresh } = useSession();
  const api = getApiFacade({ role: "caregiver" });
  const [mode, setMode] = useState<Mode>("register");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError("");
    if (!displayName.trim() || !email.trim() || !password) {
      setError("Complete every field before continuing.");
      return;
    }
    if (mode === "register" && !consentConfirmed) {
      setError("Acknowledge the privacy notice before creating the account.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        await api.registerAccount({
          role: "caregiver",
          displayName,
          email,
          password,
          privacyAcknowledged: true,
        });
      } else {
        await api.signInAccount({
          role: "caregiver",
          email,
          password,
        });
      }
      await refresh();
      router.replace("/pairing/claim");
    } catch (caught) {
      setError(
        caught instanceof LocalApiError
          ? caught.message
          : "Unable to continue with the caregiver account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen testID="caregiver-register-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Caregiver account"
        title={
          mode === "register"
            ? "Create your caregiver account"
            : "Welcome back"
        }
        copy="Dashboard access requires an athlete pairing code and explicit athlete approval. You will only see aggregate progress patterns."
      />
      <View style={styles.modeRow}>
        <Pressable
          onPress={() => {
            setMode("register");
            setError("");
          }}
          style={({ pressed }) => [
            styles.modeButton,
            mode === "register" && styles.modeButtonActive,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "register" }}
          accessibilityLabel="Create caregiver account"
        >
          <Text
            style={[
              styles.modeText,
              mode === "register" && styles.modeTextActive,
            ]}
          >
            Create
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            setMode("signin");
            setError("");
          }}
          style={({ pressed }) => [
            styles.modeButton,
            mode === "signin" && styles.modeButtonActive,
            pressed && styles.pressed,
          ]}
          accessibilityRole="button"
          accessibilityState={{ selected: mode === "signin" }}
          accessibilityLabel="Sign in to caregiver account"
        >
          <Text
            style={[
              styles.modeText,
              mode === "signin" && styles.modeTextActive,
            ]}
          >
            Sign in
          </Text>
        </Pressable>
      </View>
      {mode === "register" ? (
        <Field
          label="Display name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          accessibilityLabel="Display name"
          placeholder="Your name"
        />
      ) : null}
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
        keyboardType="email-address"
        accessibilityLabel="Email"
        placeholder="you@example.com"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        autoComplete={mode === "register" ? "new-password" : "password"}
        secureTextEntry
        accessibilityLabel="Password"
        placeholder={
          mode === "register" ? "Create a password" : "Your password"
        }
      />
      {mode === "register" ? (
        <Pressable
          accessibilityLabel="I understand the caregiver privacy boundary"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: consentConfirmed }}
          onPress={() => setConsentConfirmed((current) => !current)}
          style={({ pressed }) => [
            styles.acknowledgement,
            consentConfirmed && styles.acknowledgementChecked,
            pressed && styles.pressed,
          ]}
        >
          <View
            style={[
              styles.checkbox,
              consentConfirmed && styles.checkboxChecked,
            ]}
          >
            {consentConfirmed ? <View style={styles.checkboxMark} /> : null}
          </View>
          <Text style={styles.acknowledgementCopy}>
            I understand that I can see aggregate progress only after the
            athlete approves this relationship.
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
      <Button
        label={mode === "register" ? "Continue to pairing" : "Sign in"}
        onPress={submit}
        loading={loading}
        accessibilityLabel={
          mode === "register"
            ? "Continue to pairing"
            : "Sign in to caregiver account"
        }
      />
      <Button
        label="I have an athlete pairing code"
        variant="secondary"
        onPress={() => router.replace("/pairing/claim")}
        accessibilityLabel="Open pairing code claim"
      />
      <PrivacyNotice />
    </Screen>
  );
}

const styles = {
  modeRow: {
    flexDirection: "row" as const,
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  modeButtonActive: {
    borderColor: colors.cyan,
    backgroundColor: "#122544",
  },
  modeText: { color: colors.muted, fontSize: 15, fontWeight: "800" },
  modeTextActive: { color: colors.cyan },
  pressed: { opacity: 0.8 },
  acknowledgement: {
    minHeight: 48,
    flexDirection: "row" as const,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.card,
    padding: 14,
    marginBottom: 16,
  },
  acknowledgementChecked: { borderColor: colors.cyan },
  acknowledgementCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    marginLeft: 12,
  },
  checkbox: {
    width: 18,
    height: 18,
    flexShrink: 0,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.muted,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  checkboxChecked: { borderColor: colors.cyan },
  checkboxMark: {
    width: 10,
    height: 10,
    borderRadius: 1,
    backgroundColor: colors.cyan,
  },
  errorText: { color: colors.danger, fontSize: 14, marginBottom: 12 },
};
