import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Flame, LockKeyhole, MessageCircle, Settings2, Trophy, Zap } from "lucide-react";
import type { CaregiverDashboardPayload, PairingLink } from "@shared/types";
import { ApiError, apiClient } from "../lib/apiClient";
import { AccountActions } from "./AccountActions";
import { useSession } from "./session";

interface LiveParentDashboardProps {
  link: PairingLink;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function LiveParentDashboard({ link }: LiveParentDashboardProps) {
  const { refreshPairing } = useSession();
  const [data, setData] = useState<CaregiverDashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await apiClient.getCaregiverDashboard(link.athleteId));
    } catch (caught) {
      // A 403 means the athlete removed access; the link state will catch up.
      if (caught instanceof ApiError && caught.status === 403) {
        await refreshPairing().catch(() => undefined);
        return;
      }
      setError(caught instanceof Error ? caught.message : "We couldn't load the dashboard.");
    }
  }, [link.athleteId, refreshPairing]);

  // Keep the numbers current while the dashboard stays open.
  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function unlink() {
    setBusy(true);
    try {
      await apiClient.revokeConsent(link.id);
      await refreshPairing();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't unlink.");
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="screen live-screen no-nav">
        <div className="live-center">
          {error ? (
            <>
              <div className="live-error" role="alert">
                {error}
              </div>
              <button type="button" className="primary-button" onClick={() => void load()}>
                Try again
              </button>
            </>
          ) : (
            <>
              <div className="live-spinner" aria-hidden="true" />
              <span className="live-note">Loading dashboard…</span>
            </>
          )}
        </div>
      </div>
    );
  }

  const { athlete, weeklySummary, metrics } = data;
  const firstName = athlete.name.split(/\s+/)[0] ?? athlete.name;
  const change = metrics.composureScore.changeWeekly;

  return (
    <div className="screen parent-screen">
      <div className="parent-glow" />
      <header className="parent-header">
        <div style={{ width: 42 }} />
        <div className="parent-title">
          <span className="eyebrow">CAREGIVER VIEW</span>
          <strong>Parent dashboard</strong>
        </div>
        <button
          type="button"
          className="icon-button parent-settings"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          <Settings2 size={19} />
        </button>
      </header>

      <main className="parent-content">
        <section className="athlete-identity" aria-label="Linked player">
          <div className="athlete-avatar">{initials(athlete.name)}</div>
          <div>
            <span className="eyebrow" style={{ color: "#00F0FF", letterSpacing: "0.08em" }}>
              {firstName.toUpperCase()}'S OFF-PITCH TRAINING
            </span>
            <h1>{athlete.name}</h1>
            <p>{weeklySummary.headline}</p>
          </div>
          <span className="status-dot">
            <span /> Linked
          </span>
        </section>

        <section className="parent-summary-card" aria-label="Last 7 days">
          <div className="summary-heading">
            <div>
              <span className="eyebrow">LAST 7 DAYS</span>
              <h2>
                Trained {weeklySummary.daysCompleted} of {weeklySummary.daysTarget} days
              </h2>
            </div>
            <CalendarDays size={22} color="#00F0FF" />
          </div>
          <p className="live-copy">{weeklySummary.description}</p>
          <div className="week-dots" aria-hidden="true">
            {weeklySummary.sevenDayPattern.map((done, index) => (
              <span key={index} className={done ? "done" : ""} />
            ))}
          </div>
        </section>

        <section className="parent-metrics-grid" aria-label="Progress">
          <div className="parent-metric violet">
            <div className="parent-metric-icon">
              <Trophy size={19} />
            </div>
            <span className="eyebrow">COMPOSURE SCORE</span>
            <strong>{metrics.composureScore.value}</strong>
            <small>{change > 0 ? `+${change} this week` : change < 0 ? `${change} this week` : "Steady this week"}</small>
            <div className="score-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, Math.max(0, metrics.composureScore.value))}%` }} />
            </div>
          </div>

          <div className="parent-metric blue">
            <div className="parent-metric-icon">
              <Flame size={19} />
            </div>
            <span className="eyebrow">CURRENT STREAK</span>
            <strong>
              {metrics.currentStreak.days} {metrics.currentStreak.days === 1 ? "day" : "days"}
            </strong>
            <small>
              Best: {metrics.currentStreak.bestDays} {metrics.currentStreak.bestDays === 1 ? "day" : "days"}
            </small>
          </div>

          <div className="parent-metric mint" style={{ gridColumn: "1 / -1" }}>
            <div className="parent-metric-icon">
              <Zap size={19} />
            </div>
            <span className="eyebrow">LAST REP</span>
            {metrics.lastRep.duration === "No completed reps" ? (
              <>
                <strong style={{ fontSize: 18 }}>None yet</strong>
                <small>Their first rep will show here.</small>
              </>
            ) : (
              <>
                <strong style={{ fontSize: 18 }}>{metrics.lastRep.title}</strong>
                <small>
                  {metrics.lastRep.completedToday
                    ? "Today"
                    : new Date(metrics.lastRep.completedAt).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })}{" "}
                  · {metrics.lastRep.duration}
                </small>
              </>
            )}
          </div>
        </section>

        {data.conversationStarters.length > 0 && (
          <section className="conversation-section" aria-label="Conversation starters" style={{ marginTop: 22 }}>
            <div className="section-row">
              <div>
                <span className="eyebrow">CONVERSATION STARTERS</span>
                <h2>Ask about the picture, not the score.</h2>
              </div>
              <MessageCircle size={22} />
            </div>
            {data.conversationStarters.map((starter, index) => (
              <div key={starter.id} className={`conversation-card ${index === 0 ? "featured" : ""}`}>
                <div className="conversation-icon">
                  <MessageCircle size={21} />
                </div>
                <div>
                  <span className="eyebrow">{starter.category}</span>
                  <strong>“{starter.prompt}”</strong>
                  <p>{starter.guidance}</p>
                </div>
              </div>
            ))}
          </section>
        )}

        <section className="parent-note" aria-label="Privacy">
          <div className="note-icon">
            <LockKeyhole size={17} />
          </div>
          <p>{data.privacyPolicyNotice}</p>
        </section>

        <div style={{ marginTop: 16 }}>
          <AccountActions />
        </div>
      </main>

      {showSettings && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Caregiver settings">
          <div className="modal-sheet">
            <h3>Caregiver settings</h3>
            <p>
              Linked player: <strong>{athlete.name}</strong>
            </p>
            {error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <div className="modal-options">
              {!confirmUnlink ? (
                <button type="button" className="modal-option-btn danger" onClick={() => setConfirmUnlink(true)}>
                  Unlink from {firstName}
                </button>
              ) : (
                <button type="button" className="modal-option-btn danger" disabled={busy} onClick={unlink}>
                  {busy ? "Unlinking…" : `Yes, unlink – ${firstName}'s sessions lock until someone links again`}
                </button>
              )}
              <button
                type="button"
                className="modal-option-btn cancel"
                onClick={() => {
                  setShowSettings(false);
                  setConfirmUnlink(false);
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
