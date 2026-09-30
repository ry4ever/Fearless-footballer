import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Pressable, Switch, Text, View } from "react-native";
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
import { WhyVideoModal } from "../../src/ui/WhyVideo";
import { photos } from "../../src/ui/photos";
import { sessionPhoto, sessionTagLine, splitTitle, videoLengthLabel } from "../../../shared/player";
import { Button, Screen, StatusCard, Wordmark, colors } from "../../src/ui";
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
  getCurrentPrompt,
  isCompletionEligible,
  measurePlaybackSeconds,
  type PlaybackInterval,
} from "../../src/lib/sessionPlayer";
import { fonts } from "../../src/ui/fonts";

/**
 * The training session: session image and title, Mark's video introduction,
 * what they're working on, then training style and backing music (which
 * pick one of the recordings), a simple player, and Reflect once it's done.
 */
function PlayerScreen({
  session,
  variant,
  api,
  onChoose,
}: {
  session: SessionPackage;
  /** The chosen recording; null for older single-file sessions. */
  variant: SessionAudioVariant | null;
  api: ReturnType<typeof getApiFacade>;
  /** Switch recording: training style and backing music. */
  onChoose: (mode: SessionMode, withMusic: boolean) => void;
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
  const [showVideo, setShowVideo] = useState(false);
  const [explained, setExplained] = useState<SessionMode | null>(null);
  const lastTime = useRef(0);
  const intervalsRef = useRef(intervals);
  const lastPlaying = useRef(false);
  const saveQueue = useRef(Promise.resolve());
  const duration = status.duration > 0 ? status.duration : targetSeconds;
  const currentTime = clamp(status.currentTime, 0, duration);
  const playedSeconds = measurePlaybackSeconds(intervalsRef.current);
  const eligible = isCompletionEligible(playedSeconds, targetSeconds);
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

  const [titleTop, titleBottom] = splitTitle(session.title);
  const tagLine = sessionTagLine(session);
  const videoLength = videoLengthLabel(session.whyVideoDurationSeconds);
  const modes = availableModes(session);
  const progressRatio = duration > 0 ? currentTime / duration : 0;
  const done = eligible || finished;
  const leave = () => {
    persistProgress(lastTime.current, intervalsRef.current);
    router.back();
  };

  return (
    <Screen testID="session-player-screen">
      <View style={styles.hero}>
        <Image source={photos[sessionPhoto(session)]} style={styles.heroPhoto} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroFade} />
        <View style={styles.heroTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={leave} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Wordmark height={22} />
          <View style={styles.back} />
        </View>
        <View style={styles.heroTitle}>
          <Text style={styles.eyebrow}>OFF-PITCH TRAINING</Text>
          <Text style={styles.title} accessibilityRole="header">
            {titleTop}
            {titleBottom ? <Text style={styles.titleAccent}>{`\n${titleBottom}`}</Text> : null}
          </Text>
          {tagLine ? <Text style={styles.tags}>{tagLine.toUpperCase()}</Text> : null}
        </View>
      </View>

      {playerError ? (
        <StatusCard tone="danger" title="Audio unavailable">
          {playerError}
        </StatusCard>
      ) : null}

      {session.whyVideoUrl ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Video introduction: watch Mark introduce today's training"
          onPress={() => {
            // Pause the session so Mark's video and voice don't overlap.
            if (status.playing) void pause();
            setShowVideo(true);
          }}
          style={({ pressed }) => [styles.video, pressed && styles.pressed]}
          testID="video-introduction"
        >
          <View style={styles.videoThumb}>
            <Image source={photos.composure} style={styles.fill} resizeMode="cover" />
            <View style={styles.videoPlay}>
              <Text style={styles.videoPlayGlyph}>▶</Text>
            </View>
          </View>
          <View style={styles.videoText}>
            <Text style={styles.videoEyebrow}>VIDEO INTRODUCTION</Text>
            <Text style={styles.videoTitle}>Watch Mark introduce today's training</Text>
            {videoLength ? <Text style={styles.videoLength}>{videoLength}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}

      {session.workingOn?.length ? (
        <View style={styles.working}>
          <Text style={styles.eyebrow}>TODAY YOU'RE WORKING ON</Text>
          <Text style={styles.workingText}>{session.workingOn.join(" · ")}</Text>
        </View>
      ) : null}

      {variant && modes.length > 0 ? (
        <View style={styles.section} testID="training-style">
          <Text style={[styles.eyebrow, styles.sectionLabel]}>CHOOSE YOUR TRAINING STYLE</Text>
          <View style={styles.styles} accessibilityRole="radiogroup">
            {modes.map((item) => {
              const selected = variant.mode === item;
              return (
                <View key={item} style={[styles.style, selected && styles.styleSelected]}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected, checked: selected }}
                    accessibilityLabel={MODE_COPY[item].label}
                    onPress={() => onChoose(item, variant.withMusic)}
                    style={({ pressed }) => [styles.stylePick, pressed && styles.pressed]}
                    testID={`version-${item}`}
                  >
                    <Text style={styles.styleLabel}>{MODE_COPY[item].label}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`About ${MODE_COPY[item].label}`}
                    accessibilityState={{ expanded: explained === item }}
                    onPress={() => setExplained(explained === item ? null : item)}
                    style={styles.info}
                    hitSlop={8}
                    testID={`about-${item}`}
                  >
                    <Text style={[styles.infoText, explained === item && styles.accent]}>i</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
          {explained ? (
            <View style={styles.explain} accessibilityLiveRegion="polite">
              <Text style={styles.explainTitle}>{MODE_COPY[explained].label}</Text>
              <Text style={styles.explainText}>{MODE_COPY[explained].detail}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close explanation" onPress={() => setExplained(null)} style={styles.explainClose} hitSlop={8}>
                <Text style={styles.explainCloseText}>✕</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      ) : null}

      {variant && hasMusicChoice(session, variant.mode) ? (
        <View style={styles.music}>
          <Text style={styles.musicGlyph}>♫</Text>
          <View style={styles.musicText}>
            <Text style={styles.musicTitle}>Backing music</Text>
            <Text style={styles.musicCopy}>Add music to your training session</Text>
          </View>
          <Switch
            accessibilityLabel="Backing music"
            value={variant.withMusic}
            onValueChange={(next) => onChoose(variant.mode, next)}
            trackColor={{ false: "rgba(143, 176, 220, 0.3)", true: colors.cyan }}
            thumbColor="#FFFFFF"
            testID="music-toggle"
          />
        </View>
      ) : null}

      <View style={styles.player}>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(currentTime) }}
          testID="session-playback-progress"
        >
          <View style={[styles.trackFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
          <View style={[styles.knob, { left: `${Math.round(progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.times}>
          <Text style={styles.time}>{formatClock(currentTime)}</Text>
          <Text style={styles.time}>{formatClock(duration)}</Text>
        </View>
        <Pressable
          accessibilityLabel={status.playing ? "Pause session" : "Play session"}
          accessibilityRole="button"
          disabled={!status.isLoaded || Boolean(playerError)}
          onPress={() => void (status.playing ? pause() : play())}
          style={({ pressed }) => [styles.play, (!status.isLoaded || playerError) && styles.disabled, pressed && styles.pressed]}
          testID="play-button"
        >
          <Text style={[styles.playGlyph, !status.playing && styles.playGlyphOffset]}>{status.playing ? "Ⅱ" : "▶"}</Text>
        </Pressable>
        {!status.isLoaded ? <Text style={styles.status}>Loading audio…</Text> : null}
        {offline ? <Text style={styles.status}>Offline – your progress is saved on this device.</Text> : null}
        {currentPrompt ? <Text style={styles.prompt}>{currentPrompt.promptText}</Text> : null}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !done }}
        disabled={!done}
        onPress={() => router.push(`/session/${session.id}/complete${versionQuery(variant)}`)}
        style={({ pressed }) => [styles.reflect, done && styles.reflectReady, pressed && styles.pressed]}
        testID="review-completion-button"
      >
        <Text style={[styles.reflectTitle, done && styles.reflectTitleReady]}>
          {done ? "Finish & reflect  ✓" : "🔒  Finish & reflect"}
        </Text>
        {!done ? <Text style={styles.reflectCopy}>Complete the session to unlock</Text> : null}
      </Pressable>

      {showVideo && session.whyVideoUrl ? (
        <WhyVideoModal url={session.whyVideoUrl} onClose={() => setShowVideo(false)} />
      ) : null}
    </Screen>
  );
}

function SessionRouteContent() {
  const { sessionId, mode, music } = useLocalSearchParams<{ sessionId: string; mode?: string; music?: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            : "Unable to load this session.",
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
        <StatusCard tone="info" title="Loading session">
          Getting your training ready…
        </StatusCard>
      </Screen>
    );
  }
  if (error || !session) {
    return (
      <Screen>
        <StatusCard tone="danger" title="Session unavailable">
          {error ?? "This session is not available."}
        </StatusCard>
        <Button label="Back to athlete home" onPress={() => router.replace("/athlete/home")} />
      </Screen>
    );
  }
  const api = getApiFacade({ role: "athlete" });
  const variant = variantFromParams(session, { mode, music });
  // A new recording means a new native player, so key the screen by it.
  return (
    <PlayerScreen
      key={variant?.url ?? session.id}
      session={session}
      variant={variant}
      api={api}
      // Each recording keeps its own saved position, so switching resumes it.
      onChoose={(nextMode, withMusic) => router.setParams({ mode: nextMode, music: withMusic ? "1" : "0" })}
    />
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
  hero: { height: 320, marginTop: -20, marginHorizontal: -20, marginBottom: 18, overflow: "hidden" },
  heroPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  heroShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(5, 10, 25, 0.5)" },
  heroFade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 120, backgroundColor: "rgba(5, 10, 25, 0.7)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fonts.w700, color: colors.white, fontSize: 22 },
  heroTitle: { position: "absolute", left: 20, right: 20, bottom: 20 },
  eyebrow: { fontFamily: fonts.w700, color: "#9AB5DC", fontSize: 11, letterSpacing: 2.4 },
  title: { fontFamily: fonts.w800, color: colors.white, fontSize: 38, lineHeight: 42, marginTop: 8 },
  titleAccent: { color: colors.cyan },
  tags: { fontFamily: fonts.w700, color: "#B8C9E4", fontSize: 11, letterSpacing: 2.2, marginTop: 10 },
  video: {
    flexDirection: "row",
    minHeight: 104,
    marginBottom: 18,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(143, 176, 220, 0.25)",
    backgroundColor: "rgba(11, 22, 53, 0.85)",
  },
  videoThumb: { width: "32%", alignItems: "center", justifyContent: "center" },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  videoPlay: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 10, 25, 0.5)",
  },
  videoPlayGlyph: { color: colors.cyan, fontSize: 15, marginLeft: 3 },
  videoText: { flex: 1, justifyContent: "center", gap: 5, paddingVertical: 12, paddingLeft: 14, paddingRight: 4 },
  videoEyebrow: { fontFamily: fonts.w700, color: "#9AB5DC", fontSize: 10, letterSpacing: 1.6 },
  videoTitle: { fontFamily: fonts.w700, color: colors.white, fontSize: 15, lineHeight: 20 },
  videoLength: { fontFamily: fonts.w700, color: "#9AB5DC", fontSize: 11, letterSpacing: 1.8 },
  chevron: { alignSelf: "center", marginRight: 14, color: colors.cyan, fontSize: 26 },
  working: {
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 3,
    borderLeftColor: colors.cyanStrong,
    borderRadius: 12,
    backgroundColor: "rgba(0, 139, 206, 0.1)",
  },
  workingText: { fontFamily: fonts.w600, color: colors.white, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
  section: { marginBottom: 18 },
  sectionLabel: { marginBottom: 12 },
  styles: { flexDirection: "row", gap: 8 },
  style: {
    flex: 1,
    minHeight: 96,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(143, 176, 220, 0.25)",
    backgroundColor: "rgba(11, 22, 53, 0.85)",
  },
  styleSelected: { borderColor: colors.cyan },
  stylePick: { flex: 1, justifyContent: "flex-end", paddingHorizontal: 12, paddingTop: 36, paddingBottom: 14 },
  styleLabel: { fontFamily: fonts.w700, color: colors.white, fontSize: 14, lineHeight: 18 },
  info: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#B8C9E4",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: { fontFamily: fonts.w800, color: "#B8C9E4", fontSize: 12 },
  accent: { color: colors.cyan },
  explain: {
    marginTop: 10,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(105, 224, 250, 0.35)",
    backgroundColor: "rgba(0, 139, 206, 0.12)",
  },
  explainTitle: { fontFamily: fonts.w700, color: colors.white, fontSize: 14 },
  explainText: { fontFamily: fonts.w400, color: "#CFE0F7", fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  explainClose: { position: "absolute", top: 10, right: 12, width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  explainCloseText: { fontFamily: fonts.w700, color: "#B8C9E4", fontSize: 14 },
  music: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 22,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 176, 220, 0.2)",
    backgroundColor: "rgba(11, 22, 53, 0.85)",
  },
  musicGlyph: { color: colors.cyan, fontSize: 22 },
  musicText: { flex: 1 },
  musicTitle: { fontFamily: fonts.w700, color: colors.white, fontSize: 15 },
  musicCopy: { fontFamily: fonts.w400, color: "#A4B6D4", fontSize: 12.5, marginTop: 2 },
  player: { alignItems: "center", gap: 10, marginBottom: 20 },
  track: { alignSelf: "stretch", height: 6, borderRadius: 99, backgroundColor: "rgba(143, 176, 220, 0.18)", justifyContent: "center" },
  trackFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 99, backgroundColor: colors.cyan },
  knob: { position: "absolute", width: 16, height: 16, marginLeft: -8, borderRadius: 8, backgroundColor: colors.cyan },
  times: { alignSelf: "stretch", flexDirection: "row", justifyContent: "space-between" },
  time: { fontFamily: fonts.w600, color: "#A4B6D4", fontSize: 13 },
  play: {
    width: 84,
    height: 84,
    marginTop: 4,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cyan,
  },
  playGlyph: { fontFamily: fonts.w900, color: "#041126", fontSize: 30 },
  playGlyphOffset: { marginLeft: 5 },
  status: { fontFamily: fonts.w500, color: "#8FA3C7", fontSize: 12.5, textAlign: "center" },
  prompt: { fontFamily: fonts.w500, color: "#CFE0F7", fontSize: 14, lineHeight: 20, textAlign: "center" },
  reflect: {
    minHeight: 72,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 176, 220, 0.22)",
    backgroundColor: "rgba(11, 22, 53, 0.6)",
  },
  reflectReady: { borderColor: colors.cyanStrong, backgroundColor: colors.cyanStrong },
  reflectTitle: { fontFamily: fonts.w700, color: "#7F97C0", fontSize: 16 },
  reflectTitleReady: { color: "#041126" },
  reflectCopy: { fontFamily: fonts.w400, color: "#7F97C0", fontSize: 12.5 },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
} as const;
