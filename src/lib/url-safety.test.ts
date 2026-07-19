import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock node:dns/promises BEFORE importing the module under test, so the
// module's own `import dns from "node:dns/promises"` picks up the mock.
vi.mock("node:dns/promises", () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}));

import dns from "node:dns/promises";
import { assertSafeUrl, isSafeUrl } from "./url-safety";

const mockResolve4 = dns.resolve4 as unknown as ReturnType<typeof vi.fn>;
const mockResolve6 = dns.resolve6 as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockResolve4.mockReset();
  mockResolve6.mockReset();
  // Default: no AAAA record for most test hosts.
  mockResolve6.mockRejectedValue(new Error("ENOTFOUND"));
});

describe("url-safety", () => {
  it("rejects a literal private IP in the URL (the case the old check already caught)", async () => {
    mockResolve4.mockRejectedValue(
      new Error("should not be called for IP literals"),
    );
    await expect(isSafeUrl("http://127.0.0.1/hook")).resolves.toBe(false);
    await expect(assertSafeUrl("http://10.0.0.5/hook")).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it("REGRESSION: rejects a public-looking hostname that DNS-resolves to a private IP (rebinding)", async () => {
    // This is exactly the bypass that existed before the fix: the
    // hostname string itself contains nothing private, so the old
    // literal-only check let it straight through.
    mockResolve4.mockResolvedValue(["169.254.169.254"]);

    await expect(
      isSafeUrl("http://attacker-controlled.example.com/hook"),
    ).resolves.toBe(false);
    await expect(
      assertSafeUrl("http://attacker-controlled.example.com/hook"),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockResolve4).toHaveBeenCalledWith(
      "attacker-controlled.example.com",
    );
  });

  it("rejects a hostname that resolves to loopback via rebinding", async () => {
    mockResolve4.mockResolvedValue(["127.0.0.1"]);
    await expect(
      isSafeUrl("http://looks-legit.example.com/hook"),
    ).resolves.toBe(false);
  });

  it("allows a hostname that resolves only to public IPs", async () => {
    mockResolve4.mockResolvedValue(["93.184.216.34"]); // example.com-ish public IP
    await expect(isSafeUrl("https://example.com/hook")).resolves.toBe(true);
  });

  it("fails closed when a hostname can't be resolved at all", async () => {
    mockResolve4.mockRejectedValue(new Error("ENOTFOUND"));
    await expect(
      isSafeUrl("https://does-not-exist.invalid/hook"),
    ).resolves.toBe(false);
  });

  it("rejects non-http(s) schemes without touching DNS", async () => {
    mockResolve4.mockRejectedValue(new Error("should not be called"));
    await expect(isSafeUrl("ftp://example.com/hook")).resolves.toBe(false);
    await expect(isSafeUrl("file:///etc/passwd")).resolves.toBe(false);
  });

  it("rejects blocked hostnames (metadata endpoints) without needing DNS to resolve them", async () => {
    await expect(isSafeUrl("http://metadata.google.internal/")).resolves.toBe(
      false,
    );
    expect(mockResolve4).not.toHaveBeenCalled();
  });
});
