import { Check, Crown, Download, LockKeyhole, Sparkles, Trophy } from "lucide-react";

export function VaultScreen() {
  const badges = [
    { title: "Focus Builder", desc: "3 reps completed in a row", icon: Crown, earned: true },
    { title: "Matchday Anchor", desc: "Completed pre-kickoff routine", icon: Sparkles, earned: true },
    { title: "Composure Baseline", desc: "Locked in initial score", icon: Trophy, earned: true },
    { title: "Seven-Day Iron", desc: "7 consecutive days completed", icon: LockKeyhole, earned: false },
  ];

  return (
    <div className="screen vault-screen">
      <header className="vault-header">
        <div>
          <span className="eyebrow">ATHLETIC LOCKER</span>
          <h1>Your Vault</h1>
        </div>
        <div className="offline-badge">
          <Download size={15} />
          <span>2 Reps Offline</span>
        </div>
      </header>

      <main className="vault-content">
        <section className="vault-section">
          <h3>Earned Milestones</h3>
          <div className="badges-grid">
            {badges.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className={`badge-card ${b.earned ? "earned" : "locked"}`}>
                  <div className="badge-icon-wrap">
                    <Icon size={24} />
                    {b.earned && <Check size={12} strokeWidth={3} className="badge-check-dot" />}
                  </div>
                  <strong>{b.title}</strong>
                  <p>{b.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="vault-section">
          <h3>Saved Matchday Anchors</h3>
          <div className="anchor-card">
            <span className="anchor-tag">IN-GAME RESET CUE</span>
            <blockquote className="anchor-quote">
              “Notice the adrenaline. It is information.”
            </blockquote>
            <small>Practiced today · 5 min composure rep</small>
          </div>
        </section>
      </main>
    </div>
  );
}
