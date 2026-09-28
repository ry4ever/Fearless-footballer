import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { WhyVideoLink, WhyVideoModal } from "../../src/ui/WhyVideo";
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
import type { PlaybackEventRequest, SessionAudioVariant, SessionMode, SessionPackage } from "../../../shared/types";
import {
  MODE_COPY,
  availableModes,
  hasMusicChoice,
  progressKey,
  variantFromParams,
  versionQuery,
} from "../../src/lib/sessionVersions";
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

/** Shown while playing when a session has no timed prompts. */
const GUIDANCE = {
  interactive: "Stay with Mark's voice. When he hands over, run your own passages of play — he'll bring you back in.",
  guidance: "Stay with Mark's voice and let the pictures come. He's with you the whole way through.",
  relaxation: "Settle in and let Mark take you through it. Nothing to do but follow along.",
} as const;

/**
 * Version picker at the bottom of the player: one row of modes plus a music
 * switch. A mode's explanation shows only once it has been tapped.
 */
function VersionBar({
  session,
  variant,
  explained,
  onChoose,
}: {
  session: SessionPackage;
  variant: SessionAudioVariant;
  explained: SessionMode | null;
  onChoose: (mode: SessionMode, withMusic: boolean, tapped: boolean) => void;
}) {
  const modes = availableModes(session);
  return (
    <View style={styles.versionBar} testID="version-bar">
      <Text style={styles.versionLabel}>CHOOSE YOUR VERSION</Text>
      <View style={styles.versionRow} accessibilityRole="radiogroup">
        {modes.map((mode) => {
          const selected = variant.mode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              accessibilityLabel={MODE_COPY[mode].label}
              onPress={() => onChoose(mode, variant.withMusic, true)}
              style={({ pressed }) => [styles.versionOption, selected && styles.versionOptionSelected, pressed && styles.pressed]}
              testID={`version-${mode}`}
            >
              <Text style={[styles.versionOptionText, selected && styles.versionOptionTextSelected]} numberOfLines={1}>
                {MODE_COPY[mode].label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {hasMusicChoice(session, variant.mode) ? (
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: variant.withMusic }}
          accessibilityLabel="Music"
          onPress={() => onChoose(variant.mode, !variant.withMusic, false)}
          style={({ pressed }) => [styles.musicToggle, pressed && styles.pressed]}
          testID="music-toggle"
        >
          <View style={[styles.musicBox, variant.withMusic && styles.musicBoxOn]}>
            {variant.withMusic ? <Text style={styles.musicTick}>✓</Text> : null}
          </View>
          <Text style={styles.musicText}>Music</Text>
        </Pressable>
      ) : null}
      {explained ? <Text style={styles.versionDetail}>{MODE_COPY[explained].detail}</Text> : null}
    </View>
  );
}

function PlayerScreen({
  session,
  variant,
  api,
  versionBar,
}: {
  session: SessionPackage;
  /** The chosen recording; null for older single-file sessions. */
  variant: SessionAudioVariant | null;
  api: ReturnType<typeof getApiFacade>;
  /** Shown under the play controls. */
  versionBar?: ReactNode;
}) {
  const router = useRouter();
  const network = useNetworkState();
  const mode = variant?.mode ?? "interactive";
  // Each recording has its own timeline and length, so progress and the
  // 80% rule are per recording.
  const progressId = progressKey(session.id, variant);
  const targetSeconds = variant?.durationSeconds ?? session.defaultDurationSeconds;
  const player = useAudioPlayer(variant?.url ?? session.media.voiceUrl, {
    updateInterval: 250,
  });
  const status = useAudioPlayerStatus(player);
  const [intervals, setIntervals] = useState<PlaybackInterval[]>([]);
  const [restored, setRestored] = useState(false);
  const [finished, setFinished] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const lastTime = useRef(0);
  const intervalsRef = useRef(intervals);
  const lastPlaying = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const duration = status.duration > 0 ? status.duration : targetSeconds;
  const currentTime = clamp(status.currentTime, 0, duration);
  const playedSeconds = measurePlaybackSeconds(intervalsRef.current);
  const thresholdSeconds = targetSeconds * COMPLETION_THRESHOLD;
  const eligible = isCompletionEligible(playedSeconds, targetSeconds);
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
        .then(() => savePlaybackProgress(progressId, progress))
        .catch(() => undefined);
      return saveQueue.current;
    },
    [duration, progressId],
  );

  useEffect(() => {
    let cancelled = false;
    loadPlaybackProgress(progressId)
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
  }, [player.id, progressId]);

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
        mode,
        musicEnabled: variant?.withMusic,
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

  // Read playback state from the status hook. Accessing the native
  // `player.playing` getter can return a Java Integer on Android and crash
  // Expo Go while the screen is being removed. Kept in a ref so the blur
  // cleanup below doesn't re-run (and pause) on every play/pause change.
  const playingRef = useRef(status.playing);
  playingRef.current = status.playing;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (playingRef.current) player.pause();
        persistProgress(lastTime.current, intervalsRef.current);
      };
    }, [persistProgress, player]),
  );

  /** Playback events are analytics only; they must never block the audio. */
  function reportPlaybackEvent(event: PlaybackEventRequest) {
    api.recordPlaybackEvent(session.id, event).catch(() => null);
  }

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
    player.play();
    reportPlaybackEvent({
      eventType: "start",
      mode,
      musicEnabled: variant?.withMusic,
      playbackPositionSeconds: lastTime.current,
      clientTimestamp: new Date().toISOString(),
    });
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
    player.pause();
    reportPlaybackEvent({
      eventType: "pause",
      mode,
      musicEnabled: variant?.withMusic,
      playbackPositionSeconds: nextTime,
      clientTimestamp: new Date().toISOString(),
    });
  }

  async function seekTo(target: number) {
    if (!status.isLoaded || status.duration <= 0) return;
    const nextTime = clamp(target, 0, duration);
    setSeeking(true);
    try {
      await player.seekTo(nextTime);
      lastTime.current = nextTime;
      persistProgress(nextTime, intervalsRef.current);
      reportPlaybackEvent({
        eventType: "seek",
        mode,
        musicEnabled: variant?.withMusic,
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
    targetSeconds,
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
      <PageTitle eyebrow={session.focusArea ?? "Live rehearsal"} title={session.title} />
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
            {currentPrompt?.promptText ??
              (currentTime > 0 || status.playing ? GUIDANCE[mode] : "Press play when you are ready.")}
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
      {versionBar}
      {eligible || finished ? (
        <Button
          label="Review completion"
          onPress={() => router.push(`/session/${session.id}/complete${versionQuery(variant)}`)}
          accessibilityLabel="Review session completion"
          testID="review-completion-button"
        />
      ) : (
        <StatusCard tone="info" title="Finish the rep">
          Play through at least {formatClock(thresholdSeconds)} of the session. Seeking does not count skipped audio.
        </StatusCard>
      )}
      {session.whyVideoUrl ? (
        <WhyVideoLink
          onPress={() => {
            // Pause the session so Mark's video and voice don't overlap.
            if (status.playing) void pause();
            setShowVideo(true);
          }}
        />
      ) : null}
      {showVideo && session.whyVideoUrl ? (
        <WhyVideoModal url={session.whyVideoUrl} onClose={() => setShowVideo(false)} />
      ) : null}
      <PrivacyNotice />
    </Screen>
  );
}

function SessionRouteContent() {
  const { sessionId, mode, music } = useLocalSearchParams<{ sessionId: string; mode?: string; music?: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [explained, setExplained] = useState<SessionMode | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    const api = getApiFacade({ role: "athlete" });
    api.getSessionLibrary()
      .then((library) => {
        if (!mounted) return;
        const found = library.sessions.find((item) => item.id === sessionId && !item.comingSoon);
        if (!found) {
          router.replace("/athlete/home");
          return;
        }
        setSession(found);
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
  const variant = variantFromParams(session, { mode, music });
  const versionBar = variant ? (
    <VersionBar
      session={session}
      variant={variant}
      explained={explained}
      onChoose={(nextMode, withMusic, tapped) => {
        if (tapped) setExplained(nextMode);
        // Each recording keeps its own saved position, so switching resumes it.
        router.setParams({ mode: nextMode, music: withMusic ? "1" : "0" });
      }}
    />
  ) : null;
  // A new recording means a new native player, so key the screen by it.
  return (
    <PlayerScreen key={variant?.url ?? session.id} session={session} variant={variant} api={api} versionBar={versionBar} />
  );
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
  versionBar: { gap: 10, marginBottom: 16 },
  versionLabel: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  versionRow: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  versionOption: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  versionOptionSelected: { backgroundColor: colors.cyanStrong },
  versionOptionText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  versionOptionTextSelected: { color: "#050A19" },
  musicToggle: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start", minHeight: 44 },
  musicBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  musicBoxOn: { backgroundColor: colors.cyanStrong, borderColor: colors.cyanStrong },
  musicTick: { color: "#050A19", fontSize: 13, fontWeight: "900" },
  musicText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  versionDetail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
} as const;
