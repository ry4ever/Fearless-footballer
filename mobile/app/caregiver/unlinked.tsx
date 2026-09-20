import { useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../../src/ui";
import { CaregiverAccountGuard, useSession } from "../../src/session";

function CaregiverUnlinkedContent() {
  const router = useRouter();
  const { state, signOut, switchRole } = useSession();
  const pairing = state?.pairing;
  const pending = pairing?.status === "pending_athlete_approval";
  const revoked = pairing?.status === "revoked";

  return (
    <Screen testID="caregiver-unlinked-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Caregiver access"
        title={revoked ? "Access has been revoked" : pending ? "Waiting for athlete approval" : "Dashboard access is locked"}
        copy={
          revoked
            ? "The athlete controls this relationship. Dashboard access ends immediately when a link is revoked."
            : pending
              ? "The athlete has not approved this parent or guardian relationship yet. Switch accounts to review the request."
              : "Create or sign in to your caregiver account, then claim the athlete's short-lived pairing code."
        }
      />
      <StatusCard
        tone={revoked ? "danger" : pending ? "warning" : "danger"}
        title={revoked ? "Revoked" : pending ? "Pending athlete approval" : "No active link"}
      >
        {revoked
          ? "This caregiver can no longer open the dashboard."
          : pending
            ? "Approval is required before any aggregate progress is visible."
            : "A pairing code and explicit athlete approval are required."}
      </StatusCard>
      {pending ? (
        <Button
          label="Switch to athlete account"
          onPress={async () => {
            await switchRole("athlete");
            router.replace("/pairing/approval");
          }}
          accessibilityLabel="Switch to athlete account for pairing approval"
        />
      ) : (
        <Button
          label="Claim a pairing code"
          onPress={() => router.replace("/pairing/claim")}
          accessibilityLabel="Open pairing code claim"
        />
      )}
      <Button
        label="Back to caregiver account"
        variant="quiet"
        onPress={() => router.replace("/caregiver/register")}
        accessibilityLabel="Back to caregiver account"
      />
      <Button
        label="Sign out"
        variant="quiet"
        onPress={async () => {
          await signOut();
          router.replace("/welcome");
        }}
        accessibilityLabel="Sign out of this device"
      />
      <PrivacyNotice />
    </Screen>
  );
}

export default function CaregiverUnlinkedScreen() {
  return (
    <CaregiverAccountGuard>
      <CaregiverUnlinkedContent />
    </CaregiverAccountGuard>
  );
}
