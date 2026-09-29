import AsyncStorage from "@react-native-async-storage/async-storage";
import type { OnboardingPlan } from "../../../shared/onboarding";

/**
 * The athlete's onboarding answers. The API can't store these yet, so they
 * stay on this device per account (the web app does the same in the browser).
 */
const key = (userId: string) => `fearlessfootballer.plan.${userId}`;

export async function loadPlan(userId: string): Promise<OnboardingPlan | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? (JSON.parse(raw) as OnboardingPlan) : null;
  } catch {
    return null;
  }
}

export async function savePlan(userId: string, plan: OnboardingPlan): Promise<void> {
  await AsyncStorage.setItem(key(userId), JSON.stringify(plan));
}
