import { PropsWithChildren } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
// Per-weight imports so only these six font files are bundled.
import { Montserrat_400Regular } from "@expo-google-fonts/montserrat/400Regular";
import { Montserrat_500Medium } from "@expo-google-fonts/montserrat/500Medium";
import { Montserrat_600SemiBold } from "@expo-google-fonts/montserrat/600SemiBold";
import { Montserrat_700Bold } from "@expo-google-fonts/montserrat/700Bold";
import { Montserrat_800ExtraBold } from "@expo-google-fonts/montserrat/800ExtraBold";
import { Montserrat_900Black } from "@expo-google-fonts/montserrat/900Black";
import { SessionErrorScreen, SessionProvider, useSession } from "../src/session";

function SessionRoot({ children }: PropsWithChildren) {
  const { error } = useSession();
  if (error) return <SessionErrorScreen />;
  return children;
}

export default function RootLayout() {
  // Brand font. Keys match src/ui/fonts.ts.
  const [fontsLoaded, fontError] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
    Montserrat_800ExtraBold,
    Montserrat_900Black,
  });
  // Wait briefly for the fonts; if they fail, carry on with the system font.
  if (!fontsLoaded && !fontError) return null;

  return (
    <SessionProvider>
      <SessionRoot>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SessionRoot>
    </SessionProvider>
  );
}
