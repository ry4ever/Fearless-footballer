import { Redirect, useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../../src/ui";
import { useSession } from "../../src/session";

export default function AthleteAgeGateScreen() {
  const router = useRouter();
  const { state } = useSession();
  const account = state?.currentUser;

  if (
    !account ||
    !state?.hasTokens ||
    account.role !== "athlete"
  ) {
    return <Redirect href="/athlete/register" />;
  }

  const pending =
    account.ageGateStatus === "pending_guardian_authorization";
  const restricted = account.ageGateStatus === "restricted";

  return (
    <Screen testID="athlete-age-gate-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Age and consent"
        title={
          restricted
            ? "We could not verify your age"
            : pending
              ? "Guardian authorization needed"
              : "Your account is ready"
        }
        copy={
          restricted
            ? "Use a valid date of birth to continue. Session access stays locked while this account is restricted."
            : pending
              ? "You can create a pairing code for a parent or guardian. Session access stays locked until they confirm consent and you approve the link."
              : "Your age gate is complete. Your one-session athlete home is ready."
        }
      />
      <StatusCard
        tone={restricted || pending ? "warning" : "success"}
        testID="age-gate-status"
      >
        {restricted
          ? "This account cannot open session content."
          : pending
            ? "Restricted until guardian consent and athlete approval are active."
            : "Age gate verified. You can open the one beta session."}
      </StatusCard>
      <Button
        label={restricted || pending ? "Open restricted state" : "Open athlete home"}
        onPress={() =>
          router.replace(
            restricted || pending ? "/athlete/restricted" : "/athlete/home",
          )
        }
        accessibilityLabel={
          restricted || pending ? "Open restricted state" : "Open athlete home"
        }
      />
      <PrivacyNotice />
    </Screen>
  );
}
