import { describe, expect, it } from "vitest";
import type { SessionPackage } from "../../../shared/types";
import { sampleSessionPackage } from "../../../shared/sampleSession";
import {
  availableModes,
  hasMusicChoice,
  lengthLabel,
  pickVariant,
  progressKey,
  variantFromParams,
  versionQuery,
} from "./sessionVersions";

const session: SessionPackage = {
  ...sampleSessionPackage,
  availableModes: ["interactive", "relaxation"],
  audio: [
    { mode: "interactive", withMusic: true, url: "https://cdn/i-m.mp3", durationSeconds: 610 },
    { mode: "interactive", withMusic: false, url: "https://cdn/i-n.mp3", durationSeconds: 610 },
    { mode: "relaxation", withMusic: true, url: "https://cdn/r-m.mp3", durationSeconds: 594 },
    { mode: "relaxation", withMusic: false, url: "https://cdn/r-n.mp3", durationSeconds: 448 },
  ],
};

describe("session versions", () => {
  it("lists only the recorded modes, in display order", () => {
    expect(availableModes(session)).toEqual(["interactive", "relaxation"]);
    expect(availableModes(sampleSessionPackage)).toEqual([]);
  });

  it("picks the exact recording, falling back to the other music option", () => {
    expect(pickVariant(session, "relaxation", false)?.durationSeconds).toBe(448);
    expect(pickVariant(session, "guidance", true)).toBeNull();
    const musicOnly: SessionPackage = { ...session, audio: [session.audio![0]!] };
    expect(pickVariant(musicOnly, "interactive", false)?.withMusic).toBe(true);
    expect(hasMusicChoice(musicOnly, "interactive")).toBe(false);
    expect(hasMusicChoice(session, "relaxation")).toBe(true);
  });

  it("keeps progress separate per recording", () => {
    const withMusic = pickVariant(session, "relaxation", true);
    const without = pickVariant(session, "relaxation", false);
    expect(progressKey("s1", withMusic)).not.toBe(progressKey("s1", without));
    expect(progressKey("s1", null)).toBe("s1");
  });

  it("round-trips the chosen recording through the route query", () => {
    const chosen = pickVariant(session, "relaxation", false);
    const query = new URLSearchParams(versionQuery(chosen).slice(1));
    const back = variantFromParams(session, { mode: query.get("mode")!, music: query.get("music")! });
    expect(back).toEqual(chosen);
    expect(variantFromParams(session, {})?.mode).toBe("interactive");
    expect(variantFromParams(sampleSessionPackage, { mode: "relaxation" })).toBeNull();
  });

  it("describes the length range across recordings", () => {
    expect(lengthLabel(session)).toBe("7–10 min");
    expect(lengthLabel(sampleSessionPackage)).toBe("5 min");
  });
});
