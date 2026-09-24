import { Alert, Linking } from "react-native";

export const PRIVACY_POLICY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim();
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL?.trim();

function isPublicUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export async function openPublicUrl(
  url: string | undefined,
  label: string,
): Promise<boolean> {
  if (!isPublicUrl(url)) {
    Alert.alert("Link unavailable", `${label} is not configured for this build.`);
    return false;
  }

  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert("Link unavailable", `No app is available to open ${label}.`);
      return false;
    }
    await Linking.openURL(url);
    return true;
  } catch {
    Alert.alert("Link unavailable", `Unable to open ${label}.`);
    return false;
  }
}
