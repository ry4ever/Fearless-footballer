import { ArrowLeft, ArrowRight, Bookmark, Headphones, HelpCircle, Music2, Sparkles, Target, VolumeX } from "lucide-react";
import type { SessionMode } from "@shared/types";

interface SetupScreenProps {
  mode: SessionMode;
  setMode: (mode: SessionMode) => void;
  music: boolean;
  setMusic: (music: boolean) => void;
  onBack: () => void;
  onStart: () => void;
}

const modeOptions = [
  {
    id: "interactive" as SessionMode,
    label: "Interactive",
    eyebrow: "COACH WITH ME",
    body: "Short prompts and choices keep you actively engaged between phases.",
    duration: "5 min",
    icon: Target,
  },
  {
    id: "guidance" as SessionMode,
    label: "Full Guidance",
    eyebrow: "FOLLOW THE VOICE",
    body: "A calm, continuous walkthrough from first breath to final play.",
    duration: "8 min",
    icon: Headphones,
  },
  {
    id: "relaxation" as SessionMode,
    label: "Relaxation",
    eyebrow: "RESET YOUR SYSTEM",
    body: "Slower pacing, spacious silence, and a softer matchday landing.",
    duration: "10 min",
    icon: Sparkles,
  },
];

export function SetupScreen({
  mode,
  setMode,
  music,
  setMusic,
  onBack,
  onStart,
}: SetupScreenProps) {
  const selected = modeOptions.find((m) => m.id === mode) || modeOptions[0];

  return (
    <div className="screen setup-screen">
      <div className="setup-top-glow" />

      <header className="setup-header">
        <button
          type="button"
          className="back-button"
          onClick={onBack}
          aria-label="Back to Fearless HQ"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="brand-lockup">
          <span>FEAR</span>
          <span className="brand-cut">A</span>
          <span>LESS</span>
          <small>FOOTBALLER</small>
        </div>

        <button
          type="button"
          className="icon-button"
          aria-label="Bookmark session"
        >
          <Bookmark size={20} />
        </button>
      </header>

      <main className="setup-content">
        <span className="eyebrow">MATCHDAY STATE</span>
        <h1>Unshakeable</h1>
        <p className="setup-subtitle">
          Stay locked onto your game, whatever they try.
        </p>

        <div className="prep-card">
          <h3>Before you start</h3>
          <ul>
            <li>Bring to mind the opponent and their high-press rhythm.</li>
            <li>Notice their routine — the vocal pressure, the fouling.</li>
            <li>Choose one recent match where that challenge happened.</li>
          </ul>
        </div>

        <div className="control-group">
          <div className="control-label">
            <span>Mode</span>
            <small>Choose how you want to be coached.</small>
          </div>

          <div className="mode-grid" role="radiogroup" aria-label="Session coaching mode">
            {modeOptions.map(({ id, label, eyebrow, body, duration, icon: Icon }) => {
              const isSelected = mode === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`mode-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setMode(id)}
                  role="radio"
                  aria-checked={isSelected}
                >
                  <div className="mode-icon">
                    <Icon size={18} />
                  </div>
                  <div className="mode-card-copy">
                    <span>{label}</span>
                    <small>{eyebrow}</small>
                    <p>{body}</p>
                  </div>
                  <b>{duration}</b>
                </button>
              );
            })}
          </div>
        </div>

        <div className="music-row">
          <div className="music-symbol">
            {music ? <Music2 size={20} /> : <VolumeX size={20} />}
          </div>
          <div>
            <span>Background music</span>
            <small>
              {music
                ? "Atmospheric stadium ambient sound bed enabled"
                : "Voice guidance and silence only"}
            </small>
          </div>
          <button
            type="button"
            className={`switch ${music ? "on" : ""}`}
            onClick={() => setMusic(!music)}
            aria-pressed={music}
            aria-label="Toggle background music"
          >
            <span />
          </button>
        </div>

        <button
          type="button"
          className="primary-button start-button"
          onClick={onStart}
        >
          Start · {selected.duration} <ArrowRight size={19} />
        </button>

        <button type="button" className="text-link">
          <HelpCircle size={15} /> Why this works · Sports Psychology Evidence
        </button>
      </main>
    </div>
  );
}
