import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Flame,
  Info,
  SlidersHorizontal,
  Users,
  Zap,
  Shield,
  Crosshair,
  Footprints,
  Target,
  Trophy,
} from "lucide-react";
import {
  BadgeHexIcon,
  PitchMarkingsGraphic,
  FearlessHeaderLogo,
} from "../components/icons/CustomIcons";

interface HQScreenProps {
  onStartRehearsal: () => void;
  onOpenSetup: () => void;
  onOpenParent: () => void;
  onNavigateTab: (tab: string) => void;
}

const workOnCategories = [
  { id: "technical", label: "Technical", icon: Target, desc: "Finishing, 1v1s, First Touch" },
  { id: "tactical", label: "Tactical", icon: Footprints, desc: "Movement, Spacing, Positioning" },
  { id: "match_prep", label: "Match Prep", icon: Shield, desc: "Pre-match focus, Nerves = Performance" },
  { id: "decisions", label: "Decisions", icon: Crosshair, desc: "Scanning, Tempo, Micro-choices" },
];

export function HQScreen({
  onStartRehearsal,
  onOpenSetup,
  onOpenParent,
}: HQScreenProps) {
  const [activeCategory, setActiveCategory] = useState("tactical");
  const [selectedDay, setSelectedDay] = useState("WED");
  const [recommendedMode, setRecommendedMode] = useState<"training" | "customize">("training");
  const [viewState, setViewState] = useState<"active" | "baseline">("active");

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // High quality photo avatar for Alex Rivera (Pro Performance Coach)
  const coachAvatar = "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80";

  return (
    <div className={`screen hq-screen ${viewState === "baseline" ? "mode-baseline" : "mode-active"}`}>
      <div className="hero-wash" />

      {/* Top Header */}
      <header className="hq-header">
        <FearlessHeaderLogo subtitle="HQ" size="md" />

        <div className="header-actions">
          <button
            type="button"
            className="parent-entry"
            onClick={onOpenParent}
            aria-label="Open Caregiver Parent View"
          >
            <Users size={14} /> Parent view
          </button>

          <button
            type="button"
            className="icon-button notification-button"
            aria-label="Notifications (0 unread)"
          >
            <Bell size={20} />
            <span className="notification-badge">0</span>
          </button>
        </div>
      </header>

      {/* View Mode Toggle (Active Effort vs Fresh Baseline) */}
      <div className="view-mode-toggle">
        <span>Training View:</span>
        <button
          type="button"
          className={`toggle-pill ${viewState === "active" ? "active" : ""}`}
          onClick={() => setViewState("active")}
        >
          Active Programme
        </button>
        <button
          type="button"
          className={`toggle-pill ${viewState === "baseline" ? "active" : ""}`}
          onClick={() => setViewState("baseline")}
        >
          Fresh Baseline
        </button>
      </div>

      {/* Greeting & Football Context */}
      <section className="greeting">
        <span className="eyebrow">GOOD EVENING, ALEX</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <h1 style={{ margin: 0 }}>Fearless HQ</h1>
          <span style={{ fontSize: "0.75rem", background: "rgba(0,240,255,0.15)", color: "#00F0FF", padding: "2px 8px", borderRadius: "100px", fontWeight: 700 }}>
            Striker · U14
          </span>
        </div>
      </section>

      {/* Question 1: What am I working on? (Current Focus) */}
      <section className="current-focus-banner" style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(0, 240, 255, 0.25)", borderRadius: "14px", padding: "14px 18px", margin: "14px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span className="eyebrow" style={{ color: "#00F0FF", fontSize: "0.7rem", letterSpacing: "1.2px", textTransform: "uppercase" }}>
              YOUR CURRENT FOCUS
            </span>
            <h3 style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 800, margin: "2px 0 0 0" }}>
              Become More Dangerous in the Box
            </h3>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.75rem" }}>
              Striker · 4-week programme (Week 2 of 4)
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenSetup}
            style={{ background: "transparent", border: "none", color: "#00F0FF", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.75rem", fontWeight: 700 }}
          >
            Plan <ArrowRight size={13} />
          </button>
        </div>
      </section>

      {/* Performance Metrics: TRAINING SCORE & STREAK */}
      <section className="metrics-grid" aria-label="Athlete Training Effort">
        {viewState === "active" ? (
          <>
            {/* Training Score Circular Gauge */}
            <div className="metric-card composure-gauge-card">
              <div className="circular-gauge-wrap">
                <svg className="gauge-svg" viewBox="0 0 100 100" aria-hidden="true">
                  <circle className="gauge-track" cx="50" cy="50" r="42" />
                  <circle
                    className="gauge-value"
                    cx="50"
                    cy="50"
                    r="42"
                    strokeDasharray="264"
                    strokeDashoffset="48"
                  />
                </svg>
                <div className="gauge-inner">
                  <span className="gauge-label">TRAINING SCORE</span>
                  <strong className="gauge-number">82</strong>
                  <span style={{ fontSize: "0.65rem", color: "#00F0FF", fontWeight: 700, textTransform: "uppercase" }}>High Consistency</span>
                </div>
              </div>
            </div>

            {/* Current Streak Active State */}
            <div className="metric-card streak-active-card">
              <div className="streak-header-row">
                <div className="flame-glow-icon">
                  <Flame size={26} />
                </div>
                <div>
                  <span className="eyebrow">CURRENT STREAK</span>
                  <strong className="streak-number">6 Days</strong>
                  <small style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "0.7rem", marginTop: "2px" }}>
                    3/4 sessions this week
                  </small>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="metric-card cyan-edge baseline-metric">
              <div className="metric-icon">
                <Target size={24} />
              </div>
              <div className="metric-copy">
                <span className="eyebrow">TRAINING SCORE</span>
                <strong className="baseline-dash">—</strong>
                <small>Complete training to build consistency.</small>
              </div>
              <Info className="metric-help" size={15} />
            </div>

            <div className="metric-card purple-edge baseline-metric">
              <div className="metric-icon pink-flame">
                <Flame size={25} />
              </div>
              <div className="metric-copy">
                <span className="eyebrow">CURRENT STREAK</span>
                <strong className="baseline-score">0/1</strong>
                <small>Train today to start your streak.</small>
              </div>
              <Info className="metric-help" size={15} />
            </div>
          </>
        )}
      </section>

      {/* Question 2: What am I training today? (Today's Off-Pitch Training) */}
      <section className="rep-card" aria-label="Today's Off-Pitch Training">
        <div
          className="rep-cover"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5,13,33,.98) 0%, rgba(5,13,33,.82) 48%, rgba(5,13,33,.2) 100%), url('/assets/hq-active-screen.jpg')`,
            backgroundPosition: "top right",
          }}
        />
        <div className="rep-content">
          <div className="rep-header-pill">
            <span className="eyebrow">TODAY'S OFF-PITCH TRAINING</span>
          </div>

          <div className="rep-title-row">
            <div className="rep-target-badge">
              <Footprints size={20} />
            </div>
            <h2>Finding Space<br />Between Centre-Backs</h2>
          </div>

          <div className="rep-meta">
            <span style={{ color: "#00F0FF", fontWeight: 700 }}>Tactical</span>
            <span className="meta-divider">|</span>
            <span className="composure-tag"><Footprints size={14} /> Movement</span>
            <span className="meta-divider">|</span>
            <span>SEE · REHEARSE · BECOME</span>
          </div>

          <button
            type="button"
            className="primary-button rep-cta-button"
            onClick={onStartRehearsal}
          >
            Start Training <ArrowRight size={18} />
          </button>
        </div>

        <div className="rep-check" aria-label="Verified recommendation">
          <Check size={14} strokeWidth={3} />
        </div>
      </section>

      {/* Question 3: Am I staying consistent? (Programme Progress & Matchday Cadence) */}
      <section className="consistency-summary-card" style={{ background: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "16px", margin: "14px 0" }}>
        <span className="eyebrow" style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.7rem", letterSpacing: "1px" }}>
          WEEKLY TRAINING PROGRESS
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "10px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>This Week</span>
            <strong style={{ display: "block", color: "#fff", fontSize: "1.1rem", fontWeight: 800 }}>3 of 4 Sessions</strong>
            <small style={{ color: "#00F0FF", fontSize: "0.7rem" }}>On track for matchday</small>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.6)" }}>Next Match</span>
            <strong style={{ display: "block", color: "#fff", fontSize: "1.1rem", fontWeight: 800 }}>Saturday</strong>
            <small style={{ color: "#a855f7", fontSize: "0.7rem" }}>Pre-match rehearsal due Fri</small>
          </div>
        </div>
      </section>

      {/* Horizontal Shelf: Training Library, Train With The Pros, Badges */}
      {viewState === "active" && (
        <section className="horizontal-shelf-section" aria-label="Shortcuts & Milestones">
          <div className="horizontal-shelf-scroll">
            {/* Card 1: Training Plan */}
            <button
              type="button"
              className="shelf-card blueprint-shelf-card"
              onClick={onOpenSetup}
            >
              <PitchMarkingsGraphic />
              <div className="shelf-card-top">
                <div className="shelf-icon blue">
                  <Calendar size={16} />
                </div>
                <span className="shelf-pill blue">YOUR PROGRAMME</span>
              </div>
              <strong>Striker Plan: Box Mastery</strong>
              <p>Week 2 of 4 · Tactical Spacing</p>
              <div className="shelf-arrow">
                <ArrowRight size={14} />
              </div>
            </button>

            {/* Card 2: Train With The Pros */}
            <button
              type="button"
              className="shelf-card mentor-shelf-card"
              onClick={onStartRehearsal}
            >
              <div className="shelf-card-top">
                <img
                  src={coachAvatar}
                  alt="Alex Rivera"
                  className="shelf-avatar-img"
                />
                <span className="shelf-pill purple">PRO REHEARSAL</span>
              </div>
              <strong>Train With The Pros</strong>
              <p>Beating Your Defender 1v1</p>
              <div className="shelf-arrow">
                <ArrowRight size={14} />
              </div>
            </button>

            {/* Card 3: Recent Training Milestone */}
            <div className="shelf-card badge-shelf-card">
              <div className="shelf-card-top">
                <div className="shelf-icon cyan glow-hex">
                  <BadgeHexIcon size={18} />
                </div>
                <span className="shelf-pill purple">MILESTONE</span>
              </div>
              <strong>Box Hunter Level 2</strong>
              <p>Completed 5 movement rehearsals</p>
              <div className="shelf-arrow badge-check">
                <Check size={13} strokeWidth={3} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Choose What To Work On (Replaces Browse by Mindset) */}
      <section className="mindset-filter-section" aria-label="Choose What To Work On">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <span className="eyebrow section-eyebrow" style={{ color: "#fff", fontWeight: 700 }}>
            CHOOSE WHAT TO WORK ON
          </span>
          <span style={{ fontSize: "0.75rem", color: "#00F0FF" }}>Training Library</span>
        </div>

        <div className="mindset-pill-track">
          {workOnCategories.map(({ id, label, icon: Icon }) => {
            const isActive = activeCategory === id;
            return (
              <button
                key={id}
                type="button"
                className={`mindset-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveCategory(id)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Days Training Schedule */}
      <section className="blueprint-section" style={{ marginTop: "16px" }}>
        <div className="section-row">
          <div>
            <span className="eyebrow">OFF-PITCH SCHEDULE</span>
          </div>
          <div className="recommended-mode-group">
            <span className="mode-group-label">SCHEDULE VIEW</span>
            <div className="mode-pills-wrap">
              <button
                type="button"
                className={`mode-toggle-chip ${recommendedMode === "training" ? "active" : ""}`}
                onClick={() => setRecommendedMode("training")}
              >
                <Target size={12} /> Training
              </button>
              <button
                type="button"
                className={`mode-toggle-chip ${recommendedMode === "customize" ? "active" : ""}`}
                onClick={() => {
                  setRecommendedMode("customize");
                  onOpenSetup();
                }}
              >
                <SlidersHorizontal size={12} /> Match Schedule
              </button>
            </div>
          </div>
        </div>

        <div className="days-row" role="tablist" aria-label="Weekly training days">
          {days.map((item) => {
            const isSelected = selectedDay === item;
            return (
              <button
                key={item}
                type="button"
                className={`day-button ${isSelected ? "selected" : ""}`}
                onClick={() => setSelectedDay(item)}
                role="tab"
                aria-selected={isSelected}
              >
                <div className="day-top-indicator">
                  {isSelected ? (
                    <div className="selected-check-badge">
                      <Check size={11} strokeWidth={3} />
                    </div>
                  ) : (
                    <span className="hollow-day-circle" />
                  )}
                </div>
                <b>{item}</b>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
