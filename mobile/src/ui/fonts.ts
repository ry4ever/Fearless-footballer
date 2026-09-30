/**
 * Montserrat, the brand font. Each weight is its own font file, so styles
 * pick a family by weight instead of using fontWeight (which Android can't
 * map onto a custom font). Loaded in app/_layout.tsx.
 */
export const fonts = {
  w400: "Montserrat_400Regular",
  w500: "Montserrat_500Medium",
  w600: "Montserrat_600SemiBold",
  w700: "Montserrat_700Bold",
  w800: "Montserrat_800ExtraBold",
  w900: "Montserrat_900Black",
} as const;
