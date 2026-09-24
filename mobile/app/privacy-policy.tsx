import { useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../src/ui";
import { openPublicUrl, PRIVACY_POLICY_URL } from "../src/lib/privacyLinks";

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <Screen testID="privacy-policy-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Privacy"
        title="Privacy policy"
        copy="Fearless Footballer keeps athlete reflections private. Caregivers can see only aggregate progress after an athlete approves a consented link."
      />
      <StatusCard tone="info" title="What stays private">
        Reflections, notes, audio, transcripts, and playback details are not shared with caregivers.
      </StatusCard>
      <StatusCard tone="success" title="Caregiver view">
        Caregivers see progress patterns only. They cannot open a private reflection or control a session.
      </StatusCard>
      <Button
        label="Open the full privacy policy"
        onPress={() => openPublicUrl(PRIVACY_POLICY_URL, "the privacy policy")}
        disabled={!PRIVACY_POLICY_URL}
        accessibilityLabel="Open the full privacy policy"
      />
      <Button
        label="Terms of service"
        variant="secondary"
        onPress={() => router.push("/terms")}
        accessibilityLabel="Open terms of service"
      />
      <Button
        label="Back"
        variant="quiet"
        onPress={() => router.back()}
        accessibilityLabel="Back"
      />
      <PrivacyNotice />
    </Screen>
  );
}
