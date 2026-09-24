import { useRouter } from "expo-router";
import { Brand, Button, ChoiceCard, PageTitle, PrivacyNotice, Screen } from "../src/ui";
import { useSession } from "../src/session";
import { canAthleteAccessSession, canCaregiverAccessDashboard } from "../src/lib/sessionGuard";

export default function RoleScreen() {
  const router = useRouter();
  const { state, switchRole, signOut } = useSession();

  async function continueAs(role: "athlete" | "caregiver") {
    if (!state?.hasTokens) {
      router.replace(role === "athlete" ? "/athlete/register" : "/caregiver/register");
      return;
    }
    const nextState = await switchRole(role);
    if (role === "athlete") {
      const athlete = nextState.athleteAccount;
      router.replace(
        athlete && canAthleteAccessSession(athlete, nextState.pairing)
          ? "/athlete/home"
          : "/athlete/restricted",
      );
      return;
    }
    const caregiver = nextState.caregiverAccount;
    router.replace(
      caregiver && canCaregiverAccessDashboard(caregiver, nextState.pairing)
        ? "/caregiver/dashboard"
        : "/caregiver/unlinked",
    );
  }

  return (
    <Screen tone="soft" testID="role-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Choose your role"
        title="Who is this account for?"
        copy="The athlete owns private reflections. A caregiver can see only aggregate progress after a one-to-one consent link is approved."
      />
      {state?.athleteAccount ? (
        <Button
          label={`${state.hasTokens ? "Continue" : "Sign in"} as athlete · ${state.athleteAccount.displayName}`}
          onPress={() => continueAs("athlete")}
          accessibilityLabel={`${state.hasTokens ? "Continue" : "Sign in"} as athlete ${state.athleteAccount.displayName}`}
        />
      ) : (
        <ChoiceCard
          title="I am an athlete"
          description="Complete the age gate and create your private rehearsal account."
          onPress={() => router.push("/athlete/register")}
          testID="athlete-role-button"
        />
      )}
      {state?.caregiverAccount ? (
        <Button
          label={`${state.hasTokens ? "Continue" : "Sign in"} as caregiver · ${state.caregiverAccount.displayName}`}
          onPress={() => continueAs("caregiver")}
          accessibilityLabel={`${state.hasTokens ? "Continue" : "Sign in"} as caregiver ${state.caregiverAccount.displayName}`}
        />
      ) : (
        <ChoiceCard
          title="I am a caregiver"
          description="Claim an athlete pairing code and request read-only progress access."
          onPress={() => router.push("/caregiver/register")}
          testID="caregiver-role-button"
        />
      )}
      {state?.athleteAccount || state?.caregiverAccount ? (
        <Button
          label="Sign out"
          variant="quiet"
          onPress={signOut}
          accessibilityLabel="Sign out of this device"
        />
      ) : (
        <Button
          label="Back"
          variant="quiet"
          onPress={() => router.replace("/welcome")}
          accessibilityLabel="Back to welcome"
        />
      )}
      <Button
        label="Privacy policy"
        variant="quiet"
        onPress={() => router.push("/privacy-policy")}
        accessibilityLabel="Open privacy policy"
      />
      <PrivacyNotice compact />
    </Screen>
  );
}
