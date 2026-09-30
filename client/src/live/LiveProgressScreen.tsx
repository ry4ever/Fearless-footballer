import { photo } from "../lib/onboardingOptions";
import { LoadState, PendingNote } from "./LiveHQScreen";
import { lastSevenDayLabels, programmeViews, useAthleteData } from "./useAthleteData";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * Progress as football development: training completed and areas worked on
 * come first. Streaks stay, but further down – they're a habit, not the goal.
 */
export function LiveProgressScreen() {
  const { progress, library, error, pending, reload } = useAthleteData();
  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading your progress…" />;
  }

  const views = programmeViews(library, progress);
  const dayLabels = lastSevenDayLabels();
  const total = progress.totalCompletions ?? 0;
  const weeks = progress.consecutiveWeeks ?? 0;
  const areas = progress.completionsByArea ?? [];
  const topArea = areas[0]?.count ?? 1;

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

      <section className="hq2-card pr-hero" aria-label="Off-Pitch Training completed">
        <img src={photo("stadium")} alt="" />
        <div className="pr-hero-body">
          <strong className="pr-big">{total}</strong>
          <span className="pr-hero-label">Off-Pitch Training {plural(total, "session", "sessions")} completed</span>
          {total === 0 && <p className="pr-note">Your first session starts your development record.</p>}
        </div>
      </section>

      <section className="hq2-card pr-weeks" aria-label="Weeks training consistently">
        <strong className="pr-mid">{weeks}</strong>
        <span>
          {plural(weeks, "week", "weeks")} training consistently
          <small>At least one session every week, Monday to Sunday.</small>
        </span>
      </section>

      <section className="hq2-card" aria-label="Areas you've worked on">
        <span className="hq2-eyebrow">AREAS YOU'VE WORKED ON</span>
        {areas.length === 0 ? (
          <p className="pr-note">Complete a session to see the parts of your game you're building.</p>
        ) : (
          <ul className="pr-areas">
            {areas.map(({ area, count }) => (
              <li key={area}>
                <div className="hq2-row">
                  <strong>{area}</strong>
                  <span className="hq2-meta">
                    {count} {plural(count, "session", "sessions")}
                  </span>
                </div>
                <span className="hq2-bar" aria-hidden="true">
                  <span style={{ width: `${(count / topArea) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {views.length > 0 && (
        <section className="hq2-card" aria-label="Programmes">
          <span className="hq2-eyebrow">PROGRAMMES</span>
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
      )}

      <section className="hq2-card pr-habit" aria-label="Training habit">
        <span className="hq2-eyebrow">TRAINING HABIT</span>
        <div className="pr-habit-row">
          <span>
            Streak <strong>{progress.currentStreakDays}</strong> {plural(progress.currentStreakDays, "day", "days")}
          </span>
          <span>
            Best <strong>{progress.bestStreakDays}</strong> {plural(progress.bestStreakDays, "day", "days")}
          </span>
        </div>
        <div className="hq2-days hq2-days-wide" aria-label={`${progress.weeklyCompletedDays} of the last 7 days trained`}>
          {progress.sevenDayPattern.map((done, index) => (
            <span key={index} className={done ? "done" : ""}>
              <i />
              {dayLabels[index]}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
