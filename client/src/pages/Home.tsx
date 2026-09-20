import { useEffect, useState } from "react";
import type { SessionMode } from "@shared/types";
import { BottomNavBar, type NavTab } from "../components/BottomNavBar";
import { OnboardingScreen } from "../screens/OnboardingScreen";
import { HQScreen } from "../screens/HQScreen";
import { SetupScreen } from "../screens/SetupScreen";
import { PlayerScreen } from "../screens/PlayerScreen";
import { CompleteScreen } from "../screens/CompleteScreen";
import { ParentDashboard } from "../screens/ParentDashboard";
import { RepsScreen } from "../screens/RepsScreen";
import { VaultScreen } from "../screens/VaultScreen";
import { FeedScreen } from "../screens/FeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type AppFlowState =
  | "onboarding"
  | "main"
  | "setup"
  | "player"
  | "complete"
  | "parent";

export default function Home() {
  const [flowState, setFlowState] = useState<AppFlowState>(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash === "onboarding" || hash === "parent" || hash === "player" || hash === "setup") {
      return hash as AppFlowState;
    }
    return "main";
  });

  const [activeTab, setActiveTab] = useState<NavTab>("hq");
  const [selectedMode, setSelectedMode] = useState<SessionMode>("interactive");
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [toastMessage, setToastMessage] = useState<string>("");

  // Sync state with hash for deep linking
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash === "onboarding" || hash === "parent" || hash === "player" || hash === "setup" || hash === "main") {
        setFlowState(hash as AppFlowState);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => setToastMessage(""), 2800);
  };

  const handleStartRep = (_repId?: string) => {
    setFlowState("setup");
    window.location.hash = "setup";
  };

  const handleStartSession = () => {
    setFlowState("player");
    window.location.hash = "player";
  };

  const handleCompleteSession = () => {
    setFlowState("complete");
    window.location.hash = "complete";
  };

  const handleBackToHQ = () => {
    setFlowState("main");
    setActiveTab("hq");
    window.location.hash = "main";
  };

  const handleOnboardingContinue = (mindset: string) => {
    triggerToast(`7-day blueprint configured for "${mindset.toUpperCase()}" mindset!`);
    setFlowState("main");
    setActiveTab("hq");
    window.location.hash = "main";
  };

  return (
    <div className="prototype-frame">
      {/* Top Prototype Navigation Bar for Discovery & Review */}
      <div className="prototype-demo-bar" style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => { setFlowState("onboarding"); window.location.hash = "onboarding"; }}
          className={`toggle-pill ${flowState === "onboarding" ? "active" : ""}`}
        >
          View Onboarding (Image 3)
        </button>
        <button
          type="button"
          onClick={() => { setFlowState("main"); setActiveTab("hq"); window.location.hash = "main"; }}
          className={`toggle-pill ${flowState === "main" && activeTab === "hq" ? "active" : ""}`}
        >
          View HQ Dashboard (Images 2 & 4)
        </button>
        <button
          type="button"
          onClick={() => { setFlowState("player"); window.location.hash = "player"; }}
          className={`toggle-pill ${flowState === "player" ? "active" : ""}`}
        >
          View Session Player (Image 1)
        </button>
        <button
          type="button"
          onClick={() => { setFlowState("parent"); window.location.hash = "parent"; }}
          className={`toggle-pill ${flowState === "parent" ? "active" : ""}`}
        >
          View Parent Dashboard
        </button>
      </div>

      <div className="phone-shell">
        {/* Screen 1: Onboarding (Design Image 3) */}
        {flowState === "onboarding" && (
          <OnboardingScreen onContinue={handleOnboardingContinue} />
        )}

        {/* Screen 2: Main Shell with Bottom Navigation Bar */}
        {flowState === "main" && (
          <>
            {activeTab === "hq" && (
              <HQScreen
                onStartRehearsal={() => handleStartRep()}
                onOpenSetup={() => handleStartRep()}
                onOpenParent={() => {
                  setFlowState("parent");
                  window.location.hash = "parent";
                }}
                onNavigateTab={(tab) => setActiveTab(tab as NavTab)}
              />
            )}

            {activeTab === "reps" && (
              <RepsScreen onStartRep={handleStartRep} />
            )}

            {activeTab === "vault" && <VaultScreen />}

            {activeTab === "feed" && <FeedScreen />}

            {activeTab === "profile" && (
              <ProfileScreen
                onOpenParentView={() => {
                  setFlowState("parent");
                  window.location.hash = "parent";
                }}
              />
            )}

            <BottomNavBar
              activeTab={activeTab}
              onSelectTab={(tab) => setActiveTab(tab)}
            />
          </>
        )}

        {/* Screen 3: Setup & Mode Selection */}
        {flowState === "setup" && (
          <SetupScreen
            mode={selectedMode}
            setMode={setSelectedMode}
            music={musicEnabled}
            setMusic={setMusicEnabled}
            onBack={() => {
              setFlowState("main");
              window.location.hash = "main";
            }}
            onStart={handleStartSession}
          />
        )}

        {/* Screen 4: Active Session Player (Design Image 1) */}
        {flowState === "player" && (
          <PlayerScreen
            mode={selectedMode}
            music={musicEnabled}
            onBack={() => {
              setFlowState("setup");
              window.location.hash = "setup";
            }}
            onComplete={handleCompleteSession}
          />
        )}

        {/* Screen 5: Completion & Reflection */}
        {flowState === "complete" && (
          <CompleteScreen onBackToHQ={handleBackToHQ} />
        )}

        {/* Screen 6: Caregiver Parent Dashboard (Isolated Read-Only) */}
        {flowState === "parent" && (
          <ParentDashboard
            onBack={() => {
              setFlowState("main");
              window.location.hash = "main";
            }}
            onNavigateTab={(tab) => {
              setFlowState("main");
              setActiveTab(tab as NavTab);
              window.location.hash = "main";
            }}
          />
        )}
      </div>

      {toastMessage && (
        <div className="toast" role="status" aria-live="polite">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
