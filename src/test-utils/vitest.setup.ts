import { vi } from "vitest";

vi.stubEnv("NODE_ENV", "test");

process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/arcid_test";
process.env.JWT_SECRET ??= "a".repeat(32);
process.env.COOKIE_SECRET ??= "b".repeat(32);
process.env.RESEND_API_KEY ??= "test-resend-key";
process.env.WEBHOOK_SIGNING_SECRET ??= "c".repeat(32);
