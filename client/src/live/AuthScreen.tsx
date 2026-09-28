import { useState, type FormEvent } from "react";
import type { BetaUserRole } from "@shared/types";
import { FearlessHeaderLogo } from "../components/icons/CustomIcons";
import { apiClient } from "../lib/apiClient";

type Mode = "sign-in" | "register";

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function AuthScreen() {
  const [role, setRole] = useState<BetaUserRole>("athlete");
  const [mode, setMode] = useState<Mode>("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (registering && !privacyAcknowledged) {
      setError("Please read and accept the privacy notice to continue.");
      return;
    }
    setBusy(true);
    try {
      // A successful call starts the session; SessionProvider takes over from there.
      if (registering) {
        await apiClient.register({
          role,
          displayName: name.trim(),
          email: email.trim(),
          password,
          privacyAcknowledged,
          ...(role === "athlete" ? { birthDate, timezone: browserTimezone() } : {}),
        });
      } else {
        await apiClient.signIn(email.trim(), password, role);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="screen live-screen no-nav">
      <FearlessHeaderLogo subtitle="HQ" size="md" />

      <div>
        <span className="eyebrow">{registering ? "CREATE YOUR ACCOUNT" : "WELCOME BACK"}</span>
        <h1 className="live-title">{registering ? "Start training off the pitch" : "Sign in to Fearless"}</h1>
      </div>

      <div className="live-segment" role="group" aria-label="Account type">
        <button type="button" aria-pressed={role === "athlete"} onClick={() => setRole("athlete")}>
          I'm a player
        </button>
        <button type="button" aria-pressed={role === "caregiver"} onClick={() => setRole("caregiver")}>
          Parent or guardian
        </button>
      </div>

      <form className="live-form" onSubmit={submit}>
        {registering && (
          <label className="live-field">
            {role === "athlete" ? "First name" : "Your name"}
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" required maxLength={100} />
          </label>
        )}
        <label className="live-field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="live-field">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={registering ? "new-password" : "current-password"}
            required
            minLength={registering ? 8 : 1}
          />
          {registering && <span className="live-hint">At least 8 characters, with a letter and a number.</span>}
        </label>
        {registering && role === "athlete" && (
          <label className="live-field">
            Date of birth
            <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            <span className="live-hint">Players under 18 link a parent or guardian before training.</span>
          </label>
        )}
        {registering && (
          <label className="live-check">
            <input
              type="checkbox"
              checked={privacyAcknowledged}
              onChange={(e) => setPrivacyAcknowledged(e.target.checked)}
            />
            <span>
              I've read the privacy notice. Reflections stay private to the player; parents see progress patterns only.
            </span>
          </label>
        )}

        {error && (
          <div className="live-error" role="alert">
            {error}
          </div>
        )}

        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? "Please wait…" : registering ? "Create account" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        className="live-link-button"
        onClick={() => {
          setMode(registering ? "sign-in" : "register");
          setError("");
        }}
      >
        {registering ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </div>
  );
}
