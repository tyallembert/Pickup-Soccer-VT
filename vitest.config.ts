import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts", "app/**/*.test.ts"],
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
  },
});
