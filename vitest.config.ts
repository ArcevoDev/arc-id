import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    pool: "threads",
    // Flattened & renamed in Vitest 4
    // Reduced from 4 to 2 for Windows I/O contention — Fastify + Prisma import
    // chains are heavy enough that 4 concurrent forks trigger hook timeouts.
    maxWorkers: 2,
    testTimeout: 15000,
    hookTimeout: 90000,
    setupFiles: ["./src/test-utils/vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@prisma-client": path.resolve(__dirname, "prisma/generated"),
    },
  },
});
