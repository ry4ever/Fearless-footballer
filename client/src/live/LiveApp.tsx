import { useState } from "react";
import type { SessionPackage } from "@shared/types";
import { BottomNavBar, type NavTab } from "../components/BottomNavBar";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { AthleteLinkScreen } from "./AthleteLinkScreen";
import { AuthScreen } from "./AuthScreen";
import { CaregiverLinkScreen } from "./CaregiverLinkScreen";
import { LiveCompleteScreen } from "./LiveCompleteScreen";
import { LiveHQScreen } from "./LiveHQScreen";
import { LiveParentDashboard } from "./LiveParentDashboard";
import { LivePlayerScreen, type CompletionOutcome } from "./LivePlayerScreen";
import { LiveProfileScreen } from "./LiveProfileScreen";
import { loadPlan, savePlan } from "./plan";
import { isLinkActive, SessionProvider, useSession } from "./session";
import "./live.css";

/** Only the tabs that have real content behind them yet. */
const ATHLETE_TABS: NavTab[] = ["hq", "profile"];

type AthleteView =
  | { name: "main"; tab: NavTab }
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
    user && loadPlan(user.id) ? { name: "main", tab: "hq" } : { name: "onboarding" },
  );
  if (!user) return null;
  const toHQ = () => setView({ name: "main", tab: "hq" });

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
    case "main":
      return (
        <>
          {view.tab === "profile" ? (
            <LiveProfileScreen onEditPlan={() => setView({ name: "onboarding" })} />
          ) : (
            <LiveHQScreen onStartSession={(session) => setView({ name: "player", session })} />
          )}
          <BottomNavBar activeTab={view.tab} tabs={ATHLETE_TABS} onSelectTab={(tab) => setView({ name: "main", tab })} />
        </>
      );
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
