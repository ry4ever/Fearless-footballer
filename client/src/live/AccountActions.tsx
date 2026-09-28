import { useState } from "react";
import { apiClient } from "../lib/apiClient";
import { useSession } from "./session";

/** Sign out and permanent account deletion, shared by athletes and caregivers. */
export function AccountActions() {
  const { signOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function deleteAccount() {
    setError("");
    setBusy(true);
    try {
      await apiClient.deleteAccount();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <section className="live-card" aria-label="Account">
      <span className="eyebrow">ACCOUNT</span>
      <div className="live-button-row" style={{ marginTop: 10 }}>
        <button type="button" className="live-secondary-button" onClick={signOut}>
          Sign out
        </button>
        {!confirming ? (
          <button type="button" className="live-danger-button" onClick={() => setConfirming(true)}>
            Delete account
          </button>
        ) : (
          <div className="live-form">
            <p className="live-copy">
              This permanently deletes your account, progress and any caregiver links. It can't be undone.
            </p>
            <label className="live-field">
              Type DELETE to confirm
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            {error && (
              <div className="live-error" role="alert">
                {error}
              </div>
            )}
            <button
              type="button"
              className="live-danger-button"
              disabled={typed.trim().toUpperCase() !== "DELETE" || busy}
              onClick={deleteAccount}
            >
              {busy ? "Deleting…" : "Permanently delete my account"}
            </button>
            <button type="button" className="live-link-button" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
