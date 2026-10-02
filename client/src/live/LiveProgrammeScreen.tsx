import { useState } from "react";
import { ArrowLeft, Check, ChevronRight } from "lucide-react";
import { sessionPhoto } from "@shared/player";
import type { SessionPackage } from "@shared/types";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { photo } from "../lib/onboardingOptions";
import { LoadState } from "./LiveHQScreen";
import { chooseProgramme, loadPlan } from "./plan";
import { useSession } from "./session";
import "./player.css";
import { currentProgramme, isCoachPlan, programmePhoto, programmeViews, useAthleteData } from "./useAthleteData";

interface LiveProgrammeScreenProps {
  slug: string;
  onBack: () => void;
  onStartSession: (session: SessionPackage) => void;
  /** Called after the player makes this their programme. */
  onChosen: () => void;
}

/** One programme: its sessions in order, what it's about, and the choice to train it. */
export function LiveProgrammeScreen({ slug, onBack, onStartSession, onChosen }: LiveProgrammeScreenProps) {
  const { user } = useSession();
  const { progress, library, error, reload } = useAthleteData();
  const [tab, setTab] = useState<"sessions" | "about">("sessions");
  if (!progress || !library) {
    return <LoadState error={error} onRetry={() => void reload()} label="Loading the programme…" />;
  }

  const views = programmeViews(library);
  const view = views.find((item) => item.programme.slug === slug);
  if (!view) {
    return <LoadState error="This programme isn't available." onRetry={onBack} label="" />;
  }
  const plan = user ? loadPlan(user.id) : null;
  const isCurrent = currentProgramme(views, plan) === view;
  const coachPlanActive = views.some(isCoachPlan);

  return (
    <div className="screen hq2-screen pg-screen">
      <section className="pg-hero">
        <img src={programmePhoto(view)} alt="" />
        <header className="ps-top">
          <button type="button" className="ps-back" onClick={onBack} aria-label="Back to Training">
            <ArrowLeft size={20} />
          </button>
          <FearlessWordmark height={22} />
          <span className="ps-back-spacer" aria-hidden="true" />
        </header>
        <div className="pg-title">
          <span className="ps-eyebrow">{isCoachPlan(view) ? "FROM YOUR COACH" : isCurrent ? "YOUR PROGRAMME" : "PROGRAMME"}</span>
          <h1>{view.programme.title}</h1>
          {view.programme.tagline && <p>{view.programme.tagline}</p>}
        </div>
      </section>

      <div className="pg-body">
        <div className="tr-tabs" role="tablist" aria-label="Programme">
          <button type="button" role="tab" aria-selected={tab === "sessions"} onClick={() => setTab("sessions")}>
            Sessions
          </button>
          <button type="button" role="tab" aria-selected={tab === "about"} onClick={() => setTab("about")}>
            About
          </button>
        </div>

        {tab === "sessions" ? (
          <ol className="pg-sessions">
            {view.sessions.map((session, index) => (
              <li key={session.id}>
                <button type="button" className="pg-session" onClick={() => onStartSession(session)}>
                  <span className="pg-session-photo">
                    <img src={photo(sessionPhoto(session))} alt="" />
                    <span className="pg-session-number">{index + 1}</span>
                  </span>
                  <span className="pg-session-text">
                    <span className="hq2-eyebrow pg-session-eyebrow">SESSION {index + 1}</span>
                    <strong>{session.title}</strong>
                    {session.tagline && <small>{session.tagline}</small>}
                  </span>
                  <ChevronRight size={20} className="pg-session-go" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <section className="hq2-card pg-about">
            <p>{view.programme.description}</p>
          </section>
        )}

        {isCurrent ? (
          <p className="pg-current" role="status">
            <Check size={18} /> {isCoachPlan(view) ? "Your coach set this plan." : "This is your programme."} Its next session
            is on Home.
          </p>
        ) : coachPlanActive ? (
          <p className="pg-current pg-coach-note" role="status">
            Your coach has set your plan, so Home follows it. You can still play any of these sessions.
          </p>
        ) : (
          <button
            type="button"
            className="pg-choose"
            onClick={() => {
              if (user) chooseProgramme(user.id, view.programme.slug);
              onChosen();
            }}
          >
            Make this my programme
          </button>
        )}
      </div>
    </div>
  );
}
