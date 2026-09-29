import { Text, View } from "react-native";
import { lastSevenDayLabels, programmeViews } from "../../../shared/training";
import { useAthleteData } from "../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../src/session";
import { LoadingRow, Screen, StatusCard, colors } from "../../src/ui";
import { hq } from "../../src/ui/hqStyles";
import { TabBar } from "../../src/ui/TabBar";

function ProgressContent() {
  const { library, progress, pendingCompletions, loading, error } = useAthleteData();
  const views = library && progress ? programmeViews(library, progress) : [];
  const dayLabels = lastSevenDayLabels();
  const sessionsDone = progress?.completedSessionIds?.length ?? 0;

  return (
    <Screen testID="athlete-progress-screen" footer={<TabBar active="progress" />}>
      <View style={hq.hello}>
        <Text style={hq.bigTitle} accessibilityRole="header">
          Your <Text style={hq.accent}>Progress</Text>
        </Text>
        <Text style={hq.method}>SEE | REHEARSE | BECOME</Text>
      </View>

      {pendingCompletions > 0 ? (
        <StatusCard tone="warning" title="Saved on this device">
          {pendingCompletions} completion{pendingCompletions === 1 ? "" : "s"} will sync when you reconnect.
        </StatusCard>
      ) : null}
      {error ? (
        <StatusCard tone="danger" title="Progress unavailable">
          {error}
        </StatusCard>
      ) : null}
      {loading && !progress ? <LoadingRow label="Loading your progress…" /> : null}

      {progress ? (
        <>
          <View style={styles.stats}>
            <View style={[hq.card, styles.stat]} accessibilityLabel={`Current streak ${progress.currentStreakDays} days`}>
              <Text style={styles.statGlyph}>🔥</Text>
              <Text style={styles.statValue}>{progress.currentStreakDays}</Text>
              <Text style={hq.eyebrow}>DAY STREAK</Text>
            </View>
            <View style={[hq.card, styles.stat]} accessibilityLabel={`Best streak ${progress.bestStreakDays} days`}>
              <Text style={styles.statGlyph}>🏆</Text>
              <Text style={styles.statValue}>{progress.bestStreakDays}</Text>
              <Text style={hq.eyebrow}>BEST STREAK</Text>
            </View>
          </View>

          <View style={hq.card}>
            <Text style={hq.eyebrow}>LAST 7 DAYS</Text>
            <Text style={hq.cardTitle}>
              {progress.weeklyCompletedDays} of {progress.weeklyTargetDays} days trained
            </Text>
            <View style={styles.week}>
              {progress.sevenDayPattern.map((done, index) => (
                <View key={index} style={hq.day}>
                  <View style={[styles.weekDot, done && hq.dayDotDone]} />
                  <Text style={[hq.dayLabel, done && hq.accent]}>{dayLabels[index]}</Text>
                </View>
              ))}
            </View>
            {progress.lastRep.completedAt ? (
              <Text style={[hq.small, styles.lastRep]}>
                Last rep: {progress.lastRep.title} · {progress.lastRep.duration}
              </Text>
            ) : null}
          </View>

          <View style={hq.card}>
            <Text style={hq.eyebrow}>SESSIONS COMPLETED</Text>
            <Text style={hq.cardTitle}>
              {sessionsDone} {sessionsDone === 1 ? "session" : "sessions"}
            </Text>
            {views.map((view) => (
              <View key={view.programme.slug} style={styles.programme}>
                <View style={hq.row}>
                  <Text style={styles.programmeTitle}>{view.programme.title}</Text>
                  <Text style={hq.meta}>
                    {view.completed}/{view.sessions.length}
                  </Text>
                </View>
                <View style={hq.barTrack}>
                  <View style={[hq.barFill, { width: `${(view.completed / view.sessions.length) * 100}%` }]} />
                </View>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  stats: { flexDirection: "row", gap: 10 },
  stat: { flex: 1, gap: 4 },
  statGlyph: { fontSize: 18 },
  statValue: { color: colors.white, fontSize: 34, fontWeight: "900" },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  weekDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(143, 176, 220, 0.4)" },
  lastRep: { marginTop: 14 },
  programme: { marginTop: 14 },
  programmeTitle: { color: colors.white, fontSize: 14, fontWeight: "800", flex: 1 },
} as const;

export default function AthleteProgressScreen() {
  return (
    <AthleteRouteGuard>
      <ProgressContent />
    </AthleteRouteGuard>
  );
}
