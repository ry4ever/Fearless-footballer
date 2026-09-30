import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Flower2,
  Footprints,
  Info,
  Lock,
  Music,
  Pause,
  Play,
  UserRound,
  X,
} from "lucide-react";
import { sessionPhoto, sessionTags, splitTitle, TRAINING_STYLES, videoLengthLabel } from "@shared/player";
import type {
  CompletionSyncResponse,
  PlaybackEventRequest,
  ReflectionFeeling,
  SessionAudioVariant,
  SessionCompletionRequest,
  SessionMode,
  SessionPackage,
} from "@shared/types";
import { audioEngine } from "../audio/audioEngine";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { isRetryableError, offlineQueue } from "../lib/offlineQueue";
import { photo } from "../lib/onboardingOptions";
import { useSession } from "./session";
import "./player.css";

export type CompletionOutcome =
  | { kind: "synced"; response: CompletionSyncResponse }
  | { kind: "queued" };

interface LivePlayerScreenProps {
  session: SessionPackage;
  onBack: () => void;
  onComplete: (outcome: CompletionOutcome) => void;
}

interface PlayerCoreProps extends LivePlayerScreenProps {
  /** The chosen recording; null for older single-file sessions. */
  variant: SessionAudioVariant | null;
  modes: SessionMode[];
  onChooseMode: (mode: SessionMode) => void;
  /** Whether the chosen style was recorded both with and without music. */
  hasMusicChoice: boolean;
  onChooseMusic: (withMusic: boolean) => void;
}

/** The server only accepts a completion after 80% of the session. */
const REQUIRED_RATIO = 0.8;
/** How long to wait for the voice track before falling back to guided prompts. */
const AUDIO_LOAD_TIMEOUT_MS = 8000;

const MODE_ORDER: SessionMode[] = ["interactive", "guidance", "relaxation"];
const MODE_ICONS: Record<SessionMode, typeof Play> = { interactive: Footprints, guidance: UserRound, relaxation: Flower2 };

/** The recording for a style and music choice, falling back to the other music option. */
function pickVariant(session: SessionPackage, mode: SessionMode, withMusic: boolean): SessionAudioVariant | null {
  const variants = session.audio ?? [];
  return (
    variants.find((v) => v.mode === mode && v.withMusic === withMusic) ??
    variants.find((v) => v.mode === mode) ??
    null
  );
}

/**
 * The training session: session image, title and tags, Mark's video
 * introduction, then two choices – training style and backing
 * music – which pick one of the recordings. Reflect unlocks once the session
 * is done: introduce → choose → train → reflect.
 */
export function LivePlayerScreen({ session, onBack, onComplete }: LivePlayerScreenProps) {
  const modes = MODE_ORDER.filter((mode) => session.audio?.some((v) => v.mode === mode));
  const [mode, setMode] = useState<SessionMode>(modes[0] ?? "interactive");
  const [withMusic, setWithMusic] = useState(true);
  const variant = pickVariant(session, mode, withMusic);
  const hasMusicChoice =
    Boolean(session.audio?.some((v) => v.mode === mode && v.withMusic)) &&
    Boolean(session.audio?.some((v) => v.mode === mode && !v.withMusic));

  // Each recording has its own timeline, so switching starts it from the beginning.
  return (
    <PlayerCore
      key={variant?.url ?? session.id}
      session={session}
      variant={variant}
      modes={modes}
      onChooseMode={setMode}
      hasMusicChoice={hasMusicChoice}
      onChooseMusic={setWithMusic}
      onBack={onBack}
      onComplete={onComplete}
    />
  );
}

/** Shown while playing without audio when a session has no timed prompts. */
const GUIDANCE: Record<SessionMode, string> = {
  interactive: "Stay with Mark's voice. When he hands over, run your own passages of play – he'll bring you back in.",
  guidance: "Stay with Mark's voice and let the pictures come. He's with you the whole way through.",
  relaxation: "Settle in and let Mark take you through it. Nothing to do but follow along.",
};

const FEELINGS: Array<{ id: ReflectionFeeling; label: string; desc: string }> = [
  { id: "more_ready", label: "More ready", desc: "Instincts primed for match speed" },
  { id: "steadier", label: "Steadier", desc: "Calm, grounded, in control" },
  { id: "clearer", label: "Clearer", desc: "Pictured the exact decisions" },
];

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function newIdempotencyKey(sessionId: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return `web_${sessionId}_${random}`;
}

function PlayerCore({ session, variant, modes, onChooseMode, hasMusicChoice, onChooseMusic, onBack, onComplete }: PlayerCoreProps) {
  const { user } = useSession();
  // Each recording has its own length; the 80% rule is measured against it.
  const duration = variant?.durationSeconds ?? session.defaultDurationSeconds;
  const mode: SessionMode = variant?.mode ?? "interactive";
  const voiceUrl = variant?.url ?? session.media.voiceUrl;
  // Recorded versions have music mixed in, so there's no separate music bed.
  const musicBedUrl = variant ? undefined : session.media.musicBedUrl;
  const requiredSeconds = Math.ceil(duration * REQUIRED_RATIO);

  const [audioState, setAudioState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [listened, setListened] = useState(0);
  const [musicSetting, setMusic] = useState(true);
  const music = variant ? variant.withMusic : musicSetting;
  const [showReflection, setShowReflection] = useState(false);
  const [feeling, setFeeling] = useState<ReflectionFeeling | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [showVideo, setShowVideo] = useState(false);
  const [explained, setExplained] = useState<SessionMode | null>(null);

  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const lastTimeRef = useRef(0);
  const idempotencyKey = useRef(newIdempotencyKey(session.id));
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const prompts = useMemo(
    () => [...session.prompts].sort((a, b) => a.timestampSeconds - b.timestampSeconds),
    [session.prompts],
  );
  const prompt = [...prompts].reverse().find((item) => item.timestampSeconds <= position) ?? null;
  const eligible = listened >= requiredSeconds;

  const report = useCallback(
    (eventType: PlaybackEventRequest["eventType"], at: number) => {
      apiClient.recordPlaybackEvent(session.id, {
        eventType,
        mode,
        musicEnabled: music,
        playbackPositionSeconds: Math.round(at),
        clientTimestamp: new Date().toISOString(),
      });
    },
    [mode, music, session.id],
  );

  const finish = useCallback(() => {
    setPlaying(false);
    setShowReflection(true);
    report("finish", duration);
  }, [duration, report]);

  // Load the voice track; fall back to timed, guided prompts if it can't play.
  useEffect(() => {
    const voice = new Audio();
    voice.preload = "auto";
    voiceRef.current = voice;
    const timeout = window.setTimeout(() => setAudioState((s) => (s === "loading" ? "unavailable" : s)), AUDIO_LOAD_TIMEOUT_MS);
    const onReady = () => setAudioState("ready");
    const onError = () => setAudioState("unavailable");
    voice.addEventListener("canplay", onReady, { once: true });
    voice.addEventListener("error", onError, { once: true });
    voice.src = voiceUrl;

    if (musicBedUrl) {
      const bed = new Audio(musicBedUrl);
      bed.loop = true;
      bed.volume = 0.35;
      musicRef.current = bed;
    }

    return () => {
      window.clearTimeout(timeout);
      voice.pause();
      voice.removeAttribute("src");
      musicRef.current?.pause();
      musicRef.current = null;
      voiceRef.current = null;
      audioEngine.pausePlayback();
    };
  }, [voiceUrl, musicBedUrl]);

  // Real audio: follow the element's clock. Only small forward steps count as
  // listening, so seeking ahead doesn't earn completion time.
  useEffect(() => {
    const voice = voiceRef.current;
    if (!voice || audioState !== "ready") return;
    const onTime = () => {
      const delta = voice.currentTime - lastTimeRef.current;
      if (delta > 0 && delta <= 1.5) setListened((value) => value + delta);
      lastTimeRef.current = voice.currentTime;
      setPosition(Math.min(voice.currentTime, duration));
      if (voice.currentTime >= duration) finish();
    };
    voice.addEventListener("timeupdate", onTime);
    voice.addEventListener("ended", finish);
    return () => {
      voice.removeEventListener("timeupdate", onTime);
      voice.removeEventListener("ended", finish);
    };
  }, [audioState, duration, finish]);

  // No audio: advance a timer so the guided prompts still run.
  useEffect(() => {
    if (!playing || audioState !== "unavailable") return;
    const tick = window.setInterval(() => {
      setListened((value) => value + 1);
      setPosition((value) => {
        const next = value + 1;
        if (next >= duration) window.setTimeout(finish, 0);
        return Math.min(next, duration);
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [playing, audioState, duration, finish]);

  // Drive the actual sound sources from `playing` and `music`.
  useEffect(() => {
    const voice = voiceRef.current;
    const bed = musicRef.current;
    if (audioState === "ready" && voice) {
      if (playing) voice.play().catch(() => setPlaying(false));
      else voice.pause();
    }
    const musicOn = playing && music;
    if (bed && audioState === "ready") {
      if (musicOn) bed.play().catch(() => undefined);
      else bed.pause();
    } else if (variant && audioState === "ready") {
      // The recording carries its own music.
      audioEngine.pausePlayback();
    } else {
      // Synthesised ambience when there's no music track (or no audio at all).
      audioEngine.setMusicEnabled(music);
      if (musicOn) audioEngine.startPlayback();
      else audioEngine.pausePlayback();
    }
  }, [playing, music, audioState, variant]);

  // Lock-screen and media-key controls go through React state, like the buttons.
  useEffect(() => {
    audioEngine.configureMediaSession(
      { title: session.title, artist: session.mentor.name },
      { onPlay: () => setPlaying(true), onPause: () => setPlaying(false) },
    );
  }, [session.title, session.mentor.name]);

  useEffect(() => {
    audioEngine.setMediaSessionPlaying(playing);
  }, [playing]);

  // Video dialog closes on Escape.
  useEffect(() => {
    if (!showVideo) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowVideo(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showVideo]);

  // Reflection dialog: focus it and close on Escape.
  useEffect(() => {
    if (!showReflection) return;
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setShowReflection(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showReflection, submitting]);

  function togglePlay() {
    if (audioState === "loading") return;
    const next = !playing;
    setPlaying(next);
    report(next ? "start" : "pause", position);
  }

  function openReflection() {
    setPlaying(false);
    setShowReflection(true);
  }

  async function submit() {
    if (!user) return;
    setSubmitError("");
    setSubmitting(true);
    const request: SessionCompletionRequest = {
      sessionId: session.id,
      sessionVersion: session.version,
      mode,
      ...(variant ? { withMusic: variant.withMusic } : {}),
      completionDurationSeconds: Math.min(Math.round(listened), duration),
      completedAt: new Date().toISOString(),
      ...(feeling ? { reflection: { feeling, ...(note.trim() ? { note: note.trim() } : {}) } } : {}),
      idempotencyKey: idempotencyKey.current,
    };
    try {
      const response = await apiClient.completeSession(request);
      onComplete({ kind: "synced", response });
    } catch (error) {
      if (isRetryableError(error)) {
        offlineQueue.enqueue(user.id, request);
        onComplete({ kind: "queued" });
        return;
      }
      setSubmitError(error instanceof Error ? error.message : "We couldn't save this session.");
      setSubmitting(false);
    }
  }

  const [titleTop, titleBottom] = splitTitle(session.title);
  const tags = sessionTags(session);
  const videoLength = videoLengthLabel(session.whyVideoDurationSeconds);
  // Older single-file sessions mix in a music bed the player can switch itself.
  const canChooseMusic = variant ? hasMusicChoice : true;
  const chooseMusic = (next: boolean) => (variant ? onChooseMusic(next) : setMusic(next));

  return (
    <div className="screen ps-screen">
      <section className="ps-hero">
        <img src={photo(sessionPhoto(session))} alt="" />
        <header className="ps-top">
          <button type="button" className="ps-back" onClick={onBack} aria-label="Back">
            <ArrowLeft size={20} />
          </button>
          <FearlessWordmark height={22} />
          <span className="ps-back-spacer" aria-hidden="true" />
        </header>
        <div className="ps-title">
          <span className="ps-eyebrow">OFF-PITCH TRAINING</span>
          <h1>
            {titleTop}
            {titleBottom && (
              <>
                <br />
                <span>{titleBottom}</span>
              </>
            )}
          </h1>
          {tags.length > 0 && (
            // Each tag stays on one line; the row wraps between tags.
            <ul className="ps-tags" aria-label="Session focus">
              {tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <main className="ps-body">
        {session.whyVideoUrl && (
          <button
            type="button"
            className="ps-video"
            onClick={() => {
              // Pause the session so Mark's video and voice don't overlap.
              setPlaying(false);
              setShowVideo(true);
            }}
          >
            <span className="ps-video-thumb">
              <img src={photo("composure")} alt="" />
              <span className="ps-video-play" aria-hidden="true">
                <Play size={16} fill="currentColor" />
              </span>
            </span>
            <span className="ps-video-text">
              <span className="ps-eyebrow">VIDEO INTRODUCTION</span>
              <strong>Watch Mark introduce today's training</strong>
              {videoLength && <small>{videoLength}</small>}
            </span>
            <ChevronRight size={20} className="ps-video-chevron" />
          </button>
        )}


        {modes.length > 0 && (
          <section aria-label="Choose your training style">
            <span className="ps-eyebrow ps-section-label">CHOOSE YOUR TRAINING STYLE</span>
            <div className="ps-styles" style={{ gridTemplateColumns: `repeat(${modes.length}, 1fr)` }}>
              {modes.map((item) => {
                const Icon = MODE_ICONS[item];
                const selected = item === mode;
                return (
                  <div key={item} className={`ps-style ${selected ? "selected" : ""}`}>
                    <button type="button" className="ps-style-pick" aria-pressed={selected} onClick={() => onChooseMode(item)}>
                      <Icon size={24} />
                      <span>{TRAINING_STYLES[item].label}</span>
                    </button>
                    <button
                      type="button"
                      className="ps-style-info"
                      aria-label={`About ${TRAINING_STYLES[item].label}`}
                      aria-expanded={explained === item}
                      onClick={() => setExplained(explained === item ? null : item)}
                    >
                      <Info size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
            {explained && (
              <div className="ps-explain" role="note" aria-live="polite">
                <strong>{TRAINING_STYLES[explained].label}</strong>
                <p>{TRAINING_STYLES[explained].detail}</p>
                <button type="button" onClick={() => setExplained(null)} aria-label="Close explanation">
                  <X size={16} />
                </button>
              </div>
            )}
          </section>
        )}

        {canChooseMusic && (
          <div className="ps-music">
            <Music size={22} className="ps-music-icon" />
            <span className="ps-music-text">
              <strong>Backing music</strong>
              <small>Add music to your training session</small>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={music}
              aria-label="Backing music"
              className={`ps-switch ${music ? "on" : ""}`}
              onClick={() => chooseMusic(!music)}
            >
              <span />
            </button>
          </div>
        )}

        <section className="ps-player" aria-label="Session audio">
          <div
            className="ps-track"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(position)}
          >
            <span className="ps-track-fill" style={{ width: `${(position / duration) * 100}%` }} />
          </div>
          <div className="ps-times">
            <span>{formatTime(position)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <button
            type="button"
            className={`ps-play ${playing ? "playing" : ""}`}
            onClick={togglePlay}
            disabled={audioState === "loading"}
            aria-label={playing ? "Pause session" : "Play session"}
          >
            {playing ? <Pause size={30} fill="currentColor" /> : <Play size={30} fill="currentColor" style={{ marginLeft: 4 }} />}
          </button>
          {audioState !== "ready" && (
            <p className="ps-status" role="status">
              {audioState === "loading" ? "Loading audio…" : "Audio unavailable – follow the prompts at your own pace."}
            </p>
          )}
          {(prompt || (audioState === "unavailable" && (playing || position > 0))) && (
            <p className="ps-prompt" aria-live="polite">
              {prompt ? prompt.promptText : GUIDANCE[mode]}
            </p>
          )}
        </section>

        <button type="button" className={`ps-reflect ${eligible ? "ready" : ""}`} onClick={openReflection} disabled={!eligible}>
          {eligible ? (
            <strong>
              Finish & reflect <Check size={18} />
            </strong>
          ) : (
            <>
              <strong>
                <Lock size={16} /> Finish & reflect
              </strong>
              <small>Complete the session to unlock</small>
            </>
          )}
        </button>
      </main>

      {showVideo && session.whyVideoUrl && (
        <div
          className="modal-overlay why-video-overlay"
          style={{ zIndex: 110 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowVideo(false);
          }}
        >
          <div className="why-video-dialog" role="dialog" aria-modal="true" aria-label="Video introduction">
            <button
              type="button"
              className="why-video-close"
              onClick={() => setShowVideo(false)}
              aria-label="Close video"
              autoFocus
            >
              <X size={20} />
            </button>
            <video src={session.whyVideoUrl} controls autoPlay playsInline preload="metadata" />
          </div>
        </div>
      )}

      {showReflection && (
        <div className="modal-overlay" style={{ zIndex: 100 }}>
          <div
            ref={dialogRef}
            className="modal-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reflection-title"
            style={{ maxHeight: "90vh", overflowY: "auto" }}
          >
            <span className="eyebrow">REFLECT</span>
            <h3 id="reflection-title">How do you feel about your next match?</h3>
            <div className="live-choice-list" role="group" aria-label="How you feel">
              {FEELINGS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="live-choice"
                  aria-pressed={feeling === item.id}
                  onClick={() => setFeeling(feeling === item.id ? null : item.id)}
                >
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.desc}</small>
                  </span>
                  {feeling === item.id && <Check size={16} color="#69E0FA" />}
                </button>
              ))}
            </div>
            {feeling && (
              <label className="live-field" style={{ marginTop: 12 }}>
                Private note (optional)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
              </label>
            )}
            <p className="live-note" style={{ margin: "12px 0" }}>
              Your feelings and notes are private to you. They're never graded or shown to your parent or guardian.
            </p>
            {submitError && (
              <div className="live-error" role="alert" style={{ marginBottom: 12 }}>
                {submitError}
              </div>
            )}
            <div className="live-button-row">
              <button type="button" className="primary-button" onClick={submit} disabled={submitting || !eligible}>
                {submitting ? "Saving…" : "Save"} <ArrowRight size={18} />
              </button>
              {!eligible && <p className="live-note">Keep training a little longer to finish this session.</p>}
              <button type="button" className="live-link-button" onClick={() => setShowReflection(false)} disabled={submitting}>
                Back to session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
