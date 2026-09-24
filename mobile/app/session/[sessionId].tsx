import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import {
  setIsAudioActiveAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useNetworkState } from "expo-network";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import {
  loadPlaybackProgress,
  savePlaybackProgress,
} from "../../src/lib/sessionStore";
import { AthleteRouteGuard } from "../../src/session";
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
import type { PlaybackEventRequest, SessionPackage } from "../../../shared/types";
import {
  addPlaybackInterval,
  clamp,
  formatClock,
  getActivePhase,
  getCurrentPrompt,
  getPlaybackPercent,
  isCompletionEligible,
  measurePlaybackSeconds,
  type PlaybackInterval,
} from "../../src/lib/sessionPlayer";

const COMPLETION_THRESHOLD = 0.8;

function PlayerScreen({ session, api }: { session: SessionPackage; api: ReturnType<typeof getApiFacade> }) {
  const router = useRouter();
  const network = useNetworkState();
  const player = useAudioPlayer(session.media.voiceUrl, {
    updateInterval: 250,
  });
  const status = useAudioPlayerStatus(player);
  const [intervals, setIntervals] = useState<PlaybackInterval[]>([]);
  const [restored, setRestored] = useState(false);
  const [finished, setFinished] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const lastTime = useRef(0);
  const intervalsRef = useRef(intervals);
  const lastPlaying = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const duration = status.duration > 0 ? status.duration : session.defaultDurationSeconds;
  const currentTime = clamp(status.currentTime, 0, duration);
  const playedSeconds = measurePlaybackSeconds(intervalsRef.current);
  const thresholdSeconds = session.defaultDurationSeconds * COMPLETION_THRESHOLD;
  const eligible = isCompletionEligible(playedSeconds, session.defaultDurationSeconds);
  const activePhase = getActivePhase(session.phases, currentTime);
  const currentPrompt = getCurrentPrompt(session.prompts, currentTime);
  const offline = network.isConnected !== true || network.isInternetReachable === false;

  const commitIntervals = useCallback((next: PlaybackInterval[]) => {
    intervalsRef.current = next;
    setIntervals(next);
  }, []);

  const persistProgress = useCallback(
    (
      positionSeconds = lastTime.current,
      nextIntervals = intervalsRef.current,
    ): Promise<void> => {
      const progress = {
        positionSeconds: clamp(positionSeconds, 0, duration),
        playedIntervals: nextIntervals,
        updatedAt: new Date().toISOString(),
      };
      saveQueue.current = saveQueue.current
        .then(() => savePlaybackProgress(session.id, progress))
        .catch(() => undefined);
      return saveQueue.current;
    },
    [duration, session.id],
  );

  useEffect(() => {
    let cancelled = false;
    loadPlaybackProgress(session.id)
      .then((saved) => {
        if (cancelled) return;
        const savedIntervals = saved?.playedIntervals ?? [];
        intervalsRef.current = savedIntervals;
        setIntervals(savedIntervals);
        lastTime.current = saved?.positionSeconds ?? 0;
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) setRestored(true);
      });
    return () => {
      cancelled = true;
    };
  }, [player.id, session.id]);

  useEffect(() => {
    if (!restored || !status.isLoaded || status.duration <= 0) return;
    const savedPosition = intervalsRef.current.length
      ? Math.max(...intervalsRef.current.map((interval) => interval.endSeconds))
      : lastTime.current;
    if (savedPosition > 0.5) {
      void player.seekTo(clamp(savedPosition, 0, status.duration));
    }
  }, [player, restored, status.duration, status.isLoaded]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    }).catch(() => {
      setPlayerError("Audio session setup is unavailable. Try again before playing.");
    });
    return () => {
      try {
        player.clearLockScreenControls();
      } catch {
        // Expo Audio may release the native player before React cleanup runs.
      }
      void setIsAudioActiveAsync(false).catch(() => undefined);
    };
  }, [player]);

  useEffect(() => {
    if (!status.isLoaded) return;
    try {
      player.setActiveForLockScreen(
        true,
        {
          title: session.title,
          artist: session.mentor.name,
          albumTitle: "Fearless Footballer",
        },
        { showSeekBackward: true, showSeekForward: true },
      );
    } catch {
      setPlayerError("Lock-screen audio controls are unavailable on this device.");
    }
  }, [player, session.mentor.name, session.title, status.isLoaded]);

  useEffect(() => {
    if (!status.mediaServicesDidReset) return;
    persistProgress(lastTime.current, intervalsRef.current);
    setPlayerError("Audio was interrupted by the operating system. Press play to resume.");
  }, [persistProgress, status.mediaServicesDidReset]);

  useEffect(() => {
    if (!status.isLoaded || status.duration <= 0) return;
    const nextTime = clamp(status.currentTime, 0, duration);
    const previousTime = lastTime.current;
    if (
      status.playing &&
      !seeking &&
      nextTime > previousTime &&
      nextTime - previousTime <= 5
    ) {
      commitIntervals(
        addPlaybackInterval(intervalsRef.current, previousTime, nextTime),
      );
    }
    lastTime.current = nextTime;
    if (lastPlaying.current && !status.playing) {
      persistProgress(nextTime, intervalsRef.current);
    }
    lastPlaying.current = status.playing;
    if (status.didJustFinish) {
      setFinished(true);
      persistProgress(nextTime, intervalsRef.current);
      void api.recordPlaybackEvent(session.id, {
        eventType: "finish",
        mode: "interactive",
        playbackPositionSeconds: nextTime,
        clientTimestamp: new Date().toISOString(),
      }).catch(() => null);
    }
    if (status.error) setPlayerError(status.error);
  }, [
    commitIntervals,
    duration,
    persistProgress,
    seeking,
    session.id,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.error,
    status.isLoaded,
    status.playing,
  ]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        // Read playback state from the status hook. Accessing the native
        // `player.playing` getter can return a Java Integer on Android and
        // crash Expo Go while the screen is being removed.
        if (status.playing) player.pause();
        persistProgress(lastTime.current, intervalsRef.current);
      };
    }, [persistProgress, player, status.playing]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "inactive" || state === "background") {
        persistProgress(lastTime.current, intervalsRef.current);
      }
    });
    return () => subscription.remove();
  }, [persistProgress]);

  async function play() {
    if (!status.isLoaded || status.duration <= 0) return;
    lastTime.current = clamp(status.currentTime, 0, duration);
    setFinished(false);
    try {
      await api.recordPlaybackEvent(session.id, {
        eventType: "start",
        mode: "interactive",
        playbackPositionSeconds: lastTime.current,
        clientTimestamp: new Date().toISOString(),
      });
      player.play();
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "Unable to start playback.");
    }
  }

  async function pause() {
    const nextTime = clamp(status.currentTime, 0, duration);
    if (status.playing && nextTime > lastTime.current) {
      commitIntervals(
        addPlaybackInterval(intervalsRef.current, lastTime.current, nextTime),
      );
    }
    lastTime.current = nextTime;
    persistProgress(nextTime, intervalsRef.current);
    try {
      await api.recordPlaybackEvent(session.id, {
        eventType: "pause",
        mode: "interactive",
        playbackPositionSeconds: nextTime,
        clientTimestamp: new Date().toISOString(),
      });
      player.pause();
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "Unable to pause playback.");
    }
  }

  async function seekTo(target: number) {
    if (!status.isLoaded || status.duration <= 0) return;
    const nextTime = clamp(target, 0, duration);
    setSeeking(true);
    try {
      await player.seekTo(nextTime);
      lastTime.current = nextTime;
      persistProgress(nextTime, intervalsRef.current);
      await api.recordPlaybackEvent(session.id, {
        eventType: "seek",
        mode: "interactive",
        playbackPositionSeconds: nextTime,
        clientTimestamp: new Date().toISOString(),
      });
    } catch (error) {
      setPlayerError(error instanceof Error ? error.message : "Unable to seek playback.");
    } finally {
      setSeeking(false);
    }
  }

  const progressPercent = getPlaybackPercent(
    currentTime,
    status.duration,
    session.defaultDurationSeconds,
  );

  return (
    <Screen testID="session-player-screen">
      <Brand compact />
      <Pressable
        accessibilityLabel="Back to athlete home"
        accessibilityRole="button"
        onPress={() => {
          persistProgress(lastTime.current, intervalsRef.current);
          router.back();
        }}
        style={[styles.backButton, styles.backButtonPressed]}
      >
        <Text style={styles.backButtonText}>← Athlete home</Text>
      </Pressable>
      <PageTitle
        eyebrow="Live rehearsal"
        title={session.title}
        copy={session.subtitle}
      />
      <View style={styles.statusGrid}>
        <StatusCard tone={offline ? "warning" : "success"} title="Connection">
          {offline ? "Offline · progress is saved on this device" : "Online · ready to play"}
        </StatusCard>
        <StatusCard tone="info" title="Audio route">
          System output · headphones or device speaker
        </StatusCard>
      </View>
      {playerError ? (
        <StatusCard tone="danger" title="Audio unavailable">
          {playerError}
        </StatusCard>
      ) : null}
      <View style={styles.playerCard}>
        <View style={styles.phaseRow}>
          <Text style={styles.phaseLabel}>
            {activePhase ? `PHASE ${activePhase.number} · ${activePhase.label}` : "GET READY"}
          </Text>
          <Text style={styles.clock}>{formatClock(currentTime)}</Text>
        </View>
        <ProgressBar
          value={currentTime}
          maximumValue={duration}
          label={`${Math.round(progressPercent)}% · ${formatClock(duration)} total`}
          testID="session-playback-progress"
        />
        <View style={styles.promptCard}>
          <Text style={styles.promptLabel}>CURRENT PROMPT</Text>
          <Text style={styles.promptText}>
            {currentPrompt?.promptText ?? "Press play when you are ready."}
          </Text>
          {currentPrompt?.subText ? (
            <Text style={styles.promptSubtext}>{currentPrompt.subText}</Text>
          ) : null}
        </View>
        <View style={styles.controls}>
          <Pressable
            accessibilityLabel="Back fifteen seconds"
            accessibilityRole="button"
            disabled={!status.isLoaded}
            onPress={() => void seekTo(currentTime - 15)}
            style={({ pressed }) => [
              styles.roundControl,
              styles.roundControlSecondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.controlText}>−15</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={status.playing ? "Pause rehearsal" : "Play rehearsal"}
            accessibilityRole="button"
            disabled={!status.isLoaded || Boolean(playerError)}
            onPress={() => void (status.playing ? pause() : play())}
            style={({ pressed }) => [
              styles.roundControl,
              styles.playControl,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.playControlText}>{status.playing ? "Ⅱ" : "▶"}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel="Forward fifteen seconds"
            accessibilityRole="button"
            disabled={!status.isLoaded}
            onPress={() => void seekTo(currentTime + 15)}
            style={({ pressed }) => [
              styles.roundControl,
              styles.roundControlSecondary,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.controlText}>+15</Text>
          </Pressable>
        </View>
        <View style={styles.playbackMeter}>
          <Text style={styles.playbackMeterLabel}>ACTUAL PLAYBACK</Text>
          <Text style={styles.playbackMeterValue}>
            {formatClock(playedSeconds)} / {formatClock(thresholdSeconds)} to finish
          </Text>
        </View>
      </View>
      {eligible || finished ? (
        <Button
          label="Review completion"
          onPress={() => router.push(`/session/${session.id}/complete`)}
          accessibilityLabel="Review session completion"
          testID="review-completion-button"
        />
      ) : (
        <StatusCard tone="info" title="Finish the rep">
          Play through at least {formatClock(thresholdSeconds)} of the session. Seeking does not count skipped audio.
        </StatusCard>
      )}
      <PrivacyNotice />
    </Screen>
  );
}

function SessionRouteContent() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    const api = getApiFacade({ role: "athlete" });
    api.getAthleteSession()
      .then((result) => {
        if (!mounted) return;
        if (result.session.id !== sessionId) {
          router.replace("/athlete/home");
          return;
        }
        setSession(result.session);
      })
      .catch((caught) => {
        if (!mounted) return;
        setError(
          caught instanceof LocalApiError
            ? caught.message
            : "Unable to load this rehearsal.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [router, sessionId]);

  if (loading) {
    return (
      <Screen>
        <StatusCard tone="info" title="Loading rehearsal">
          Preparing your private audio space…
        </StatusCard>
      </Screen>
    );
  }
  if (error || !session) {
    return (
      <Screen>
        <StatusCard tone="danger" title="Rehearsal unavailable">
          {error ?? "This session is not available."}
        </StatusCard>
        <Button label="Back to athlete home" onPress={() => router.replace("/athlete/home")} />
      </Screen>
    );
  }
  const api = getApiFacade({ role: "athlete" });
  return <PlayerScreen session={session} api={api} />;
}

export default function SessionScreen() {
  return (
    <AthleteRouteGuard>
      <SessionRouteContent />
    </AthleteRouteGuard>
  );
}

const styles = {
  backButton: { marginBottom: 18, paddingHorizontal: 4 },
  backButtonPressed: { opacity: 0.8 },
  backButtonText: { color: colors.cyan, fontSize: 15, fontWeight: "800" },
  statusGrid: { gap: 12, marginBottom: 16 },
  playerCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    gap: 16,
  },
  phaseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  phaseLabel: {
    color: colors.magenta,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    flex: 1,
  },
  clock: { color: colors.white, fontSize: 18, fontWeight: "900" },
  promptCard: {
    backgroundColor: "#08122A",
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  promptLabel: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 8,
  },
  promptText: { color: colors.white, fontSize: 18, fontWeight: "800", lineHeight: 25 },
  promptSubtext: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 8 },
  controls: { flexDirection: "row", justifyContent: "center", gap: 16 },
  roundControl: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#172746",
    borderColor: colors.line,
    borderWidth: 1,
  },
  roundControlSecondary: { width: 58, height: 58, borderRadius: 29 },
  playControl: { backgroundColor: colors.cyanStrong, borderColor: colors.cyanStrong },
  controlText: { color: colors.white, fontSize: 16, fontWeight: "900" },
  playControlText: { color: "#050A19", fontSize: 25, fontWeight: "900" },
  pressed: { opacity: 0.78 },
  playbackMeter: { alignItems: "center" },
  playbackMeterLabel: {
    color: colors.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 5,
  },
  playbackMeterValue: { color: colors.white, fontSize: 15, fontWeight: "800" },
} as const;
