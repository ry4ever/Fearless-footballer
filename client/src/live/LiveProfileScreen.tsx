import { useState } from "react";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { AccountActions } from "./AccountActions";
import { AthleteCoachCard } from "./AthleteCoachCard";
import { loadPlan } from "./plan";
import { isLinkActive, useSession } from "./session";

interface LiveProfileScreenProps {
  onEditPlan: () => void;
}

export function LiveProfileScreen({ onEditPlan }: LiveProfileScreenProps) {
  const { user, pairing, refreshPairing } = useSession();
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const plan = user ? loadPlan(user.id) : null;

  async function revoke() {
    if (!pairing) return;
    setError("");
    setBusy(true);
    try {
      await apiClient.revokePairing(pairing.id);
      await refreshPairing();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't remove access.");
    } finally {
      setBusy(false);
      setConfirmRevoke(false);
    }
  }

  return (
    <div className="screen live-screen hq2-screen">
      <FearlessWordmark />
      <section className="hq2-hello hq2-page-title">
        <p>{user?.displayName}</p>
        <h1>
          <span>More</span>
        </h1>
      </section>

      <section className="live-card" aria-label="Training plan">
        <span className="eyebrow">YOUR PLAN</span>
        {plan ? (
          <>
            <h2>{plan.goal}</h2>
            <p className="live-copy">Matchday: {plan.matchday}</p>
          </>
        ) : (
          <p className="live-copy">You haven't set a focus yet.</p>
        )}
        <button type="button" className="live-secondary-button" style={{ marginTop: 12, width: "100%" }} onClick={onEditPlan}>
          {plan ? "Change my plan" : "Set my plan"}
        </button>
      </section>

      <AthleteCoachCard />

      <section className="live-card" aria-label="Parent or guardian access">
        <span className="eyebrow">PARENT OR GUARDIAN</span>
        {isLinkActive(pairing) ? (
          <>
            <h2>Your {pairing.relationship} is linked</h2>
            <p className="live-copy">
              They see your training days, streak and score – never your reflections or notes.
            </p>
            {!confirmRevoke ? (
              <button type="button" className="live-danger-button" style={{ marginTop: 12, width: "100%" }} onClick={() => setConfirmRevoke(true)}>
                Remove their access
              </button>
            ) : (
              <div className="live-button-row" style={{ marginTop: 12 }}>
                <p className="live-copy">
                  Removing access also locks your sessions until a parent or guardian links again.
                </p>
                <button type="button" className="live-danger-button" disabled={busy} onClick={revoke}>
                  {busy ? "Removing…" : "Yes, remove access"}
                </button>
                <button type="button" className="live-link-button" onClick={() => setConfirmRevoke(false)}>
                  Cancel
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="live-copy">No one is linked.</p>
        )}
        {error && (
          <div className="live-error" role="alert" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}
      </section>

      <AccountActions />
    </div>
  );
}
