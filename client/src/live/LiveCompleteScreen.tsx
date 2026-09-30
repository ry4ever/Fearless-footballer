import { ArrowRight, Check, CloudOff } from "lucide-react";
import type { CompletionOutcome } from "./LivePlayerScreen";

interface LiveCompleteScreenProps {
  outcome: CompletionOutcome;
  onBackToHQ: () => void;
}

export function LiveCompleteScreen({ outcome, onBackToHQ }: LiveCompleteScreenProps) {
  const synced = outcome.kind === "synced" ? outcome.response : null;
  const delta = synced?.composure.delta ?? 0;

  return (
    <div className="screen complete-screen">
      <div className="complete-glow" />
      <main className="complete-content">
        <div className="success-ring" aria-hidden="true">
          {synced ? <Check size={38} strokeWidth={3} /> : <CloudOff size={34} />}
        </div>

        <span className="eyebrow">{synced ? "REP COMPLETE" : "SAVED ON THIS DEVICE"}</span>
        <h1 className="complete-heading">
          You showed up <br />
          today.
        </h1>
        <p className="complete-sub">
          {synced
            ? "One session closer to playing your next game with intent."
            : "You're offline, so this session will sync automatically when you reconnect. Your streak updates then."}
        </p>

        {synced && (
          <div className="complete-stats" aria-label="Rep summary">
            <div>
              <strong>
                {synced.streak.currentStreakDays} {synced.streak.currentStreakDays === 1 ? "day" : "days"}
              </strong>
              <span>{synced.streak.isNewMilestone ? "new best streak!" : "current streak"}</span>
            </div>
            <div>
              <strong>{synced.composure.newScore}</strong>
              <span>composure score</span>
            </div>
            <div>
              <strong>{delta > 0 ? `+${delta}` : delta === 0 ? "±0" : delta}</strong>
              <span>from this session</span>
            </div>
          </div>
        )}

        <button type="button" className="primary-button finish-to-hq-btn" onClick={onBackToHQ}>
          Back to Fearless HQ <ArrowRight size={19} />
        </button>

        <p className="live-note" style={{ marginTop: 14 }}>
          Your parent or guardian sees that you trained, never your reflections.
        </p>
      </main>
    </div>
  );
}
