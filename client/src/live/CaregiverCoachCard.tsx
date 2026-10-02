import { useCallback, useEffect, useState } from "react";
import type { CaregiverCoachLink } from "@shared/types";
import { apiClient } from "../lib/apiClient";

/**
 * Coach requests and coaches on the parent dashboard. A coach only sees the
 * player's training once the parent approves here, and the parent can
 * remove a coach at any time.
 */
export function CaregiverCoachCard() {
  const [links, setLinks] = useState<CaregiverCoachLink[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLinks(await apiClient.getCoachRequests());
    } catch {
      setLinks([]);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError("");
    try {
      await action();
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusyId(null);
    }
  }

  if (!links || links.length === 0) return null;

  return (
    <section className="live-card coach-requests" aria-label="Coaches">
      <span className="eyebrow">COACH</span>
      {links.map((link) =>
        link.status === "pending_parent" ? (
          <div key={link.id} className="coach-request">
            <h2>
              {link.coachName} wants to coach {link.athleteName}
            </h2>
            <p className="live-copy">
              If you approve, {link.coachName} will see {link.athleteName}'s training – sessions completed, weeks and
              areas worked on – and can set a plan of sessions. Never their reflections or notes.
            </p>
            <div className="live-button-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="primary-button"
                disabled={busyId === link.id}
                onClick={() => void act(link.id, () => apiClient.decideCoachRequest(link.id, true))}
              >
                Approve
              </button>
              <button
                type="button"
                className="live-link-button"
                disabled={busyId === link.id}
                onClick={() => void act(link.id, () => apiClient.decideCoachRequest(link.id, false))}
              >
                Decline
              </button>
            </div>
          </div>
        ) : (
          <div key={link.id} className="coach-request">
            <h2>{link.coachName}</h2>
            <p className="live-copy">
              Coaching {link.athleteName}. Sees training progress and sets their plan – never reflections.
            </p>
            <button
              type="button"
              className="live-danger-button"
              style={{ marginTop: 12, width: "100%" }}
              disabled={busyId === link.id}
              onClick={() => void act(link.id, () => apiClient.removeCoach(link.id))}
            >
              Remove coach
            </button>
          </div>
        ),
      )}
      {error && (
        <div className="live-error" role="alert" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}
    </section>
  );
}
