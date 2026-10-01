import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { programmePhoto } from "../../../../shared/onboarding";
import { sessionPhoto } from "../../../../shared/player";
import { currentProgramme, programmeViews } from "../../../../shared/training";
import { chooseProgramme } from "../../../src/lib/plan";
import { useAthleteData } from "../../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../../src/session";
import { LoadingRow, Screen, StatusCard, Wordmark, colors } from "../../../src/ui";
import { fonts } from "../../../src/ui/fonts";
import { hq } from "../../../src/ui/hqStyles";
import { photos } from "../../../src/ui/photos";
import { SegmentedTabs } from "../../../src/ui/SegmentedTabs";
import { TabBar } from "../../../src/ui/TabBar";

/** One programme: its sessions in order, what it's about, and the choice to train it. */
function ProgrammeContent() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { account, library, plan, loading, error } = useAthleteData();
  const [tab, setTab] = useState<"sessions" | "about">("sessions");
  const [saving, setSaving] = useState(false);
  const views = library ? programmeViews(library) : [];
  const view = views.find((item) => item.programme.slug === slug);
  const isCurrent = Boolean(view && currentProgramme(views, plan ?? null) === view);

  if (!view) {
    return (
      <Screen footer={<TabBar active="training" />}>
        {loading ? (
          <LoadingRow label="Loading the programme…" />
        ) : (
          <StatusCard tone="danger" title="Programme unavailable">
            {error ?? "This programme isn't available."}
          </StatusCard>
        )}
      </Screen>
    );
  }

  async function choose() {
    if (!account?.id || !view) return;
    setSaving(true);
    try {
      await chooseProgramme(account.id, view.programme.slug);
      router.replace("/athlete/home");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen testID="athlete-programme-screen" footer={<TabBar active="training" />}>
      <View style={styles.hero}>
        <Image source={photos[programmePhoto(view.programme.slug)]} style={styles.fill} resizeMode="cover" />
        <View style={styles.heroShade} />
        <View style={styles.heroTop}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to Training" onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Wordmark height={22} />
          <View style={styles.back} />
        </View>
        <View style={styles.heroTitle}>
          <Text style={styles.eyebrow}>{isCurrent ? "YOUR PROGRAMME" : "PROGRAMME"}</Text>
          <Text style={styles.title} accessibilityRole="header">
            {view.programme.title}
          </Text>
          {view.programme.tagline ? <Text style={styles.tagline}>{view.programme.tagline}</Text> : null}
        </View>
      </View>

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "sessions", label: "Sessions" },
          { value: "about", label: "About" },
        ]}
      />

      {tab === "sessions" ? (
        view.sessions.map((session, index) => (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            accessibilityLabel={`Session ${index + 1}: ${session.title}`}
            onPress={() => router.push(`/session/${session.id}`)}
            style={({ pressed }) => [styles.session, pressed && hq.pressed]}
            testID={`programme-session-${index + 1}`}
          >
            <View style={styles.sessionPhoto}>
              <Image source={photos[sessionPhoto(session)]} style={styles.fill} resizeMode="cover" />
              <View style={styles.number}>
                <Text style={styles.numberText}>{index + 1}</Text>
              </View>
            </View>
            <View style={styles.sessionText}>
              <Text style={styles.sessionEyebrow}>SESSION {index + 1}</Text>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              {session.tagline ? <Text style={styles.sessionTagline}>{session.tagline}</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))
      ) : (
        <View style={hq.card}>
          <Text style={styles.about}>{view.programme.description}</Text>
        </View>
      )}

      {isCurrent ? (
        <Text style={styles.current} accessibilityRole="text">
          ✓ This is your programme. Its next session is on Home.
        </Text>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPress={choose}
          style={({ pressed }) => [styles.choose, (pressed || saving) && hq.pressed]}
          testID="choose-programme"
        >
          <Text style={styles.chooseText}>Make this my programme</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = {
  hero: { height: 340, marginTop: -20, marginHorizontal: -20, marginBottom: 16, overflow: "hidden" },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  heroShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "60%", backgroundColor: "rgba(5, 10, 25, 0.65)" },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 16 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fonts.w700, color: colors.white, fontSize: 22 },
  heroTitle: { position: "absolute", left: 20, right: 20, bottom: 18 },
  eyebrow: { fontFamily: fonts.w700, color: "#9AB5DC", fontSize: 11, letterSpacing: 2.4 },
  title: { fontFamily: fonts.w800, color: colors.white, fontSize: 32, lineHeight: 36, marginTop: 8 },
  tagline: { fontFamily: fonts.w400, color: "#CFDCF0", fontSize: 14.5, lineHeight: 20, marginTop: 8 },
  session: {
    flexDirection: "row",
    minHeight: 108,
    marginBottom: 10,
    overflow: "hidden",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(143, 176, 220, 0.22)",
    backgroundColor: "rgba(11, 22, 53, 0.85)",
  },
  sessionPhoto: { width: "30%", justifyContent: "center" },
  number: {
    width: 34,
    height: 34,
    marginLeft: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 139, 206, 0.6)",
  },
  numberText: { fontFamily: fonts.w800, color: colors.cyan, fontSize: 15 },
  sessionText: { flex: 1, justifyContent: "center", gap: 4, paddingVertical: 14, paddingLeft: 14, paddingRight: 4 },
  sessionEyebrow: { fontFamily: fonts.w800, color: colors.cyan, fontSize: 10.5, letterSpacing: 1.6 },
  sessionTitle: { fontFamily: fonts.w700, color: colors.white, fontSize: 16 },
  sessionTagline: { fontFamily: fonts.w400, color: "#A4B6D4", fontSize: 13, lineHeight: 18 },
  chevron: { alignSelf: "center", marginRight: 12, color: colors.cyan, fontSize: 24 },
  about: { fontFamily: fonts.w400, color: "#CFDCF0", fontSize: 14.5, lineHeight: 22 },
  current: { fontFamily: fonts.w600, color: colors.cyan, fontSize: 14, marginTop: 6, marginBottom: 12 },
  choose: { minHeight: 54, marginTop: 6, marginBottom: 12, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.cyanStrong },
  chooseText: { fontFamily: fonts.w800, color: "#041126", fontSize: 16 },
} as const;

export default function AthleteProgrammeScreen() {
  return (
    <AthleteRouteGuard>
      <ProgrammeContent />
    </AthleteRouteGuard>
  );
}
