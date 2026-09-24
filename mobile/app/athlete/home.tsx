import { useEffect, useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import { AthleteRouteGuard, useSession } from "../../src/session";
import { canCaregiverAccessDashboard } from "../../src/lib/sessionGuard";
import { addConnectivityListener } from "../../src/lib/offlineCompletionQueue";
import {
  Brand,
  Button,
  PageTitle,
  PrivacyNotice,
  ProgressBar,
  Screen,
  SessionMetadataCard,
  StatusCard,
} from "../../src/ui";
import type { AthleteProgress, SessionPackage } from "../../../shared/types";

function AthleteHomeContent() {
  const router = useRouter();
  const { state, signOut, switchRole } = useSession();
  const api = getApiFacade({ role: state?.currentRole ?? "athlete" });
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [progress, setProgress] = useState<AthleteProgress | null>(null);
  const [pendingCompletions, setPendingCompletions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const account = state?.currentUser;

  useEffect(() => {
    if (!account?.id) return;
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([
      api.getAthleteSession(),
      api.getAthleteProgress(),
      api.getOfflineQueueStatus(),
    ])
      .then(([sessionResult, progressResult, queueStatus]) => {
        if (!mounted) return;
        setSession(sessionResult.session);
        setProgress(progressResult);
        setPendingCompletions(queueStatus.pending);
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(
          caught instanceof LocalApiError
            ? caught.message
            : "Unable to load your beta rehearsal space.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account?.id, state?.pairing?.id]);

  // Wire connectivity listener to sync offline completions when coming online
  useEffect(() => {
    if (!account?.id) return undefined;
    const unsubscribe = addConnectivityListener(() => {
      api.syncOfflineCompletions()
        .then((result) => {
          if (result.synced > 0) {
            setPendingCompletions((current) => Math.max(0, current - result.synced));
          }
        })
        .catch(() => null);
    });
    return unsubscribe;
  }, [account?.id]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const pending = state?.pairing?.status === "pending_athlete_approval";
  const active = state?.pairing?.status === "active";
  const currentProgress = progress ?? state?.athleteProgress ?? null;

  return (
    <Screen testID="athlete-home-screen">
      <Brand compact />
      <PageTitle
        eyebrow={greeting}
        title={account?.displayName ? `${account.displayName}, today's off-pitch training.` : "Off-pitch training for footballers"}
        copy="See it. Rehearse it. Become it. Technical, tactical, and mental development."
      />
      <View style={styles.stateRow}>
        <StatusCard tone="info" title="Training score">
          {currentProgress
            ? `${currentProgress.score} · ${currentProgress.deltaWeekly >= 0 ? "+" : ""}${currentProgress.deltaWeekly} this week`
            : "Build your consistency."}
        </StatusCard>
        <StatusCard tone="info" title="Current streak">
          {currentProgress
            ? `${currentProgress.currentStreakDays} day${currentProgress.currentStreakDays === 1 ? "" : "s"} · Best ${currentProgress.bestStreakDays}`
            : "Complete a session to start your streak."}
        </StatusCard>
      </View>
      {currentProgress ? (
        <View style={styles.progressWrap}>
          <ProgressBar
            value={currentProgress.weeklyCompletedDays}
            maximumValue={currentProgress.weeklyTargetDays}
            label={`${currentProgress.weeklyCompletedDays}/${currentProgress.weeklyTargetDays} days this week`}
            testID="weekly-progress-bar"
          />
        </View>
      ) : null}
      {pendingCompletions > 0 ? (
        <StatusCard tone="warning" title="Saved on this device">
          {pendingCompletions} completion{pendingCompletions === 1 ? "" : "s"} will sync when you reconnect.
        </StatusCard>
      ) : null}
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
        label="Start training session"
        disabled={!session || Boolean(error)}
        onPress={() => {
          if (session) router.push(`/session/${session.id}`);
        }}
        accessibilityLabel="Start the off-pitch training session"
        testID="start-rehearsal-button"
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
        label="Privacy and account"
        variant="secondary"
        onPress={() => router.push("/athlete/settings")}
        accessibilityLabel="Open athlete privacy and account settings"
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

const styles = {
  stateRow: { gap: 12, marginBottom: 12 },
  progressWrap: { marginBottom: 16 },
} as const;

export default function AthleteHomeScreen() {
  return (
    <AthleteRouteGuard>
      <AthleteHomeContent />
    </AthleteRouteGuard>
  );
}
