import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Headphones, Pause, Play, RotateCcw } from "lucide-react";
import type {
  CompletionSyncResponse,
  PlaybackEventRequest,
  ReflectionFeeling,
  SessionCompletionRequest,
  SessionPackage,
} from "@shared/types";
import { audioEngine } from "../audio/audioEngine";
import { apiClient } from "../lib/apiClient";
import { isRetryableError, offlineQueue } from "../lib/offlineQueue";
import { useSession } from "./session";

export type CompletionOutcome =
  | { kind: "synced"; response: CompletionSyncResponse }
  | { kind: "queued" };

interface LivePlayerScreenProps {
  session: SessionPackage;
  onBack: () => void;
  onComplete: (outcome: CompletionOutcome) => void;
}

/** The server only accepts a completion after 80% of the session. */
const REQUIRED_RATIO = 0.8;
/** How long to wait for the voice track before falling back to guided prompts. */
const AUDIO_LOAD_TIMEOUT_MS = 8000;

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

export function LivePlayerScreen({ session, onBack, onComplete }: LivePlayerScreenProps) {
  const { user } = useSession();
  const duration = session.defaultDurationSeconds;
  const requiredSeconds = Math.ceil(duration * REQUIRED_RATIO);

  const [audioState, setAudioState] = useState<"loading" | "ready" | "unavailable">("loading");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [listened, setListened] = useState(0);
  const [music, setMusic] = useState(true);
  const [showReflection, setShowReflection] = useState(false);
  const [feeling, setFeeling] = useState<ReflectionFeeling | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);

  const voiceRef = useRef<HTMLAudioElement | null>(null);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const lastTimeRef = useRef(0);
  const idempotencyKey = useRef(newIdempotencyKey(session.id));
  const dialogRef = useRef<HTMLDivElement | null>(null);

  const phases = useMemo(() => [...session.phases].sort((a, b) => a.startSeconds - b.startSeconds), [session.phases]);
  const prompts = useMemo(
    () => [...session.prompts].sort((a, b) => a.timestampSeconds - b.timestampSeconds),
    [session.prompts],
  );
  const phaseIndex = Math.max(
    0,
    phases.findIndex((phase) => position >= phase.startSeconds && position < phase.endSeconds),
  );
  const prompt = [...prompts].reverse().find((item) => item.timestampSeconds <= position) ?? null;
  const eligible = listened >= requiredSeconds;

  const report = useCallback(
    (eventType: PlaybackEventRequest["eventType"], at: number) => {
      apiClient.recordPlaybackEvent(session.id, {
        eventType,
        mode: "interactive",
        musicEnabled: music,
        playbackPositionSeconds: Math.round(at),
        clientTimestamp: new Date().toISOString(),
      });
    },
    [music, session.id],
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
    voice.src = session.media.voiceUrl;

    if (session.media.musicBedUrl) {
      const bed = new Audio(session.media.musicBedUrl);
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
  }, [session.media.voiceUrl, session.media.musicBedUrl]);

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
    } else {
      // Synthesised ambience when there's no music track (or no audio at all).
      audioEngine.setMusicEnabled(music);
      if (musicOn) audioEngine.startPlayback();
      else audioEngine.pausePlayback();
    }
  }, [playing, music, audioState]);

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

  function seekBy(delta: number) {
    const target = Math.max(0, Math.min(duration, position + delta));
    const voice = voiceRef.current;
    if (audioState === "ready" && voice) {
      voice.currentTime = target;
      lastTimeRef.current = target;
    }
    setPosition(target);
    report("seek", target);
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
      mode: "interactive",
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
      setSubmitError(error instanceof Error ? error.message : "We couldn't save this rep.");
      setSubmitting(false);
    }
  }

  const remainingToQualify = Math.max(0, requiredSeconds - listened);

  return (
    <div
      className="screen player-screen-high-res"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(6,10,26,.65) 0%, rgba(6,10,26,.95) 75%)${
          session.heroImageUrl ? `, url('${session.heroImageUrl}')` : ""
        }`,
        backgroundPosition: "center top",
        backgroundSize: "cover",
      }}
    >
      <header className="player-header-clean">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to HQ">
          <ArrowLeft size={20} />
        </button>
        <div className="brand-wordmark-centered">
          <span>FEAR</span>
          <span className="brand-cut">A</span>
          <span>LESS</span>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setMusic((value) => !value)}
          aria-pressed={music}
          style={{ width: "auto", minHeight: 36, background: "rgba(255,255,255,0.08)", border: "none", color: "#00F0FF", padding: "6px 12px", borderRadius: 100, fontSize: "0.75rem", fontWeight: 700, whiteSpace: "nowrap" }}
        >
          Music {music ? "on" : "off"}
        </button>
      </header>

      <main className="player-body">
        <div className="player-title-block">
          <h1 className="player-main-title">{session.title}</h1>
          <p className="live-copy" style={{ textAlign: "center" }}>{session.subtitle}</p>
        </div>

        <div className="mentor-row-compact">
          {session.mentor.avatarUrl && !avatarFailed && (
            <div className="mentor-compact-avatar">
              <img src={session.mentor.avatarUrl} alt="" className="mentor-avatar-img" onError={() => setAvatarFailed(true)} />
            </div>
          )}
          <div className="mentor-compact-info">
            <span className="coach-name">{session.mentor.name}</span>
            <span className="coach-tagline">{session.mentor.title}</span>
          </div>
        </div>

        {phases.length > 0 && (
          <ol
            className="phase-stepper-container"
            aria-label="Session phases"
            style={{ display: "grid", gridTemplateColumns: `repeat(${phases.length}, 1fr)`, gap: 8, margin: "16px 0 8px", padding: 0, listStyle: "none" }}
          >
            {phases.map((phase, index) => {
              const isActive = index === phaseIndex;
              const isPast = index < phaseIndex;
              return (
                <li
                  key={phase.number}
                  aria-current={isActive ? "step" : undefined}
                  style={{
                    padding: "8px 6px",
                    borderRadius: 8,
                    textAlign: "center",
                    background: isActive ? "rgba(0,240,255,0.15)" : isPast ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    border: isActive ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                    color: isActive ? "#00F0FF" : isPast ? "#fff" : "rgba(255,255,255,0.5)",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    letterSpacing: 1,
                  }}
                >
                  {index + 1}. {phase.label}
                </li>
              );
            })}
          </ol>
        )}

        <div className="central-play-node-wrap">
          <div className={`audio-glow-ring ${playing ? "pulsing" : ""}`} />
          <button
            type="button"
            className="play-node-button"
            onClick={togglePlay}
            disabled={audioState === "loading"}
            aria-label={playing ? "Pause session" : "Play session"}
          >
            {playing ? <Pause size={38} className="play-icon-glow" /> : <Play size={38} className="play-icon-glow" style={{ marginLeft: 4 }} />}
          </button>
        </div>

        <div className="contextual-prompt-box" aria-live="polite">
          <p className="prompt-body-text" style={{ fontSize: "0.95rem", lineHeight: 1.4 }}>
            {prompt ? prompt.promptText : "Find a quiet spot, put your headphones on, and press play when you're ready."}
          </p>
          {prompt?.subText && <p className="live-note">{prompt.subText}</p>}
        </div>

        <div className="scrubber-section">
          <div className="scrubber-time-row">
            <span className="time-elapsed">{formatTime(position)}</span>
            <span className="time-remaining">{formatTime(duration)}</span>
          </div>
          <div
            className="scrubber-track-container"
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={Math.round(position)}
          >
            <div className="scrubber-fill-bar" style={{ width: `${(position / duration) * 100}%` }} />
          </div>
        </div>

        <div className="transport-controls-row">
          <button type="button" className="transport-skip-btn" onClick={() => seekBy(-15)} aria-label="Back 15 seconds">
            <RotateCcw size={18} />
            <span>-15s</span>
          </button>
          <button
            type="button"
            className="transport-center-toggle"
            onClick={togglePlay}
            disabled={audioState === "loading"}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: 2 }} />}
          </button>
          <button type="button" className="transport-skip-btn" onClick={() => seekBy(15)} aria-label="Forward 15 seconds">
            <RotateCcw size={18} style={{ transform: "scaleX(-1)" }} />
            <span>+15s</span>
          </button>
        </div>

        <div className="headphones-status-pill" role="status">
          <Headphones size={13} />
          <span>
            {audioState === "loading"
              ? "Loading audio…"
              : audioState === "ready"
                ? "Headphones recommended"
                : "Audio unavailable – follow the prompts at your own pace"}
          </span>
        </div>

        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            onClick={openReflection}
            className="primary-button"
            disabled={!eligible}
            style={{ width: "100%", padding: 14, fontSize: "0.95rem" }}
          >
            Finish & reflect <Check size={18} />
          </button>
          {!eligible && (
            <p className="live-note" style={{ marginTop: 8 }}>
              Keep going – {Math.ceil(remainingToQualify / 60)} more min to complete this rep.
            </p>
          )}
        </div>
      </main>

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
            <span className="eyebrow">OFF-PITCH REFLECTION</span>
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
                  {feeling === item.id && <Check size={16} color="#00F0FF" />}
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
                {submitting ? "Saving…" : "Save rep"} <ArrowRight size={18} />
              </button>
              {!eligible && (
                <p className="live-note">Listen a little longer to complete this rep.</p>
              )}
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
