import { defineConfig } from "vitest/config";

// Live evaluation only. The normal unit suite (vitest.config.mts) includes
// tests/** and never sees this directory.
export default defineConfig({
  test: {
    environment: "node",
    include: ["eval/**/*.eval.ts"],
    testTimeout: 60 * 60 * 1000,
    fileParallelism: false,
  },
});
