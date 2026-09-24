import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import type { CaregiverDashboardPayload } from "../../../shared/types";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import { CaregiverRouteGuard, useSession } from "../../src/session";
import { canAthleteAccessSession } from "../../src/lib/sessionGuard";
import { addConnectivityListener } from "../../src/lib/offlineCompletionQueue";
import {
  Brand,
  Button,
  PageTitle,
  PrivacyNotice,
  Screen,
  StatusCard,
} from "../../src/ui";

function CaregiverDashboardContent() {
  const router = useRouter();
  const { state, signOut, switchRole } = useSession();
  const api = getApiFacade({ role: state?.currentRole ?? "caregiver" });
  const [dashboard, setDashboard] = useState<CaregiverDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const athleteId = state?.athleteAccount?.id;

  useEffect(() => {
    if (!athleteId) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    api.getCaregiverDashboard(athleteId)
      .then((result) => {
        if (mounted) setDashboard(result);
      })
      .catch((caught) => {
        if (mounted) {
          setError(
            caught instanceof LocalApiError
              ? caught.message
              : "Unable to load the caregiver dashboard.",
          );
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [athleteId, state?.pairing?.id]);

  useEffect(() => {
    if (!state?.currentUser?.id) return undefined;

    const unsubscribe = addConnectivityListener(() => {
      api.syncOfflineCompletions().catch(() => null);
    });

    return unsubscribe;
  }, [state?.currentUser?.id]);

  return (
    <Screen testID="caregiver-dashboard-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Caregiver dashboard"
        title={dashboard?.athlete.name ? `${dashboard.athlete.name}'s progress` : "Progress overview"}
        copy="This read-only view shares aggregate patterns, not private reflections or session content."
      />
      {error ? (
        <StatusCard tone="danger" title="Dashboard unavailable">
          {error}
        </StatusCard>
      ) : null}
      {loading ? (
        <StatusCard tone="info" title="Loading authorized aggregate view">
          Checking the active caregiver relationship…
        </StatusCard>
      ) : dashboard ? (
        <View style={styles.content}>
          <StatusCard tone="success" title={dashboard.athlete.status === "active" ? "Active link" : "Pending link"}>
            {dashboard.athlete.program}
          </StatusCard>
          <StatusCard tone="info" title="Weekly rhythm">
            {dashboard.weeklySummary.headline} · {dashboard.weeklySummary.daysCompleted}/{dashboard.weeklySummary.daysTarget} days
          </StatusCard>
          <StatusCard tone="info" title="Training score">
            {dashboard.metrics.composureScore.value} · {dashboard.metrics.composureScore.changeWeekly >= 0 ? "+" : ""}{dashboard.metrics.composureScore.changeWeekly} this week
          </StatusCard>
          <StatusCard tone="info" title="Current streak">
            {dashboard.metrics.currentStreak.days} days · Best {dashboard.metrics.currentStreak.bestDays} days
          </StatusCard>
          <StatusCard tone="info" title="Last session">
            {dashboard.metrics.lastRep.title} · {dashboard.metrics.lastRep.duration}
          </StatusCard>
          <StatusCard tone="info" title="Conversation starter">
            {dashboard.conversationStarters[0]?.prompt ?? "Which situation did you rehearse today?"}
          </StatusCard>
          <PrivacyNotice />
        </View>
      ) : null}
      <Button
        label="Privacy and account"
        variant="secondary"
        onPress={() => router.push("/caregiver/settings")}
        accessibilityLabel="Open caregiver privacy and account settings"
      />
      <Button
        label="Switch to athlete account"
        variant="secondary"
        onPress={async () => {
          const nextState = await switchRole("athlete");
          const athlete = nextState.athleteAccount;
          router.replace(
            athlete && canAthleteAccessSession(athlete, nextState.pairing)
              ? "/athlete/home"
              : "/athlete/restricted",
          );
        }}
        accessibilityLabel="Switch to athlete account"
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
    </Screen>
  );
}

import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  content: { gap: 12, marginBottom: 16 },
});

export default function CaregiverDashboardScreen() {
  return (
    <CaregiverRouteGuard>
      <CaregiverDashboardContent />
    </CaregiverRouteGuard>
  );
}
