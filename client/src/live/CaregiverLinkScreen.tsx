import { useEffect, useState, type FormEvent } from "react";
import type { PairingRelationship } from "@shared/types";
import { FearlessHeaderLogo } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { useSession } from "./session";

const POLL_MS = 8000;

/** Caregiver enters the athlete's code, then waits for the athlete to approve. */
export function CaregiverLinkScreen() {
  const { user, pairing, refreshPairing, signOut } = useSession();
  const [code, setCode] = useState("");
  const [relationship, setRelationship] = useState<PairingRelationship>("parent");
  const [consent, setConsent] = useState(false);
  const [athleteName, setAthleteName] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const waiting = pairing?.status === "pending_athlete_approval";

  useEffect(() => {
    if (!waiting) return;
    const poll = window.setInterval(() => refreshPairing().catch(() => undefined), POLL_MS);
    return () => window.clearInterval(poll);
  }, [waiting, refreshPairing]);

  async function claim(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Please confirm consent to link to this player.");
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.claimPairingCode(code.trim().toUpperCase(), relationship);
      setAthleteName(result.athlete.displayName);
      await refreshPairing();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That code didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function checkNow() {
    setBusy(true);
    await refreshPairing().catch(() => undefined);
    setBusy(false);
  }

  return (
    <div className="screen live-screen no-nav">
      <FearlessHeaderLogo subtitle="Parents" size="md" />

      <div>
        <span className="eyebrow">HI {user?.displayName.toUpperCase()}</span>
        <h1 className="live-title">{waiting ? "Waiting for approval" : "Link to your player"}</h1>
      </div>

      {waiting ? (
        <section className="live-card" aria-live="polite">
          <span className="eyebrow">ALMOST THERE</span>
          <h2>{athleteName ? `${athleteName} needs to approve you` : "Your player needs to approve you"}</h2>
          <p className="live-copy">
            Ask them to open Fearless and approve the request. This page updates as soon as they do.
          </p>
          <button type="button" className="live-secondary-button" style={{ marginTop: 14, width: "100%" }} disabled={busy} onClick={checkNow}>
            Check now
          </button>
        </section>
      ) : (
        <>
          <p className="live-copy">
            Ask your player to create a pairing code in their Fearless app, then enter it here. Codes last 15 minutes.
          </p>
          {pairing?.status === "revoked" && (
            <div className="live-card">
              <p className="live-copy">Your previous link has ended. Enter a new code from your player to link again.</p>
            </div>
          )}
          <form className="live-form" onSubmit={claim}>
            <label className="live-field">
              Pairing code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="FEAR-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                required
                maxLength={20}
              />
            </label>
            <div className="live-segment" role="group" aria-label="Your relationship to the player">
              <button type="button" aria-pressed={relationship === "parent"} onClick={() => setRelationship("parent")}>
                Parent
              </button>
              <button type="button" aria-pressed={relationship === "guardian"} onClick={() => setRelationship("guardian")}>
                Guardian
              </button>
            </div>
            <label className="live-check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                I'm this player's {relationship} and I consent to them using Fearless. I'll see progress patterns only,
                never their reflections or notes.
              </span>
            </label>
            {error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? "Linking…" : "Link to player"}
            </button>
          </form>
        </>
      )}

      <button type="button" className="live-link-button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
