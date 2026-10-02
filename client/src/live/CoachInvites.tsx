import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Copy, X } from "lucide-react";
import type { CoachInviteSummary } from "@shared/types";
import { apiClient } from "../lib/apiClient";

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Mark's "Invite a coach" panel on his coach dashboard: make a single-use
 * code for a new coach, copy it to send them, and see which codes have been
 * used. A code is only shown when it's made – only its hash is stored.
 */
export function CoachInvites() {
  const [invites, setInvites] = useState<CoachInviteSummary[] | null>(null);
  const [note, setNote] = useState("");
  const [created, setCreated] = useState<{ code: string; note: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setInvites(await apiClient.getCoachInvites());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't load your invites.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const result = await apiClient.createCoachInvite(note.trim());
      setCreated({ code: result.inviteCode, note: note.trim(), expiresAt: result.expiresAt });
      setNote("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the code is on screen to copy by hand.
    }
  }

  const message = created
    ? `You're invited to coach on Fearless Footballer. Go to ${window.location.origin}, choose Coach, then "New here? Create an account", and enter this invite code: ${created.code} (it works once, until ${formatDay(created.expiresAt)}).`
    : "";

  return (
    <section className="hq2-card ci-card" aria-label="Invite a coach">
      <span className="hq2-eyebrow">INVITE A COACH</span>
      <p className="co-plan-intro">
        Each code works once, for 30 days. Send it to the coach yourself – they'll use it to create their account.
      </p>

      <form className="ci-form" onSubmit={create}>
        <label className="live-field">
          Who's it for? <span className="live-hint">(only you see this)</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={120} placeholder="e.g. Coach Jamie Smith" />
        </label>
        <button type="submit" className="pg-choose" disabled={busy}>
          {busy ? "Creating…" : "Create invite code"}
        </button>
      </form>

      {created && (
        <div className="ci-created" role="status">
          <span className="hq2-eyebrow">{created.note ? `CODE FOR ${created.note.toUpperCase()}` : "NEW CODE"}</span>
          <div className="co-code-row">
            <strong>{created.code}</strong>
            <button type="button" className="co-copy" onClick={() => void copy(created.code)} aria-label="Copy code">
              {copied ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>
          <p>Copy it now – for security it won't be shown again.</p>
          <button type="button" className="live-secondary-button" onClick={() => void copy(message)}>
            Copy a message with the code and instructions
          </button>
        </div>
      )}

      {error && (
        <div className="live-error" role="alert">
          {error}
        </div>
      )}

      {invites && invites.length > 0 && (
        <>
          <span className="hq2-eyebrow ci-list-label">YOUR INVITES</span>
          <ul className="ci-list">
            {invites.map((invite) => (
              <li key={invite.id}>
                <span className="ci-list-text">
                  <strong>{invite.note || "Coach invite"}</strong>
                  <small>
                    {invite.status === "used"
                      ? `Used${invite.usedByName ? ` by ${invite.usedByName}` : ""} · ${formatDay(invite.usedAt!)}`
                      : invite.status === "expired"
                        ? `Expired ${formatDay(invite.expiresAt)}`
                        : `Not used yet · until ${formatDay(invite.expiresAt)}`}
                  </small>
                </span>
                <span className={`co-tag ${invite.status === "open" ? "" : "muted"}`}>{invite.status.toUpperCase()}</span>
                {invite.status === "open" && (
                  <button
                    type="button"
                    className="co-icon-button"
                    aria-label={`Cancel invite${invite.note ? ` for ${invite.note}` : ""}`}
                    onClick={async () => {
                      await apiClient.cancelCoachInvite(invite.id).catch(() => undefined);
                      void load();
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
