import { useEffect, useState } from "react";
import { View } from "react-native";
import { StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { getAthleteSession, LocalApiError } from "../../src/lib/localBetaApi";
import { AthleteRouteGuard, useSession } from "../../src/session";
import { canCaregiverAccessDashboard } from "../../src/lib/sessionGuard";
import {
  Brand,
  Button,
  PageTitle,
  PrivacyNotice,
  Screen,
  SessionMetadataCard,
  StatusCard,
} from "../../src/ui";
import type { SessionPackage } from "../../../shared/types";

function AthleteHomeContent() {
  const router = useRouter();
  const { state, signOut, switchRole } = useSession();
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const account = state?.currentUser;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    getAthleteSession()
      .then((result) => {
        if (mounted) setSession(result.session);
      })
      .catch((caught) => {
        if (mounted) {
          setError(
            caught instanceof LocalApiError
              ? caught.message
              : "Unable to load the beta session.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account?.id, state?.pairing?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const pending = state?.pairing?.status === "pending_athlete_approval";
  const active = state?.pairing?.status === "active";

  return (
    <Screen testID="athlete-home-screen">
      <Brand compact />
      <PageTitle
        eyebrow={greeting}
        title={account?.displayName ? `${account.displayName}, breathe before the next play.` : "Your private rehearsal space"}
        copy="One focused session. Your reflections stay with you."
      />
      <View style={styles.stateRow}>
        <StatusCard tone="info" title="Composure">
          Build your baseline.
        </StatusCard>
        <StatusCard tone="info" title="Current streak">
          0/1 · Complete a session to start your streak.
        </StatusCard>
      </View>
      {error ? (
        <StatusCard tone="danger" title="Session unavailable">
          {error}
        </StatusCard>
      ) : null}
      {loading ? (
        <StatusCard tone="info" title="Loading one beta session">
          Checking your authorized session…
        </StatusCard>
      ) : session ? (
        <SessionMetadataCard session={session} />
      ) : null}
      <Button
        label="Session playback arrives in the next beta slice"
        disabled
        accessibilityLabel="Session playback is not available in this beta slice"
        testID="playback-placeholder"
      />
      <Button
        label={pending ? "Review pairing" : active ? "Manage caregiver link" : "Pair with a parent or guardian"}
        variant="secondary"
        onPress={() =>
          router.replace(
            pending || active ? "/pairing/approval" : "/pairing/code",
          )
        }
        accessibilityLabel="Open pairing management"
      />
      <Button
        label="Switch account"
        variant="quiet"
        onPress={async () => {
          const nextState = await switchRole("caregiver");
          const caregiver = nextState.caregiverAccount;
          router.replace(
            caregiver && canCaregiverAccessDashboard(caregiver, nextState.pairing)
              ? "/caregiver/dashboard"
              : "/caregiver/unlinked",
          );
        }}
        accessibilityLabel="Switch to caregiver account"
      />
      <Button
        label="Sign out"
        variant="quiet"
        onPress={async () => {
          await signOut();
          router.replace("/welcome");
        }}
        accessibilityLabel="Sign out of this device"
      />
      <PrivacyNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stateRow: { gap: 12, marginBottom: 16 },
});

export default function AthleteHomeScreen() {
  return (
    <AthleteRouteGuard>
      <AthleteHomeContent />
    </AthleteRouteGuard>
  );
}
