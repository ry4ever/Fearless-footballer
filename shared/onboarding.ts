/**
 * Choices offered during onboarding, shared by web and mobile. Photos are
 * named here; each app maps a name to its own copy of
 * assets/photos/<name>.jpg.
 */

export type PhotoName =
  | "ball"
  | "centre-back"
  | "changing-room"
  | "composure"
  | "cone"
  | "cone-lights"
  | "decision"
  | "energy"
  | "floodlights"
  | "focus"
  | "fullback"
  | "goalkeeper"
  | "headphones"
  | "hero"
  | "hold-up"
  | "matchday"
  | "midfielder"
  | "profile"
  | "stadium"
  | "striker"
  | "tactics-board"
  | "winger";

export interface PositionOption {
  id: string;
  title: string;
  role: string;
  photo: PhotoName;
}

export const POSITIONS: PositionOption[] = [
  { id: "striker", title: "Striker", role: "ST / CF", photo: "striker" },
  { id: "winger", title: "Winger", role: "LW / RW", photo: "winger" },
  { id: "midfielder", title: "Midfielder", role: "CM / CAM", photo: "midfielder" },
  { id: "fullback", title: "Fullback", role: "LB / RB", photo: "fullback" },
  { id: "centre_back", title: "Centre-Back", role: "CB", photo: "centre-back" },
  { id: "goalkeeper", title: "Goalkeeper", role: "GK", photo: "goalkeeper" },
];

export interface SkillOption {
  id: string;
  label: string;
}

export const SKILLS_BY_POSITION: Record<string, SkillOption[]> = {
  striker: [
    { id: "finishing", label: "Finishing & Shot Placement" },
    { id: "movement", label: "Box Movement & Anticipation" },
    { id: "hold_up", label: "Hold-Up & Link Play" },
    { id: "first_touch", label: "First Touch Under Pressure" },
    { id: "1v1s", label: "Beating Defenders 1v1" },
    { id: "heading", label: "Aerial Duels & Heading" },
    { id: "confidence", label: "Confidence in Front of Goal" },
    { id: "composure", label: "Composure on Big Chances" },
  ],
  winger: [
    { id: "1v1s", label: "1v1 Take-Ons & Beating Fullbacks" },
    { id: "crossing", label: "Crossing & Delivery into the Box" },
    { id: "cutting_inside", label: "Cutting Inside & Shooting" },
    { id: "first_touch", label: "First Touch on the Move" },
    { id: "movement", label: "Back-Post Runs & Timing" },
    { id: "decision_making", label: "Final-Third Decision Making" },
    { id: "confidence", label: "Boldness to Attack Defenders" },
    { id: "composure", label: "Composure Under Pressure" },
  ],
  midfielder: [
    { id: "scanning", label: "Scanning & Pitch Awareness" },
    { id: "first_touch", label: "Receiving on the Half-Turn" },
    { id: "passing", label: "Range of Passing & Penetration" },
    { id: "decision_making", label: "Tempo & Quick Decisions" },
    { id: "press_resistance", label: "Shielding & Press Resistance" },
    { id: "positioning", label: "Spacing & Defensive Shape" },
    { id: "confidence", label: "Demanding the Ball Under Pressure" },
    { id: "composure", label: "Composure in Tight Spaces" },
  ],
  fullback: [
    { id: "1v1_defending", label: "1v1 Defending & Jockeying" },
    { id: "crossing", label: "Overlapping & Delivery" },
    { id: "recovery", label: "Recovery Runs & Transitions" },
    { id: "distribution", label: "Building from the Back" },
    { id: "scanning", label: "Tracking Runners & Awareness" },
    { id: "confidence", label: "Confidence in 50/50 Duels" },
    { id: "composure", label: "Composure on the Ball" },
  ],
  centre_back: [
    { id: "positioning", label: "Positioning & Holding the Line" },
    { id: "heading", label: "Aerial Dominance & Headers" },
    { id: "1v1_defending", label: "1v1 Defending in Space" },
    { id: "distribution", label: "Line-Breaking Passes" },
    { id: "leadership", label: "Organising & Vocal Command" },
    { id: "composure", label: "Composure Under Heavy Press" },
  ],
  goalkeeper: [
    { id: "shot_stopping", label: "Reaction Saves & Reflexes" },
    { id: "crosses", label: "Claiming High Balls & Crosses" },
    { id: "distribution", label: "Distribution with Feet & Hands" },
    { id: "1v1_saves", label: "1v1 Smothers & Angles" },
    { id: "command", label: "Command of the Penalty Area" },
    { id: "composure", label: "Composure After Errors" },
  ],
};

/** Background photo for each focus area row. */
const SKILL_PHOTOS: Record<string, PhotoName> = {
  finishing: "ball",
  movement: "stadium",
  hold_up: "hold-up",
  first_touch: "cone",
  "1v1s": "energy",
  heading: "floodlights",
  confidence: "focus",
  composure: "composure",
  crossing: "cone-lights",
  cutting_inside: "ball",
  decision_making: "decision",
  scanning: "midfielder",
  passing: "tactics-board",
  press_resistance: "profile",
  positioning: "changing-room",
  "1v1_defending": "centre-back",
  recovery: "energy",
  distribution: "tactics-board",
  leadership: "fullback",
  shot_stopping: "goalkeeper",
  crosses: "floodlights",
  "1v1_saves": "goalkeeper",
  command: "fullback",
};

export const skillPhoto = (skillId: string): PhotoName => SKILL_PHOTOS[skillId] ?? "stadium";

export type GoalIcon = "box" | "score" | "confidence" | "touch" | "defend" | "level" | "target";

export interface GoalOption {
  label: string;
  icon: GoalIcon;
}

const NEXT_LEVEL: GoalOption = { label: "Reach the Next Level", icon: "level" };

export const GOALS_BY_POSITION: Record<string, GoalOption[]> = {
  striker: [
    { label: "Become More Dangerous in the Box", icon: "box" },
    { label: "Score More Consistently", icon: "score" },
    { label: "Be More Confident in Big Moments", icon: "confidence" },
    { label: "Improve My First Touch", icon: "touch" },
    { label: "Be Harder to Defend", icon: "defend" },
    NEXT_LEVEL,
  ],
  winger: [
    { label: "Dominate My Fullback 1v1", icon: "box" },
    { label: "Deliver Better Crosses", icon: "target" },
    { label: "Create More Chances", icon: "score" },
    { label: "Play Without Second-Guessing", icon: "confidence" },
    NEXT_LEVEL,
  ],
  midfielder: [
    { label: "Control the Tempo of the Game", icon: "target" },
    { label: "Keep the Ball Under Pressure", icon: "defend" },
    { label: "See the Pass Earlier", icon: "box" },
    { label: "Stay Composed for 90 Minutes", icon: "confidence" },
    NEXT_LEVEL,
  ],
  fullback: [
    { label: "Lock Down My Flank", icon: "defend" },
    { label: "Get Forward and Deliver", icon: "target" },
    { label: "Win More Duels", icon: "box" },
    { label: "Stay Composed in Transition", icon: "confidence" },
    NEXT_LEVEL,
  ],
  centre_back: [
    { label: "Keep More Clean Sheets", icon: "defend" },
    { label: "Win Every Aerial Duel", icon: "box" },
    { label: "Start Attacks with Confident Passes", icon: "target" },
    { label: "Lead the Back Line", icon: "confidence" },
    NEXT_LEVEL,
  ],
  goalkeeper: [
    { label: "Keep Clean Sheets in Big Games", icon: "defend" },
    { label: "Command My Box", icon: "box" },
    { label: "Distribute Under Pressure", icon: "target" },
    { label: "Reset Instantly After Conceding", icon: "confidence" },
    NEXT_LEVEL,
  ],
};

export const MATCHDAYS = ["Saturday", "Sunday", "Midweek", "No Match This Week"];

export const MAX_SKILLS = 3;

export function positionById(id: string | undefined): PositionOption {
  return POSITIONS.find((position) => position.id === id) ?? POSITIONS[0]!;
}

/** Programme thumbnail: the midfield programme shows a midfielder, the rest a striker. */
export const programmePhoto = (slug: string): PhotoName => (slug.includes("midfield") ? "midfielder" : "striker");

export interface OnboardingPlan {
  position: string;
  skills: string[];
  goal: string;
  matchday: string;
  /** Programme slug chosen on the Training tab; otherwise one is picked from the position. */
  programme?: string;
}

export function skillLabel(positionId: string, skillId: string): string {
  const skills = SKILLS_BY_POSITION[positionId] ?? SKILLS_BY_POSITION.striker!;
  return skills.find((skill) => skill.id === skillId)?.label ?? skillId.replace(/_/g, " ");
}
