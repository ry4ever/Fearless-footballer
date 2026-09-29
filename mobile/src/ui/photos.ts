import type { ImageSourcePropType } from "react-native";
import type { PhotoName } from "../../../shared/onboarding";

/** Bundled photos, named as in shared/onboarding.ts. */
export const photos: Record<PhotoName, ImageSourcePropType> = {
  ball: require("../../assets/photos/ball.jpg"),
  "centre-back": require("../../assets/photos/centre-back.jpg"),
  "changing-room": require("../../assets/photos/changing-room.jpg"),
  composure: require("../../assets/photos/composure.jpg"),
  cone: require("../../assets/photos/cone.jpg"),
  "cone-lights": require("../../assets/photos/cone-lights.jpg"),
  decision: require("../../assets/photos/decision.jpg"),
  energy: require("../../assets/photos/energy.jpg"),
  floodlights: require("../../assets/photos/floodlights.jpg"),
  focus: require("../../assets/photos/focus.jpg"),
  fullback: require("../../assets/photos/fullback.jpg"),
  goalkeeper: require("../../assets/photos/goalkeeper.jpg"),
  headphones: require("../../assets/photos/headphones.jpg"),
  hero: require("../../assets/photos/hero.jpg"),
  "hold-up": require("../../assets/photos/hold-up.jpg"),
  matchday: require("../../assets/photos/matchday.jpg"),
  midfielder: require("../../assets/photos/midfielder.jpg"),
  profile: require("../../assets/photos/profile.jpg"),
  stadium: require("../../assets/photos/stadium.jpg"),
  striker: require("../../assets/photos/striker.jpg"),
  "tactics-board": require("../../assets/photos/tactics-board.jpg"),
  winger: require("../../assets/photos/winger.jpg"),
};
