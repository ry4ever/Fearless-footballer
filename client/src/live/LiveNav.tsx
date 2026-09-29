import { ChartNoAxesColumn, Dumbbell, Ellipsis, House } from "lucide-react";

export type LiveTab = "home" | "training" | "progress" | "more";

const ITEMS: Array<{ id: LiveTab; label: string; icon: typeof House }> = [
  { id: "home", label: "Home", icon: House },
  { id: "training", label: "Training", icon: Dumbbell },
  { id: "progress", label: "Progress", icon: ChartNoAxesColumn },
  { id: "more", label: "More", icon: Ellipsis },
];

export function LiveNav({ active, onSelect }: { active: LiveTab; onSelect: (tab: LiveTab) => void }) {
  return (
    <nav className="live-nav" aria-label="Main">
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = id === active;
        return (
          <button
            key={id}
            type="button"
            className={isActive ? "active" : ""}
            aria-current={isActive ? "page" : undefined}
            onClick={() => onSelect(id)}
          >
            <Icon size={22} strokeWidth={isActive ? 2.4 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
