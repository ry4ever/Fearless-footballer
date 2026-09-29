import { Modal, Pressable, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { colors } from "./index";

/** "Why this works?" link shown under the player's completion note. */
export function WhyVideoLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Why this works? Play the video"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
      testID="why-this-works-link"
    >
      <Text style={styles.linkText}>▶ Why this works?</Text>
    </Pressable>
  );
}

/**
 * Full-screen video with native controls. Mounted only while open, so the
 * player starts on open and is released on close.
 */
export function WhyVideoModal({ url, onClose }: { url: string; onClose: () => void }) {
  const player = useVideoPlayer(url, (created) => {
    created.play();
  });
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={["portrait"]}>
      <View style={styles.backdrop} testID="why-this-works-video">
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close video"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          hitSlop={12}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = {
  link: { alignSelf: "center", minHeight: 44, justifyContent: "center", paddingHorizontal: 12, marginBottom: 12 },
  linkText: { color: colors.cyan, fontSize: 15, fontWeight: "800", textDecorationLine: "underline" },
  pressed: { opacity: 0.75 },
  backdrop: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
  video: { width: "100%", height: "100%" },
  close: {
    position: "absolute",
    top: 52,
    right: 18,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  closeText: { color: colors.white, fontSize: 20, fontWeight: "900" },
} as const;
