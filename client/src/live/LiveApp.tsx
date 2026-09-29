import { useState } from "react";
import type { SessionPackage } from "@shared/types";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AthleteLinkScreen } from "./AthleteLinkScreen";
import { AuthScreen } from "./AuthScreen";
import { CaregiverLinkScreen } from "./CaregiverLinkScreen";
import { LiveCompleteScreen } from "./LiveCompleteScreen";
import { LiveHQScreen } from "./LiveHQScreen";
import { LiveNav, type LiveTab } from "./LiveNav";
import { LiveParentDashboard } from "./LiveParentDashboard";
import { LivePlayerScreen, type CompletionOutcome } from "./LivePlayerScreen";
import { LiveProfileScreen } from "./LiveProfileScreen";
import { LiveProgressScreen } from "./LiveProgressScreen";
import { LiveTrainingScreen } from "./LiveTrainingScreen";
import { loadPlan, savePlan } from "./plan";
import { isLinkActive, SessionProvider, useSession } from "./session";
import "./live.css";
import "./athlete.css";

type AthleteView =
  | { name: "main"; tab: LiveTab }
  | { name: "onboarding" }
  | { name: "player"; session: SessionPackage }
  | { name: "complete"; outcome: CompletionOutcome };

function Loading() {
  return (
    <div className="screen live-screen no-nav">
      <div className="live-center" aria-live="polite">
        <div className="live-spinner" aria-hidden="true" />
        <span className="live-note">Loading…</span>
      </div>
    </div>
  );
}

function AthleteApp() {
  const { user } = useSession();
  const [view, setView] = useState<AthleteView>(() =>
    user && loadPlan(user.id) ? { name: "main", tab: "home" } : { name: "onboarding" },
  );
  if (!user) return null;
  const toHQ = () => setView({ name: "main", tab: "home" });

  switch (view.name) {
    case "onboarding":
      return (
        <OnboardingScreen
          onContinue={(plan) => {
            savePlan(user.id, plan);
            toHQ();
          }}
        />
      );
    case "player":
      return (
        <LivePlayerScreen
          session={view.session}
          onBack={toHQ}
          onComplete={(outcome) => setView({ name: "complete", outcome })}
        />
      );
    case "complete":
      return <LiveCompleteScreen outcome={view.outcome} onBackToHQ={toHQ} />;
    case "main": {
      const start = (session: SessionPackage) => setView({ name: "player", session });
      const openTab = (tab: LiveTab) => setView({ name: "main", tab });
      return (
        <>
          {view.tab === "home" && <LiveHQScreen onStartSession={start} onOpenTab={openTab} />}
          {view.tab === "training" && <LiveTrainingScreen onStartSession={start} />}
          {view.tab === "progress" && <LiveProgressScreen />}
          {view.tab === "more" && <LiveProfileScreen onEditPlan={() => setView({ name: "onboarding" })} />}
          <LiveNav active={view.tab} onSelect={openTab} />
        </>
      );
    }
  }
}

function LiveRoutes() {
  const { user, pairing } = useSession();
  if (!user) return <AuthScreen />;
  if (pairing === undefined) return <Loading />;

  if (user.role === "caregiver") {
    return isLinkActive(pairing) ? <LiveParentDashboard link={pairing} /> : <CaregiverLinkScreen />;
  }
  // The server only opens sessions once a parent or guardian link is active.
  // Keyed by user so switching accounts starts from a clean state.
  return isLinkActive(pairing) ? <AthleteApp key={user.id} /> : <AthleteLinkScreen />;
}

/** The real, API-backed app. The design prototype lives at ?demo. */
export default function LiveApp() {
  return (
    <SessionProvider>
      <div className="prototype-frame">
        <div className="phone-shell">
          <LiveRoutes />
        </div>
      </div>
    </SessionProvider>
  );
}
