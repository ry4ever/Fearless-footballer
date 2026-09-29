import { useState } from "react";
import { Image, Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import {
  GOALS_BY_POSITION,
  MATCHDAYS,
  MAX_SKILLS,
  POSITIONS,
  SKILLS_BY_POSITION,
  positionById,
  skillLabel,
  skillPhoto,
  type GoalIcon,
} from "../../../shared/onboarding";
import { savePlan } from "../../src/lib/plan";
import { AthleteAccountGuard, useSession } from "../../src/session";
import { Screen, Wordmark, colors } from "../../src/ui";
import { photos } from "../../src/ui/photos";

const TOTAL_STEPS = 5;

const GOAL_GLYPHS: Record<GoalIcon, string> = {
  box: "⌖",
  score: "◎",
  confidence: "⚡",
  touch: "●",
  defend: "⛨",
  level: "↗",
  target: "◉",
};

function CheckCircle({ checked }: { checked: boolean }) {
  return <View style={[styles.check, checked && styles.checkOn]}>{checked ? <Text style={styles.checkMark}>✓</Text> : null}</View>;
}

function Title({ lead, accent, subtitle }: { lead: string; accent: string; subtitle: string }) {
  return (
    <View style={styles.titleBlock}>
      <Text style={styles.title} accessibilityRole="header">
        {lead} <Text style={styles.accent}>{accent}</Text>
      </Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

function OnboardingContent() {
  const router = useRouter();
  const { state } = useSession();
  const [step, setStep] = useState(1);
  const [position, setPosition] = useState("striker");
  const [skills, setSkills] = useState<string[]>([]);
  const [goal, setGoal] = useState("");
  const [customGoal, setCustomGoal] = useState<string | null>(null);
  const [matchday, setMatchday] = useState("Saturday");
  const [saving, setSaving] = useState(false);

  const positionSkills = SKILLS_BY_POSITION[position] ?? SKILLS_BY_POSITION.striker!;
  const goals = GOALS_BY_POSITION[position] ?? GOALS_BY_POSITION.striker!;
  // The first goal is picked until the player chooses another.
  const listGoal = goals.some((option) => option.label === goal) ? goal : goals[0]!.label;
  const chosenGoal = customGoal !== null ? customGoal.trim() : listGoal;
  const canContinue = !saving && (step !== 2 || skills.length > 0) && (step !== 3 || chosenGoal.length > 0);

  const choosePosition = (id: string) => {
    if (id === position) return;
    setPosition(id);
    setSkills([]);
    setGoal("");
    setCustomGoal(null);
  };

  const toggleSkill = (id: string) =>
    setSkills((current) =>
      current.includes(id) ? current.filter((skill) => skill !== id) : current.length < MAX_SKILLS ? [...current, id] : current,
    );

  async function next() {
    if (!canContinue) return;
    if (step < TOTAL_STEPS) {
      setStep(step + 1);
      return;
    }
    const userId = state?.currentUser?.id;
    if (!userId) return;
    setSaving(true);
    try {
      await savePlan(userId, { position, skills, goal: chosenGoal, matchday });
      router.replace("/athlete/home");
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <View style={styles.footer}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canContinue }}
        disabled={!canContinue}
        onPress={next}
        style={({ pressed }) => [styles.continue, !canContinue && styles.disabled, pressed && styles.pressed]}
        testID="onboarding-continue"
      >
        <Text style={styles.continueText}>{step === TOTAL_STEPS ? "Enter Fearless HQ  →" : "Continue  →"}</Text>
      </Pressable>
    </View>
  );

  return (
    <Screen testID="athlete-onboarding-screen" footer={footer}>
      <View style={styles.header}>
        {step > 1 ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(step - 1)} style={styles.back} hitSlop={8}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Wordmark height={26} />
        <Text style={styles.stepCount} accessibilityLabel={`Step ${step} of ${TOTAL_STEPS}`}>
          {step}/{TOTAL_STEPS}
        </Text>
      </View>
      <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: TOTAL_STEPS, now: step }}>
        {Array.from({ length: TOTAL_STEPS }, (_, index) => (
          <View key={index} style={[styles.progressSegment, index < step && styles.progressDone]} />
        ))}
      </View>

      {step === 1 ? (
        <>
          <Image source={photos.hero} style={styles.hero} resizeMode="cover" />
          <Title lead="WHAT POSITION DO YOU" accent="PLAY?" subtitle="We'll build your training around your role." />
          <View style={styles.grid} accessibilityRole="radiogroup">
            {POSITIONS.map((option) => {
              const selected = option.id === position;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${option.title}, ${option.role}`}
                  onPress={() => choosePosition(option.id)}
                  style={({ pressed }) => [styles.positionCard, selected && styles.selectedBorder, pressed && styles.pressed]}
                  testID={`position-${option.id}`}
                >
                  <Image source={photos[option.photo]} style={styles.fill} resizeMode="cover" />
                  <View style={styles.cardShade} />
                  <View style={styles.cardCheck}>
                    <CheckCircle checked={selected} />
                  </View>
                  <View style={styles.positionText}>
                    <Text style={styles.positionTitle}>{option.title}</Text>
                    <Text style={styles.positionRole}>{option.role}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {step === 2 ? (
        <>
          <Title lead="WHAT DO YOU WANT TO" accent="WORK ON?" subtitle={`Select 1–${MAX_SKILLS} areas to focus on.`} />
          {positionSkills.map((skill) => {
            const selected = skills.includes(skill.id);
            const full = !selected && skills.length >= MAX_SKILLS;
            return (
              <Pressable
                key={skill.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected, disabled: full }}
                onPress={() => toggleSkill(skill.id)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, full && styles.rowFull, pressed && styles.pressed]}
                testID={`skill-${skill.id}`}
              >
                <Image source={photos[skillPhoto(skill.id)]} style={styles.rowPhoto} resizeMode="cover" />
                <Text style={styles.rowText}>{skill.label}</Text>
                <CheckCircle checked={selected} />
              </Pressable>
            );
          })}
          <Text style={styles.hint}>
            {skills.length === MAX_SKILLS ? `That's ${MAX_SKILLS} – tap one to swap it.` : `${skills.length} of ${MAX_SKILLS} selected`}
          </Text>
        </>
      ) : null}

      {step === 3 ? (
        <>
          <Title lead="WHAT'S YOUR BIGGEST GOAL" accent="RIGHT NOW?" subtitle="Pick the one that matters most." />
          {goals.map((option) => {
            const selected = customGoal === null && listGoal === option.label;
            return (
              <Pressable
                key={option.label}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => {
                  setGoal(option.label);
                  setCustomGoal(null);
                }}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}>
                  <Text style={styles.rowGlyph}>{GOAL_GLYPHS[option.icon]}</Text>
                </View>
                <Text style={styles.rowText}>{option.label}</Text>
                <CheckCircle checked={selected} />
              </Pressable>
            );
          })}
          {customGoal === null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setCustomGoal("")}
              style={({ pressed }) => [styles.row, styles.rowDashed, pressed && styles.pressed]}
              testID="goal-something-else"
            >
              <View style={styles.rowIcon}>
                <Text style={styles.rowGlyph}>+</Text>
              </View>
              <Text style={[styles.rowText, styles.mutedText]}>Something Else</Text>
            </Pressable>
          ) : (
            <View style={[styles.row, styles.rowSelected]}>
              <View style={styles.rowIcon}>
                <Text style={styles.rowGlyph}>+</Text>
              </View>
              <TextInput
                autoFocus
                value={customGoal}
                onChangeText={setCustomGoal}
                maxLength={80}
                placeholder="Type your goal"
                placeholderTextColor="#7A91B8"
                accessibilityLabel="Your goal"
                returnKeyType="done"
                onSubmitEditing={next}
                style={styles.input}
              />
            </View>
          )}
        </>
      ) : null}

      {step === 4 ? (
        <>
          <Title lead="WHEN'S YOUR NEXT" accent="MATCH?" subtitle="We'll time your sessions around matchday." />
          {MATCHDAYS.map((day) => {
            const selected = matchday === day;
            return (
              <Pressable
                key={day}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setMatchday(day)}
                style={({ pressed }) => [styles.row, selected && styles.rowSelected, pressed && styles.pressed]}
              >
                <View style={styles.rowIcon}>
                  <Text style={styles.rowGlyph}>▦</Text>
                </View>
                <Text style={styles.rowText}>{day}</Text>
                <CheckCircle checked={selected} />
              </Pressable>
            );
          })}
        </>
      ) : null}

      {step === 5 ? (
        <>
          <Title lead="YOUR PLAN IS" accent="READY." subtitle="See it. Rehearse it. Become it." />
          <View style={styles.planCard}>
            <Image source={photos.headphones} style={styles.planPhoto} resizeMode="cover" />
            <View style={styles.planBody}>
              <Text style={styles.chip}>{positionById(position).title.toUpperCase()} · YOUR FOCUS</Text>
              <Text style={styles.planGoal}>{chosenGoal}</Text>
              {skills.map((skill) => (
                <Text key={skill} style={styles.planItem}>
                  <Text style={styles.accent}>✓ </Text>
                  {skillLabel(position, skill)}
                </Text>
              ))}
              <Text style={styles.planMeta}>Matchday: {matchday}</Text>
            </View>
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = {
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  backText: { color: "#B8D0EF", fontSize: 30, lineHeight: 32, fontWeight: "600" },
  stepCount: { width: 40, textAlign: "right", color: colors.cyan, fontSize: 13, fontWeight: "800" },
  progress: { flexDirection: "row", gap: 6, marginTop: 14 },
  progressSegment: { flex: 1, height: 4, borderRadius: 99, backgroundColor: "rgba(148, 173, 211, 0.2)" },
  progressDone: { backgroundColor: colors.cyan },
  hero: { position: "absolute", top: 70, right: -40, width: 200, height: 210, opacity: 0.55, borderRadius: 100 },
  titleBlock: { marginTop: 28, marginBottom: 18, maxWidth: 300 },
  title: { color: colors.white, fontSize: 28, lineHeight: 31, fontWeight: "900", letterSpacing: -0.5 },
  accent: { color: colors.cyan },
  subtitle: { color: "#A4B6D4", fontSize: 14, lineHeight: 20, marginTop: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
  positionCard: {
    width: "48.5%",
    aspectRatio: 1.08,
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "rgba(94, 234, 212, 0.14)",
    backgroundColor: colors.cardStrong,
  },
  selectedBorder: { borderColor: colors.cyan },
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  cardShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(5, 10, 25, 0.62)" },
  cardCheck: { position: "absolute", top: 10, right: 10 },
  positionText: { position: "absolute", left: 12, right: 12, bottom: 11 },
  positionTitle: { color: colors.white, fontSize: 16, fontWeight: "900" },
  positionRole: { color: colors.cyan, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(184, 208, 239, 0.5)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5, 10, 25, 0.35)",
  },
  checkOn: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  checkMark: { color: "#041126", fontSize: 13, fontWeight: "900" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 62,
    paddingVertical: 9,
    paddingLeft: 10,
    paddingRight: 14,
    marginBottom: 9,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(94, 234, 212, 0.14)",
    backgroundColor: "rgba(13, 26, 58, 0.85)",
  },
  rowSelected: { borderColor: colors.cyan, backgroundColor: "rgba(0, 139, 206, 0.2)" },
  rowFull: { opacity: 0.5 },
  rowDashed: { borderStyle: "dashed", backgroundColor: "transparent" },
  rowPhoto: { width: 64, height: 44, borderRadius: 10 },
  rowIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0, 139, 206, 0.18)" },
  rowGlyph: { color: colors.cyan, fontSize: 20, fontWeight: "900" },
  rowText: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "800", lineHeight: 20 },
  mutedText: { color: "#B8D0EF" },
  input: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "700", paddingVertical: 8 },
  hint: { color: "#8EA6CC", fontSize: 12, textAlign: "center", marginTop: 4 },
  planCard: { overflow: "hidden", borderRadius: 20, borderWidth: 1.5, borderColor: "rgba(94, 234, 212, 0.5)", backgroundColor: colors.cardStrong },
  planPhoto: { width: "100%", height: 150 },
  planBody: { padding: 16, gap: 6 },
  chip: {
    alignSelf: "flex-start",
    color: colors.cyan,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "rgba(94, 234, 212, 0.14)",
  },
  planGoal: { color: colors.white, fontSize: 21, fontWeight: "900", marginTop: 6, marginBottom: 4 },
  planItem: { color: "#D4E2F5", fontSize: 14 },
  planMeta: { color: "#8EA6CC", fontSize: 12.5, marginTop: 6 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, backgroundColor: colors.background },
  continue: { minHeight: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: colors.cyanStrong },
  continueText: { color: "#041126", fontSize: 16, fontWeight: "900" },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
} as const;

export default function AthleteOnboardingScreen() {
  return (
    <AthleteAccountGuard>
      <OnboardingContent />
    </AthleteAccountGuard>
  );
}
