import { Flame, Trophy } from "lucide-react";
import { LoadState, PendingNote } from "./LiveHQScreen";
import { lastSevenDayLabels, programmeViews, useAthleteData } from "./useAthleteData";

export function LiveProgressScreen() {
  const { progress, library, error, pending, reload } = useAthleteData();
  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading your progress…" />;
  }

  const views = programmeViews(library, progress);
  const dayLabels = lastSevenDayLabels();
  const sessionsDone = progress.completedSessionIds?.length ?? 0;

  return (
    <div className="screen hq2-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <section className="hq2-hello hq2-page-title">
        <h1>
          Your <span>Progress</span>
        </h1>
        <span className="hq2-method">SEE | REHEARSE | BECOME</span>
      </section>

      <PendingNote pending={pending} />

      <div className="hq2-stats">
        <section className="hq2-card hq2-stat" aria-label="Current streak">
          <Flame size={20} className="hq2-stat-icon" />
          <strong>{progress.currentStreakDays}</strong>
          <span className="hq2-eyebrow">DAY STREAK</span>
        </section>
        <section className="hq2-card hq2-stat" aria-label="Best streak">
          <Trophy size={20} className="hq2-stat-icon" />
          <strong>{progress.bestStreakDays}</strong>
          <span className="hq2-eyebrow">BEST STREAK</span>
        </section>
      </div>

      <section className="hq2-card" aria-label="Last 7 days">
        <span className="hq2-eyebrow">LAST 7 DAYS</span>
        <h2>
          {progress.weeklyCompletedDays} of {progress.weeklyTargetDays} days trained
        </h2>
        <div className="hq2-days hq2-days-wide" aria-hidden="true">
          {progress.sevenDayPattern.map((done, index) => (
            <span key={index} className={done ? "done" : ""}>
              <i />
              {dayLabels[index]}
            </span>
          ))}
        </div>
        {progress.lastRep.completedAt && (
          <p className="hq2-meta hq2-last-rep">
            Last rep: {progress.lastRep.title} · {progress.lastRep.duration}
          </p>
        )}
      </section>

      <section className="hq2-card" aria-label="Sessions completed">
        <span className="hq2-eyebrow">SESSIONS COMPLETED</span>
        <h2>
          {sessionsDone} {sessionsDone === 1 ? "session" : "sessions"}
        </h2>
        {views.map((view) => (
          <div key={view.programme.slug} className="hq2-progress-row">
            <div className="hq2-row">
              <strong>{view.programme.title}</strong>
              <small className="hq2-meta">
                {view.completed}/{view.sessions.length}
              </small>
            </div>
            <span className="hq2-bar" aria-hidden="true">
              <span style={{ width: `${(view.completed / view.sessions.length) * 100}%` }} />
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}
