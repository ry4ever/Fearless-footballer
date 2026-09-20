import { PropsWithChildren } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SessionErrorScreen, SessionProvider, useSession } from "../src/session";

function SessionRoot({ children }: PropsWithChildren) {
  const { error } = useSession();
  if (error) return <SessionErrorScreen />;
  return children;
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <SessionRoot>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SessionRoot>
    </SessionProvider>
  );
}
