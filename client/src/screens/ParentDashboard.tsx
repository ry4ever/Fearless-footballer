import { useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Flame,
  LockKeyhole,
  MessageCircle,
  Settings2,
  Sparkles,
  Trophy,
  Zap,
} from "lucide-react";

interface ParentDashboardProps {
  onBack: () => void;
  onNavigateTab: (tab: string) => void;
}

export function ParentDashboard({ onBack }: ParentDashboardProps) {
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [isUnlinked, setIsUnlinked] = useState(false);

  if (isUnlinked) {
    return (
      <div className="screen parent-screen">
        <header className="parent-header">
          <button type="button" className="back-button" onClick={onBack} aria-label="Back">
            <ArrowLeft size={22} />
          </button>
          <div className="parent-title">
            <span className="eyebrow">CAREGIVER VIEW</span>
            <strong>Access Revoked</strong>
          </div>
          <div style={{ width: 42 }} />
        </header>

        <div className="unlinked-empty-state">
          <LockKeyhole size={48} className="unlinked-icon" />
          <h2>Athlete Unlinked</h2>
          <p>
            You no longer have access to Alex Rivera’s progress patterns. To reconnect, request a new pairing code from the athlete’s mobile app.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setIsUnlinked(false);
              onBack();
            }}
          >
            Return to Fearless HQ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen parent-screen">
      <div className="parent-glow" />

      {/* Header */}
      <header className="parent-header">
        <button
          type="button"
          className="back-button parent-back"
          onClick={onBack}
          aria-label="Back to Fearless HQ"
        >
          <ArrowLeft size={22} />
        </button>

        <div className="parent-title">
          <span className="eyebrow">CAREGIVER VIEW</span>
          <strong>Parent dashboard</strong>
        </div>

        <button
          type="button"
          className="icon-button parent-settings"
          onClick={() => setShowSettingsModal(true)}
          aria-label="Caregiver dashboard settings"
        >
          <Settings2 size={19} />
        </button>
      </header>

      <main className="parent-content">
        {/* Athlete Identity */}
        <section className="athlete-identity" aria-label="Linked Athlete">
          <div className="athlete-avatar">AR</div>
          <div>
            <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "0.08em" }}>ALEX'S OFF-PITCH TRAINING</span>
            <h1>Alex Rivera</h1>
            <p>Striker · Current focus: Become More Dangerous in the Box</p>
          </div>
          <span className="status-dot">
            <span /> Active
          </span>
        </section>

        {/* Weekly Completion Summary */}
        <section className="parent-summary-card" aria-label="Weekly Completion Summary">
          <div className="summary-heading">
            <div>
              <span className="eyebrow">THIS WEEK</span>
              <h2>4 of 5 Sessions Completed</h2>
            </div>
            <CalendarDays size={22} color="#00F0FF" />
          </div>

          <div className="completion-row">
            <div className="completion-ring" aria-label="4 of 5 sessions completed">
              <strong>4/5</strong>
              <span>sessions</span>
            </div>
            <div>
              <strong>37 minutes training time</strong>
              <p>Alex is on track for Saturday's matchday.</p>
              <div className="completion-dots" aria-hidden="true">
                {[1, 1, 1, 1, 0].map((done, index) => (
                  <span className={done ? "done" : ""} key={index} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Metrics Grid */}
        <section className="parent-metrics-grid" aria-label="Athlete progress metrics">
          {/* Metric 1: Consistency / Training Score */}
          <div className="parent-metric violet">
            <div className="parent-metric-icon">
              <Trophy size={19} />
            </div>
            <span className="eyebrow">TRAINING SCORE</span>
            <strong>82</strong>
            <small>Consistent effort this week</small>
            <div className="score-bar" aria-hidden="true">
              <span style={{ width: "82%" }} />
            </div>
          </div>

          {/* Metric 2: Habit Streak */}
          <div className="parent-metric blue">
            <div className="parent-metric-icon">
              <Flame size={19} />
            </div>
            <span className="eyebrow">CURRENT STREAK</span>
            <strong>6 days</strong>
            <small>Best: 12 days</small>
            <div className="streak-dots" aria-hidden="true">
              <span className="done" />
              <span className="done" />
              <span className="done" />
              <span className="done" />
              <span className="done" />
              <span className="done" />
            </div>
          </div>

          {/* Metric 3: Programme Progress */}
          <div className="parent-metric mint">
            <div className="parent-metric-icon">
              <Sparkles size={19} />
            </div>
            <span className="eyebrow">PROGRAMME</span>
            <strong>Week 2</strong>
            <small>of 4-week cycle</small>
          </div>

          {/* Metric 4: Next Matchday */}
          <div className="parent-metric coral">
            <div className="parent-metric-icon">
              <Zap size={19} />
            </div>
            <span className="eyebrow">NEXT MATCH</span>
            <strong>Saturday</strong>
            <small>Match prep scheduled Fri</small>
          </div>
        </section>

        {/* Sessions Trained This Week */}
        <section className="trained-sessions-section" style={{ marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "0.08em" }}>SITUATIONS REHEARSED</span>
              <h2 style={{ fontSize: 16, margin: "3px 0 0", color: "#fff", fontWeight: 700 }}>Sessions Trained This Week</h2>
            </div>
            <span style={{ fontSize: 11, color: "#8fa3c7", background: "rgba(255,255,255,0.06)", padding: "4px 8px", borderRadius: 8 }}>4 total</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            <div style={{ background: "rgba(15, 34, 73, 0.7)", border: "1px solid rgba(0, 240, 255, 0.2)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: "rgba(0, 240, 255, 0.15)", color: "#00F0FF", padding: "2px 6px", borderRadius: 4 }}>Tactical · Movement</span>
                  <span style={{ fontSize: 11, color: "#7a90b8" }}>Today & Yesterday</span>
                </div>
                <strong style={{ fontSize: 13, color: "#f0f4fc" }}>Finding Space Between Centre-Backs</strong>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#00F0FF", background: "rgba(0, 240, 255, 0.1)", padding: "4px 8px", borderRadius: 6 }}>2x</span>
            </div>

            <div style={{ background: "rgba(15, 34, 73, 0.7)", border: "1px solid rgba(193, 59, 255, 0.2)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: "rgba(193, 59, 255, 0.15)", color: "#cb91ff", padding: "2px 6px", borderRadius: 4 }}>Technical · 1v1</span>
                  <span style={{ fontSize: 11, color: "#7a90b8" }}>Tuesday</span>
                </div>
                <strong style={{ fontSize: 13, color: "#f0f4fc" }}>Beating Your Defender 1v1</strong>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#cb91ff", background: "rgba(193, 59, 255, 0.1)", padding: "4px 8px", borderRadius: 6 }}>1x</span>
            </div>

            <div style={{ background: "rgba(15, 34, 73, 0.7)", border: "1px solid rgba(84, 214, 174, 0.2)", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", background: "rgba(84, 214, 174, 0.15)", color: "#54D6AE", padding: "2px 6px", borderRadius: 4 }}>Technical · Finishing</span>
                  <span style={{ fontSize: 11, color: "#7a90b8" }}>Monday</span>
                </div>
                <strong style={{ fontSize: 13, color: "#f0f4fc" }}>Low Driven Finishing Across Goal</strong>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#54D6AE", background: "rgba(84, 214, 174, 0.1)", padding: "4px 8px", borderRadius: 6 }}>1x</span>
            </div>
          </div>
        </section>

        {/* Areas Trained Breakdown */}
        <section style={{ marginTop: 20, background: "rgba(12, 25, 56, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: 14, padding: "14px 16px" }}>
          <span className="eyebrow" style={{ color: "#8fa3c7" }}>TRAINING PILLARS</span>
          <h3 style={{ fontSize: 13, color: "#fff", margin: "4px 0 10px", fontWeight: 700 }}>Areas Trained This Week</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, textAlign: "center" }}>
            <div style={{ background: "rgba(0, 240, 255, 0.08)", border: "1px solid rgba(0, 240, 255, 0.25)", borderRadius: 10, padding: "8px 6px" }}>
              <div style={{ fontSize: 14, color: "#00F0FF", fontWeight: 800 }}>✓</div>
              <strong style={{ display: "block", fontSize: 11, color: "#fff", marginTop: 2 }}>Technical</strong>
              <span style={{ fontSize: 9, color: "#8fa3c7" }}>Finishing & 1v1</span>
            </div>
            <div style={{ background: "rgba(193, 59, 255, 0.08)", border: "1px solid rgba(193, 59, 255, 0.25)", borderRadius: 10, padding: "8px 6px" }}>
              <div style={{ fontSize: 14, color: "#cb91ff", fontWeight: 800 }}>✓</div>
              <strong style={{ display: "block", fontSize: 11, color: "#fff", marginTop: 2 }}>Tactical</strong>
              <span style={{ fontSize: 9, color: "#8fa3c7" }}>Movement & Space</span>
            </div>
            <div style={{ background: "rgba(84, 214, 174, 0.08)", border: "1px solid rgba(84, 214, 174, 0.25)", borderRadius: 10, padding: "8px 6px" }}>
              <div style={{ fontSize: 14, color: "#54D6AE", fontWeight: 800 }}>✓</div>
              <strong style={{ display: "block", fontSize: 11, color: "#fff", marginTop: 2 }}>Mental</strong>
              <span style={{ fontSize: 9, color: "#8fa3c7" }}>Composure under pressure</span>
            </div>
          </div>
        </section>

        {/* Supportive Football Conversation Starters */}
        <section className="conversation-section" aria-label="Supportive conversation starters" style={{ marginTop: 22 }}>
          <div className="section-row">
            <div>
              <span className="eyebrow">CONVERSATION STARTERS</span>
              <h2>Ask about the picture, not the score.</h2>
            </div>
            <MessageCircle size={22} />
          </div>

          <div className="conversation-card featured">
            <div className="conversation-icon">
              <MessageCircle size={21} />
            </div>
            <div>
              <span className="eyebrow">AFTER TODAY'S REHEARSAL</span>
              <strong>“Which situation did you rehearse today?”</strong>
              <p>Ask what picture they created in their mind.</p>
            </div>
            <ChevronRight size={18} />
          </div>

          <div className="conversation-card">
            <div className="conversation-icon secondary">
              <Trophy size={20} />
            </div>
            <div>
              <span className="eyebrow">LOOKING AHEAD</span>
              <strong>“What are you going to look for in Saturday's game?”</strong>
              <p>Connect mental practice directly to real match action.</p>
            </div>
            <ChevronRight size={18} />
          </div>

          <div className="conversation-card">
            <div className="conversation-icon blue-icon">
              <Zap size={20} />
            </div>
            <div>
              <span className="eyebrow">TURF TRANSFER</span>
              <strong>“Anything you pictured that you'd like to try at training?”</strong>
              <p>Encourage transferring off-pitch reps to physical practice.</p>
            </div>
            <ChevronRight size={18} />
          </div>
        </section>

        {/* Privacy Safeguard Note */}
        <section className="parent-note" aria-label="Privacy guarantee">
          <div className="note-icon">
            <LockKeyhole size={17} />
          </div>
          <p>
            Private by design. You see training consistency, focus areas, and session titles — not private audio, reflections, or personal thoughts.
          </p>
        </section>
      </main>

      {/* Caregiver Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Caregiver Settings">
          <div className="modal-sheet">
            <h3>Caregiver Settings</h3>
            <p>Linked athlete: <strong>Alex Rivera</strong></p>
            <div className="modal-options">
              <button
                type="button"
                className="modal-option-btn danger"
                onClick={() => {
                  setIsUnlinked(true);
                  setShowSettingsModal(false);
                }}
              >
                Unlink Athlete Access
              </button>
              <button
                type="button"
                className="modal-option-btn cancel"
                onClick={() => setShowSettingsModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
