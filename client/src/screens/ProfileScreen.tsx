import { useState } from "react";
import { Check, Copy, Download, KeyRound, LockKeyhole, ShieldCheck, Trash2, User } from "lucide-react";

interface ProfileScreenProps {
  onOpenParentView: () => void;
}

export function ProfileScreen({ onOpenParentView }: ProfileScreenProps) {
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [linkedCaregiver, setLinkedCaregiver] = useState<string | null>("Sarah Rivera (Parent)");

  const generateCode = () => {
    const randomCode = `FEAR-${Math.floor(1000 + Math.random() * 9000)}`;
    setPairingCode(randomCode);
    setCopied(false);
  };

  const copyCode = () => {
    if (!pairingCode) return;
    navigator.clipboard?.writeText(pairingCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="screen profile-screen">
      <header className="profile-header">
        <div>
          <span className="eyebrow">ATHLETE IDENTITY</span>
          <h1>Profile & Privacy</h1>
        </div>
        <div className="profile-avatar-circle">AR</div>
      </header>

      <main className="profile-content">
        {/* Athlete Overview */}
        <section className="profile-user-card">
          <div className="user-details">
            <strong>Alex Rivera</strong>
            <span>Age 14 • U15 Academy Midfielder</span>
            <small>New York, USA (EST Timezone)</small>
          </div>
          <span className="coppa-badge">
            <ShieldCheck size={14} /> Verified Youth
          </span>
        </section>

        {/* Caregiver Linking Section (P0 Requirement) */}
        <section className="profile-section">
          <h3>Caregiver Pairing (Parent View)</h3>
          <p className="profile-section-sub">
            Share aggregated progress with your parent or legal guardian without sharing private reflections or session audio.
          </p>

          {linkedCaregiver ? (
            <div className="linked-caregiver-card">
              <div className="caregiver-info">
                <div className="caregiver-avatar">SR</div>
                <div>
                  <strong>{linkedCaregiver}</strong>
                  <span>Linked via Verifiable Parental Consent</span>
                </div>
              </div>
              <div className="caregiver-actions">
                <button
                  type="button"
                  className="view-parent-btn"
                  onClick={onOpenParentView}
                >
                  Preview Parent Dashboard
                </button>
                <button
                  type="button"
                  className="unlink-btn"
                  onClick={() => setLinkedCaregiver(null)}
                >
                  Unlink Access
                </button>
              </div>
            </div>
          ) : (
            <div className="pairing-generator-card">
              <p>No caregiver currently linked.</p>
              {pairingCode ? (
                <div className="generated-code-box">
                  <span className="code-label">15-MINUTE PAIRING CODE:</span>
                  <div className="code-display-row">
                    <strong className="code-value">{pairingCode}</strong>
                    <button type="button" className="copy-code-btn" onClick={copyCode}>
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                  <small>Ask your parent to enter this code in their Fearless app.</small>
                </div>
              ) : (
                <button
                  type="button"
                  className="primary-button generate-code-btn"
                  onClick={generateCode}
                >
                  <KeyRound size={17} /> Generate Pairing Code
                </button>
              )}
            </div>
          )}
        </section>

        {/* Privacy, Safeguarding & Data Ownership */}
        <section className="profile-section">
          <h3>Privacy & Safeguarding</h3>
          <div className="privacy-actions-list">
            <button
              type="button"
              className="privacy-action-row"
              onClick={() => alert("Downloading your anonymized progress data archive (JSON)...")}
            >
              <Download size={18} />
              <div>
                <strong>Export My Data</strong>
                <span>Download full progress history (COPPA/GDPR)</span>
              </div>
            </button>

            <button
              type="button"
              className="privacy-action-row danger"
              onClick={() => {
                if (confirm("Are you sure you want to request permanent account deletion?")) {
                  alert("Deletion request received. Personal data will be purged within 72 hours.");
                }
              }}
            >
              <Trash2 size={18} />
              <div>
                <strong>Delete Account & Data</strong>
                <span>Permanently purge profile and metrics</span>
              </div>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
