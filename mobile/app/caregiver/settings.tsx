import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { getApiFacade } from "../../src/lib/apiFacade";
import { clearSessionState, saveSessionState } from "../../src/lib/sessionStore";
import { CaregiverAccountGuard, useSession } from "../../src/session";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../../src/ui";

function CaregiverSettingsContent() {
  const router = useRouter();
  const { state, refresh, signOut } = useSession();
  const account = state?.currentUser;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function revokeAccess() {
    if (!account || !state?.pairing?.id || state.pairing.status !== "active") return;
    setBusy(true);
    setError(null);
    try {
      const api = getApiFacade({ role: "caregiver" });
      const result = await api.revokeConsent(state.pairing.id);
      const revokedAt = result.revokedAt ?? new Date().toISOString();
      await saveSessionState({
        ...state,
        caregiverAccount: account
          ? { ...account, pairingStatus: "revoked" as const }
          : account,
        athleteAccount: state.athleteAccount
          ? { ...state.athleteAccount, pairingStatus: "revoked" as const }
          : state.athleteAccount,
        pairing: {
          ...state.pairing,
          status: "revoked" as const,
          consentStatus: "revoked" as const,
          consentRevokedAt: revokedAt,
          revokedAt,
        },
      });
      await refresh();
      router.replace("/caregiver/unlinked");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke caregiver access.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount() {
    if (!account) return;
    Alert.alert(
      "Delete account?",
      "This permanently removes your caregiver account and its pairing data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              const api = getApiFacade({ role: "caregiver" });
              await api.deleteAccount({ confirmation: "DELETE_MY_ACCOUNT" });
              await clearSessionState();
              await refresh();
              router.replace("/role");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Unable to delete this account.");
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen testID="caregiver-settings-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Caregiver account"
        title="Privacy and account"
        copy="Manage your consented read-only access. You can revoke the link or delete this caregiver account at any time."
      />
      {error ? <StatusCard tone="danger" title="Account action failed">{error}</StatusCard> : null}
      <StatusCard tone="success" title="Aggregate access only">
        This account can see progress patterns only. Reflections, transcripts, audio, and playback controls remain private to the athlete.
      </StatusCard>
      <Button
        label="Privacy policy"
        variant="secondary"
        onPress={() => router.push("/privacy-policy")}
        accessibilityLabel="Open privacy policy"
      />
      <Button
        label="Terms of service"
        variant="secondary"
        onPress={() => router.push("/terms")}
        accessibilityLabel="Open terms of service"
      />
      <Button
        label={state?.pairing?.status === "active" ? "Revoke caregiver access" : "Caregiver access is not active"}
        variant="danger"
        disabled={busy || state?.pairing?.status !== "active"}
        loading={busy && state?.pairing?.status === "active"}
        onPress={revokeAccess}
        accessibilityLabel="Revoke caregiver access"
      />
      <Button
        label="Delete account"
        variant="danger"
        disabled={busy}
        loading={busy}
        onPress={deleteAccount}
        accessibilityLabel="Delete caregiver account"
      />
      <Button
        label="Sign out"
        variant="quiet"
        onPress={async () => {
          await signOut();
          router.replace("/role");
        }}
        accessibilityLabel="Sign out of caregiver account"
      />
      <PrivacyNotice />
    </Screen>
  );
}

export default function CaregiverSettingsScreen() {
  return (
    <CaregiverAccountGuard>
      <CaregiverSettingsContent />
    </CaregiverAccountGuard>
  );
}
