import { useState } from "react";
import { Bell, ChevronRight, Flame, Play } from "lucide-react";
import type { SessionPackage } from "@shared/types";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { photo } from "../lib/onboardingOptions";
import { loadPlan } from "./plan";
import { useSession } from "./session";
import {
  currentProgramme,
  lastSevenDayLabels,
  nextSession,
  programmePhoto,
  programmeViews,
  useAthleteData,
} from "./useAthleteData";

interface LiveHQScreenProps {
  onStartSession: (session: SessionPackage) => void;
  onOpenTab: (tab: "training" | "progress" | "more") => void;
}

function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function LoadState({ error, onRetry, label }: { error: string; onRetry: () => void; label: string }) {
  return (
    <div className="screen live-screen">
      <div className="live-center" aria-live="polite">
        {error ? (
          <>
            <div className="live-error" role="alert">
              {error}
            </div>
            <button type="button" className="primary-button" onClick={onRetry}>
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="live-spinner" aria-hidden="true" />
            <span className="live-note">{label}</span>
          </>
        )}
      </div>
    </div>
  );
}

export function PendingNote({ pending }: { pending: number }) {
  if (pending === 0) return null;
  return (
    <p className="live-note" role="status">
      {pending === 1 ? "1 rep is" : `${pending} reps are`} saved on this device and will sync when you're back online.
    </p>
  );
}

export function LiveHQScreen({ onStartSession, onOpenTab }: LiveHQScreenProps) {
  const { user } = useSession();
  const { progress, library, error, pending, reload } = useAthleteData();
  const [showNotifications, setShowNotifications] = useState(false);
  const plan = user ? loadPlan(user.id) : null;

  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading your HQ…" />;
  }

  const firstName = progress.athleteName.trim().split(/\s+/)[0] || "Player";
  const views = programmeViews(library, progress);
  const programme = currentProgramme(views, plan);
  const today = programme ? nextSession(programme, progress) : null;
  const fallback = library.sessions.find((session) => !session.comingSoon);
  const todaySession = today?.session ?? fallback;
  const dayLabels = lastSevenDayLabels();

  return (
    <div className="screen hq2-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <header className="hq2-header">
        <FearlessWordmark />
        <div className="hq2-header-actions">
          <button
            type="button"
            className="hq2-icon-button"
            aria-label="Notifications"
            aria-expanded={showNotifications}
            onClick={() => setShowNotifications((open) => !open)}
          >
            <Bell size={20} />
          </button>
          <button type="button" className="hq2-avatar" aria-label="Your account" onClick={() => onOpenTab("more")}>
            {firstName.charAt(0).toUpperCase()}
          </button>
          {showNotifications && (
            <div className="hq2-popover" role="status">
              You're all caught up.
            </div>
          )}
        </div>
      </header>

      <section className="hq2-hello">
        <p>{greeting()}, {firstName}.</p>
        <h1>
          Fearless <span>HQ</span>
        </h1>
        <span className="hq2-method">SEE | REHEARSE | BECOME</span>
      </section>

      <PendingNote pending={pending} />

      {plan && (
        <section className="hq2-card hq2-focus" aria-label="Your current focus">
          <div className="hq2-focus-text">
            <span className="hq2-eyebrow">YOUR CURRENT FOCUS</span>
            <h2>{plan.goal}</h2>
          </div>
          <img src={photo("ball")} alt="" />
        </section>
      )}

      <button type="button" className="hq2-card hq2-streak" onClick={() => onOpenTab("progress")} aria-label={`Current streak ${progress.currentStreakDays} days. See your progress`}>
        <span className="hq2-flame">
          <Flame size={22} />
        </span>
        <span className="hq2-streak-text">
          <span className="hq2-eyebrow">CURRENT STREAK</span>
          <strong>
            {progress.currentStreakDays} {progress.currentStreakDays === 1 ? "day" : "days"}
          </strong>
        </span>
        <span className="hq2-days" aria-hidden="true">
          {progress.sevenDayPattern.map((done, index) => (
            <span key={index} className={done ? "done" : ""}>
              <i />
              {dayLabels[index]}
            </span>
          ))}
        </span>
        <ChevronRight size={18} className="hq2-chevron" />
      </button>

      {todaySession ? (
        <section className="hq2-card hq2-today" aria-label="Today's training">
          <img src={photo("headphones")} alt="" />
          <div className="hq2-today-body">
            <div className="hq2-row">
              <span className="hq2-eyebrow">TODAY'S TRAINING</span>
              {programme && today && (
                <span className="hq2-count">
                  {today.index + 1}/{programme.sessions.length}
                </span>
              )}
            </div>
            <h2>{todaySession.title}</h2>
            <div className="hq2-row hq2-today-foot">
              <span className="hq2-meta">
                {todaySession.focusArea ? `${todaySession.focusArea.toUpperCase()} · ` : ""}VISUALISATION
              </span>
              <button type="button" className="hq2-play" aria-label={`Play ${todaySession.title}`} onClick={() => onStartSession(todaySession)}>
                <Play size={22} fill="currentColor" />
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="hq2-card" aria-label="Today's training">
          <span className="hq2-eyebrow">TODAY'S TRAINING</span>
          <h2>New training is on its way</h2>
          <p className="live-copy">Check back soon – your progress is saved.</p>
        </section>
      )}

      {views.length > 0 && (
        <section className="hq2-card hq2-programmes" aria-label="Your programmes">
          <div className="hq2-row">
            <span className="hq2-eyebrow">YOUR PROGRAMMES</span>
            <button type="button" className="hq2-link" onClick={() => onOpenTab("training")}>
              See all →
            </button>
          </div>
          {(programme ? [programme, ...views.filter((view) => view !== programme)] : views).slice(0, 2).map((view) => (
            <button
              key={view.programme.slug}
              type="button"
              className="hq2-programme"
              onClick={() => onStartSession(nextSession(view, progress).session)}
              aria-label={`${view.programme.title}, ${view.completed} of ${view.sessions.length} sessions done. Play the next session`}
            >
              <span className="hq2-programme-photo">
                <img src={programmePhoto(view.programme.slug)} alt="" />
                <strong>{view.programme.title}</strong>
              </span>
              <span className="hq2-programme-text">
                <small>{view.sessions.map((session) => session.title).join(" · ")}</small>
                <span className="hq2-bar" aria-hidden="true">
                  <span style={{ width: `${(view.completed / view.sessions.length) * 100}%` }} />
                </span>
                <small>
                  {view.completed} of {view.sessions.length} sessions
                </small>
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}
