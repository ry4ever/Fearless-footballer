import { useState } from "react";
import { Redirect, useRouter } from "expo-router";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import { AthleteAccountGuard, useSession } from "../../src/session";
import {
  Brand,
  Button,
  PageTitle,
  PrivacyNotice,
  Screen,
  StatusCard,
} from "../../src/ui";

function PairingApprovalContent() {
  const router = useRouter();
  const { state, refresh } = useSession();
  const api = getApiFacade({ role: "athlete" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pairing = state?.pairing;

  async function decide(approved: boolean) {
    if (!pairing) return;
    setError("");
    setLoading(true);
    try {
      await api.approvePairing(pairing.id, { approved });
      await refresh();
      router.replace(approved ? "/athlete/home" : "/athlete/restricted");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the relationship.");
    } finally {
      setLoading(false);
    }
  }

  async function revoke() {
    if (!pairing) return;
    setError("");
    setLoading(true);
    try {
      await api.revokePairing(pairing.id);
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to revoke caregiver access.");
    } finally {
      setLoading(false);
    }
  }

  if (!pairing) {
    return <Redirect href="/athlete/restricted" />;
  }

  const caregiverName = state.caregiverAccount?.displayName;
  const relationship = pairing.relationship;

  return (
    <Screen testID="pairing-approval-screen">
      <Brand compact />
      <PageTitle
        eyebrow="Athlete approval"
        title={
          pairing.status === "active"
            ? "Caregiver access is active"
            : pairing.status === "revoked"
              ? "Caregiver access is revoked"
              : "Review this caregiver request"
        }
        copy={
          pairing.status === "active"
            ? "You can revoke access at any time. Revocation immediately blocks the caregiver dashboard."
            : pairing.status === "revoked"
              ? "This relationship no longer provides caregiver dashboard access."
              : "Choose whether this parent or guardian can see aggregate progress patterns."
        }
      />
      <StatusCard
        tone={
          pairing.status === "active"
            ? "success"
            : pairing.status === "revoked"
              ? "danger"
              : "warning"
        }
        title={
          pairing.status === "active"
            ? "Active"
            : pairing.status === "revoked"
              ? "Revoked"
              : "Pending athlete approval"
        }
      >
        {caregiverName
          ? `${caregiverName} requested access as ${relationship}.`
          : `A caregiver requested access as ${relationship}.`}
      </StatusCard>
      {error ? (
        <StatusCard tone="danger" title="Unable to update relationship">
          {error}
        </StatusCard>
      ) : null}
      {pairing.status === "pending_athlete_approval" ? (
        <>
          <Button
            label="Approve caregiver access"
            onPress={() => decide(true)}
            loading={loading}
            accessibilityLabel="Approve caregiver access"
          />
          <Button
            label="Not now"
            variant="secondary"
            onPress={() => decide(false)}
            loading={loading}
            accessibilityLabel="Reject caregiver access for now"
          />
        </>
      ) : null}
      {pairing.status === "active" ? (
        <Button
          label="Revoke caregiver access"
          variant="danger"
          onPress={revoke}
          loading={loading}
          accessibilityLabel="Revoke caregiver access"
        />
      ) : null}
      <Button
        label={pairing.status === "active" ? "Open athlete home" : "Back to restricted state"}
        variant="quiet"
        onPress={() =>
          router.replace(
            pairing.status === "active" ? "/athlete/home" : "/athlete/restricted",
          )
        }
        accessibilityLabel={
          pairing.status === "active" ? "Open athlete home" : "Back to restricted state"
        }
      />
      <PrivacyNotice />
    </Screen>
  );
}

export default function PairingApprovalScreen() {
  return (
    <AthleteAccountGuard>
      <PairingApprovalContent />
    </AthleteAccountGuard>
  );
}
