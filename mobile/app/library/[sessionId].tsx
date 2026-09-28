import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getApiFacade, LocalApiError } from "../../src/lib/apiFacade";
import {
  MODE_COPY,
  availableModes,
  formatMinutes,
  hasMusicChoice,
  pickVariant,
  versionQuery,
} from "../../src/lib/sessionVersions";
import { AthleteRouteGuard } from "../../src/session";
import { Brand, Button, ChoiceCard, PageTitle, PrivacyNotice, Screen, StatusCard, colors } from "../../src/ui";
import { Markdown } from "../../src/ui/SessionContent";
import type { SessionMode, SessionPackage } from "../../../shared/types";

function SessionDetailContent() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<SessionMode>("interactive");
  const [withMusic, setWithMusic] = useState(true);

  useEffect(() => {
    let mounted = true;
    getApiFacade({ role: "athlete" })
      .getSessionLibrary()
      .then((library) => {
        if (!mounted) return;
        const found = library.sessions.find((item) => item.id === sessionId) ?? null;
        setSession(found);
        if (found) setMode(availableModes(found)[0] ?? "interactive");
        if (!found) setError("This session isn't available.");
      })
      .catch((caught) => {
        if (mounted) setError(caught instanceof LocalApiError ? caught.message : "Unable to load this session.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [sessionId]);

  if (loading) {
    return (
      <Screen>
        <StatusCard tone="info" title="Loading session">
          Getting the details ready…
        </StatusCard>
      </Screen>
    );
  }
  if (error || !session) {
    return (
      <Screen>
        <StatusCard tone="danger" title="Session unavailable">
          {error ?? "This session isn't available."}
        </StatusCard>
        <Button label="Back to athlete home" onPress={() => router.replace("/athlete/home")} />
      </Screen>
    );
  }

  const modes = availableModes(session);
  const chosen = pickVariant(session, mode, withMusic);
  const start = () => router.push(`/session/${session.id}${versionQuery(chosen)}`);

  return (
    <Screen testID="session-detail-screen">
      <Brand compact />
      <Button label="← Athlete home" variant="quiet" onPress={() => router.back()} />
      <PageTitle
        eyebrow={session.focusArea ?? "Off-pitch training"}
        title={session.title}
        copy={`With ${session.mentor.name} · ${session.mentor.title}`}
      />

      {session.comingSoon ? (
        <StatusCard tone="info" title="Coming soon">
          This session is being recorded. You can read about it below.
        </StatusCard>
      ) : modes.length > 0 ? (
        <View style={styles.picker}>
          <Text style={styles.eyebrow}>CHOOSE YOUR VERSION</Text>
          {modes.map((item) => {
            const variant = pickVariant(session, item, withMusic);
            return (
              <ChoiceCard
                key={item}
                title={`${MODE_COPY[item].label}${variant ? ` · ${formatMinutes(variant.durationSeconds)}` : ""}`}
                description={MODE_COPY[item].detail}
                selected={mode === item}
                onPress={() => setMode(item)}
                testID={`version-${item}`}
              />
            );
          })}
          {hasMusicChoice(session, mode) ? (
            <ChoiceCard
              title={withMusic ? "Music on" : "Music off"}
              description="Tap to switch. The recordings with and without music differ slightly in length."
              selected={withMusic}
              onPress={() => setWithMusic((value) => !value)}
              accessibilityLabel={`Music ${withMusic ? "on" : "off"}. Tap to switch.`}
              testID="music-toggle"
            />
          ) : null}
          <Button
            label={chosen ? `Start · ${formatMinutes(chosen.durationSeconds)}` : "Start"}
            disabled={!chosen}
            onPress={start}
            testID="start-session-button"
          />
        </View>
      ) : (
        <Button label="Start training session" onPress={start} testID="start-session-button" />
      )}

      {session.descriptionMarkdown ? (
        <View style={styles.description}>
          <Markdown source={session.descriptionMarkdown} />
        </View>
      ) : null}
      <PrivacyNotice />
    </Screen>
  );
}

export default function SessionDetailScreen() {
  return (
    <AthleteRouteGuard>
      <SessionDetailContent />
    </AthleteRouteGuard>
  );
}

const styles = {
  picker: { gap: 10, marginBottom: 18 },
  eyebrow: { color: colors.cyan, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  description: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
} as const;
