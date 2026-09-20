export type BetaUserRole = "athlete" | "caregiver";
export type BetaSessionMode = "interactive";
export type SessionMode = BetaSessionMode | "guidance" | "relaxation";
export type MindsetCategory =
  | "calm"
  | "sharp"
  | "brave"
  | "unshakeable"
  | "focus"
  | "resilience"
  | "performance";
export type ReflectionFeeling = "clearer" | "steadier" | "more_ready";
export type PairingRelationship = "parent" | "guardian";
export type PairingStatus =
  | "unlinked"
  | "pending_athlete_approval"
  | "active"
  | "revoked";
export type AgeGateStatus =
  | "verified"
  | "pending_guardian_authorization"
  | "restricted";
export type ConsentStatus = "pending" | "granted" | "revoked";
export type CompletionSyncStatus = "queued" | "syncing" | "synced" | "failed";
export type PlaybackStatus =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "interrupted"
  | "completed";

export interface Mentor {
  id: string;
  name: string;
  title: string;
  avatarUrl?: string;
  bio?: string;
}

export interface SessionPhase {
  number: number;
  label: string;
  startSeconds: number;
  endSeconds: number;
}

export interface SessionPrompt {
  timestampSeconds: number;
  promptText: string;
  subText?: string;
}

export interface SessionMediaPackage {
  voiceUrl: string;
  musicBedUrl?: string;
  captionsUrl?: string;
  transcriptUrl?: string;
  transcriptLocale?: string;
}

export interface SessionPackage {
  id: string;
  slug: string;
  version: string;
  title: string;
  subtitle: string;
  category: string;
  mindset: MindsetCategory;
  defaultDurationSeconds: number;
  mentor: Mentor;
  heroImageUrl?: string;
  thumbnailUrl?: string;
  availableModes: readonly [BetaSessionMode];
  media: SessionMediaPackage;
  phases: SessionPhase[];
  prompts: SessionPrompt[];
}

export interface UserAccount {
  id: string;
  role: BetaUserRole;
  displayName: string;
  isMinor: boolean;
  ageGateStatus: AgeGateStatus;
  pairingStatus: PairingStatus;
}

export interface AuthTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RegisterAccountRequest {
  role: BetaUserRole;
  fullName?: string;
  displayName?: string;
  email: string;
  password: string;
  birthDate?: string;
  timezone?: string;
  region?: string;
  /** Local beta acknowledgement; production consent is server-owned. */
  privacyAcknowledged?: boolean;
}

export interface SignInAccountRequest {
  role: BetaUserRole;
  email: string;
  password: string;
}

export interface RegisterAccountResponse {
  user: UserAccount;
  tokens: AuthTokenSet;
}

export interface PairingCode {
  code: string;
  expiresAt: string;
}

export interface PairingLink {
  id: string;
  athleteId: string;
  caregiverUserId: string;
  relationship: PairingRelationship;
  status: PairingStatus;
  pairingCode?: string;
  pairingExpiresAt?: string;
  consentStatus: ConsentStatus;
  consentedAt?: string;
  athleteApprovedAt?: string;
  revokedAt?: string;
}

export interface Reflection {
  feeling: ReflectionFeeling;
  note?: string;
}

export interface SessionCompletion {
  id: string;
  sessionId: string;
  sessionVersion: string;
  mode: BetaSessionMode;
  durationSeconds: number;
  completedAt: string;
  reflection?: Reflection;
}

export interface SessionCompletionRequest {
  sessionId: string;
  sessionVersion: string;
  mode: BetaSessionMode;
  completionDurationSeconds: number;
  completedAt: string;
  reflection?: Reflection;
  idempotencyKey: string;
}

export interface OfflineCompletionQueueItem {
  id: string;
  request: SessionCompletionRequest;
  createdAt: string;
  updatedAt: string;
  attempts: number;
  status: CompletionSyncStatus;
  lastError?: string;
}

export interface StreakUpdate {
  currentStreakDays: number;
  bestStreakDays: number;
  isNewMilestone: boolean;
}

export interface ComposureUpdate {
  previousScore: number;
  newScore: number;
  delta: number;
}

export interface WeeklyProgress {
  completedDays: number;
  targetDays: number;
  sevenDayPattern: boolean[];
}

export interface CompletionSyncResponse {
  completionId: string;
  streak: StreakUpdate;
  composure: ComposureUpdate;
  weeklyProgress: WeeklyProgress;
}

export interface ComposureMetrics {
  score: number;
  deltaWeekly: number;
  currentStreakDays: number;
  bestStreakDays: number;
  weeklyTargetDays: number;
  weeklyCompletedDays: number;
  sevenDayPattern: boolean[];
}

export interface AthleteProgress extends ComposureMetrics {
  athleteId: string;
  athleteName: string;
  lastRep: {
    title: string;
    duration: string;
    completedAt: string;
    completedToday: boolean;
  };
  moodTrend: {
    status: string;
    subtitle: string;
    trendValues: number[];
  };
}

export interface CaregiverConversationStarter {
  id: string;
  category: string;
  prompt: string;
  guidance: string;
}

export interface CaregiverDashboardPayload {
  athlete: {
    id: string;
    name: string;
    program: string;
    status: "active" | "pending" | "unlinked";
  };
  weeklySummary: {
    headline: string;
    description: string;
    daysCompleted: number;
    daysTarget: number;
    sevenDayPattern: boolean[];
  };
  metrics: {
    moodTrend: {
      status: string;
      subtitle: string;
      trendData: number[];
    };
    composureScore: {
      value: number;
      changeWeekly: number;
    };
    currentStreak: {
      days: number;
      bestDays: number;
    };
    lastRep: {
      title: string;
      duration: string;
      completedAt: string;
      completedToday: boolean;
    };
  };
  conversationStarters: CaregiverConversationStarter[];
  privacyPolicyNotice: string;
}

export interface AgeGateRequest {
  birthDate: string;
  timezone: string;
  region?: string;
}

export interface AgeGateResponse {
  isMinor: boolean;
  status: AgeGateStatus;
  restrictedReason?: "guardian_consent_required" | "age_verification_required";
}

export interface PairingCodeResponse {
  pairingCode: string;
  expiresAt: string;
}

export interface PairingClaimRequest {
  pairingCode: string;
  relationship: PairingRelationship;
  consentConfirmed: boolean;
}

export interface PairingClaimResponse {
  linkId: string;
  status: Extract<PairingStatus, "pending_athlete_approval">;
  athlete: {
    id: string;
    displayName: string;
  };
}

export interface PairingApprovalRequest {
  approved: boolean;
}

export interface PairingApprovalResponse {
  linkId: string;
  status: Extract<PairingStatus, "active" | "revoked">;
  athleteApprovedAt?: string;
  revokedAt?: string;
}

export interface SessionRetrieveResponse {
  session: SessionPackage;
}

export interface PlaybackEventRequest {
  eventType: "start" | "heartbeat" | "pause" | "seek" | "finish";
  mode: BetaSessionMode;
  musicEnabled?: boolean;
  playbackPositionSeconds: number;
  clientTimestamp: string;
}

export interface CaregiverDashboardRequest {
  athleteId: string;
}
