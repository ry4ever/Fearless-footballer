import { useEffect, useState } from "react";
import type { PairingCodeResponse } from "@shared/types";
import { FearlessWordmark } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";
import { useSession } from "./session";

const POLL_MS = 8000;

/**
 * The server only opens sessions once a parent or guardian has claimed the
 * athlete's code and the athlete has approved them.
 */
export function AthleteLinkScreen() {
  const { user, pairing, refreshPairing, signOut } = useSession();
  const [code, setCode] = useState<PairingCodeResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const pending = pairing?.status === "pending_athlete_approval";
  const expiresInMs = code ? new Date(code.expiresAt).getTime() - now : 0;
  const codeLive = code !== null && expiresInMs > 0;

  // While a code is out, check for the caregiver's claim and count down.
  useEffect(() => {
    if (!codeLive) return;
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(() => refreshPairing().catch(() => undefined), POLL_MS);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(poll);
    };
  }, [codeLive, refreshPairing]);

  async function run(action: () => Promise<unknown>) {
    setError("");
    setBusy(true);
    try {
      await action();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const createCode = () =>
    run(async () => {
      setCode(await apiClient.createPairingCode());
      setNow(Date.now());
    });

  const decide = (approved: boolean) =>
    run(async () => {
      if (!pairing) return;
      await apiClient.approvePairing(pairing.id, approved);
      setCode(null);
      await refreshPairing();
    });

  const minutes = Math.floor(expiresInMs / 60000);
  const seconds = Math.floor((expiresInMs % 60000) / 1000);

  return (
    <div className="screen live-screen no-nav">
      <FearlessWordmark />

      <div>
        <span className="eyebrow">HI {user?.displayName.toUpperCase()}</span>
        <h1 className="live-title">{pending ? "Approve your parent or guardian" : "Link a parent or guardian"}</h1>
      </div>

      {pending ? (
        <section className="live-card" aria-live="polite">
          <span className="eyebrow">REQUEST WAITING</span>
          <h2>
            Your {pairing.relationship} entered your code
          </h2>
          <p className="live-copy">
            If you approve, they'll see your training patterns (days trained, streak, score). They never see your
            reflections or notes. You can remove their access any time from your profile.
          </p>
          <div className="live-button-row" style={{ marginTop: 14 }}>
            <button type="button" className="primary-button" disabled={busy} onClick={() => decide(true)}>
              Approve
            </button>
            <button type="button" className="live-danger-button" disabled={busy} onClick={() => decide(false)}>
              Decline
            </button>
          </div>
        </section>
      ) : (
        <>
          <p className="live-copy">
            Training opens once a parent or guardian links to your account. Create a code and give it to them. They
            enter it in their own Fearless account, then you approve it here.
          </p>
          {pairing?.status === "revoked" && (
            <div className="live-card">
              <p className="live-copy">Your previous caregiver link has ended. Create a new code to link again.</p>
            </div>
          )}

          {codeLive ? (
            <section className="live-card" aria-live="polite">
              <span className="eyebrow">YOUR CODE</span>
              <strong className="pairing-code">{code.pairingCode}</strong>
              <p className="live-note">
                Expires in {minutes}:{String(seconds).padStart(2, "0")}. This page updates when they enter it.
              </p>
            </section>
          ) : (
            <button type="button" className="primary-button" disabled={busy} onClick={createCode}>
              {code ? "Code expired – create a new one" : "Create pairing code"}
            </button>
          )}
          {codeLive && (
            <button type="button" className="live-secondary-button" disabled={busy} onClick={() => run(refreshPairing)}>
              Check now
            </button>
          )}
        </>
      )}

      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}

      <button type="button" className="live-link-button" onClick={signOut}>
        Sign out
      </button>
    </div>
  );
}
