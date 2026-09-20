import { useState } from "react";
import {
  ArrowLeft,
  Brain,
  CalendarDays,
  ChevronRight,
  Flame,
  Headphones,
  LockKeyhole,
  MessageCircle,
  Settings2,
  Sparkles,
  Trophy,
  UserCheck,
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
            <span className="eyebrow">ATHLETE</span>
            <h1>Alex Rivera</h1>
            <p>Matchday mindset · Week 1</p>
          </div>
          <span className="status-dot">
            <span /> Active
          </span>
        </section>

        {/* 7-Day Completion Rhythm */}
        <section className="parent-summary-card" aria-label="Weekly Completion Summary">
          <div className="summary-heading">
            <div>
              <span className="eyebrow">THIS WEEK</span>
              <h2>Building composure</h2>
            </div>
            <CalendarDays size={22} />
          </div>

          <div className="completion-row">
            <div className="completion-ring" aria-label="5 of 7 days completed">
              <strong>5/7</strong>
              <span>days</span>
            </div>
            <div>
              <strong>Consistent rhythm</strong>
              <p>Alex has completed five mindset reps this week.</p>
              <div className="completion-dots" aria-hidden="true">
                {[1, 1, 1, 1, 1, 0, 0].map((done, index) => (
                  <span className={done ? "done" : ""} key={index} />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4 Core Metrics Grid */}
        <section className="parent-metrics-grid" aria-label="Athlete progress metrics">
          {/* Metric 1: Mood Trend */}
          <div className="parent-metric mint">
            <div className="parent-metric-icon">
              <Sparkles size={19} />
            </div>
            <span className="eyebrow">MOOD TREND</span>
            <strong>Improving</strong>
            <small>More settled after reps</small>
            <div className="trend-line" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          {/* Metric 2: Composure Trajectory */}
          <div className="parent-metric violet">
            <div className="parent-metric-icon">
              <Brain size={19} />
            </div>
            <span className="eyebrow">COMPOSURE</span>
            <strong>82</strong>
            <small>+8 this week</small>
            <div className="score-bar" aria-hidden="true">
              <span />
            </div>
          </div>

          {/* Metric 3: Habit Streak */}
          <div className="parent-metric blue">
            <div className="parent-metric-icon">
              <Flame size={19} />
            </div>
            <span className="eyebrow">CURRENT STREAK</span>
            <strong>4 days</strong>
            <small>Best: 5 days</small>
            <div className="streak-dots" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          {/* Metric 4: Last Rep */}
          <div className="parent-metric coral">
            <div className="parent-metric-icon">
              <Headphones size={19} />
            </div>
            <span className="eyebrow">LAST REP</span>
            <strong>5 min</strong>
            <small>Nerves = Performance</small>
            <span className="last-rep-label">Completed today</span>
          </div>
        </section>

        {/* Supportive Conversation Starters */}
        <section className="conversation-section" aria-label="Supportive conversation starters">
          <div className="section-row">
            <div>
              <span className="eyebrow">CONVERSATION STARTERS</span>
              <h2>Open the door, don’t grade the rep.</h2>
            </div>
            <MessageCircle size={22} />
          </div>

          <div className="conversation-card featured">
            <div className="conversation-icon">
              <MessageCircle size={21} />
            </div>
            <div>
              <span className="eyebrow">TRY THIS TONIGHT</span>
              <strong>“What helped you reset today?”</strong>
              <p>Invite a story, not a score.</p>
            </div>
            <ChevronRight size={18} />
          </div>

          <div className="conversation-card">
            <div className="conversation-icon secondary">
              <Trophy size={20} />
            </div>
            <div>
              <span className="eyebrow">NOTICE THE EFFORT</span>
              <strong>“I noticed you made time for your rep.”</strong>
              <p>Reinforce consistency over outcome.</p>
            </div>
            <ChevronRight size={18} />
          </div>

          <div className="conversation-card">
            <div className="conversation-icon blue-icon">
              <Zap size={20} />
            </div>
            <div>
              <span className="eyebrow">BEFORE MATCHDAY</span>
              <strong>“Which cue do you want to carry with you?”</strong>
              <p>Help Alex choose their own anchor.</p>
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
            Private by design. This view shares progress patterns, not session transcripts, audio, or reflection notes.
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
