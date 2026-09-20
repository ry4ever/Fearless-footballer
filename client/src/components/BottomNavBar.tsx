import { Home as HomeIcon, LockKeyhole, MessageSquareText, UserRound, Zap } from "lucide-react";

export type NavTab = "hq" | "reps" | "vault" | "feed" | "profile";

interface BottomNavBarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
}

const navItems: Array<{ id: NavTab; label: string; icon: typeof HomeIcon }> = [
  { id: "hq", label: "HQ", icon: HomeIcon },
  { id: "reps", label: "Reps", icon: Zap },
  { id: "vault", label: "Vault", icon: LockKeyhole },
  { id: "feed", label: "Feed", icon: MessageSquareText },
  { id: "profile", label: "Profile", icon: UserRound },
];

export function BottomNavBar({ activeTab, onSelectTab }: BottomNavBarProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary Mobile Navigation">
      {navItems.map(({ id, label, icon: Icon }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            className={`nav-item ${isActive ? "active" : ""}`}
            onClick={() => onSelectTab(id)}
            aria-label={label}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon size={21} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
