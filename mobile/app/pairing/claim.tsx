import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { claimPairingCode } from "../../src/lib/localBetaApi";
import type { PairingRelationship } from "../../../shared/types";
import { CaregiverAccountGuard, useSession } from "../../src/session";
import {
  Brand,
  Button,
  ChoiceCard,
  Field,
  PageTitle,
  PrivacyNotice,
  Screen,
  StatusCard,
  colors,
} from "../../src/ui";

export function PairingClaimContent() {
  const router = useRouter();
  const { state, refresh, switchRole } = useSession();
  const [pairingCode, setPairingCode] = useState("");
  const [relationship, setRelationship] = useState<PairingRelationship | null>(null);
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingLink, setPendingLink] = useState<string | null>(null);

  async function submit() {
    setError("");
    if (!pairingCode.trim() || !relationship || !consentConfirmed) {
      setError("Enter the code, choose parent or guardian, and confirm consent.");
      return;
    }

    setLoading(true);
    try {
      const result = await claimPairingCode({
        pairingCode: pairingCode.trim().toUpperCase(),
        relationship,
        consentConfirmed,
      });
      await refresh();
      setPendingLink(result.linkId);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to claim that pairing code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function switchToAthlete() {
    await switchRole("athlete");
    router.replace("/pairing/approval");
  }

  if (pendingLink || state?.pairing?.status === "pending_athlete_approval") {
    return (
      <Screen testID="pairing-claim-screen">
        <Brand compact />
        <PageTitle
          eyebrow="Claim received"
          title="Waiting for athlete approval"
          copy="The caregiver relationship is pending. Switch to the athlete account to approve or reject it."
        />
        <StatusCard tone="warning" title="Pending athlete approval">
          Dashboard access stays locked until the athlete approves this parent or guardian relationship.
        </StatusCard>
        <Button
          label="Switch to athlete account"
          onPress={switchToAthlete}
          accessibilityLabel="Switch to athlete account for approval"
        />
        <Button
          label="Stay on caregiver account"
          variant="quiet"
          onPress={() => router.replace("/caregiver/unlinked")}
          accessibilityLabel="Stay on caregiver account"
        />
        <PrivacyNotice />
      </Screen>
    );
  }

  return (
    <Screen testID="pairing-claim-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Claim pairing code"
        title="Connect as a parent or guardian"
        copy="Enter the code shared by the athlete. You will not receive dashboard access until the athlete approves the relationship."
      />
      <Field
        label="Pairing code"
        value={pairingCode}
        onChangeText={setPairingCode}
        autoCapitalize="characters"
        accessibilityLabel="Pairing code"
        placeholder="FEAR-0001"
        hint="Codes expire 15 minutes after they are generated."
      />
      <ChoiceCard
        title="Parent"
        description="I am the athlete's parent."
        selected={relationship === "parent"}
        onPress={() => setRelationship("parent")}
        testID="parent-relationship-button"
      />
      <ChoiceCard
        title="Guardian"
        description="I am the athlete's legal guardian."
        selected={relationship === "guardian"}
        onPress={() => setRelationship("guardian")}
        testID="guardian-relationship-button"
      />
      <Pressable
        accessibilityLabel="I confirm caregiver consent"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: consentConfirmed }}
        onPress={() => setConsentConfirmed((current) => !current)}
        style={({ pressed }) => [
          styles.consent,
          consentConfirmed && styles.consentChecked,
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.checkbox, consentConfirmed && styles.checkboxChecked]}>
          {consentConfirmed ? <View style={styles.checkboxMark} /> : null}
        </View>
        <Text style={styles.consentCopy}>
          I confirm that I am requesting access as a parent or guardian and
          understand that the athlete controls this link.
        </Text>
      </Pressable>
      {error ? (
        <StatusCard tone="danger" title="Claim unavailable">
          {error}
        </StatusCard>
      ) : null}
      <Button
        label="Claim pairing code"
        onPress={submit}
        loading={loading}
        accessibilityLabel="Claim pairing code"
      />
      <Button
        label="Back to caregiver account"
        variant="quiet"
        onPress={() => router.replace("/caregiver/unlinked")}
        accessibilityLabel="Back to caregiver account"
      />
      <PrivacyNotice />
    </Screen>
  );
}

function PairingClaimScreen() {
  return (
    <CaregiverAccountGuard>
      <PairingClaimContent />
    </CaregiverAccountGuard>
  );
}

export default PairingClaimScreen;

const styles = {
  consent: {
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
  consentChecked: { borderColor: colors.cyan },
  consentCopy: {
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
  pressed: { opacity: 0.8 },
};
