import { colors } from "./index";
import { fonts } from "./fonts";

/** Card, title and progress styles shared by the athlete's main screens. */
export const hq = {
  hello: { marginTop: 18, marginBottom: 16 },
  helloLine: { fontFamily: fonts.w400, color: "#A4B6D4", fontSize: 15 },
  bigTitle: { fontFamily: fonts.w900, color: colors.white, fontSize: 36, letterSpacing: -1, marginTop: 2 },
  accent: { color: colors.cyan },
  method: { fontFamily: fonts.w800, color: "#7F97C0", fontSize: 11, letterSpacing: 2.6, marginTop: 8 },
  card: {
    overflow: "hidden",
    padding: 16,
    marginBottom: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(105, 224, 250, 0.2)",
    backgroundColor: "#0C1D45",
  },
  cardTitle: { fontFamily: fonts.w900, color: colors.white, fontSize: 20, marginTop: 6, lineHeight: 24 },
  eyebrow: { fontFamily: fonts.w900, color: "#8FB0DC", fontSize: 10.5, letterSpacing: 1.6 },
  meta: { fontFamily: fonts.w800, color: "#8FA3C7", fontSize: 11.5, letterSpacing: 0.6 },
  small: { fontFamily: fonts.w400, color: "#8FA3C7", fontSize: 12, marginTop: 3 },
  link: { fontFamily: fonts.w800, color: colors.cyan, fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  pressed: { opacity: 0.8 },
  days: { flex: 1, flexDirection: "row", justifyContent: "flex-end", gap: 5 },
  day: { alignItems: "center", gap: 4 },
  dayDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(143, 176, 220, 0.4)" },
  dayDotDone: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  dayLabel: { fontFamily: fonts.w800, color: "#7A91B8", fontSize: 9.5 },
  banner: { height: 150, overflow: "hidden", borderRadius: 14, justifyContent: "flex-end" },
  bannerPhoto: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  bannerShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", backgroundColor: "rgba(5, 10, 25, 0.6)" },
  bannerTitle: { fontFamily: fonts.w800, color: colors.white, fontSize: 18, margin: 14 },
  barTrack: { height: 5, marginTop: 8, marginBottom: 2, overflow: "hidden", borderRadius: 99, backgroundColor: "rgba(143, 176, 220, 0.18)" },
  barFill: { height: "100%", borderRadius: 99, backgroundColor: colors.cyan },
} as const;
