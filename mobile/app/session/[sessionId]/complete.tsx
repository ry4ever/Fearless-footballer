import { useEffect, useState } from "react";
import { View } from "react-native";
import {
  router,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useNetworkState } from "expo-network";
import {
  clearPendingCompletionKey,
  getOrCreatePendingCompletionKey,
  loadPlaybackProgress,
} from "../../../src/lib/sessionStore";
import { getApiFacade, LocalApiError } from "../../../src/lib/apiFacade";
import { AthleteRouteGuard, useSession } from "../../../src/session";
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
} from "../../../src/ui";
import type {
  ReflectionFeeling,
  SessionCompletionRequest,
  SessionPackage,
} from "../../../../shared/types";
import {
  formatClock,
  isCompletionEligible,
  measurePlaybackSeconds,
} from "../../../src/lib/sessionPlayer";

const feelings: Array<{
  value: ReflectionFeeling;
  label: string;
  description: string;
}> = [
  {
    value: "clearer",
    label: "Clearer",
    description: "The next play feels easier to see.",
  },
  {
    value: "steadier",
    label: "Steadier",
    description: "Your breathing and focus feel more even.",
  },
  {
    value: "more_ready",
    label: "More ready",
    description: "You feel prepared to take the next action.",
  },
];

function CompletionContent() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const network = useNetworkState();
  const { refresh } = useSession();
  const api = getApiFacade({ role: "athlete" });
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [feeling, setFeeling] = useState<ReflectionFeeling | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [pendingCompletions, setPendingCompletions] = useState(0);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    Promise.all([api.getAthleteSession(), loadPlaybackProgress(sessionId)])
      .then(([sessionResult, progress]) => {
        if (!mounted) return;
        if (sessionResult.session.id !== sessionId) {
          router.replace("/athlete/home");
          return;
        }
        const measured = measurePlaybackSeconds(progress?.playedIntervals ?? []);
        setSession(sessionResult.session);
        setPlayedSeconds(measured);
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(
          caught instanceof LocalApiError
            ? caught.message
            : "Unable to load this completion check-in.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router, sessionId]);

  useEffect(() => {
    const reachable =
      network.isConnected === true && network.isInternetReachable !== false;
    if (!reachable) return;
    let active = true;
    api.syncOfflineCompletions()
      .then((result) => {
        if (!active) return;
        setPendingCompletions((current) => Math.max(0, current - result.synced));
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, [network.isConnected, network.isInternetReachable]);

  const thresholdSeconds = session
    ? session.defaultDurationSeconds * 0.8
    : 0;
  const eligible = Boolean(
    session && isCompletionEligible(playedSeconds, session.defaultDurationSeconds),
  );

  async function submitCompletion() {
    if (!session || !feeling || !eligible) return;
    setSubmitting(true);
    setError("");
    setSavedOffline(false);
    try {
      const idempotencyKey = await getOrCreatePendingCompletionKey(session.id);
      const request: SessionCompletionRequest = {
        sessionId: session.id,
        sessionVersion: session.version,
        mode: "interactive",
        completionDurationSeconds: Math.min(
          Math.round(playedSeconds),
          session.defaultDurationSeconds,
        ),
        completedAt: new Date().toISOString(),
        reflection: {
          feeling,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
        idempotencyKey,
      };
      const response = await api.completeSession(session.id, request);
      const queueStatus = await api.getOfflineQueueStatus();
      setPendingCompletions(queueStatus.pending);
      if (queueStatus.pending === 0) {
        await clearPendingCompletionKey(session.id);
      } else {
        setSavedOffline(true);
      }
      await refresh();
      setSuccess(true);
    } catch (caught) {
      setError(
        caught instanceof LocalApiError
          ? caught.message
          : "Unable to save this completion. Your progress is still on this device.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Screen>
        <Brand compact />
        <StatusCard tone="info" title="Preparing check-in">
          Reading your private rehearsal progress…
        </StatusCard>
      </Screen>
    );
  }

  if (error && !session) {
    return (
      <Screen>
        <Brand compact />
        <StatusCard tone="danger" title="Check-in unavailable">
          {error}
        </StatusCard>
        <Button label="Back to rehearsal" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (!session) return null;

  return (
    <Screen testID="session-completion-screen">
      <Brand compact />
      <Button
        label="← Back to player"
        variant="quiet"
        onPress={() => router.back()}
        accessibilityLabel="Back to session player"
      />
      {success ? (
        <View>
          <PageTitle
            eyebrow="Rehearsal complete"
            title="You showed up for the next play."
            copy="Your private reflection is stored only in athlete local state."
          />
          <StatusCard tone="success" title={savedOffline ? "Saved on this device" : "Completion saved"}>
            {savedOffline
              ? "It will sync automatically when this device reconnects."
              : "Your composure and streak progress are updated."}
          </StatusCard>
          {pendingCompletions > 0 ? (
            <StatusCard tone="warning" title="Sync pending">
              {pendingCompletions} completion{pendingCompletions === 1 ? "" : "s"} waiting for a connection.
            </StatusCard>
          ) : null}
          <Button
            label="Return to athlete home"
            onPress={() => router.replace("/athlete/home")}
            accessibilityLabel="Return to athlete home"
          />
          <PrivacyNotice />
        </View>
      ) : (
        <View>
          <PageTitle
            eyebrow="Private check-in"
            title="How do you feel now?"
            copy="Choose one feeling. A private note is optional and never appears in the caregiver view."
          />
          {!eligible ? (
            <StatusCard tone="warning" title="Keep playing">
              You have {formatClock(playedSeconds)} of actual playback. Finish at least {formatClock(thresholdSeconds)} before completing.
            </StatusCard>
          ) : (
            <StatusCard tone="success" title="Playback threshold met">
              You completed {formatClock(playedSeconds)} of actual playback.
            </StatusCard>
          )}
          {error ? <StatusCard tone="danger" title="Unable to save">{error}</StatusCard> : null}
          <View style={styles.choices}>
            {feelings.map((choice) => (
              <ChoiceCard
                key={choice.value}
                title={choice.label}
                description={choice.description}
                selected={feeling === choice.value}
                onPress={() => setFeeling(choice.value)}
                accessibilityLabel={`Choose ${choice.label}`}
                testID={`feeling-${choice.value}`}
              />
            ))}
          </View>
          <Field
            label="Private note (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={1000}
            accessibilityLabel="Private reflection note"
            placeholder="What do you want to remember for the next play?"
            hint="Only you can see this note in the local beta."
          />
          <Button
            label={submitting ? "Saving completion…" : "Save completion"}
            onPress={submitCompletion}
            loading={submitting}
            disabled={!eligible || !feeling || submitting}
            accessibilityLabel="Save session completion"
            testID="save-completion-button"
          />
          <PrivacyNotice />
        </View>
      )}
    </Screen>
  );
}

export default function CompletionScreen() {
  return (
    <AthleteRouteGuard>
      <CompletionContent />
    </AthleteRouteGuard>
  );
}

const styles = {
  choices: { marginBottom: 16 },
} as const;
