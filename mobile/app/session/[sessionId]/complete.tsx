import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
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
  PageTitle,
  PrivacyNotice,
  Screen,
  StatusCard,
  colors,
} from "../../../src/ui";
import type {
  ReflectionFeeling,
  SessionAudioVariant,
  SessionCompletionRequest,
  SessionPackage,
} from "../../../../shared/types";
import { progressKey, variantFromParams } from "../../../src/lib/sessionVersions";
import { fonts } from "../../../src/ui/fonts";
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
  const { sessionId, mode, music } = useLocalSearchParams<{ sessionId: string; mode?: string; music?: string }>();
  const router = useRouter();
  const network = useNetworkState();
  const { refresh } = useSession();
  const api = getApiFacade({ role: "athlete" });
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [variant, setVariant] = useState<SessionAudioVariant | null>(null);
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
    api.getSessionLibrary()
      .then(async (library) => {
        if (!mounted) return;
        const found = library.sessions.find((item) => item.id === sessionId && !item.comingSoon);
        if (!found) {
          router.replace("/athlete/home");
          return;
        }
        // The player saved progress for the recording that was played.
        const chosen = variantFromParams(found, { mode, music });
        const progress = await loadPlaybackProgress(progressKey(found.id, chosen));
        if (!mounted) return;
        setSession(found);
        setVariant(chosen);
        setPlayedSeconds(measurePlaybackSeconds(progress?.playedIntervals ?? []));
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
  }, [router, sessionId, mode, music]);

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

  // The 80% rule is measured against the recording that was played.
  const targetSeconds = variant?.durationSeconds ?? session?.defaultDurationSeconds ?? 0;
  const thresholdSeconds = targetSeconds * 0.8;
  const eligible = Boolean(session && isCompletionEligible(playedSeconds, targetSeconds));

  async function submitCompletion() {
    if (!session || !eligible) return;
    setSubmitting(true);
    setError("");
    setSavedOffline(false);
    try {
      const recordingId = progressKey(session.id, variant);
      const idempotencyKey = await getOrCreatePendingCompletionKey(recordingId);
      const request: SessionCompletionRequest = {
        sessionId: session.id,
        sessionVersion: session.version,
        mode: variant?.mode ?? "interactive",
        ...(variant ? { withMusic: variant.withMusic } : {}),
        completionDurationSeconds: Math.min(Math.round(playedSeconds), targetSeconds),
        completedAt: new Date().toISOString(),
        // Feeling and notes are both optional; send whichever they gave.
        ...(feeling || note.trim()
          ? { reflection: { ...(feeling ? { feeling } : {}), ...(note.trim() ? { note: note.trim() } : {}) } }
          : {}),
        idempotencyKey,
      };
      const response = await api.completeSession(session.id, request);
      const queueStatus = await api.getOfflineQueueStatus();
      setPendingCompletions(queueStatus.pending);
      if (queueStatus.pending === 0) {
        await clearPendingCompletionKey(recordingId);
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
            eyebrow="Reflect"
            title="How did that feel?"
            copy="Pick a feeling, write down your thoughts, or both. Your reflections are private to you."
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
                onPress={() => setFeeling(feeling === choice.value ? null : choice.value)}
                accessibilityLabel={`Choose ${choice.label}`}
                testID={`feeling-${choice.value}`}
              />
            ))}
          </View>
          <View style={styles.notepad}>
            <Text style={styles.notepadLabel}>✎  Your reflection</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={1000}
              accessibilityLabel="Your reflection"
              placeholder="What did you see? What felt different? What will you take into your next game?"
              placeholderTextColor="#7A91B8"
              textAlignVertical="top"
              style={styles.notepadInput}
              testID="reflection-notepad"
            />
            <Text style={styles.notepadCount}>{note.length}/1000</Text>
          </View>
          <Button
            label={submitting ? "Saving…" : "Save"}
            onPress={submitCompletion}
            loading={submitting}
            disabled={!eligible || submitting}
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
  notepad: { marginBottom: 16, gap: 8 },
  notepadLabel: { fontFamily: fonts.w700, color: colors.white, fontSize: 15 },
  notepadInput: {
    minHeight: 150,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(105, 224, 250, 0.3)",
    backgroundColor: "rgba(5, 10, 25, 0.6)",
    color: colors.white,
    fontFamily: fonts.w400,
    fontSize: 15,
    lineHeight: 24,
  },
  notepadCount: { alignSelf: "flex-end", fontFamily: fonts.w400, color: "#7A91B8", fontSize: 12 },
  choices: { marginBottom: 16 },
} as const;
