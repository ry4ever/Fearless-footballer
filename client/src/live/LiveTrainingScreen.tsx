import { ChevronRight } from "lucide-react";
import type { SessionPackage } from "@shared/types";
import { LoadState, PendingNote } from "./LiveHQScreen";
import { programmePhoto, programmeViews, useAthleteData } from "./useAthleteData";

interface LiveTrainingScreenProps {
  onStartSession: (session: SessionPackage) => void;
}

/** A playable session opens straight into the player; coming-soon ones are listed only. */
function SessionRow({
  session,
  index,
  done,
  onStart,
}: {
  session: SessionPackage;
  index?: number;
  done?: boolean;
  onStart: (session: SessionPackage) => void;
}) {
  const content = (
    <>
      {index !== undefined && <span className={`row-index ${done ? "done" : ""}`}>{index}</span>}
      <span className="row-text">
        <strong>{session.title}</strong>
        {session.focusArea && <small>{session.focusArea}</small>}
      </span>
      {session.comingSoon ? <span className="row-badge">SOON</span> : <ChevronRight size={18} color="#69e0fa" />}
    </>
  );
  if (session.comingSoon) {
    return (
      <div className="live-session-row soon" aria-label={`${session.title}, coming soon`}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" className="live-session-row" onClick={() => onStart(session)}>
      {content}
    </button>
  );
}

export function LiveTrainingScreen({ onStartSession }: LiveTrainingScreenProps) {
  const { progress, library, error, pending, reload } = useAthleteData();
  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading your training…" />;
  }

  const done = new Set(progress.completedSessionIds ?? []);
  const views = programmeViews(library, progress);
  const playable = library.sessions.filter((session) => !session.comingSoon);
  const comingSoon = library.sessions.filter((session) => session.comingSoon);
  const groups = new Map<string, SessionPackage[]>();
  for (const session of playable) {
    const key = session.focusArea ?? "Sessions";
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }

  return (
    <div className="screen hq2-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <section className="hq2-hello hq2-page-title">
        <h1>
          Your <span>Training</span>
        </h1>
        <span className="hq2-method">SEE | REHEARSE | BECOME</span>
      </section>

      <PendingNote pending={pending} />

      {views.map((view) => (
        <section key={view.programme.slug} className="hq2-card hq2-programme-card" aria-label={view.programme.title}>
          <div className="hq2-programme-head">
            <img src={programmePhoto(view.programme.slug)} alt="" />
            <div>
              <span className="hq2-eyebrow">PROGRAMME</span>
              <h2>{view.programme.title}</h2>
              <span className="hq2-bar" aria-hidden="true">
                <span style={{ width: `${(view.completed / view.sessions.length) * 100}%` }} />
              </span>
              <small className="hq2-meta">
                {view.completed} of {view.sessions.length} sessions
              </small>
            </div>
          </div>
          <p className="live-copy">{view.programme.description}</p>
          <div className="hq2-rows">
            {view.sessions.map((session, index) => (
              <SessionRow key={session.id} session={session} index={index + 1} done={done.has(session.id)} onStart={onStartSession} />
            ))}
          </div>
        </section>
      ))}

      {playable.length === 0 ? (
        <section className="hq2-card" aria-label="Sessions">
          <span className="hq2-eyebrow">ALL SESSIONS</span>
          <h2>No session available yet</h2>
          <p className="live-copy">New training is on its way. Check back soon – your progress is saved.</p>
        </section>
      ) : (
        <section aria-label="All sessions">
          <span className="hq2-eyebrow hq2-section-label">ALL SESSIONS</span>
          {Array.from(groups.entries()).map(([group, sessions]) => (
            <div key={group} className="hq2-group">
              <p className="hq2-group-label">{group}</p>
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} onStart={onStartSession} />
              ))}
            </div>
          ))}
        </section>
      )}

      {comingSoon.length > 0 && (
        <section aria-label="Coming soon">
          <span className="hq2-eyebrow hq2-section-label">COMING SOON</span>
          {comingSoon.map((session) => (
            <SessionRow key={session.id} session={session} onStart={onStartSession} />
          ))}
        </section>
      )}
    </div>
  );
}
