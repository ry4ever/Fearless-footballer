import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/lib/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: [
        "src/lib/metrics.ts",
        "src/lib/offlineCompletionQueue.ts",
        "src/lib/sessionGuard.ts",
        "src/lib/sessionPlayer.ts",
      ],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 80,
        statements: 80,
        branches: 75,
        functions: 60,
      },
    },
  },
});
