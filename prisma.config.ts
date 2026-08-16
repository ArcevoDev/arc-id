import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Force load process env as an ultimate fallback if Prisma's native scanner chokes in MINGW64
const databaseUrl = env("DATABASE_URL") || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "CRITICAL: DATABASE_URL could not be resolved by Prisma engine or process environment.\n" +
      "Please verify that your .env file exists at the root of your project and contains a valid connection string.",
  );
}

// Shadow database for `prisma migrate diff --from-migrations` (used by the
// migration rollback test). Optional — Prisma 7's env() throws when a
// variable is unset, so read it defensively and only fall back to the
// process env / sibling-DB derivation when it is genuinely absent.
let shadowEnv: string | undefined;
try {
  shadowEnv = env("SHADOW_DATABASE_URL") || undefined;
} catch {
  shadowEnv = undefined;
}
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL || shadowEnv || databaseUrl.replace(/\/[^/]*\?/, "/arcid_shadow?");

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl,
  },
});
