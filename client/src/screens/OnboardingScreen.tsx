import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  Crosshair,
  Footprints,
  Goal,
  Plus,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import {
  GOALS_BY_POSITION,
  MATCHDAYS,
  MAX_SKILLS,
  POSITIONS,
  SKILLS_BY_POSITION,
  photo,
  positionById,
  skillLabel,
  skillPhoto,
  type GoalIcon,
  type OnboardingPlan,
} from "../lib/onboardingOptions";
import "./onboarding.css";

export type { OnboardingPlan };

interface OnboardingScreenProps {
  onContinue: (plan: OnboardingPlan) => void;
}

const TOTAL_STEPS = 5;

const GOAL_ICONS: Record<GoalIcon, typeof Target> = {
  box: Crosshair,
  score: Goal,
  confidence: Zap,
  touch: Footprints,
  defend: Shield,
  level: TrendingUp,
  target: Target,
};

function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <span className={`ob-check ${checked ? "checked" : ""}`} aria-hidden="true">
      {checked && <Check size={14} strokeWidth={3} />}
    </span>
  );
}

function StepTitle({ title, subtitle }: { title: ReactNode; subtitle?: string }) {
  return (
    <div className="ob-title">
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
    </div>
  );
}

export function OnboardingScreen({ onContinue }: OnboardingScreenProps) {
  const [step, setStep] = useState(1);
  const [position, setPosition] = useState("striker");
  const [skills, setSkills] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [customGoal, setCustomGoal] = useState<string | null>(null);
  const [matchday, setMatchday] = useState("Saturday");

  const positionSkills = SKILLS_BY_POSITION[position] ?? SKILLS_BY_POSITION.striker!;
  const goals = GOALS_BY_POSITION[position] ?? GOALS_BY_POSITION.striker!;
  // The first goal is picked until the player chooses another.
  const listGoal = goals.some((option) => option.label === goal) ? goal : goals[0]!.label;
  const chosenGoal = customGoal !== null ? customGoal.trim() : listGoal;

  const canContinue =
    (step === 2 && skills.length > 0) || (step === 3 && chosenGoal.length > 0) || step === 1 || step >= 4;

  const choosePosition = (id: string) => {
    if (id === position) return;
    setPosition(id);
    setSkills([]);
    setGoal("");
    setCustomGoal(null);
  };

  const toggleSkill = (id: string) => {
    setSkills((current) =>
      current.includes(id) ? current.filter((skill) => skill !== id) : current.length < MAX_SKILLS ? [...current, id] : current,
    );
  };

  const handleNext = () => {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    onContinue({ position, skills, goal: chosenGoal, matchday });
  };

  const positionTitle = positionById(position).title;

  return (
    <div className={`screen ob-screen ob-step-${step}`}>
      <div className="ob-glow" aria-hidden="true" />
      {step === 1 && <img className="ob-hero" src={photo("hero")} alt="" aria-hidden="true" />}
      {step === 3 && <img className="ob-hero ob-hero-wide" src={photo("stadium")} alt="" aria-hidden="true" />}

      <header className="ob-header">
        <div className="ob-header-row">
          {step > 1 ? (
            <button type="button" className="ob-back" onClick={() => setStep(step - 1)} aria-label="Back">
              <ChevronLeft size={22} />
            </button>
          ) : (
            <span className="ob-back-spacer" />
          )}
          <FearlessWordmark height={28} />
          <span className="ob-step-count" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
            {step}/{TOTAL_STEPS}
          </span>
        </div>
        <div className="ob-progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span key={index} className={index < step ? "done" : ""} />
          ))}
        </div>
      </header>

      <main className="ob-content">
        {step === 1 && (
          <>
            <StepTitle
              title={
                <>
                  What position <br />
                  do you <span className="ob-accent">play?</span>
                </>
              }
              subtitle="We'll build your training around your role."
            />
            <div className="ob-position-grid" role="radiogroup" aria-label="Position">
              {POSITIONS.map((option) => {
                const selected = option.id === position;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`ob-position-card ${selected ? "selected" : ""}`}
                    onClick={() => choosePosition(option.id)}
                  >
                    <img src={photo(option.photo)} alt="" loading="lazy" />
                    <CheckCircle checked={selected} />
                    <span className="ob-position-text">
                      <strong>{option.title}</strong>
                      <small>{option.role}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <StepTitle
              title={
                <>
                  What do you want <br />
                  to <span className="ob-accent">work on?</span>
                </>
              }
              subtitle={`Select 1–${MAX_SKILLS} areas to focus on.`}
            />
            <div className="ob-list" role="group" aria-label={`Focus areas for a ${positionTitle}`}>
              {positionSkills.map((skill) => {
                const selected = skills.includes(skill.id);
                const full = !selected && skills.length >= MAX_SKILLS;
                return (
                  <button
                    key={skill.id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    aria-disabled={full}
                    className={`ob-photo-row ${selected ? "selected" : ""} ${full ? "full" : ""}`}
                    onClick={() => toggleSkill(skill.id)}
                  >
                    <img src={photo(skillPhoto(skill.id))} alt="" loading="lazy" />
                    <strong>{skill.label}</strong>
                    <CheckCircle checked={selected} />
                  </button>
                );
              })}
            </div>
            <p className="ob-hint" aria-live="polite">
              {skills.length === MAX_SKILLS ? `That's ${MAX_SKILLS} – tap one to swap it.` : `${skills.length} of ${MAX_SKILLS} selected`}
            </p>
          </>
        )}

        {step === 3 && (
          <>
            <StepTitle
              title={
                <>
                  What's your biggest <br />
                  goal <span className="ob-accent">right now?</span>
                </>
              }
              subtitle="Pick the one that matters most."
            />
            <div className="ob-list" role="radiogroup" aria-label="Goal">
              {goals.map((option) => {
                const Icon = GOAL_ICONS[option.icon];
                const selected = customGoal === null && listGoal === option.label;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`ob-icon-row ${selected ? "selected" : ""}`}
                    onClick={() => {
                      setGoal(option.label);
                      setCustomGoal(null);
                    }}
                  >
                    <span className="ob-row-icon">
                      <Icon size={20} />
                    </span>
                    <strong>{option.label}</strong>
                    <CheckCircle checked={selected} />
                  </button>
                );
              })}
              {customGoal === null ? (
                <button type="button" className="ob-icon-row ob-add-row" onClick={() => setCustomGoal("")}>
                  <span className="ob-row-icon">
                    <Plus size={20} />
                  </span>
                  <strong>Something Else</strong>
                </button>
              ) : (
                <label className="ob-icon-row selected ob-custom-row">
                  <span className="ob-row-icon">
                    <Plus size={20} />
                  </span>
                  <input
                    autoFocus
                    value={customGoal}
                    maxLength={80}
                    placeholder="Type your goal"
                    aria-label="Your goal"
                    onChange={(event) => setCustomGoal(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleNext()}
                  />
                </label>
              )}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <StepTitle
              title={
                <>
                  When's your <br />
                  next <span className="ob-accent">match?</span>
                </>
              }
              subtitle="We'll time your sessions around matchday."
            />
            <div className="ob-list" role="radiogroup" aria-label="Matchday">
              {MATCHDAYS.map((day) => {
                const selected = matchday === day;
                return (
                  <button
                    key={day}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`ob-icon-row ${selected ? "selected" : ""}`}
                    onClick={() => setMatchday(day)}
                  >
                    <span className="ob-row-icon">
                      <Calendar size={20} />
                    </span>
                    <strong>{day}</strong>
                    <CheckCircle checked={selected} />
                  </button>
                );
              })}
            </div>
          </>
        )}

        {step === 5 && (
          <>
            <StepTitle
              title={
                <>
                  Your plan <br />
                  is <span className="ob-accent">ready.</span>
                </>
              }
              subtitle="See it. Rehearse it. Become it."
            />
            <section className="ob-plan-card">
              <img src={photo("headphones")} alt="" />
              <div className="ob-plan-body">
                <span className="ob-chip">{positionTitle} · Your focus</span>
                <h2>{chosenGoal}</h2>
                <ul>
                  {skills.map((skill) => (
                    <li key={skill}>
                      <Check size={14} strokeWidth={3} /> {skillLabel(position, skill)}
                    </li>
                  ))}
                </ul>
                <p>Matchday: {matchday}</p>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="ob-footer">
        <button type="button" className="ob-continue" onClick={handleNext} disabled={!canContinue}>
          {step === TOTAL_STEPS ? "Enter Fearless HQ" : "Continue"} <ArrowRight size={20} strokeWidth={2.4} />
        </button>
      </footer>
    </div>
  );
}
