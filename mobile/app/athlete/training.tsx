import { Image, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { programmePhoto } from "../../../shared/onboarding";
import { programmeViews } from "../../../shared/training";
import type { SessionPackage } from "../../../shared/types";
import { useAthleteData } from "../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../src/session";
import { LoadingRow, Screen, StatusCard, colors } from "../../src/ui";
import { hq } from "../../src/ui/hqStyles";
import { photos } from "../../src/ui/photos";
import { SessionRow } from "../../src/ui/SessionContent";
import { TabBar } from "../../src/ui/TabBar";
import { fonts } from "../../src/ui/fonts";

function TrainingContent() {
  const router = useRouter();
  const { library, progress, pendingCompletions, loading, error } = useAthleteData();
  const sessions = library?.sessions ?? [];
  const views = library && progress ? programmeViews(library, progress) : [];
  const done = new Set(progress?.completedSessionIds ?? []);
  const playable = sessions.filter((item) => !item.comingSoon);
  const comingSoon = sessions.filter((item) => item.comingSoon);
  const groups = new Map<string, SessionPackage[]>();
  for (const item of playable) {
    const key = item.focusArea ?? "Sessions";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  const openSession = (item: SessionPackage) => router.push(`/session/${item.id}`);

  return (
    <Screen testID="athlete-training-screen" footer={<TabBar active="training" />}>
      <View style={hq.hello}>
        <Text style={hq.bigTitle} accessibilityRole="header">
          Your <Text style={hq.accent}>Training</Text>
        </Text>
        <Text style={hq.method}>SEE | REHEARSE | BECOME</Text>
      </View>

      {pendingCompletions > 0 ? (
        <StatusCard tone="warning" title="Saved on this device">
          {pendingCompletions} completion{pendingCompletions === 1 ? "" : "s"} will sync when you reconnect.
        </StatusCard>
      ) : null}
      {error ? (
        <StatusCard tone="danger" title="Session unavailable">
          {error}
        </StatusCard>
      ) : null}
      {loading && !library ? <LoadingRow label="Loading your training…" /> : null}

      {views.map((view) => (
        <View key={view.programme.slug} style={hq.card} testID={`programme-${view.programme.slug}`}>
          <View style={[hq.banner, styles.hero]}>
            <Image source={photos[programmePhoto(view.programme.slug)]} style={hq.bannerPhoto} resizeMode="cover" />
            <View style={hq.bannerShade} />
            <View style={styles.heroText}>
              <Text style={hq.eyebrow}>PROGRAMME</Text>
              <Text style={styles.title}>{view.programme.title}</Text>
            </View>
          </View>
          <View style={styles.head}>
            <View style={styles.headText}>
              <View style={hq.barTrack}>
                <View style={[hq.barFill, { width: `${(view.completed / view.sessions.length) * 100}%` }]} />
              </View>
              <Text style={hq.small}>
                {view.completed} of {view.sessions.length} sessions
              </Text>
            </View>
          </View>
          <Text style={styles.copy}>{view.programme.description}</Text>
          {view.sessions.map((item, index) => (
            <SessionRow key={item.id} session={item} index={index + 1} done={done.has(item.id)} onPress={() => openSession(item)} />
          ))}
        </View>
      ))}

      {!loading && !error && playable.length === 0 ? (
        <StatusCard tone="info" title="No session available yet">
          New training is on its way. Check back soon — your progress is saved.
        </StatusCard>
      ) : null}

      {playable.length > 0 ? (
        <View style={styles.section} testID="all-sessions">
          <Text style={hq.eyebrow}>ALL SESSIONS</Text>
          {Array.from(groups.entries()).map(([group, items]) => (
            <View key={group}>
              <Text style={styles.groupLabel}>{group}</Text>
              {items.map((item) => (
                <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
              ))}
            </View>
          ))}
        </View>
      ) : null}

      {comingSoon.length > 0 ? (
        <View style={styles.section} testID="coming-soon">
          <Text style={[hq.eyebrow, styles.sectionLabel]}>COMING SOON</Text>
          {comingSoon.map((item) => (
            <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = {
  hero: { height: 180, marginTop: -16, marginHorizontal: -16, borderRadius: 0 },
  heroText: { position: "absolute", left: 16, right: 16, bottom: 14 },
  head: { marginTop: 10, marginBottom: 12 },
  headText: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.w900, color: colors.white, fontSize: 22, marginTop: 4 },
  copy: { fontFamily: fonts.w400, color: "#B8C6DE", fontSize: 14, lineHeight: 21, marginBottom: 12 },
  section: { marginTop: 6, marginBottom: 14 },
  sectionLabel: { marginBottom: 8 },
  groupLabel: { fontFamily: fonts.w800, color: "#A4B6D4", fontSize: 13, marginTop: 12, marginBottom: 8 },
} as const;

export default function AthleteTrainingScreen() {
  return (
    <AthleteRouteGuard>
      <TrainingContent />
    </AthleteRouteGuard>
  );
}
