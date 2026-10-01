import type { OnboardingPlan } from "../screens/OnboardingScreen";

/**
 * The athlete's onboarding answers. The API can't store these yet, so they
 * live in this browser per account until the profile endpoint exists.
 */
const key = (userId: string) => `fearless_plan_${userId}`;

export function loadPlan(userId: string): OnboardingPlan | null {
  try {
    const raw = localStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as OnboardingPlan) : null;
  } catch {
    return null;
  }
}

export function savePlan(userId: string, plan: OnboardingPlan) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(plan));
  } catch {
    // Storage unavailable: onboarding will show again next visit.
  }
}

/** Records the programme the player chose on the Training tab. */
export function chooseProgramme(userId: string, programme: string) {
  const plan = loadPlan(userId);
  if (plan) savePlan(userId, { ...plan, programme });
}
