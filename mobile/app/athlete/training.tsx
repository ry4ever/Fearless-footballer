import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { currentProgramme, isCoachPlan, programmeViews } from "../../../shared/training";
import type { SessionPackage } from "../../../shared/types";
import { programmeViewPhoto } from "../../../shared/player";
import { useAthleteData } from "../../src/lib/useAthleteData";
import { AthleteRouteGuard } from "../../src/session";
import { LoadingRow, Screen, StatusCard, colors } from "../../src/ui";
import { fonts } from "../../src/ui/fonts";
import { hq } from "../../src/ui/hqStyles";
import { photos } from "../../src/ui/photos";
import { SessionRow } from "../../src/ui/SessionContent";
import { SegmentedTabs } from "../../src/ui/SegmentedTabs";
import { TabBar } from "../../src/ui/TabBar";

type TrainingTab = "programmes" | "sessions";

/**
 * Programmes to choose from (each opens its own page) and, under My
 * Sessions, every session in the library.
 */
function TrainingContent() {
  const router = useRouter();
  const { library, plan, pendingCompletions, loading, error } = useAthleteData();
  const [tab, setTab] = useState<TrainingTab>("programmes");
  const sessions = library?.sessions ?? [];
  const views = library ? programmeViews(library) : [];
  const current = currentProgramme(views, plan ?? null);
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

      <SegmentedTabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "programmes", label: "Programmes" },
          { value: "sessions", label: "My Sessions" },
        ]}
      />

      {pendingCompletions > 0 ? (
        <StatusCard tone="warning" title="Saved on this device">
          {pendingCompletions} completion{pendingCompletions === 1 ? "" : "s"} will sync when you reconnect.
        </StatusCard>
      ) : null}
      {error ? (
        <StatusCard tone="danger" title="Training unavailable">
          {error}
        </StatusCard>
      ) : null}
      {loading && !library ? <LoadingRow label="Loading your training…" /> : null}

      {tab === "programmes"
        ? views.map((view) => {
            const isCurrent = view === current;
            return (
              <Pressable
                key={view.programme.slug}
                accessibilityRole="button"
                accessibilityLabel={`${view.programme.title}${isCurrent ? ", your programme" : ""}. Open the programme`}
                onPress={() => router.push(`/athlete/programme/${view.programme.slug}`)}
                style={({ pressed }) => [styles.programme, pressed && hq.pressed]}
                testID={`programme-${view.programme.slug}`}
              >
                <Image source={photos[programmeViewPhoto(view)]} style={styles.programmePhoto} resizeMode="cover" />
                <View style={styles.programmeShade} />
                <View style={styles.programmeText}>
                  <Text style={hq.eyebrow}>{isCoachPlan(view) ? "FROM YOUR COACH" : isCurrent ? "YOUR PROGRAMME" : "PROGRAMME"}</Text>
                  <Text style={styles.programmeTitle}>{view.programme.title}</Text>
                  {view.programme.tagline ? <Text style={styles.programmeTagline}>{view.programme.tagline}</Text> : null}
                </View>
                <View style={styles.go}>
                  <Text style={styles.goText}>›</Text>
                </View>
              </Pressable>
            );
          })
        : null}

      {tab === "sessions" ? (
        <>
          {!loading && !error && playable.length === 0 ? (
            <StatusCard tone="info" title="No session available yet">
              New training is on its way. Check back soon — your progress is saved.
            </StatusCard>
          ) : null}
          {Array.from(groups.entries()).map(([group, items]) => (
            <View key={group} testID="all-sessions">
              <Text style={styles.groupLabel}>{group}</Text>
              {items.map((item) => (
                <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
              ))}
            </View>
          ))}
          {comingSoon.length > 0 ? (
            <View style={styles.section} testID="coming-soon">
              <Text style={[hq.eyebrow, styles.sectionLabel]}>COMING SOON</Text>
              {comingSoon.map((item) => (
                <SessionRow key={item.id} session={item} onPress={() => openSession(item)} />
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  programme: {
    minHeight: 200,
    justifyContent: "flex-end",
    marginBottom: 14,
    overflow: "hidden",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(105, 224, 250, 0.25)",
    backgroundColor: "#0B1635",
  },
  programmePhoto: { position: "absolute", top: 0, right: 0, bottom: 0, width: "62%", height: "100%" },
  programmeShade: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(11, 22, 53, 0.45)" },
  programmeText: { maxWidth: "66%", gap: 6, paddingVertical: 20, paddingLeft: 18, paddingRight: 8 },
  programmeTitle: { fontFamily: fonts.w800, color: colors.white, fontSize: 24, lineHeight: 27 },
  programmeTagline: { fontFamily: fonts.w400, color: "#CFDCF0", fontSize: 13.5, lineHeight: 19 },
  go: {
    position: "absolute",
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 139, 206, 0.35)",
  },
  goText: { fontFamily: fonts.w700, color: colors.cyan, fontSize: 26, marginTop: -2 },
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
