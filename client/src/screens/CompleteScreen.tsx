import { useState } from "react";
import { ArrowRight, Check, MessageCircle, Sparkles } from "lucide-react";
import type { ReflectionFeeling } from "@shared/types";

interface CompleteScreenProps {
  onBackToHQ: () => void;
}

export function CompleteScreen({ onBackToHQ }: CompleteScreenProps) {
  const [selectedFeeling, setSelectedFeeling] = useState<ReflectionFeeling | null>(null);

  const feelings: Array<{ id: ReflectionFeeling; label: string }> = [
    { id: "clearer", label: "Clearer" },
    { id: "steadier", label: "Steadier" },
    { id: "more_ready", label: "More ready" },
  ];

  return (
    <div className="screen complete-screen">
      <div className="complete-glow" />

      <main className="complete-content">
        <div className="success-ring" aria-hidden="true">
          <Check size={38} strokeWidth={3} />
        </div>

        <span className="eyebrow">SESSION COMPLETE</span>
        <h1 className="complete-heading">
          You showed up <br />
          today.
        </h1>
        <p className="complete-sub">
          One rep closer to playing your next game with intent.
        </p>

        {/* Milestone Stats */}
        <div className="complete-stats" aria-label="Session summary stats">
          <div>
            <strong>1</strong>
            <span>rep complete</span>
          </div>
          <div>
            <strong>5 days</strong>
            <span>current streak</span>
          </div>
          <div>
            <strong>+2 pts</strong>
            <span>composure update</span>
          </div>
        </div>

        {/* Interactive Reflection Card */}
        <div className="reflection-card" aria-label="Optional post-session reflection">
          <div className="reflection-header">
            <span className="eyebrow">OPTIONAL REFLECTION</span>
            <Sparkles size={16} className="text-cyan" />
          </div>

          <h3>How do you feel right now?</h3>

          <div className="reflection-row" role="group" aria-label="Emotional sentiment">
            {feelings.map(({ id, label }) => {
              const isChosen = selectedFeeling === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`reflection-btn ${isChosen ? "selected" : ""}`}
                  onClick={() => setSelectedFeeling(id)}
                  aria-pressed={isChosen}
                >
                  {isChosen && <Check size={12} strokeWidth={3} />}
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          {selectedFeeling && (
            <p className="reflection-saved-note">
              ✓ Logged to your private athletic profile.
            </p>
          )}
        </div>

        <button
          type="button"
          className="primary-button finish-to-hq-btn"
          onClick={onBackToHQ}
        >
          Back to Fearless HQ <ArrowRight size={19} />
        </button>

        <div className="parent-insight-hint">
          <MessageCircle size={15} />
          <span>Caregiver insight automatically synced (private by design)</span>
        </div>
      </main>
    </div>
  );
}
