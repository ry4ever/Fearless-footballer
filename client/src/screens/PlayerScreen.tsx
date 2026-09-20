import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Check,
  Clock,
  Headphones,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  Trophy,
} from "lucide-react";
import type { SessionMode } from "@shared/types";
import { audioEngine } from "../audio/audioEngine";

interface PlayerScreenProps {
  mode: SessionMode;
  music: boolean;
  onBack: () => void;
  onComplete: () => void;
}

const modePhases: Record<SessionMode, string[]> = {
  interactive: ["Center", "Reframe", "Rehearse"],
  guidance: ["Arrive", "Reframe", "Rehearse"],
  relaxation: ["Settle", "Release", "Reset"],
};

const modeDurations: Record<SessionMode, number> = {
  interactive: 300, // 5 min
  guidance: 480,    // 8 min
  relaxation: 600,  // 10 min
};

export function PlayerScreen({
  mode,
  music,
  onBack,
  onComplete,
}: PlayerScreenProps) {
  const [playing, setPlaying] = useState(false);
  const [progressSeconds, setProgressSeconds] = useState(0);

  const totalDuration = modeDurations[mode] || 300;
  const phaseLabels = modePhases[mode];

  // Calculate current phase: 0 = Center, 1 = Reframe, 2 = Rehearse
  const phaseIndex = useMemo(() => {
    const ratio = progressSeconds / totalDuration;
    if (ratio >= 0.66) return 2;
    if (ratio >= 0.33) return 1;
    return 0;
  }, [progressSeconds, totalDuration]);

  // Format MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Playback timer & real Web Audio engine integration
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

  const progressPercent = (progressSeconds / totalDuration) * 100;

  // Contextual coach prompt based on phase
  const promptText = useMemo(() => {
    if (phaseIndex === 0) return "Notice the adrenaline. It is information.";
    if (phaseIndex === 1) return "Transform pressure into presence. Choose your first anchor.";
    return "See yourself executing that anchor cleanly under crowd pressure.";
  }, [phaseIndex]);

  return (
    <div
      className="screen player-screen-high-res"
      style={{
        backgroundImage: `linear-gradient(180deg, rgba(6,10,26,.45) 0%, rgba(6,10,26,.92) 68%), url('/assets/session-player-screen.png')`,
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
          aria-label="Back to Setup"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="brand-wordmark-centered">
          <span>FEAR</span>
          <span className="brand-cut">A</span>
          <span>LESS</span>
        </div>

        <div style={{ width: 42 }} />
      </header>

      <main className="player-body">
        {/* Title and Category Badge */}
        <div className="player-title-block">
          <h1 className="player-main-title">Nerves = Performance</h1>
          <div className="category-pill">
            <Brain size={14} />
            <span>COMPOSURE</span>
          </div>
        </div>

        {/* Mentor Card Row */}
        <div className="mentor-row-card">
          <div className="mentor-avatar-ring">
            <span className="avatar-initials">AR</span>
          </div>
          <div className="mentor-meta">
            <strong className="mentor-name">Alex Rivera</strong>
            <span className="mentor-role">FOOTBALL MENTOR</span>
            <div className="mentor-duration">
              <Clock size={12} />
              <span>{formatTime(totalDuration)}</span>
            </div>
          </div>
        </div>

        {/* 3-Step Phase Stepper (Design Image 1) */}
        <div className="player-phase-stepper" aria-label="Session phases">
          {phaseLabels.map((label, idx) => {
            const isActive = idx <= phaseIndex;
            const isCurrent = idx === phaseIndex;
            return (
              <div
                key={label}
                className={`stepper-node ${isActive ? "active" : ""} ${isCurrent ? "current" : ""}`}
              >
                <div className="stepper-circle">
                  {idx < phaseIndex ? <Check size={14} strokeWidth={3} /> : idx + 1}
                </div>
                <span className="stepper-label">{label}</span>
              </div>
            );
          })}
        </div>

        {/* Big Central Play Node */}
        <button
          type="button"
          className={`giant-play-node ${playing ? "is-playing" : ""}`}
          onClick={togglePlay}
          aria-label={playing ? "Pause rehearsal" : "Play rehearsal"}
        >
          {playing ? (
            <Pause size={44} fill="currentColor" />
          ) : (
            <Play size={44} fill="currentColor" style={{ marginLeft: 6 }} />
          )}
        </button>

        {/* Timeline Scrubber */}
        <div className="timeline-container">
          <input
            type="range"
            min={0}
            max={totalDuration}
            value={progressSeconds}
            onChange={handleSeek}
            className="timeline-slider"
            aria-label="Seek session timeline"
          />
          <div className="timeline-time-labels">
            <span>{formatTime(progressSeconds)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Dynamic Coach Prompt */}
        <div className="center-prompt-box">
          <p className="coach-prompt-text">{promptText}</p>
        </div>

        {/* Transport Controls (-15s, Play/Pause, +15s) */}
        <div className="transport-row-modern">
          <button
            type="button"
            className="transport-btn skip-btn"
            onClick={() => skipSeconds(-15)}
            aria-label="Skip back 15 seconds"
          >
            <RotateCcw size={18} />
            <small>– 15s</small>
          </button>

          <button
            type="button"
            className="transport-btn-main"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>

          <button
            type="button"
            className="transport-btn skip-btn"
            onClick={() => skipSeconds(15)}
            aria-label="Skip forward 15 seconds"
          >
            <RotateCcw size={18} className="flip-icon" />
            <small>+ 15s</small>
          </button>
        </div>

        {/* Audio State / Offline Banner */}
        <div className="audio-status-pill">
          <Headphones size={15} />
          <span>OFFLINE / HEADPHONES RECOMMENDED</span>
        </div>

        {/* Bottom Card: Finish Strong & Reflect */}
        <section className="finish-strong-card" aria-label="Completion and Reflection">
          <div className="finish-card-eyebrow">
            <span>AT THE END OF THIS SESSION</span>
          </div>

          <div className="finish-content-row">
            <div className="trophy-avatar">
              <Trophy size={20} />
            </div>
            <div>
              <strong className="finish-title">Finish strong</strong>
              <p className="finish-sub">REFLECT ON WHAT YOU LEARNED.</p>
            </div>
          </div>

          <button
            type="button"
            className="reflect-cta-bar"
            onClick={onComplete}
            aria-label="Finish and reflect"
          >
            <MessageSquare size={17} />
            <span>Take a moment to reflect...</span>
            <ArrowRight size={17} />
          </button>
        </section>
      </main>
    </div>
  );
}
