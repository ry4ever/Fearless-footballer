import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Headphones, Music } from "lucide-react";
import type { SessionAudioVariant, SessionMode, SessionPackage } from "@shared/types";
import { Markdown } from "./Markdown";

interface LiveSessionDetailProps {
  session: SessionPackage;
  onBack: () => void;
  onStart: (session: SessionPackage, variant: SessionAudioVariant | null) => void;
}

const MODE_COPY: Record<SessionMode, { label: string; detail: string }> = {
  interactive: {
    label: "Interactive",
    detail: "Guided in, then 45-second blocks to run your own passages of play.",
  },
  guidance: {
    label: "Full Guidance",
    detail: "Mark's voice with you the whole way through.",
  },
  relaxation: {
    label: "Relaxation",
    detail: "Deeper and calmer — for recovery, downtime or before sleep.",
  },
};

export function formatMinutes(seconds: number) {
  return `${Math.round(seconds / 60)} min`;
}

export function LiveSessionDetail({ session, onBack, onStart }: LiveSessionDetailProps) {
  const variants = session.audio ?? [];
  const modes = useMemo(
    () => (["interactive", "guidance", "relaxation"] as SessionMode[]).filter((mode) => variants.some((v) => v.mode === mode)),
    [variants],
  );
  const [mode, setMode] = useState<SessionMode>(modes[0] ?? "interactive");
  const [withMusic, setWithMusic] = useState(true);

  const pick = (m: SessionMode, music: boolean) =>
    variants.find((v) => v.mode === m && v.withMusic === music) ?? variants.find((v) => v.mode === m) ?? null;
  const chosen = pick(mode, withMusic);
  const hasMusicChoice = variants.some((v) => v.mode === mode && v.withMusic) && variants.some((v) => v.mode === mode && !v.withMusic);

  return (
    <div className="screen live-screen no-nav">
      <header className="live-header">
        <button type="button" className="back-button" onClick={onBack} aria-label="Back to HQ">
          <ArrowLeft size={20} />
        </button>
      </header>

      <div>
        {session.focusArea && <span className="eyebrow">{session.focusArea.toUpperCase()}</span>}
        <h1 className="live-title">{session.title}</h1>
        <p className="live-note" style={{ textAlign: "left", marginTop: 6 }}>
          <Headphones size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> with {session.mentor.name} ·{" "}
          {session.mentor.title}
        </p>
      </div>

      {session.comingSoon ? (
        <div className="live-card">
          <span className="eyebrow">COMING SOON</span>
          <p className="live-copy">This session is being recorded. You can read about it below.</p>
        </div>
      ) : modes.length > 0 ? (
        <section className="live-card" aria-label="Choose your version">
          <span className="eyebrow">CHOOSE YOUR VERSION</span>
          <div className="live-choice-list" role="radiogroup" aria-label="Version" style={{ marginTop: 10 }}>
            {modes.map((m) => {
              const variant = pick(m, withMusic);
              return (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={mode === m}
                  aria-pressed={mode === m}
                  className="live-choice"
                  onClick={() => setMode(m)}
                >
                  <span>
                    <strong>
                      {MODE_COPY[m].label}
                      {variant ? ` · ${formatMinutes(variant.durationSeconds)}` : ""}
                    </strong>
                    <small>{MODE_COPY[m].detail}</small>
                  </span>
                  {mode === m && <Check size={16} color="#00F0FF" />}
                </button>
              );
            })}
          </div>
          {hasMusicChoice && (
            <label className="live-check" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={withMusic} onChange={(e) => setWithMusic(e.target.checked)} />
              <span>
                <Music size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> Play with music
              </span>
            </label>
          )}
          <button
            type="button"
            className="primary-button"
            style={{ width: "100%", marginTop: 14 }}
            disabled={!chosen}
            onClick={() => onStart(session, chosen)}
          >
            Start {chosen ? `· ${formatMinutes(chosen.durationSeconds)}` : ""} <ArrowRight size={18} />
          </button>
        </section>
      ) : (
        <button type="button" className="primary-button" onClick={() => onStart(session, null)}>
          Start training <ArrowRight size={18} />
        </button>
      )}

      {session.descriptionMarkdown && (
        <section className="live-card" aria-label="About this session">
          <Markdown source={session.descriptionMarkdown} />
        </section>
      )}
    </div>
  );
}
