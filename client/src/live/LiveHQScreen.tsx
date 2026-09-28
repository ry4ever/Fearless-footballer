import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Flame, Headphones } from "lucide-react";
import type { AthleteProgress, SessionPackage } from "@shared/types";
import { FearlessHeaderLogo } from "../components/icons/CustomIcons";
import { ApiError, apiClient } from "../lib/apiClient";
import { offlineQueue } from "../lib/offlineQueue";
import { loadPlan } from "./plan";
import { useSession } from "./session";

interface LiveHQScreenProps {
  onStartSession: (session: SessionPackage) => void;
}

const GAUGE_CIRCUMFERENCE = 264;

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

export function LiveHQScreen({ onStartSession }: LiveHQScreenProps) {
  const { user } = useSession();
  const [progress, setProgress] = useState<AthleteProgress | null>(null);
  /** undefined while loading; null when no session is published. */
  const [session, setSession] = useState<SessionPackage | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => (user ? offlineQueue.pendingCount(user.id) : 0));
  const plan = user ? loadPlan(user.id) : null;

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextProgress, nextSession] = await Promise.all([
        apiClient.getAthleteProgress(),
        // No published session is a normal state, not a failure: keep showing progress.
        apiClient.getTodaySession().catch((error) => {
          if (error instanceof ApiError && error.status === 404) return null;
          throw error;
        }),
      ]);
      setProgress(nextProgress);
      setSession(nextSession);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load your HQ.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Reload stats once queued offline reps reach the server.
  useEffect(() => {
    if (!user) return;
    return offlineQueue.subscribe(() => {
      const next = offlineQueue.pendingCount(user.id);
      setPending((previous) => {
        if (next < previous) void load();
        return next;
      });
    });
  }, [user, load]);

  if (error && !progress) {
    return (
      <div className="screen live-screen">
        <div className="live-center">
          <div className="live-error" role="alert">
            {error}
          </div>
          <button type="button" className="primary-button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!progress || session === undefined) {
    return (
      <div className="screen live-screen">
        <div className="live-center" aria-live="polite">
          <div className="live-spinner" aria-hidden="true" />
          <span className="live-note">Loading your HQ…</span>
        </div>
      </div>
    );
  }

  const score = Math.max(0, Math.min(100, progress.score));

  return (
    <div className="screen hq-screen live-screen">
      <div className="hero-wash" />
      <header className="live-header">
        <FearlessHeaderLogo subtitle="HQ" size="md" />
      </header>

      <section>
        <span className="eyebrow">
          {greeting()}, {progress.athleteName.toUpperCase()}
        </span>
        <h1 className="live-title">Fearless HQ</h1>
      </section>

      {plan && (
        <section className="live-card">
          <span className="eyebrow">YOUR CURRENT FOCUS</span>
          <h2>{plan.goal}</h2>
          <p className="live-copy">Matchday: {plan.matchday}</p>
        </section>
      )}

      {pending > 0 && (
        <p className="live-note" role="status">
          {pending === 1 ? "1 rep is" : `${pending} reps are`} saved on this device and will sync when you're back online.
        </p>
      )}

      <section className="metrics-grid" aria-label="Your training numbers">
        <div className="metric-card composure-gauge-card">
          <div className="circular-gauge-wrap">
            <svg className="gauge-svg" viewBox="0 0 100 100" aria-hidden="true">
              <circle className="gauge-track" cx="50" cy="50" r="42" />
              <circle
                className="gauge-value"
                cx="50"
                cy="50"
                r="42"
                strokeDasharray={GAUGE_CIRCUMFERENCE}
                strokeDashoffset={GAUGE_CIRCUMFERENCE * (1 - score / 100)}
              />
            </svg>
            <div className="gauge-inner">
              <span className="gauge-label">COMPOSURE</span>
              <strong className="gauge-number">{score}</strong>
              <span style={{ fontSize: "0.65rem", color: "#00F0FF", fontWeight: 700 }}>
                {progress.deltaWeekly > 0 ? `+${progress.deltaWeekly} this week` : "Score"}
              </span>
            </div>
          </div>
        </div>

        <div className="metric-card streak-active-card">
          <div className="streak-header-row">
            <div className="flame-glow-icon">
              <Flame size={26} />
            </div>
            <div>
              <span className="eyebrow">CURRENT STREAK</span>
              <strong className="streak-number">
                {progress.currentStreakDays} {progress.currentStreakDays === 1 ? "day" : "days"}
              </strong>
              <small style={{ color: "rgba(255,255,255,0.6)", display: "block", fontSize: "0.7rem", marginTop: 2 }}>
                Best: {progress.bestStreakDays} {progress.bestStreakDays === 1 ? "day" : "days"}
              </small>
            </div>
          </div>
        </div>
      </section>

      {session ? (
        <section className="live-card" aria-label="Today's session">
          <span className="eyebrow">TODAY'S OFF-PITCH TRAINING</span>
          <h2>{session.title}</h2>
          <p className="live-copy">{session.subtitle}</p>
          <p className="live-note" style={{ textAlign: "left", marginTop: 8 }}>
            <Headphones size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> {Math.round(session.defaultDurationSeconds / 60)} min · with {session.mentor.name}
          </p>
          <button
            type="button"
            className="primary-button"
            style={{ width: "100%", marginTop: 14 }}
            onClick={() => onStartSession(session)}
          >
            {progress.lastRep.completedToday ? "Train again" : "Start training"} <ArrowRight size={18} />
          </button>
        </section>
      ) : (
        <section className="live-card" aria-label="Today's session">
          <span className="eyebrow">TODAY'S OFF-PITCH TRAINING</span>
          <h2>No session available yet</h2>
          <p className="live-copy">New training is on its way. Check back soon – your progress is saved.</p>
        </section>
      )}

      <section className="live-card" aria-label="Last 7 days">
        <span className="eyebrow">LAST 7 DAYS</span>
        <h2>
          {progress.weeklyCompletedDays} of {progress.weeklyTargetDays} days trained
        </h2>
        <div className="week-dots" aria-hidden="true">
          {progress.sevenDayPattern.map((done, index) => (
            <span key={index} className={done ? "done" : ""} />
          ))}
        </div>
        {progress.lastRep.completedAt && (
          <p className="live-note" style={{ textAlign: "left", marginTop: 10 }}>
            Last rep: {progress.lastRep.title} · {progress.lastRep.duration}
          </p>
        )}
      </section>
    </div>
  );
}
