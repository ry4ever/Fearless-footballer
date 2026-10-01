import { Image, Text, View } from "react-native";
import { lastSevenDayLabels } from "../../../shared/training";
import { useAthleteData } from "../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../src/session";
import { LoadingRow, Screen, StatusCard, colors } from "../../src/ui";
import { fonts } from "../../src/ui/fonts";
import { hq } from "../../src/ui/hqStyles";
import { photos } from "../../src/ui/photos";
import { TabBar } from "../../src/ui/TabBar";

const plural = (count: number, one: string, many: string) => (count === 1 ? one : many);

/**
 * Progress as football development: training completed and areas worked on
 * come first. Streaks stay, but further down – they're a habit, not the goal.
 */
function ProgressContent() {
  const { progress, pendingCompletions, loading, error } = useAthleteData();
  const dayLabels = lastSevenDayLabels();
  const total = progress?.totalCompletions ?? 0;
  const weeks = progress?.consecutiveWeeks ?? 0;
  const areas = progress?.completionsByArea ?? [];
  const topArea = areas[0]?.count ?? 1;

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
          <View style={[hq.card, styles.hero]} accessibilityLabel={`${total} Off-Pitch Training sessions completed`}>
            <Image source={photos.stadium} style={styles.heroPhoto} resizeMode="cover" />
            <View style={styles.heroShade} />
            <View style={styles.heroBody}>
              <Text style={styles.big}>{total}</Text>
              <Text style={styles.heroLabel}>Off-Pitch Training {plural(total, "session", "sessions")} completed</Text>
              {total === 0 ? <Text style={styles.note}>Your first session starts your development record.</Text> : null}
            </View>
          </View>

          <View style={[hq.card, styles.weeks]} accessibilityLabel={`${weeks} weeks training consistently`}>
            <Text style={styles.mid}>{weeks}</Text>
            <View style={styles.weeksText}>
              <Text style={styles.weeksLabel}>{plural(weeks, "week", "weeks")} training consistently</Text>
              <Text style={hq.small}>At least one session every week, Monday to Sunday.</Text>
            </View>
          </View>

          <View style={hq.card}>
            <Text style={hq.eyebrow}>AREAS YOU'VE WORKED ON</Text>
            {areas.length === 0 ? (
              <Text style={styles.note}>Complete a session to see the parts of your game you're building.</Text>
            ) : (
              areas.map(({ area, count }) => (
                <View key={area} style={styles.area}>
                  <View style={hq.row}>
                    <Text style={styles.areaTitle}>{area}</Text>
                    <Text style={hq.meta}>
                      {count} {plural(count, "session", "sessions")}
                    </Text>
                  </View>
                  <View style={hq.barTrack}>
                    <View style={[hq.barFill, { width: `${(count / topArea) * 100}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>


          <View style={[hq.card, styles.habit]}>
            <Text style={hq.eyebrow}>TRAINING HABIT</Text>
            <View style={styles.habitRow}>
              <Text style={styles.habitText}>
                Streak <Text style={styles.habitValue}>{progress.currentStreakDays}</Text>{" "}
                {plural(progress.currentStreakDays, "day", "days")}
              </Text>
              <Text style={styles.habitText}>
                Best <Text style={styles.habitValue}>{progress.bestStreakDays}</Text>{" "}
                {plural(progress.bestStreakDays, "day", "days")}
              </Text>
            </View>
            <View style={styles.week} accessibilityLabel={`${progress.weeklyCompletedDays} of the last 7 days trained`}>
              {progress.sevenDayPattern.map((done, index) => (
                <View key={index} style={hq.day}>
                  <View style={[styles.weekDot, done && hq.dayDotDone]} />
                  <Text style={[hq.dayLabel, done && hq.accent]}>{dayLabels[index]}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  hero: { minHeight: 170, padding: 0, borderColor: "rgba(105, 224, 250, 0.5)" },
  heroPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  heroShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(5, 10, 25, 0.6)" },
  heroBody: { padding: 20, maxWidth: "80%", gap: 4 },
  big: { fontFamily: fonts.w900, color: colors.cyan, fontSize: 60, lineHeight: 64 },
  heroLabel: { fontFamily: fonts.w800, color: colors.white, fontSize: 17, lineHeight: 21 },
  note: { fontFamily: fonts.w400, color: "#A4B6D4", fontSize: 13, lineHeight: 19, marginTop: 8 },
  weeks: { flexDirection: "row", alignItems: "center", gap: 16 },
  mid: { fontFamily: fonts.w900, color: colors.cyan, fontSize: 44, lineHeight: 48 },
  weeksText: { flex: 1 },
  weeksLabel: { fontFamily: fonts.w800, color: colors.white, fontSize: 16 },
  area: { marginTop: 14 },
  areaTitle: { fontFamily: fonts.w800, color: colors.white, fontSize: 14, flex: 1 },
  habit: { backgroundColor: "rgba(11, 22, 53, 0.6)", borderColor: "rgba(143, 176, 220, 0.14)" },
  habitRow: { flexDirection: "row", gap: 20, marginTop: 10 },
  habitText: { fontFamily: fonts.w500, color: "#A4B6D4", fontSize: 13 },
  habitValue: { fontFamily: fonts.w800, color: colors.white, fontSize: 16 },
  week: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  weekDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "rgba(143, 176, 220, 0.4)" },
} as const;

export default function AthleteProgressScreen() {
  return (
    <AthleteRouteGuard>
      <ProgressContent />
    </AthleteRouteGuard>
  );
}
