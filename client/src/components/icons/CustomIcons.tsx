import type { SVGProps } from "react";

// Head profile with breath waves (Used in Calm / Composure Score)
export function HeadBreathIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Face Profile Silhouette */}
      <path d="M15 4a5 5 0 0 0-4.9 4.1C9.6 8.9 9 9.9 9 11v1c0 .6.2 1.2.6 1.6L8 16.5V19a2 2 0 0 0 2 2h4.5a5.5 5.5 0 0 0 5.5-5.5V11A7 7 0 0 0 15 4z" />
      {/* Breath waves exhaling */}
      <path d="M4 9h4" />
      <path d="M2 12h5" />
      <path d="M5 15h3" />
    </svg>
  );
}

// Target / Crosshairs icon (Used for Sharp / Reps)
export function TargetIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
    </svg>
  );
}

// Mountain Peak with Flag (Used for Unshakeable in Onboarding Image 2)
export function MountainFlagIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Mountain outline */}
      <path d="M3 20l7-12 4 6 7-10 2 16H3z" />
      {/* Flag pole on peak */}
      <line x1="14" y1="2" x2="14" y2="14" />
      {/* Flag */}
      <path d="M14 2l5 3-5 3V2z" fill="currentColor" fillOpacity="0.2" />
    </svg>
  );
}

// Hexagon Badge Icon (Used for Focus Builder badge in Active HQ Image 4)
export function BadgeHexIcon({ size = 24, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {/* Outer Hexagon */}
      <path d="M12 2l8.5 4.9v9.8L12 21.6l-8.5-4.9V6.9L12 2z" />
      {/* Crown / Shield Symbol */}
      <path d="M8 14l2-4 2 2 2-2 2 4H8z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

// 3D Perspective Soccer Pitch Markings Vector Graphic
export function PitchMarkingsGraphic({ className }: { className?: string }) {
  return (
    <div className={`pitch-markings-vector-wrap ${className || ""}`}>
      <svg
        viewBox="0 0 400 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="pitch-vector-svg"
      >
        <g opacity="0.65">
          {/* Outer Boundary */}
          <rect x="10" y="20" width="380" height="90" rx="4" stroke="url(#pitch-line-gradient)" strokeWidth="1.5" />
          {/* Halfway Line */}
          <line x1="200" y1="20" x2="200" y2="110" stroke="url(#pitch-line-gradient)" strokeWidth="1.5" />
          {/* Center Circle */}
          <ellipse cx="200" cy="65" rx="55" ry="32" stroke="url(#pitch-line-gradient)" strokeWidth="1.5" />
          {/* Center Spot */}
          <circle cx="200" cy="65" r="2.5" fill="#69e0fa" />
          {/* Penalty Boxes */}
          <rect x="10" y="38" width="54" height="54" stroke="url(#pitch-line-gradient)" strokeWidth="1" />
          <rect x="336" y="38" width="54" height="54" stroke="url(#pitch-line-gradient)" strokeWidth="1" />
        </g>
        <defs>
          <linearGradient id="pitch-line-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#69e0fa" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#c13bff" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#008bce" stopOpacity="0.8" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Brain/Soccer Ball Split Emblem Vector Icon
export function BrainSoccerMark({ size = 32, className, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Outer Circle Boundary */}
      <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="4" />
      {/* Center Divider Line */}
      <line x1="50" y1="4" x2="50" y2="96" stroke="currentColor" strokeWidth="4" />

      {/* Left Half: Brain Sulci Patterns */}
      <g stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" fill="none">
        <path d="M44 14C35 15 26 21 21 29" />
        <path d="M45 25C36 26 28 32 24 40" />
        <path d="M44 37C34 38 24 45 18 55" />
        <path d="M45 50C38 52 28 60 22 70" />
        <path d="M44 65C38 67 30 76 26 84" />
        <path d="M44 78C38 80 34 85 30 90" />
        <path d="M30 32c4-2 8 2 10 6" />
        <path d="M22 46c5-1 9 4 11 8" />
        <path d="M28 62c4-1 7 4 9 7" />
      </g>

      {/* Right Half: Soccer Ball Pentagons & Panels */}
      <g stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" fill="none">
        {/* Center Pentagon on right border */}
        <path d="M50 34l18-6 10 16-6 18-18 2" fill="currentColor" fillOpacity="0.25" />
        <path d="M68 28l18 8" />
        <path d="M78 44l16 4" />
        <path d="M72 64l14 16" />
        <path d="M50 64l12 18" />
        <path d="M50 16l14 8" />
        {/* Lower Soccer Pentagon Panel */}
        <path d="M62 82l18-8 12 14" />
      </g>
    </svg>
  );
}

// Brand Logo Lockup Header Component
export function FearlessHeaderLogo({
  subtitle = "HQ",
  showGraphic = true,
  size = "md",
}: {
  subtitle?: string;
  showGraphic?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const logoHeight = size === "sm" ? 28 : size === "lg" ? 44 : 34;

  return (
    <div className={`fearless-brand-logo-lockup size-${size}`}>
      {showGraphic ? (
        <img
          src="/assets/fearless-logo.png"
          alt="Fearless Footballer Logo"
          className="brand-logo-img"
          style={{ height: logoHeight, width: "auto", objectFit: "contain" }}
        />
      ) : (
        <div className="brand-text-only">
          <span className="brand-fearless">FEARLESS</span>
          {subtitle && <span className="brand-sub-badge">{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
