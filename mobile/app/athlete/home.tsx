import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import { programmePhoto } from "../../../shared/onboarding";
import { sessionPhoto } from "../../../shared/player";
import {
  currentProgramme,
  firstName,
  greetingFor,
  lastSevenDayLabels,
  nextSession,
  programmeViews,
} from "../../../shared/training";
import type { SessionPackage } from "../../../shared/types";
import { useAthleteData } from "../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../src/session";
import { LoadingRow, Screen, StatusCard, Wordmark, colors } from "../../src/ui";
import { hq } from "../../src/ui/hqStyles";
import { photos } from "../../src/ui/photos";
import { TabBar } from "../../src/ui/TabBar";
import { fonts } from "../../src/ui/fonts";

function AthleteHomeContent() {
  const router = useRouter();
  const { account, library, progress, plan, pendingCompletions, loading, error } = useAthleteData();
  const [showNotifications, setShowNotifications] = useState(false);

  // No plan saved on this device yet: onboarding first.
  if (plan === null) return <Redirect href="/athlete/onboarding" />;

  const name = firstName(progress?.athleteName ?? account?.displayName);
  const views = library ? programmeViews(library) : [];
  const programme = currentProgramme(views, plan ?? null);
  const today = programme && progress ? nextSession(programme, progress) : null;
  const todaySession = today?.session ?? library?.sessions.find((item) => !item.comingSoon);
  const dayLabels = lastSevenDayLabels();
  // A session opens straight into the player; the version is chosen there.
  const openSession = (item: SessionPackage) => router.push(`/session/${item.id}`);

  return (
    <Screen testID="athlete-home-screen" footer={<TabBar active="home" />}>
      <View style={styles.header}>
        <Wordmark />
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Notifications"
            onPress={() => setShowNotifications((open) => !open)}
            style={styles.iconButton}
          >
            <Text style={styles.iconGlyph}>🔔</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Your account"
            onPress={() => router.replace("/athlete/settings")}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </Pressable>
        </View>
      </View>
      {showNotifications ? <Text style={styles.popover}>You're all caught up.</Text> : null}

      <View style={hq.hello}>
        <Text style={hq.helloLine}>
          {greetingFor()}, {name}.
        </Text>
        <Text style={hq.bigTitle} accessibilityRole="header">
          Fearless <Text style={hq.accent}>HQ</Text>
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

      {plan ? (
        <View style={[hq.card, styles.focus]} accessibilityLabel={`Your current focus: ${plan.goal}`}>
          <Image source={photos.ball} style={styles.focusPhoto} resizeMode="cover" />
          <View style={styles.focusText}>
            <Text style={hq.eyebrow}>YOUR CURRENT FOCUS</Text>
            <Text style={hq.cardTitle}>{plan.goal}</Text>
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Current streak ${progress?.currentStreakDays ?? 0} days. See your progress`}
        onPress={() => router.replace("/athlete/progress")}
        style={({ pressed }) => [hq.card, styles.streak, pressed && hq.pressed]}
        testID="streak-card"
      >
        <View style={styles.flame}>
          <Text style={styles.flameGlyph}>🔥</Text>
        </View>
        <View>
          <Text style={hq.eyebrow}>CURRENT STREAK</Text>
          <Text style={styles.streakValue}>
            {progress?.currentStreakDays ?? 0} {progress?.currentStreakDays === 1 ? "day" : "days"}
          </Text>
        </View>
        <View style={hq.days}>
          {(progress?.sevenDayPattern ?? Array(7).fill(false)).map((done: boolean, index: number) => (
            <View key={index} style={hq.day}>
              <View style={[hq.dayDot, done && hq.dayDotDone]} />
              <Text style={[hq.dayLabel, done && hq.accent]}>{dayLabels[index]}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {loading && !library ? <LoadingRow label="Loading your training…" /> : null}

      {todaySession ? (
        <View style={[hq.card, styles.today]} testID="todays-training">
          <Image source={photos[sessionPhoto(todaySession)]} style={styles.todayPhoto} resizeMode="cover" />
          <View style={styles.todayShade} />
          <View style={styles.todayBody}>
            <View style={hq.row}>
              <Text style={hq.eyebrow}>TODAY'S TRAINING</Text>
            </View>
            <Text style={styles.todayTitle}>{todaySession.title}</Text>
            <View style={[hq.row, styles.todayFoot]}>
              <Text style={hq.meta}>
                {todaySession.focusArea ? `${todaySession.focusArea.toUpperCase()} · ` : ""}VISUALISATION
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Play ${todaySession.title}`}
                onPress={() => openSession(todaySession)}
                style={({ pressed }) => [styles.play, pressed && hq.pressed]}
                testID="play-todays-training"
              >
                <Text style={styles.playGlyph}>▶</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : !loading && !error ? (
        <StatusCard tone="info" title="No session available yet">
          New training is on its way. Check back soon — your progress is saved.
        </StatusCard>
      ) : null}

      {programme ? (
        <View style={hq.card} testID="your-programme">
          <View style={hq.row}>
            <Text style={hq.eyebrow}>YOUR PROGRAMME</Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace("/athlete/training")} hitSlop={8}>
              <Text style={hq.link}>Change →</Text>
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${programme.programme.title}. Open the programme`}
            onPress={() => router.push(`/athlete/programme/${programme.programme.slug}`)}
            style={({ pressed }) => [styles.programme, pressed && hq.pressed]}
            testID={`programme-${programme.programme.slug}`}
          >
            <View style={hq.banner}>
              <Image source={photos[programmePhoto(programme.programme.slug)]} style={hq.bannerPhoto} resizeMode="cover" />
              <View style={hq.bannerShade} />
              <Text style={hq.bannerTitle}>{programme.programme.title}</Text>
            </View>
            {programme.programme.tagline ? <Text style={styles.programmeTagline}>{programme.programme.tagline}</Text> : null}
          </Pressable>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = {
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14, 32, 72, 0.6)" },
  iconGlyph: { fontFamily: fonts.w400, fontSize: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(105, 224, 250, 0.12)",
  },
  avatarText: { fontFamily: fonts.w900, color: colors.cyan, fontSize: 17 },
  popover: {
    fontFamily: fonts.w400,
    alignSelf: "flex-end",
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(105, 224, 250, 0.3)",
    backgroundColor: "#0D1A3A",
    color: "#CFE0F7",
    fontSize: 13,
    overflow: "hidden",
  },
  focus: { minHeight: 112, padding: 0, justifyContent: "center" },
  focusPhoto: { position: "absolute", right: 0, top: 0, bottom: 0, width: "50%", height: "100%", opacity: 0.85 },
  focusText: { padding: 16, maxWidth: "62%" },
  streak: { flexDirection: "row", alignItems: "center", gap: 12 },
  flame: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 124, 64, 0.16)" },
  flameGlyph: { fontFamily: fonts.w400, fontSize: 20 },
  streakValue: { fontFamily: fonts.w900, color: colors.white, fontSize: 21, marginTop: 3 },
  chevron: { fontFamily: fonts.w700, color: "#7A91B8", fontSize: 22 },
  today: { minHeight: 190, padding: 0, borderColor: "rgba(105, 224, 250, 0.55)" },
  todayPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, width: "70%", height: "100%" },
  todayShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(5, 10, 25, 0.45)" },
  todayBody: { flex: 1, minHeight: 190, padding: 16 },
  todayTitle: { fontFamily: fonts.w900, color: colors.white, fontSize: 23, marginTop: 8, maxWidth: "75%" },
  todayFoot: { marginTop: "auto", paddingTop: 16 },
  play: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: colors.cyanStrong },
  playGlyph: { fontFamily: fonts.w400, color: "#041126", fontSize: 20, marginLeft: 3 },
  programme: { marginTop: 12 },
  programmeTagline: { fontFamily: fonts.w400, color: "#B8C9E4", fontSize: 13.5, lineHeight: 19, marginTop: 10 },
} as const;

export default function AthleteHomeScreen() {
  return (
    <AthleteRouteGuard>
      <AthleteHomeContent />
    </AthleteRouteGuard>
  );
}
