import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AthleteCoachLink } from "@shared/types";
import { apiClient } from "../lib/apiClient";

/**
 * "Your coach" on the athlete's More screen: join a squad with a code, see
 * whether the parent has approved, or leave. Coaches only ever see training
 * progress, never reflections.
 */
export function AthleteCoachCard() {
  const [coach, setCoach] = useState<AthleteCoachLink | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const load = useCallback(async () => {
    try {
      setCoach(await apiClient.getMyCoach());
    } catch {
      setCoach(null);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function join(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      setCoach(await apiClient.joinSquad(code.trim()));
      setCode("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't send your request.");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!coach) return;
    setBusy(true);
    try {
      await apiClient.leaveCoach(coach.id);
      setCoach(null);
      setConfirmLeave(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't remove your coach.");
    } finally {
      setBusy(false);
    }
  }

  if (coach === undefined) return null;

  return (
    <section className="live-card" aria-label="Your coach">
      <span className="eyebrow">YOUR COACH</span>
      {coach ? (
        <>
          <h2>{coach.coachName}</h2>
          <p className="live-copy">
            {coach.status === "active"
              ? "Your coach can see your training – sessions, weeks and areas – and can set your plan. Never your reflections."
              : "Waiting for your parent or guardian to approve. Once they do, your coach can see your training (never your reflections)."}
          </p>
          {confirmLeave ? (
            <div className="live-button-row" style={{ marginTop: 12 }}>
              <button type="button" className="live-danger-button" disabled={busy} onClick={() => void leave()}>
                {busy ? "Removing…" : coach.status === "active" ? "Yes, remove my coach" : "Yes, cancel request"}
              </button>
              <button type="button" className="live-link-button" onClick={() => setConfirmLeave(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button type="button" className="live-secondary-button" style={{ marginTop: 12, width: "100%" }} onClick={() => setConfirmLeave(true)}>
              {coach.status === "active" ? "Remove coach" : "Cancel request"}
            </button>
          )}
        </>
      ) : (
        <form onSubmit={join} className="live-form" style={{ marginTop: 8 }}>
          <p className="live-copy">Training with a coach? Enter their squad code. Your parent or guardian approves it first.</p>
          <label className="live-field">
            Squad code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SQUAD-…"
              autoCapitalize="characters"
              autoComplete="off"
              required
            />
          </label>
          <button type="submit" className="primary-button" disabled={busy || !code.trim()}>
            {busy ? "Sending…" : "Join squad"}
          </button>
        </form>
      )}
      {error && (
        <div className="live-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </section>
  );
}
