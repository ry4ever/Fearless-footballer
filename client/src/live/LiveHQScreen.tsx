import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Flame } from "lucide-react";
import type { AthleteProgress, SessionLibraryResponse, SessionPackage } from "@shared/types";
import { FearlessHeaderLogo } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { formatMinutes } from "./LiveSessionDetail";
import { offlineQueue } from "../lib/offlineQueue";
import { loadPlan } from "./plan";
import { useSession } from "./session";

interface LiveHQScreenProps {
  onOpenSession: (session: SessionPackage) => void;
}

/** Shortest-to-longest length across the session's versions, e.g. "8–10 min". */
function lengthLabel(session: SessionPackage) {
  const lengths = (session.audio ?? []).map((variant) => variant.durationSeconds);
  if (lengths.length === 0) return formatMinutes(session.defaultDurationSeconds);
  const min = Math.round(Math.min(...lengths) / 60);
  const max = Math.round(Math.max(...lengths) / 60);
  return min === max ? `${min} min` : `${min}–${max} min`;
}

function SessionRow({
  session,
  index,
  onOpen,
}: {
  session: SessionPackage;
  index?: number;
  onOpen: (session: SessionPackage) => void;
}) {
  return (
    <button type="button" className={`live-session-row ${session.comingSoon ? "soon" : ""}`} onClick={() => onOpen(session)}>
      {index !== undefined && <span className="row-index">{index}</span>}
      <span className="row-text">
        <strong>{session.title}</strong>
        <small>
          {session.comingSoon
            ? session.focusArea ?? ""
            : [lengthLabel(session), session.focusArea].filter(Boolean).join(" · ")}
        </small>
      </span>
      {session.comingSoon ? <span className="row-badge">SOON</span> : <ChevronRight size={18} color="#69e0fa" />}
    </button>
  );
}

const GAUGE_CIRCUMFERENCE = 264;

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "GOOD MORNING";
  if (hour < 18) return "GOOD AFTERNOON";
  return "GOOD EVENING";
}

export function LiveHQScreen({ onOpenSession }: LiveHQScreenProps) {
  const { user } = useSession();
  const [progress, setProgress] = useState<AthleteProgress | null>(null);
  const [library, setLibrary] = useState<SessionLibraryResponse | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(() => (user ? offlineQueue.pendingCount(user.id) : 0));
  const plan = user ? loadPlan(user.id) : null;

  const load = useCallback(async () => {
    setError("");
    try {
      const [nextProgress, nextLibrary] = await Promise.all([apiClient.getAthleteProgress(), apiClient.getLibrary()]);
      setProgress(nextProgress);
      setLibrary(nextLibrary);
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

  if (!progress || !library) {
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
  const byId = new Map(library.sessions.map((session) => [session.id, session]));
  const programmes = library.programmes.filter((programme) => programme.sessionIds.some((id) => byId.has(id)));
  const playable = library.sessions.filter((session) => !session.comingSoon);
  const comingSoon = library.sessions.filter((session) => session.comingSoon);
  const groups = new Map<string, SessionPackage[]>();
  for (const session of playable) {
    const key = session.focusArea ?? "Sessions";
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }

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

      {programmes.length > 0 && (
        <section aria-label="Programmes">
          <span className="eyebrow" style={{ marginBottom: 8 }}>
            YOUR PROGRAMMES
          </span>
          {programmes.map((programme) => (
            <div key={programme.slug} className="live-card" style={{ marginTop: 10 }}>
              <h2>{programme.title}</h2>
              <p className="live-copy" style={{ marginBottom: 12 }}>
                {programme.description}
              </p>
              {programme.sessionIds.map((id, index) => {
                const session = byId.get(id);
                return session ? <SessionRow key={id} session={session} index={index + 1} onOpen={onOpenSession} /> : null;
              })}
            </div>
          ))}
        </section>
      )}

      {playable.length === 0 ? (
        <section className="live-card" aria-label="Sessions">
          <span className="eyebrow">OFF-PITCH TRAINING</span>
          <h2>No session available yet</h2>
          <p className="live-copy">New training is on its way. Check back soon – your progress is saved.</p>
        </section>
      ) : (
        <section aria-label="All sessions">
          <span className="eyebrow">ALL SESSIONS</span>
          {Array.from(groups.entries()).map(([group, sessions]) => (
            <div key={group} style={{ marginTop: 12 }}>
              <p className="live-note" style={{ textAlign: "left", marginBottom: 6 }}>
                {group}
              </p>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} onOpen={onOpenSession} />
              ))}
            </div>
          ))}
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

      {comingSoon.length > 0 && (
        <section aria-label="Coming soon">
          <span className="eyebrow">COMING SOON</span>
          <div style={{ marginTop: 8 }}>
            {comingSoon.map((session) => (
              <SessionRow key={session.id} session={session} onOpen={onOpenSession} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
