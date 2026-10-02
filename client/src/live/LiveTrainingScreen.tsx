import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { SessionPackage } from "@shared/types";
import { AthleteHeader } from "./AthleteHeader";
import { LoadState, PendingNote } from "./LiveHQScreen";
import { loadPlan } from "./plan";
import { useSession } from "./session";
import { currentProgramme, programmePhoto, programmeViews, useAthleteData } from "./useAthleteData";

interface LiveTrainingScreenProps {
  onStartSession: (session: SessionPackage) => void;
  onOpenProgramme: (slug: string) => void;
  onOpenAccount: () => void;
}

/** A playable session opens straight into the player; coming-soon ones are listed only. */
function SessionRow({ session, onStart }: { session: SessionPackage; onStart: (session: SessionPackage) => void }) {
  const content = (
    <>
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

type TrainingTab = "programmes" | "sessions";

/**
 * Programmes to choose from (each opens its own page) and, under My
 * Sessions, every session in the library.
 */
export function LiveTrainingScreen({ onStartSession, onOpenProgramme, onOpenAccount }: LiveTrainingScreenProps) {
  const { user } = useSession();
  const { progress, library, error, pending, reload } = useAthleteData();
  const [tab, setTab] = useState<TrainingTab>("programmes");
  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading your training…" />;
  }

  const plan = user ? loadPlan(user.id) : null;
  const views = programmeViews(library);
  const current = currentProgramme(views, plan);
  const playable = library.sessions.filter((session) => !session.comingSoon);
  const comingSoon = library.sessions.filter((session) => session.comingSoon);
  const groups = new Map<string, SessionPackage[]>();
  for (const session of playable) {
    const key = session.focusArea ?? "Sessions";
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  const firstName = progress.athleteName.trim().split(/\s+/)[0] || "Player";

  return (
    <div className="screen hq2-screen">
      <div className="hq2-glow" aria-hidden="true" />
      <AthleteHeader name={firstName} onOpenAccount={onOpenAccount} />
      <section className="hq2-hello">
        <h1>
          Your <span>Training</span>
        </h1>
        <span className="hq2-method">SEE | REHEARSE | BECOME</span>
      </section>

      <div className="tr-tabs" role="tablist" aria-label="Training">
        <button type="button" role="tab" aria-selected={tab === "programmes"} onClick={() => setTab("programmes")}>
          Programmes
        </button>
        <button type="button" role="tab" aria-selected={tab === "sessions"} onClick={() => setTab("sessions")}>
          My Sessions
        </button>
      </div>

      <PendingNote pending={pending} />

      {tab === "programmes" ? (
        views.length === 0 ? (
          <section className="hq2-card">
            <h2>Programmes are on their way</h2>
            <p className="live-copy">In the meantime, every session is under My Sessions.</p>
          </section>
        ) : (
          views.map((view) => (
            <button
              key={view.programme.slug}
              type="button"
              className="tr-programme"
              onClick={() => onOpenProgramme(view.programme.slug)}
              aria-label={`${view.programme.title}${view === current ? ", your programme" : ""}. Open the programme`}
            >
              <img src={programmePhoto(view.programme.slug)} alt="" />
              <span className="tr-programme-text">
                <span className="hq2-eyebrow">{view === current ? "YOUR PROGRAMME" : "PROGRAMME"}</span>
                <strong>{view.programme.title}</strong>
                {view.programme.tagline && <small>{view.programme.tagline}</small>}
              </span>
              <span className="tr-programme-go" aria-hidden="true">
                <ChevronRight size={22} />
              </span>
            </button>
          ))
        )
      ) : (
        <>
          {playable.length === 0 ? (
            <section className="hq2-card" aria-label="Sessions">
              <h2>No session available yet</h2>
              <p className="live-copy">New training is on its way. Check back soon – your progress is saved.</p>
            </section>
          ) : (
            <section aria-label="All sessions">
              {Array.from(groups.entries()).map(([group, sessions]) => (
                <div key={group} className="hq2-group">
                  <p className="hq2-group-label">{group}</p>
                  <div className="hq2-rows">
                    {sessions.map((session) => (
                      <SessionRow key={session.id} session={session} onStart={onStartSession} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}
          {comingSoon.length > 0 && (
            <section aria-label="Coming soon">
              <span className="hq2-eyebrow hq2-section-label">COMING SOON</span>
              <div className="hq2-rows">
                {comingSoon.map((session) => (
                  <SessionRow key={session.id} session={session} onStart={onStartSession} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
