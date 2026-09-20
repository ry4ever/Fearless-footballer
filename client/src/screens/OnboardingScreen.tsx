import { useState } from "react";
import { ArrowRight, Check, Compass, Shield, Target, Wind } from "lucide-react";

interface OnboardingScreenProps {
  onContinue: (selectedMindset: string) => void;
}

const mindsetOptions = [
  {
    id: "calm",
    title: "Calm",
    tagline: "CLEAR MIND. BETTER DECISIONS.",
    icon: Wind,
  },
  {
    id: "sharp",
    title: "Sharp",
    tagline: "FOCUS. FASTER REACTIONS.",
    icon: Target,
  },
  {
    id: "brave",
    title: "Brave",
    tagline: "FACE CHALLENGES. PLAY BOLDER.",
    icon: Shield,
  },
  {
    id: "unshakeable",
    title: "Unshakeable",
    tagline: "STAY STRONG. NO MATTER WHAT.",
    icon: Compass,
  },
];

export function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  const [selected, setSelected] = useState<string>("calm");

  return (
    <div className="screen onboarding-screen">
      <div className="onboarding-bg-glow" />

      <header className="onboarding-header">
        <div className="brand-lockup-hero" aria-label="Fearless Footballer">
          <span>FEAR</span>
          <span className="brand-cut">A</span>
          <span>LESS</span>
        </div>

        <div className="onboarding-progress-row">
          <span className="step-counter">2 of 5</span>
          <div className="step-dots" role="progressbar" aria-valuenow={2} aria-valuemin={1} aria-valuemax={5}>
            <span className="dot past" />
            <span className="dot current" />
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
        </div>
      </header>

      <main className="onboarding-content">
        <div className="onboarding-title-wrap">
          <h1>
            What do you want to feel <br />
            <span className="highlight-cyan">before</span> your next match?
          </h1>
        </div>

        <div className="mindset-cards-grid" role="radiogroup" aria-label="Pre-match mindset selection">
          {mindsetOptions.map(({ id, title, tagline, icon: Icon }) => {
            const isSelected = selected === id;
            return (
              <button
                key={id}
                type="button"
                className={`mindset-choice-card ${isSelected ? "selected" : ""}`}
                onClick={() => setSelected(id)}
                role="radio"
                aria-checked={isSelected}
              >
                <div className="choice-card-top">
                  <div className="choice-icon-wrap">
                    <Icon size={28} strokeWidth={2} />
                  </div>
                  <div className={`choice-check-ring ${isSelected ? "checked" : ""}`}>
                    {isSelected && <Check size={14} strokeWidth={3} />}
                  </div>
                </div>

                <div className="choice-card-copy">
                  <strong className="choice-title">{title}</strong>
                  <p className="choice-tagline">{tagline}</p>
                </div>
              </button>
            );
          })}
        </div>

        <p className="onboarding-blueprint-note">
          We’ll build your 7-day blueprint around this.
        </p>

        {/* Tactical pitch markings visual */}
        <div className="pitch-markings-container" aria-hidden="true">
          <div className="pitch-center-circle" />
          <div className="pitch-half-line" />
        </div>

        <button
          type="button"
          className="primary-button continue-button"
          onClick={() => onContinue(selected)}
        >
          Continue <ArrowRight size={20} strokeWidth={2.4} />
        </button>
      </main>
    </div>
  );
}
