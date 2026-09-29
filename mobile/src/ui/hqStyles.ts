import { colors } from "./index";

/** Card, title and progress styles shared by the athlete's main screens. */
export const hq = {
  hello: { marginTop: 18, marginBottom: 16 },
  helloLine: { color: "#A4B6D4", fontSize: 15 },
  bigTitle: { color: colors.white, fontSize: 36, fontWeight: "900", letterSpacing: -1, marginTop: 2 },
  accent: { color: colors.cyan },
  method: { color: "#7F97C0", fontSize: 11, fontWeight: "800", letterSpacing: 2.6, marginTop: 8 },
  card: {
    overflow: "hidden",
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(94, 234, 212, 0.2)",
    backgroundColor: "#0C1D45",
  },
  cardTitle: { color: colors.white, fontSize: 20, fontWeight: "900", marginTop: 6, lineHeight: 24 },
  eyebrow: { color: "#8FB0DC", fontSize: 10.5, fontWeight: "900", letterSpacing: 1.6 },
  meta: { color: "#8FA3C7", fontSize: 11.5, fontWeight: "800", letterSpacing: 0.6 },
  small: { color: "#8FA3C7", fontSize: 12, marginTop: 3 },
  link: { color: colors.cyan, fontSize: 13, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pressed: { opacity: 0.8 },
  days: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 5 },
  day: { alignItems: "center", gap: 4 },
  dayDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(143, 176, 220, 0.4)" },
  dayDotDone: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  dayLabel: { color: "#7A91B8", fontSize: 9.5, fontWeight: "800" },
  thumb: { width: 72, height: 72, borderRadius: 14 },
  barTrack: { height: 5, marginTop: 8, marginBottom: 2, overflow: "hidden", borderRadius: 99, backgroundColor: "rgba(143, 176, 220, 0.18)" },
  barFill: { height: "100%", borderRadius: 99, backgroundColor: colors.cyan },
} as const;
