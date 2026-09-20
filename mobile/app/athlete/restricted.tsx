import { Redirect, useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../../src/ui";
import { useSession } from "../../src/session";

export default function AthleteRestrictedScreen() {
  const router = useRouter();
  const { state } = useSession();
  const account = state?.athleteAccount;

  if (!account || !state?.hasTokens || account.role !== "athlete") {
    return <Redirect href="/athlete/register" />;
  }

  const pending = state?.pairing?.status === "pending_athlete_approval";
  const active = state?.pairing?.status === "active";

  return (
    <Screen testID="athlete-restricted-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Session access locked"
        title={active ? "Finish pairing management" : "Finish the consent link first"}
        copy={
          active
            ? "Your caregiver relationship is active. You can return to your one-session home or manage the link."
            : "This is a safeguarding boundary, not a penalty. A parent or guardian must confirm consent, and you must approve the relationship before the session opens."
        }
      />
      <StatusCard tone={pending ? "warning" : "danger"} testID="restricted-status">
        {pending
          ? "A caregiver has claimed your code. Review the relationship and approve it to continue."
          : active
            ? "The caregiver link is active, but this account is not currently authorized for session content."
            : "No active caregiver relationship is approved for this athlete account."}
      </StatusCard>
      {pending ? (
        <Button
          label="Review pairing"
          onPress={() => router.replace("/pairing/approval")}
          accessibilityLabel="Review pending caregiver pairing"
        />
      ) : (
        <Button
          label="Create pairing code"
          onPress={() => router.replace("/pairing/code")}
          accessibilityLabel="Create athlete pairing code"
        />
      )}
      {active ? (
        <Button
          label="Open athlete home"
          variant="secondary"
          onPress={() => router.replace("/athlete/home")}
          accessibilityLabel="Open athlete home"
        />
      ) : null}
      <PrivacyNotice />
    </Screen>
  );
}
