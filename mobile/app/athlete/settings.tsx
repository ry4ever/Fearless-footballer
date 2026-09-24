import React from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { getApiFacade } from "../../src/lib/apiFacade";
import { clearSessionState, saveSessionState } from "../../src/lib/sessionStore";
import { AthleteAccountGuard, useSession } from "../../src/session";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../../src/ui";

function AthleteSettingsContent() {
  const router = useRouter();
  const { state, refresh, signOut } = useSession();
  const account = state?.currentUser;
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function revokeCaregiver() {
    if (!account || !state?.pairing?.id || state.pairing.status !== "active") return;
    setBusy(true);
    setError(null);
    try {
      const api = getApiFacade({ role: "athlete" });
      const result = await api.revokeConsent(state.pairing.id);
      const revokedAt = result.revokedAt ?? new Date().toISOString();
      await saveSessionState({
        ...state,
        athleteAccount: account.pairingStatus === "active"
          ? { ...account, pairingStatus: "revoked" as const }
          : account,
        caregiverAccount: state.caregiverAccount
          ? { ...state.caregiverAccount, pairingStatus: "revoked" as const }
          : state.caregiverAccount,
        pairing: {
          ...state.pairing,
          status: "revoked" as const,
          consentStatus: "revoked" as const,
          consentRevokedAt: revokedAt,
          revokedAt,
        },
      });
      await refresh();
      router.replace("/athlete/restricted");
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
      "This permanently removes your account and dependent athlete, reflection, and pairing data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            setError(null);
            try {
              const api = getApiFacade({ role: "athlete" });
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
    <Screen testID="athlete-settings-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Athlete account"
        title="Privacy and account"
        copy="Control caregiver access and manage the data stored for this athlete account."
      />
      {error ? <StatusCard tone="danger" title="Account action failed">{error}</StatusCard> : null}
      <StatusCard tone="success" title="Private reflections">
        Reflections and session notes remain available only to the athlete. Caregivers receive aggregate progress patterns.
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
        onPress={revokeCaregiver}
        accessibilityLabel="Revoke active caregiver access"
      />
      <Button
        label="Delete account"
        variant="danger"
        disabled={busy}
        loading={busy}
        onPress={deleteAccount}
        accessibilityLabel="Delete athlete account"
      />
      <Button
        label="Sign out"
        variant="quiet"
        onPress={async () => {
          await signOut();
          router.replace("/role");
        }}
        accessibilityLabel="Sign out of athlete account"
      />
      <PrivacyNotice />
    </Screen>
  );
}

export default function AthleteSettingsScreen() {
  return (
    <AthleteAccountGuard>
      <AthleteSettingsContent />
    </AthleteAccountGuard>
  );
}
