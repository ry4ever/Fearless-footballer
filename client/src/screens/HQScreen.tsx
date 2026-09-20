import { useState } from "react";
import {
  ArrowRight,
  Bell,
  Brain,
  Calendar,
  Check,
  ChevronRight,
  Crown,
  Flame,
  Info,
  SlidersHorizontal,
  Target,
  Users,
  Sparkles,
  Zap,
} from "lucide-react";

interface HQScreenProps {
  onStartRehearsal: () => void;
  onOpenSetup: () => void;
  onOpenParent: () => void;
  onNavigateTab: (tab: string) => void;
}

const mindsetFilters = [
  { id: "calm", label: "Calm", icon: Brain },
  { id: "focus", label: "Focus", icon: Target },
  { id: "confidence", label: "Confidence", icon: Zap },
  { id: "resilience", label: "Resilience", icon: Sparkles },
  { id: "performance", label: "Performance", icon: SlidersHorizontal },
];

export function HQScreen({
  onStartRehearsal,
  onOpenSetup,
  onOpenParent,
}: HQScreenProps) {
  const [activeMindset, setActiveMindset] = useState("calm");
  const [selectedDay, setSelectedDay] = useState("MON");
  const [viewState, setViewState] = useState<"active" | "baseline">("active");

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  return (
    <div className="screen hq-screen">
      <div className="hero-wash" />

      {/* Top Header */}
      <header className="hq-header">
        <div className="brand-lockup-hq">
          <span className="brand-white">FEARLESS</span>
          <span className="brand-sub">HQ</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="parent-entry"
            onClick={onOpenParent}
            aria-label="Open Caregiver Parent View"
          >
            <Users size={15} /> Parent view
          </button>

          <button
            type="button"
            className="icon-button notification-button"
            aria-label="Notifications (0 unread)"
          >
            <Bell size={21} />
            <span className="notification-badge">0</span>
          </button>
        </div>
      </header>

      {/* State Mode Switcher (Allows testing both Image 2 and Image 4 mockups) */}
      <div className="view-mode-toggle">
        <span>Preview Mode:</span>
        <button
          type="button"
          className={`toggle-pill ${viewState === "active" ? "active" : ""}`}
          onClick={() => setViewState("active")}
        >
          Active (82 Score)
        </button>
        <button
          type="button"
          className={`toggle-pill ${viewState === "baseline" ? "active" : ""}`}
          onClick={() => setViewState("baseline")}
        >
          Baseline (0/1)
        </button>
      </div>

      {/* Greeting */}
      <section className="greeting">
        <span className="eyebrow">GOOD EVENING,</span>
        <h1>Alex</h1>
      </section>

      {/* Performance Metrics Cards */}
      <section className="metrics-grid" aria-label="Athlete Performance Metrics">
        {viewState === "active" ? (
          <>
            {/* Circular Gauge Composure Score (Image 4) */}
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
                  <span className="gauge-label">COMPOSURE SCORE</span>
                  <strong className="gauge-number">82</strong>
                  <Brain size={16} className="gauge-icon" />
                </div>
              </div>
            </div>

            {/* Current Streak (Image 4) */}
            <div className="metric-card streak-active-card">
              <div className="streak-header-row">
                <div className="flame-glow-icon">
                  <Flame size={28} />
                </div>
                <div>
                  <span className="eyebrow">CURRENT STREAK</span>
                  <strong className="streak-number">4/5</strong>
                </div>
              </div>
              <small className="streak-caption">
                One more rep to lock in this week’s milestone.
              </small>
            </div>
          </>
        ) : (
          <>
            {/* Baseline Composure Score (Image 2) */}
            <div className="metric-card cyan-edge">
              <div className="metric-icon">
                <Brain size={25} />
              </div>
              <div className="metric-copy">
                <span className="eyebrow">COMPOSURE SCORE</span>
                <strong>—</strong>
                <small>Build your baseline.</small>
              </div>
              <Info className="metric-help" size={16} />
            </div>

            {/* Baseline Streak (Image 2) */}
            <div className="metric-card purple-edge">
              <div className="metric-icon">
                <Flame size={27} />
              </div>
              <div className="metric-copy">
                <span className="eyebrow">CURRENT STREAK</span>
                <strong>0/1</strong>
                <small>Complete a session to start your streak.</small>
              </div>
              <Info className="metric-help" size={16} />
            </div>
          </>
        )}
      </section>

      {/* Today's Fearless Rep Card */}
      <section className="rep-card" aria-label="Today's Fearless Rep">
        <div
          className="rep-cover"
          style={{
            backgroundImage: `linear-gradient(90deg, rgba(5,13,33,.98) 0%, rgba(5,13,33,.82) 48%, rgba(5,13,33,.25) 100%), url('/assets/hq-active-screen.jpg')`,
            backgroundPosition: "top right",
          }}
        />
        <div className="rep-content">
          <div className="rep-header-pill">
            <span className="eyebrow">TODAY’S FEARLESS REP</span>
          </div>

          <h2>Nerves =<br />Performance</h2>

          <div className="rep-meta">
            <span><Target size={16} /> 5 min</span>
            <span className="meta-divider">|</span>
            <span><Brain size={16} /> Composure</span>
          </div>

          <button
            type="button"
            className="primary-button rep-cta-button"
            onClick={onStartRehearsal}
          >
            Start rehearsal <ArrowRight size={19} />
          </button>
        </div>

        <div className="rep-check" aria-label="Verified recommendation">
          <Check size={16} strokeWidth={3} />
        </div>
      </section>

      {/* Horizontal 3-Card Shelf (Image 4) */}
      <section className="horizontal-shelf-section" aria-label="Shortcuts & Milestones">
        <div className="horizontal-shelf-scroll">
          {/* Card 1: 7-Day Blueprint */}
          <button
            type="button"
            className="shelf-card blueprint-shelf-card"
            onClick={onOpenSetup}
          >
            <div className="shelf-card-top">
              <div className="shelf-icon blue">
                <Calendar size={18} />
              </div>
              <span className="shelf-pill blue">7-DAY PLAN</span>
            </div>
            <strong>Your 7-day blueprint</strong>
            <p>Build composure, sharpen focus.</p>
            <div className="shelf-arrow">
              <ArrowRight size={15} />
            </div>
          </button>

          {/* Card 2: Mentor Matthew McConaughey */}
          <button
            type="button"
            className="shelf-card mentor-shelf-card"
            onClick={onStartRehearsal}
          >
            <div className="shelf-card-top">
              <div className="shelf-avatar">MM</div>
              <span className="shelf-pill purple">MENTOR</span>
            </div>
            <strong>Matthew McConaughey</strong>
            <p>The Power of Presence</p>
            <div className="shelf-arrow">
              <ArrowRight size={15} />
            </div>
          </button>

          {/* Card 3: Recent Badge */}
          <div className="shelf-card badge-shelf-card">
            <div className="shelf-card-top">
              <div className="shelf-icon cyan">
                <Crown size={18} />
              </div>
              <span className="shelf-pill purple">RECENT BADGE</span>
            </div>
            <strong>Focus Builder</strong>
            <p>Complete 3 reps in a row</p>
            <div className="shelf-arrow badge-check">
              <Check size={14} strokeWidth={3} />
            </div>
          </div>
        </div>
      </section>

      {/* 7-Day Blueprint Selector */}
      <section className="blueprint-section">
        <div className="section-row">
          <div>
            <span className="eyebrow">7-DAY BLUEPRINT</span>
            <h3>Your starting rhythm</h3>
          </div>
          <div className="mode-pill">
            <span><Target size={14} /> Recommended</span>
            <button type="button" onClick={onOpenSetup}>
              <SlidersHorizontal size={13} /> Customize
            </button>
          </div>
        </div>

        <div className="days-row" role="tablist" aria-label="Blueprint days">
          {days.map((item, index) => {
            const isSelected = selectedDay === item;
            const isDone = index < 4;
            return (
              <button
                key={item}
                type="button"
                className={`day-button ${isSelected ? "selected" : ""} ${isDone ? "completed" : ""}`}
                onClick={() => setSelectedDay(item)}
                role="tab"
                aria-selected={isSelected}
              >
                {isDone ? (
                  <Check size={13} strokeWidth={3} className="done-check" />
                ) : (
                  <span className="day-dot" />
                )}
                <b>{item}</b>
                <small>{index === 0 ? "5m" : index === 2 ? "Rest" : "5m"}</small>
              </button>
            );
          })}
        </div>
      </section>

      {/* Browse by Mindset Filter Bar (Image 4) */}
      <section className="mindset-filter-section" aria-label="Browse by mindset">
        <span className="eyebrow section-eyebrow">BROWSE BY MINDSET</span>
        <div className="mindset-pill-track">
          {mindsetFilters.map(({ id, label, icon: Icon }) => {
            const isActive = activeMindset === id;
            return (
              <button
                key={id}
                type="button"
                className={`mindset-pill ${isActive ? "active" : ""}`}
                onClick={() => setActiveMindset(id)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
