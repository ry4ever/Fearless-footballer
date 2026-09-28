import { useEffect, useState } from "react";
import { Text, View } from "react-native";
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
  StatusCard,
  colors,
} from "../../src/ui";
import { SessionRow } from "../../src/ui/SessionContent";
import type { AthleteProgress, SessionLibraryResponse, SessionPackage } from "../../../shared/types";

function AthleteHomeContent() {
  const router = useRouter();
  const { state, signOut, switchRole } = useSession();
  const api = getApiFacade({ role: state?.currentRole ?? "athlete" });
  const [library, setLibrary] = useState<SessionLibraryResponse | null>(null);
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
      api.getSessionLibrary(),
      api.getAthleteProgress(),
      api.getOfflineQueueStatus(),
    ])
      .then(([libraryResult, progressResult, queueStatus]) => {
        if (!mounted) return;
        setLibrary(libraryResult);
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
  const sessions = library?.sessions ?? [];
  const byId = new Map(sessions.map((item) => [item.id, item]));
  const programmes = (library?.programmes ?? []).filter((programme) =>
    programme.sessionIds.some((id) => byId.has(id)),
  );
  const playable = sessions.filter((item) => !item.comingSoon);
  const comingSoon = sessions.filter((item) => item.comingSoon);
  const groups = new Map<string, SessionPackage[]>();
  for (const item of playable) {
    const key = item.focusArea ?? "Sessions";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  // A session opens straight into the player; the version is chosen there.
  const openSession = (item: SessionPackage) => router.push(`/session/${item.id}`);

  return (
    <Screen testID="athlete-home-screen">
      <Brand compact />
      <PageTitle
        eyebrow={greeting}
        title={account?.displayName ? `${account.displayName}, today's off-pitch training.` : "Off-pitch training for footballers"}
        copy="See it. Rehearse it. Become it. Technical, tactical, and mental development."
      />
      <View style={styles.stateRow}>
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
        <StatusCard tone="info" title="Loading your sessions">
          Checking your training library…
        </StatusCard>
      ) : !error && playable.length === 0 ? (
        <StatusCard tone="info" title="No session available yet">
          New training is on its way. Check back soon — your progress is saved.
        </StatusCard>
      ) : null}
      {programmes.map((programme) => (
        <View key={programme.slug} style={styles.section} testID={`programme-${programme.slug}`}>
          <Text style={styles.eyebrow}>PROGRAMME</Text>
          <Text style={styles.sectionTitle}>{programme.title}</Text>
          <Text style={styles.sectionCopy}>{programme.description}</Text>
          {programme.sessionIds.map((id, index) => {
            const item = byId.get(id);
            return item ? (
              <SessionRow key={id} session={item} index={index + 1} onPress={() => openSession(item)} />
            ) : null;
          })}
        </View>
      ))}
      {playable.length > 0 ? (
        <View style={styles.section} testID="all-sessions">
          <Text style={styles.eyebrow}>ALL SESSIONS</Text>
          {Array.from(groups.entries()).map(([group, items]) => (
            <View key={group}>
              <Text style={styles.groupLabel}>{group}</Text>
              {items.map((item) => (
                <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
              ))}
            </View>
          ))}
        </View>
      ) : null}
      {comingSoon.length > 0 ? (
        <View style={styles.section} testID="coming-soon">
          <Text style={styles.eyebrow}>COMING SOON</Text>
          {comingSoon.map((item) => (
            <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
          ))}
        </View>
      ) : null}
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
  section: { marginBottom: 20 },
  eyebrow: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 6 },
  sectionTitle: { color: colors.white, fontSize: 19, fontWeight: "900", marginBottom: 4 },
  sectionCopy: { color: colors.muted, fontSize: 14, lineHeight: 21, marginBottom: 12 },
  groupLabel: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 },
} as const;

export default function AthleteHomeScreen() {
  return (
    <AthleteRouteGuard>
      <AthleteHomeContent />
    </AthleteRouteGuard>
  );
}
