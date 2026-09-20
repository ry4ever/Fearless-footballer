import { useRouter } from "expo-router";
import { Brand, Button, PageTitle, PrivacyNotice, Screen } from "../src/ui";

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <Screen testID="welcome-screen">
      <Brand />
      <PageTitle
        eyebrow="Beta 0.1 · Mobile first"
        title="A private rehearsal space for young footballers."
        copy="Build composure through one focused session at a time. Athletes keep reflections private; caregivers see only consented progress patterns."
      />
      <Button
        label="Get started"
        onPress={() => router.push("/role")}
        accessibilityLabel="Get started"
        testID="get-started-button"
      />
      <PrivacyNotice />
    </Screen>
  );
}
