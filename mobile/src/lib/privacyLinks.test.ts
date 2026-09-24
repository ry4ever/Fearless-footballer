import { beforeEach, describe, expect, it, vi } from "vitest";

const linking = vi.hoisted(() => ({
  canOpenURL: vi.fn(),
  openURL: vi.fn(),
}));
const alert = vi.hoisted(() => ({ alert: vi.fn() }));

vi.mock("react-native", () => ({
  Alert: { alert: alert.alert },
  Linking: {
    canOpenURL: linking.canOpenURL,
    openURL: linking.openURL,
  },
}));

import { openPublicUrl } from "./privacyLinks";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("public privacy links", () => {
  it("opens a configured HTTPS policy URL", async () => {
    linking.canOpenURL.mockResolvedValue(true);
    linking.openURL.mockResolvedValue(true);

    await expect(openPublicUrl("https://example.com/privacy", "the privacy policy")).resolves.toBe(true);
    expect(linking.openURL).toHaveBeenCalledWith("https://example.com/privacy");
  });

  it("handles an unsupported URL without throwing", async () => {
    linking.canOpenURL.mockResolvedValue(false);

    await expect(openPublicUrl("https://example.com/privacy", "the privacy policy")).resolves.toBe(false);
    expect(alert.alert).toHaveBeenCalledWith(
      "Link unavailable",
      "No app is available to open the privacy policy.",
    );
  });

  it("rejects non-public schemes", async () => {
    await expect(openPublicUrl("file:///private", "the privacy policy")).resolves.toBe(false);
    expect(linking.canOpenURL).not.toHaveBeenCalled();
  });
});
