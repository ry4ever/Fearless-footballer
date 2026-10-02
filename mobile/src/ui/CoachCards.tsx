import { useCallback, useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import type { AthleteCoachLink, CaregiverCoachLink } from "../../../shared/types";
import { getApiFacade } from "../lib/apiFacade";
import { Button, StatusCard, colors } from "./index";
import { fonts } from "./fonts";
import { hq } from "./hqStyles";

const message = (caught: unknown, fallback: string) => (caught instanceof Error ? caught.message : fallback);

/**
 * "Your coach" in the athlete's More screen: join a squad with the coach's
 * code (a parent approves it), or remove the coach. Coaches see training
 * progress only, never reflections.
 */
export function AthleteCoachCard() {
  const api = getApiFacade({ role: "athlete" });
  const [coach, setCoach] = useState<AthleteCoachLink | null | undefined>(undefined);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getMyCoach().then(setCoach).catch(() => setCoach(null));
  }, []);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      setCoach(await api.joinSquad(code.trim()));
      setCode("");
    } catch (caught) {
      setError(message(caught, "Unable to send your request."));
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!coach) return;
    setBusy(true);
    setError(null);
    try {
      await api.leaveCoach(coach.id);
      setCoach(null);
      setConfirmLeave(false);
    } catch (caught) {
      setError(message(caught, "Unable to remove your coach."));
    } finally {
      setBusy(false);
    }
  }

  if (coach === undefined) return null;

  return (
    <View style={hq.card} testID="athlete-coach-card">
      <Text style={hq.eyebrow}>YOUR COACH</Text>
      {coach ? (
        <>
          <Text style={hq.cardTitle}>{coach.coachName}</Text>
          <Text style={styles.copy}>
            {coach.status === "active"
              ? "Your coach can see your training – sessions, weeks and areas – and can set your plan. Never your reflections."
              : "Waiting for your parent or guardian to approve. Once they do, your coach can see your training (never your reflections)."}
          </Text>
          {confirmLeave ? (
            <>
              <Button
                label={coach.status === "active" ? "Yes, remove my coach" : "Yes, cancel request"}
                variant="danger"
                loading={busy}
                onPress={leave}
              />
              <Button label="Keep" variant="quiet" onPress={() => setConfirmLeave(false)} />
            </>
          ) : (
            <Button
              label={coach.status === "active" ? "Remove coach" : "Cancel request"}
              variant="secondary"
              onPress={() => setConfirmLeave(true)}
            />
          )}
        </>
      ) : (
        <>
          <Text style={styles.copy}>Training with a coach? Enter their squad code. Your parent or guardian approves it first.</Text>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="SQUAD-…"
            placeholderTextColor={colors.muted}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel="Squad code"
            style={styles.input}
            testID="squad-code-input"
          />
          <Button label="Join squad" onPress={join} loading={busy} disabled={!code.trim()} testID="join-squad-button" />
        </>
      )}
      {error ? <StatusCard tone="danger" title="Couldn't update your coach">{error}</StatusCard> : null}
    </View>
  );
}

/**
 * Coach requests and coaches on the parent dashboard. A coach only sees the
 * player's training once approved here; the parent can remove them anytime.
 */
export function CaregiverCoachCard() {
  const api = getApiFacade({ role: "caregiver" });
  const [links, setLinks] = useState<CaregiverCoachLink[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.getCoachRequests().then(setLinks).catch(() => setLinks([]));
  }, []);
  useEffect(load, [load]);

  async function act(id: string, action: () => Promise<void>) {
    setBusyId(id);
    setError(null);
    try {
      await action();
      load();
    } catch (caught) {
      setError(message(caught, "Something went wrong. Please try again."));
    } finally {
      setBusyId(null);
    }
  }

  if (links.length === 0) return null;

  return (
    <View style={hq.card} testID="caregiver-coach-card">
      <Text style={hq.eyebrow}>COACH</Text>
      {links.map((link) => (
        <View key={link.id} style={styles.request}>
          <Text style={hq.cardTitle}>
            {link.status === "pending_parent" ? `${link.coachName} wants to coach ${link.athleteName}` : link.coachName}
          </Text>
          <Text style={styles.copy}>
            {link.status === "pending_parent"
              ? `If you approve, ${link.coachName} will see ${link.athleteName}'s training – sessions completed, weeks and areas worked on – and can set a plan of sessions. Never their reflections or notes.`
              : `Coaching ${link.athleteName}. Sees training progress and sets their plan – never reflections.`}
          </Text>
          {link.status === "pending_parent" ? (
            <>
              <Button
                label="Approve"
                loading={busyId === link.id}
                onPress={() => act(link.id, () => api.decideCoachRequest(link.id, true))}
                testID={`approve-coach-${link.id}`}
              />
              <Button
                label="Decline"
                variant="quiet"
                disabled={busyId === link.id}
                onPress={() => act(link.id, () => api.decideCoachRequest(link.id, false))}
              />
            </>
          ) : (
            <Button
              label="Remove coach"
              variant="danger"
              loading={busyId === link.id}
              onPress={() => act(link.id, () => api.removeCoach(link.id))}
            />
          )}
        </View>
      ))}
      {error ? <StatusCard tone="danger" title="Couldn't update the coach">{error}</StatusCard> : null}
    </View>
  );
}

const styles = {
  copy: { fontFamily: fonts.w400, color: "#B8C6DE", fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 12 },
  input: {
    minHeight: 48,
    marginBottom: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    color: colors.white,
    fontFamily: fonts.w600,
    fontSize: 16,
    letterSpacing: 1,
  },
  request: { marginTop: 4 },
} as const;
