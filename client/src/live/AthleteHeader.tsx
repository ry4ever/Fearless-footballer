import { useState } from "react";
import { Bell } from "lucide-react";
import { FearlessWordmark } from "../components/icons/CustomIcons";

/** Logo, notifications bell and avatar – the top of Home and Training. */
export function AthleteHeader({ name, onOpenAccount }: { name: string; onOpenAccount: () => void }) {
  const [showNotifications, setShowNotifications] = useState(false);
  return (
    <header className="hq2-header">
      <FearlessWordmark />
      <div className="hq2-header-actions">
        <button
          type="button"
          className="hq2-icon-button"
          aria-label="Notifications"
          aria-expanded={showNotifications}
          onClick={() => setShowNotifications((open) => !open)}
        >
          <Bell size={20} />
        </button>
        <button type="button" className="hq2-avatar" aria-label="Your account" onClick={onOpenAccount}>
          {name.charAt(0).toUpperCase()}
        </button>
        {showNotifications && (
          <div className="hq2-popover" role="status">
            You're all caught up.
          </div>
        )}
      </div>
    </header>
  );
}
