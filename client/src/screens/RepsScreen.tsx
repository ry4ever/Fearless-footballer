import { ArrowRight, Brain, Clock, Filter, Sparkles, Target, Zap } from "lucide-react";

interface RepsScreenProps {
  onStartRep: (repId: string) => void;
}

const libraryReps = [
  {
    id: "nerves",
    title: "Nerves = Performance",
    subtitle: "Turn adrenaline into matchday information.",
    duration: "5 min",
    category: "Composure",
    icon: Target,
    level: "Featured Today",
  },
  {
    id: "tunnel_focus",
    title: "Tunnel Vision",
    subtitle: "Block crowd intimidation and focus on your first touch.",
    duration: "7 min",
    category: "Focus",
    icon: Brain,
    level: "Matchday Prep",
  },
  {
    id: "post_mistake",
    title: "The 3-Second Reset",
    subtitle: "Clear a turnover or referee mistake immediately.",
    duration: "4 min",
    category: "Resilience",
    icon: Zap,
    level: "In-Game Recovery",
  },
  {
    id: "penalty_box",
    title: "Penalty Calm",
    subtitle: "Somatic heart rate reduction before dead-ball execution.",
    duration: "6 min",
    category: "Composure",
    icon: Sparkles,
    level: "High Stakes",
  },
];

export function RepsScreen({ onStartRep }: RepsScreenProps) {
  return (
    <div className="screen reps-screen">
      <header className="reps-header">
        <div>
          <span className="eyebrow">REPS LIBRARY</span>
          <h1>Mindset Catalog</h1>
        </div>
        <button type="button" className="icon-button" aria-label="Filter library">
          <Filter size={20} />
        </button>
      </header>

      <main className="reps-list">
        {libraryReps.map((rep) => {
          const Icon = rep.icon;
          return (
            <div key={rep.id} className="rep-list-item">
              <div className="rep-item-icon">
                <Icon size={22} />
              </div>
              <div className="rep-item-info">
                <span className="rep-item-badge">{rep.level}</span>
                <strong>{rep.title}</strong>
                <p>{rep.subtitle}</p>
                <div className="rep-item-meta">
                  <span><Clock size={12} /> {rep.duration}</span>
                  <span>•</span>
                  <span>{rep.category}</span>
                </div>
              </div>
              <button
                type="button"
                className="rep-item-play-btn"
                onClick={() => onStartRep(rep.id)}
                aria-label={`Start ${rep.title}`}
              >
                <ArrowRight size={18} />
              </button>
            </div>
          );
        })}
      </main>
    </div>
  );
}
