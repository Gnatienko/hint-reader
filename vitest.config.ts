import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["app/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["app/test/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["app/hooks/**", "app/lib/**", "app/components/**"],
      exclude: ["**/*.{test,spec}.*", "**/*.d.ts", "app/test/**"],
      thresholds: {
        // Global floors for the aggregate report.
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90,

        // Per-file gates so a new 0% component can't hide behind averages.
        "app/components/**": {
          perFile: true,
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80,
        },
        "app/hooks/**": {
          perFile: true,
          lines: 90,
          functions: 90,
          branches: 75,
          statements: 90,
        },
        "app/lib/**": {
          perFile: true,
          lines: 85,
          functions: 85,
          branches: 70,
          statements: 85,
        },
      },
    },
  },
});
