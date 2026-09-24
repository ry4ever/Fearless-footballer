import { useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen, StatusCard } from "../src/ui";
import { openPublicUrl, TERMS_URL } from "../src/lib/privacyLinks";

export default function TermsScreen() {
  const router = useRouter();

  return (
    <Screen testID="terms-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Account terms"
        title="Terms of service"
        copy="Use Fearless Footballer as a personal composure rehearsal tool. Account and caregiver access remain subject to the consent choices recorded in the service."
      />
      <StatusCard tone="info" title="Your choices">
        You can sign out at any time, revoke an active caregiver link, or request permanent account deletion from account settings.
      </StatusCard>
      <StatusCard tone="warning" title="Deletion">
        Account deletion removes the account and dependent athlete, reflection, and pairing data. A minimized anonymized deletion audit record is retained.
      </StatusCard>
      <Button
        label="Open the full terms"
        onPress={() => openPublicUrl(TERMS_URL, "the terms of service")}
        disabled={!TERMS_URL}
        accessibilityLabel="Open the full terms of service"
      />
      <Button
        label="Privacy policy"
        variant="secondary"
        onPress={() => router.push("/privacy-policy")}
        accessibilityLabel="Open privacy policy"
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
