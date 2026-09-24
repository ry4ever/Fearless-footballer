import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  Compass,
  Footprints,
  Target,
  Sparkles,
  SlidersHorizontal,
} from "lucide-react";
import type { SessionMode } from "@shared/types";
import { audioEngine } from "../audio/audioEngine";

interface PlayerScreenProps {
  mode: SessionMode;
  music: boolean;
  onBack: () => void;
  onComplete: () => void;
}

// Embedding SEE · REHEARSE · BECOME directly into product mechanics
const methodologyPhases = [
  {
    number: 1,
    key: "see",
    label: "1. SEE",
    sub: "Create the situation vividly",
    prompt: "Create the pitch situation vividly in your mind. See the defender's body shape, their stance, and the open grass behind them.",
  },
  {
    number: 2,
    key: "rehearse",
    label: "2. REHEARSE",
    sub: "Run through action & decisions",
    prompt: "Run through your move. Commit their weight one way, burst into the space, and look up to pick your pass or strike.",
  },
  {
    number: 3,
    key: "become",
    label: "3. BECOME",
    sub: "Execute naturally in the match",
    prompt: "Rehearse executing the decision instinctively under full match intensity. Your body already knows what to do.",
  },
];

const sessions = [
  {
    id: "1v1-winger",
    title: "Beating Your Defender 1v1",
    role: "Technical · Winger",
    duration: 480, // 8 min
  },
  {
    id: "space-cb",
    title: "Finding Space Between Centre-Backs",
    role: "Tactical · Striker",
    duration: 480, // 8 min
  },
  {
    id: "nerves-prep",
    title: "Nerves = Performance",
    role: "Match Prep · Composure",
    duration: 300, // 5 min
  },
];

export function PlayerScreen({
  mode: initialMode,
  music,
  onBack,
  onComplete,
}: PlayerScreenProps) {
  const [playing, setPlaying] = useState(false);
  const [progressSeconds, setProgressSeconds] = useState(0);
  const [sessionIndex, setSessionIndex] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<SessionMode>(initialMode || "interactive");
  const [showReflection, setShowReflection] = useState(false);
  const [selectedFeeling, setSelectedFeeling] = useState<"clearer" | "steadier" | "more_ready">("more_ready");

  const currentSession = sessions[sessionIndex];
  const totalDuration = currentSession.duration;

  // Calculate current phase index based on elapsed seconds
  const phaseIndex = useMemo(() => {
    const ratio = progressSeconds / totalDuration;
    if (ratio >= 0.66) return 2;
    if (ratio >= 0.33) return 1;
    return 0;
  }, [progressSeconds, totalDuration]);

  const activePhase = methodologyPhases[phaseIndex];

  // High quality photo avatar for Alex Rivera (Football Mentor)
  const alexRiveraAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Web Audio engine integration
  useEffect(() => {
    audioEngine.setMusicEnabled(music);
    if (playing) {
      audioEngine.startPlayback();
    } else {
      audioEngine.pausePlayback();
    }
    return () => {
      audioEngine.pausePlayback();
    };
  }, [playing, music]);

  useEffect(() => {
    if (!playing) return;
    const interval = window.setInterval(() => {
      setProgressSeconds((prev) => {
        const next = prev + 1;
        if (next >= totalDuration) {
          setPlaying(false);
          setShowReflection(true);
          return totalDuration;
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [playing, totalDuration]);

  const togglePlay = () => {
    setPlaying((prev) => !prev);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetSeconds = Number(e.target.value);
    setProgressSeconds(targetSeconds);
  };

  const skipSeconds = (delta: number) => {
    setProgressSeconds((prev) => Math.max(0, Math.min(totalDuration, prev + delta)));
    audioEngine.playChime(delta > 0 ? 587.33 : 392);
  };

  return (
    <div
      className="screen player-screen-high-res"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(6,10,26,.65) 0%, rgba(6,10,26,.95) 75%), url('/assets/session-player-screen.png')`,
        backgroundPosition: "center top",
        backgroundSize: "cover",
      }}
    >
      {/* Top Header */}
      <header className="player-header-clean">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="Back to HQ"
        >
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
          onClick={() => setSessionIndex((prev) => (prev + 1) % sessions.length)}
          title="Switch Rehearsal Session"
          style={{ background: "rgba(255,255,255,0.08)", border: "none", color: "#00F0FF", padding: "6px 12px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700 }}
        >
          Switch
        </button>
      </header>

      <main className="player-body">
        {/* Title and Category Badge */}
        <div className="player-title-block">
          <h1 className="player-main-title">{currentSession.title}</h1>
          <div className="category-pill-purple" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Target size={13} />
            <span>{currentSession.role.toUpperCase()}</span>
          </div>
        </div>

        {/* Coach / Mentor Row */}
        <div className="mentor-row-compact">
          <div className="mentor-compact-avatar">
            <img
              src={alexRiveraAvatar}
              alt="Alex Rivera"
              className="mentor-avatar-img"
            />
          </div>
          <div className="mentor-compact-info">
            <span className="coach-name">Alex Rivera</span>
            <span className="coach-tagline">Pro Performance Rehearsal</span>
          </div>
        </div>

        {/* Methodology Stepper Across Top: SEE → REHEARSE → BECOME */}
        <div className="phase-stepper-container" style={{ margin: "16px 0 8px 0" }}>
          <div className="methodology-stepper" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
            {methodologyPhases.map((phase, idx) => {
              const isActive = idx === phaseIndex;
              const isPast = idx < phaseIndex;
              return (
                <div
                  key={phase.key}
                  style={{
                    padding: "8px 6px",
                    borderRadius: "8px",
                    textAlign: "center",
                    background: isActive ? "rgba(0, 240, 255, 0.15)" : isPast ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                    border: isActive ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                    transition: "all 0.3s ease",
                  }}
                >
                  <span style={{ display: "block", fontSize: "0.75rem", fontWeight: 800, color: isActive ? "#00F0FF" : isPast ? "#fff" : "rgba(255,255,255,0.4)", letterSpacing: "1px" }}>
                    {phase.label}
                  </span>
                  <span style={{ display: "block", fontSize: "0.6rem", color: isActive ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.4)", marginTop: "2px", lineHeight: "1.1" }}>
                    {phase.sub}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Central Audio Rehearsal Node */}
        <div className="central-play-node-wrap">
          <div className={`audio-glow-ring ${playing ? "pulsing" : ""}`} />
          <button
            type="button"
            className="play-node-button"
            onClick={togglePlay}
            aria-label={playing ? "Pause rehearsal" : "Start rehearsal"}
          >
            {playing ? (
              <Pause size={38} className="play-icon-glow" />
            ) : (
              <Play size={38} className="play-icon-glow" style={{ marginLeft: "4px" }} />
            )}
          </button>
        </div>

        {/* Dynamic Situational Rehearsal Prompt */}
        <div className="contextual-prompt-box">
          <p className="prompt-body-text" style={{ whiteSpace: "pre-line", fontSize: "0.95rem", lineHeight: "1.4" }}>
            {activePhase.prompt}
          </p>
        </div>

        {/* Scrubber Timeline */}
        <div className="scrubber-section">
          <div className="scrubber-time-row">
            <span className="time-elapsed">{formatTime(progressSeconds)}</span>
            <span className="time-remaining">{formatTime(totalDuration)}</span>
          </div>

          <div className="scrubber-track-container">
            <input
              type="range"
              min={0}
              max={totalDuration}
              value={progressSeconds}
              onChange={handleSeek}
              className="player-seek-slider"
              aria-label="Seek time"
            />
            <div
              className="scrubber-fill-bar"
              style={{ width: `${(progressSeconds / totalDuration) * 100}%` }}
            />
          </div>
        </div>

        {/* Transport Controls */}
        <div className="transport-controls-row">
          <button
            type="button"
            className="transport-skip-btn"
            onClick={() => skipSeconds(-15)}
            aria-label="Skip back 15 seconds"
          >
            <RotateCcw size={18} />
            <span>-15s</span>
          </button>

          <button
            type="button"
            className="transport-center-toggle"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={22} /> : <Play size={22} style={{ marginLeft: 2 }} />}
          </button>

          <button
            type="button"
            className="transport-skip-btn"
            onClick={() => skipSeconds(15)}
            aria-label="Skip forward 15 seconds"
          >
            <RotateCcw size={18} style={{ transform: "scaleX(-1)" }} />
            <span>+15s</span>
          </button>
        </div>

        {/* Format Selector: Interactive · Full Guidance · Relaxed */}
        <div style={{ display: "flex", justifyContent: "center", gap: "8px", margin: "14px 0 8px 0" }}>
          {(["interactive", "guidance", "relaxation"] as SessionMode[]).map((fmt) => {
            const isSelected = selectedFormat === fmt;
            const labels: Record<string, string> = {
              interactive: "Interactive",
              guidance: "Full Guidance",
              relaxation: "Relaxed",
            };
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => setSelectedFormat(fmt)}
                style={{
                  background: isSelected ? "rgba(0,240,255,0.15)" : "rgba(255,255,255,0.04)",
                  border: isSelected ? "1px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                  color: isSelected ? "#00F0FF" : "rgba(255,255,255,0.6)",
                  padding: "4px 10px",
                  borderRadius: "100px",
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {labels[fmt]}
              </button>
            );
          })}
        </div>

        {/* Headphones Status Pill */}
        <div className="headphones-status-pill">
          <Headphones size={13} />
          <span>Spatial Audio Rehearsal Active</span>
        </div>

        {/* Finish Session CTA */}
        <div style={{ marginTop: "14px" }}>
          <button
            type="button"
            onClick={() => setShowReflection(true)}
            className="primary-button"
            style={{ width: "100%", padding: "14px", fontSize: "0.95rem" }}
          >
            Finish Training & Reflect <Check size={18} />
          </button>
        </div>

        {/* Post-Training Reflection Modal / Sheet */}
        {showReflection && (
          <div
            className="reflection-modal-overlay"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: "16px",
            }}
          >
            <div
              style={{
                background: "#0c1322",
                border: "1.5px solid rgba(0,240,255,0.3)",
                borderRadius: "20px",
                padding: "24px",
                maxWidth: "360px",
                width: "100%",
                boxShadow: "0 20px 50px rgba(0,240,255,0.2)",
              }}
            >
              <div style={{ display: "inline-block", background: "rgba(0,240,255,0.15)", color: "#00F0FF", padding: "4px 10px", borderRadius: "100px", fontSize: "0.7rem", fontWeight: 700 }}>
                OFF-PITCH REFLECTION
              </div>

              <h2 style={{ color: "#fff", fontSize: "1.2rem", fontWeight: 800, margin: "10px 0 4px 0" }}>
                Rehearsal Complete!
              </h2>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                How do you feel about executing <strong>{currentSession.title}</strong> in your next match?
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", margin: "16px 0" }}>
                {[
                  { id: "more_ready", label: "More Ready", desc: "Instincts primed for match speed" },
                  { id: "steadier", label: "Steadier", desc: "Calm, grounded, in control" },
                  { id: "clearer", label: "Clearer", desc: "Pictured exact pitch decisions" },
                ].map((item) => {
                  const isSelected = selectedFeeling === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedFeeling(item.id as any)}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "12px 14px",
                        borderRadius: "12px",
                        background: isSelected ? "rgba(0,240,255,0.12)" : "rgba(255,255,255,0.04)",
                        border: isSelected ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)",
                        color: "#fff",
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: "0.9rem", display: "block" }}>{item.label}</strong>
                        <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>{item.desc}</span>
                      </div>
                      {isSelected && <Check size={16} color="#00F0FF" />}
                    </button>
                  );
                })}
              </div>

              <p style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", textAlign: "center", marginBottom: "14px" }}>
                🔒 Notes & feelings are private to you (never graded or shared).
              </p>

              <button
                type="button"
                className="primary-button"
                onClick={onComplete}
                style={{ width: "100%", padding: "14px", fontWeight: 700 }}
              >
                Save & Return to HQ <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
