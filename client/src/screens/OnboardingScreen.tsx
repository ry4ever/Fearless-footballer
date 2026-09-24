import { useState } from "react";
import { ArrowRight, Check, Shield, Crosshair, Zap, Compass, Footprints, Target, Calendar } from "lucide-react";
import {
  PitchMarkingsGraphic,
  FearlessHeaderLogo,
} from "../components/icons/CustomIcons";

interface OnboardingScreenProps {
  onContinue: (planData: any) => void;
}

const positions = [
  { id: "striker", title: "Striker", role: "ST / CF", desc: "Goal scoring, box movement, finishing" },
  { id: "winger", title: "Winger", role: "LW / RW", desc: "1v1s, crossing, cutting inside, pace" },
  { id: "midfielder", title: "Central Midfielder", role: "CM / CAM", desc: "Scanning, tempo, first touch, vision" },
  { id: "fullback", title: "Fullback / Wingback", role: "LB / RB", desc: "Overlaps, 1v1 defending, recovery" },
  { id: "centre_back", title: "Centre-Back", role: "CB", desc: "Aerial duels, positioning, distribution" },
  { id: "goalkeeper", title: "Goalkeeper", role: "GK", desc: "Shot stopping, command of box, composure" },
];

const positionSkills: Record<string, { id: string; label: string; icon: any }[]> = {
  striker: [
    { id: "finishing", label: "Finishing & Shot Placement", icon: Target },
    { id: "movement", label: "Box Movement & Anticipation", icon: Footprints },
    { id: "hold_up", label: "Hold-Up & Link Play", icon: Shield },
    { id: "first_touch", label: "First Touch Under Pressure", icon: Zap },
    { id: "1v1s", label: "Beating Defenders 1v1", icon: Crosshair },
    { id: "heading", label: "Aerial Duels & Heading", icon: Compass },
    { id: "confidence", label: "Confidence in Front of Goal", icon: Zap },
    { id: "composure", label: "Composure on Big Chances", icon: Shield },
  ],
  winger: [
    { id: "1v1s", label: "1v1 Take-Ons & Beating Fullbacks", icon: Crosshair },
    { id: "crossing", label: "Crossing & Delivery into Box", icon: Compass },
    { id: "cutting_inside", label: "Cutting Inside & Shooting", icon: Target },
    { id: "first_touch", label: "First Touch on the Move", icon: Zap },
    { id: "movement", label: "Back-Post Runs & Timing", icon: Footprints },
    { id: "decision_making", label: "Final Third Decision Making", icon: Compass },
    { id: "confidence", label: "Boldness to Attack Defenders", icon: Zap },
    { id: "composure", label: "Composure Under Pressure", icon: Shield },
  ],
  midfielder: [
    { id: "scanning", label: "Scanning & Pitch Awareness", icon: Compass },
    { id: "first_touch", label: "Receiving on Half-Turn", icon: Zap },
    { id: "passing", label: "Range of Passing & Penetration", icon: Target },
    { id: "decision_making", label: "Tempo & Micro-Decisions", icon: Compass },
    { id: "press_resistance", label: "Shielding & Press Resistance", icon: Shield },
    { id: "positioning", label: "Spacing & Defensive Shape", icon: Footprints },
    { id: "confidence", label: "Demanding the Ball Under Fire", icon: Zap },
    { id: "composure", label: "Composure in Tight Spaces", icon: Shield },
  ],
  fullback: [
    { id: "1v1_defending", label: "1v1 Defending & Jockeying", icon: Shield },
    { id: "crossing", label: "Overlapping & Delivery", icon: Compass },
    { id: "recovery", label: "Recovery Runs & Transitions", icon: Footprints },
    { id: "distribution", label: "Building from the Back", icon: Target },
    { id: "scanning", label: "Tracking Runners & Awareness", icon: Compass },
    { id: "confidence", label: "Confidence in 50/50 Duels", icon: Zap },
    { id: "composure", label: "Composure on the Ball", icon: Shield },
  ],
  centre_back: [
    { id: "positioning", label: "Positioning & Holding Line", icon: Shield },
    { id: "aerial", label: "Aerial Dominance & Headers", icon: Compass },
    { id: "1v1_defending", label: "1v1 Defending in Space", icon: Crosshair },
    { id: "distribution", label: "Line-Breaking Passes", icon: Target },
    { id: "leadership", label: "Organizing & Vocal Command", icon: Compass },
    { id: "composure", label: "Composure Under Heavy Press", icon: Shield },
  ],
  goalkeeper: [
    { id: "shot_stopping", label: "Reaction Saves & Reflexes", icon: Target },
    { id: "crosses", label: "Claiming High Balls & Crosses", icon: Compass },
    { id: "distribution", label: "Distribution with Feet & Hands", icon: Zap },
    { id: "1v1_saves", label: "1v1 Smothers & Angles", icon: Shield },
    { id: "command", label: "Command of Penalty Area", icon: Compass },
    { id: "composure", label: "Composure After Errors", icon: Shield },
  ],
};

const goalsByPosition: Record<string, string[]> = {
  striker: [
    "Become More Dangerous in the Box",
    "Clinical 1-Touch Finishing",
    "Score Consistently Every Match",
    "Stay Calm on Big Chances",
  ],
  winger: [
    "Dominate My Fullback 1v1",
    "Deliver Pinpoint Crosses",
    "Create 3+ Clear Chances Per Match",
    "Play Fearless Without Second-Guessing",
  ],
  midfielder: [
    "Control the Tempo of Every Game",
    "Never Give the Ball Away Under Pressure",
    "Spot Open Teammates 1 Second Faster",
    "Dominate Both Halves with Composure",
  ],
  fullback: [
    "Lock Down My Flank & Stop Crosses",
    "Provide Lethal Overlaps in Attack",
    "Win 80%+ of Defensive Duels",
    "Stay Composed in Transition",
  ],
  centre_back: [
    "Clean Sheets & Zero Defensive Lapses",
    "Win Every Aerial & Ground Duel",
    "Initiate Attacks with Confident Passes",
    "Unshakeable Leadership Under Fire",
  ],
  goalkeeper: [
    "Keep Clean Sheets in Big Matches",
    "Dominate Every Cross into My 6-Yard Box",
    "Pinpoint Distribution Under High Press",
    "Reset Instantly After Conceding",
  ],
};

const matchdays = ["Saturday", "Sunday", "Midweek / Wednesday", "No Match This Week"];

export function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  const [step, setStep] = useState<number>(1);
  const [selectedPosition, setSelectedPosition] = useState<string>("striker");
  const [selectedSkills, setSelectedSkills] = useState<string[]>(["finishing", "movement"]);
  const [selectedGoal, setSelectedGoal] = useState<string>("Become More Dangerous in the Box");
  const [selectedMatchday, setSelectedMatchday] = useState<string>("Saturday");

  const toggleSkill = (skillId: string) => {
    if (selectedSkills.includes(skillId)) {
      if (selectedSkills.length > 1) {
        setSelectedSkills(selectedSkills.filter((s) => s !== skillId));
      }
    } else {
      setSelectedSkills([...selectedSkills, skillId]);
    }
  };

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      onContinue({
        position: selectedPosition,
        skills: selectedSkills,
        goal: selectedGoal,
        matchday: selectedMatchday,
      });
    }
  };

  const currentSkills = positionSkills[selectedPosition] || positionSkills.striker;
  const currentGoals = goalsByPosition[selectedPosition] || goalsByPosition.striker;

  return (
    <div className="screen onboarding-screen">
      <div className="onboarding-bg-glow" />

      {/* Header with Centered Official Logo */}
      <header className="onboarding-header">
        <FearlessHeaderLogo size="lg" />

        {/* Step Counter & Dot Progress Bar */}
        <div className="onboarding-progress-row">
          <span className="step-counter">{step} of 5</span>
          <div
            className="step-dots-connected"
            role="progressbar"
            aria-valuenow={step}
            aria-valuemin={1}
            aria-valuemax={5}
          >
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} style={{ display: "contents" }}>
                <div
                  className={`dot-node ${s < step ? "filled" : s === step ? "current" : ""}`}
                />
                {s < 5 && <div className={`dot-line ${s < step ? "active" : ""}`} />}
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="onboarding-content">
        {/* STEP 1: POSITION SELECTION */}
        {step === 1 && (
          <>
            <div className="onboarding-title-wrap">
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "1.5px", fontSize: "0.75rem", textTransform: "uppercase" }}>
                LET'S BUILD YOUR OFF-PITCH TRAINING
              </span>
              <h1 style={{ marginTop: "6px" }}>
                What position do you <br />
                <span className="highlight-cyan">play on the pitch?</span>
              </h1>
            </div>

            <div className="position-choice-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
              {positions.map((pos) => {
                const isSelected = selectedPosition === pos.id;
                return (
                  <button
                    key={pos.id}
                    type="button"
                    className={`mindset-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedPosition(pos.id);
                      const defaultSkills = (positionSkills[pos.id] || []).slice(0, 2).map((s) => s.id);
                      setSelectedSkills(defaultSkills);
                      const defaultGoal = (goalsByPosition[pos.id] || [])[0] || "Become More Dangerous in the Box";
                      setSelectedGoal(defaultGoal);
                    }}
                    style={{ textAlign: "left", padding: "14px", border: isSelected ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0, 240, 255, 0.08)" : "rgba(15, 23, 42, 0.6)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.75rem", color: "#00F0FF", fontWeight: 700 }}>{pos.role}</span>
                      <div className={`choice-check-ring ${isSelected ? "checked" : ""}`}>
                        {isSelected ? <Check size={12} strokeWidth={3} /> : <span className="hollow-circle-dot" />}
                      </div>
                    </div>
                    <strong style={{ display: "block", color: "#fff", fontSize: "0.95rem", marginTop: "6px" }}>{pos.title}</strong>
                    <p style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)", marginTop: "4px", lineHeight: "1.2" }}>{pos.desc}</p>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 2: WHAT DO YOU WANT TO WORK ON? */}
        {step === 2 && (
          <>
            <div className="onboarding-title-wrap">
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "1.5px", fontSize: "0.75rem", textTransform: "uppercase" }}>
                AREAS OF YOUR GAME · {positions.find((p) => p.id === selectedPosition)?.title.toUpperCase()}
              </span>
              <h1 style={{ marginTop: "6px" }}>
                What do you want to <br />
                <span className="highlight-cyan">work on?</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", marginTop: "4px" }}>
                Select 1–3 areas you want to rehearse off the pitch.
              </p>
            </div>

            <div className="skills-choice-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "16px 0" }}>
              {currentSkills.map(({ id, label, icon: Icon }) => {
                const isSelected = selectedSkills.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={`mindset-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => toggleSkill(id)}
                    style={{ textAlign: "left", padding: "12px", border: isSelected ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0, 240, 255, 0.08)" : "rgba(15, 23, 42, 0.6)" }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Icon size={18} color={isSelected ? "#00F0FF" : "rgba(255,255,255,0.7)"} />
                      <div className={`choice-check-ring ${isSelected ? "checked" : ""}`}>
                        {isSelected ? <Check size={12} strokeWidth={3} /> : <span className="hollow-circle-dot" />}
                      </div>
                    </div>
                    <strong style={{ display: "block", color: "#fff", fontSize: "0.85rem", marginTop: "8px", lineHeight: "1.2" }}>{label}</strong>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 3: BIGGEST GOAL RIGHT NOW */}
        {step === 3 && (
          <>
            <div className="onboarding-title-wrap">
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "1.5px", fontSize: "0.75rem", textTransform: "uppercase" }}>
                YOUR OBJECTIVE
              </span>
              <h1 style={{ marginTop: "6px" }}>
                What's your biggest goal <br />
                <span className="highlight-cyan">right now?</span>
              </h1>
            </div>

            <div className="goal-choice-list" style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "18px 0" }}>
              {currentGoals.map((goal) => {
                const isSelected = selectedGoal === goal;
                return (
                  <button
                    key={goal}
                    type="button"
                    className={`mindset-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedGoal(goal)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", border: isSelected ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0, 240, 255, 0.08)" : "rgba(15, 23, 42, 0.6)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Target size={20} color={isSelected ? "#00F0FF" : "rgba(255,255,255,0.5)"} />
                      <strong style={{ color: "#fff", fontSize: "0.95rem" }}>{goal}</strong>
                    </div>
                    <div className={`choice-check-ring ${isSelected ? "checked" : ""}`}>
                      {isSelected ? <Check size={12} strokeWidth={3} /> : <span className="hollow-circle-dot" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 4: WHEN'S YOUR NEXT MATCH? */}
        {step === 4 && (
          <>
            <div className="onboarding-title-wrap">
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "1.5px", fontSize: "0.75rem", textTransform: "uppercase" }}>
                MATCHDAY RHYTHM
              </span>
              <h1 style={{ marginTop: "6px" }}>
                When's your next <br />
                <span className="highlight-cyan">match?</span>
              </h1>
              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", marginTop: "4px" }}>
                Fearless schedules your off-pitch rehearsals around your team training and matchday.
              </p>
            </div>

            <div className="matchday-choice-list" style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "18px 0" }}>
              {matchdays.map((day) => {
                const isSelected = selectedMatchday === day;
                return (
                  <button
                    key={day}
                    type="button"
                    className={`mindset-choice-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedMatchday(day)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", border: isSelected ? "1.5px solid #00F0FF" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(0, 240, 255, 0.08)" : "rgba(15, 23, 42, 0.6)" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Calendar size={20} color={isSelected ? "#00F0FF" : "rgba(255,255,255,0.5)"} />
                      <strong style={{ color: "#fff", fontSize: "0.95rem" }}>{day}</strong>
                    </div>
                    <div className={`choice-check-ring ${isSelected ? "checked" : ""}`}>
                      {isSelected ? <Check size={12} strokeWidth={3} /> : <span className="hollow-circle-dot" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* STEP 5: YOUR FIRST TRAINING PLAN IS READY */}
        {step === 5 && (
          <>
            <div className="onboarding-title-wrap">
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "1.5px", fontSize: "0.75rem", textTransform: "uppercase" }}>
                PRESCRIBED TRAINING PLAN
              </span>
              <h1 style={{ marginTop: "6px" }}>
                Your First Training Plan <br />
                <span className="highlight-cyan">is Ready.</span>
              </h1>
            </div>

            <div
              className="prescribed-plan-card"
              style={{
                background: "linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)",
                border: "1.5px solid rgba(0, 240, 255, 0.4)",
                borderRadius: "16px",
                padding: "20px",
                margin: "18px 0",
                boxShadow: "0 10px 30px rgba(0, 240, 255, 0.15)",
              }}
            >
              <div style={{ display: "inline-block", background: "rgba(0, 240, 255, 0.15)", color: "#00F0FF", padding: "4px 10px", borderRadius: "100px", fontSize: "0.75rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                {positions.find((p) => p.id === selectedPosition)?.title} · 4-WEEK PROGRAMME
              </div>

              <h2 style={{ fontSize: "1.25rem", color: "#fff", fontWeight: 800, margin: "12px 0 6px 0", lineHeight: "1.3" }}>
                {selectedGoal.toUpperCase()}
              </h2>

              <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem", lineHeight: "1.4" }}>
                7 days · 5 Off-Pitch Training sessions built around your position, focus areas, and next match on {selectedMatchday}.
              </p>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", marginTop: "16px", paddingTop: "14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Focus Areas</span>
                  <div style={{ color: "#fff", fontSize: "0.8rem", fontWeight: 600, marginTop: "2px" }}>
                    {selectedSkills.map((s) => s.replace("_", " ")).slice(0, 2).join(" & ")}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Method</span>
                  <div style={{ color: "#00F0FF", fontSize: "0.8rem", fontWeight: 600, marginTop: "2px" }}>
                    SEE · REHEARSE · BECOME
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Tactical Pitch Vector Graphic at Bottom */}
        <div className="pitch-markings-bottom" style={{ opacity: 0.6, margin: "10px 0" }}>
          <PitchMarkingsGraphic />
        </div>

        {/* CTA Button */}
        <button
          type="button"
          className="primary-button continue-button"
          onClick={handleNext}
          style={{ width: "100%", padding: "16px", fontSize: "1rem", fontWeight: 700 }}
        >
          {step === 5 ? (
            <>
              Enter Fearless HQ <ArrowRight size={20} strokeWidth={2.4} />
            </>
          ) : (
            <>
              Continue <ArrowRight size={20} strokeWidth={2.4} />
            </>
          )}
        </button>
      </main>
    </div>
  );
}
