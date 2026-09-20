import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { createPairingCode } from "../../src/lib/localBetaApi";
import { AthleteAccountGuard, useSession } from "../../src/session";
import {
  Brand,
  Button,
  PageTitle,
  PairingCodeDisplay,
  PrivacyNotice,
  Screen,
  StatusCard,
} from "../../src/ui";

function PairingCodeContent() {
  const router = useRouter();
  const { state, refresh } = useSession();
  const [pairingCode, setPairingCode] = useState(state?.pairingCode);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function generateCode() {
    setError("");
    setLoading(true);
    try {
      const code = await createPairingCode();
      await refresh();
      setPairingCode({
        code: code.pairingCode,
        expiresAt: code.expiresAt,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create a pairing code.");
    } finally {
      setLoading(false);
    }
  }

  const pending = state?.pairing?.status === "pending_athlete_approval";
  const active = state?.pairing?.status === "active";

  if (active) {
    return (
      <Screen testID="pairing-code-screen">
        <Brand compact />
        <PageTitle
          eyebrow="Caregiver link"
          title="Your caregiver link is active"
          copy="This athlete account already has an approved parent or guardian relationship. No new code is needed."
        />
        <StatusCard tone="success" title="Active relationship">
          The caregiver dashboard is available while this relationship remains active and consented.
        </StatusCard>
        <Button
          label="Open athlete home"
          onPress={() => router.replace("/athlete/home")}
          accessibilityLabel="Open athlete home"
        />
        <Button
          label="Review pairing"
          variant="secondary"
          onPress={() => router.replace("/pairing/approval")}
          accessibilityLabel="Review caregiver pairing"
        />
        <PrivacyNotice />
      </Screen>
    );
  }

  return (
    <Screen testID="pairing-code-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Pair athlete account"
        title="Create a short-lived pairing code"
        copy="Share this code only with the parent or guardian you want to connect. They must confirm consent, and you must approve the relationship."
      />
      {pending ? (
        <StatusCard tone="warning" title="Pending approval">
          A caregiver has claimed the current code. Review the relationship before creating another one.
        </StatusCard>
      ) : null}
      {pairingCode ? (
        <PairingCodeDisplay
          code={pairingCode.code}
          expiresAt={pairingCode.expiresAt}
          testID="pairing-code-display"
        />
      ) : null}
      {error ? (
        <StatusCard tone="danger" title="Pairing code unavailable">
          {error}
        </StatusCard>
      ) : null}
      <Button
        label={pairingCode ? "Refresh pairing code" : "Generate pairing code"}
        onPress={generateCode}
        loading={loading}
        disabled={pending}
        accessibilityLabel={
          pairingCode ? "Refresh pairing code" : "Generate pairing code"
        }
      />
      {pending ? (
        <Button
          label="Review pending relationship"
          variant="secondary"
          onPress={() => router.replace("/pairing/approval")}
          accessibilityLabel="Review pending caregiver relationship"
        />
      ) : (
        <Button
          label="Back to restricted state"
          variant="quiet"
          onPress={() => router.replace("/athlete/restricted")}
          accessibilityLabel="Back to restricted state"
        />
      )}
      <PrivacyNotice />
    </Screen>
  );
}

export default function PairingCodeScreen() {
  return (
    <AthleteAccountGuard>
      <PairingCodeContent />
    </AthleteAccountGuard>
  );
}
