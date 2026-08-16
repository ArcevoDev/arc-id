// scripts/scan-secrets.ts
//
// Secrets / PII log scan for the arc-id repo.
//
// Usage:  pnpm scan:secrets
// Exit:   0 = clean, 1 = findings
//
// Scans tracked source areas (.env* files, src/, prisma/, docs/, scripts/)
// for high-entropy credential material and PII dumps that must never reach
// logs or VCS. Node_modules, .git, and generated artifacts are excluded.
//
// This is a lint-style guard, not a substitute for gitleaks/trufflehog in CI -
// it catches the classes of leaks that matter for this codebase (real secrets
// in config, credentials logged in plaintext, key material in docs).

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const EXCLUDE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "coverage",
  ".vitest-reports",
  ".agent",
]);

const EXCLUDE_FILES = new Set([
  // This very script - its patterns intentionally match the sample strings
  // used in test fixtures and CI placeholder secrets.
  "scan-secrets.ts",
]);

// ── Patterns ─────────────────────────────────────────────────────────────────

// Each entry: [name, regex, allowlist-regex]
// allowlist-regex: if it matches, the line is ignored (documented placeholders,
// test fixtures, KMS references etc.).
const PATTERNS: Array<[string, RegExp, RegExp | null]> = [
  // Private key material (PEM headers)
  [
    "PRIVATE_KEY",
    /-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/i,
    null,
  ],
  // AWS access keys
  ["AWS_ACCESS_KEY", /\bAKIA[0-9A-Z]{16}\b/, null],
  // Generic high-entropy API keys assigned to known secret vars.
  // Only matches `SECRET_VAR = "value"`-style assignments (env files, config
  // defaults), not object-literal keys like `refreshToken:` in code.
  [
    "API_KEY_SECRET",
    /(?:api[_-]?key|client[_-]?secret|webhook[_-]?secret|signing[_-]?secret|jwt[_-]?secret|cookie[_-]?secret|redis[_-]?token|secret[_-]?key|private[_-]?key|password|passwd)\s*[:=]\s*["'][^"']{16,}["']/i,
    /(?:change-me|YOUR_|your[_-]|PLACEHOLDER|placeholder|example|test[_-]?|mock[_-]?|fixture|ci-test|re_ci_|sk_test|argon2id|\.\.\.|xxxx|process\.env|\$\{|env\.)/i,
  ],
  // SLACK/BOT tokens
  ["BOT_TOKEN", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/, null],
  // GitHub tokens
  ["GITHUB_TOKEN", /\bgh[pousr]_[0-9A-Za-z]{36,}\b/, null],
  // Google API keys
  ["GOOGLE_API_KEY", /\bAIza[0-9A-Za-z_-]{35}\b/, null],
  // Stripe live keys
  ["STRIPE_LIVE_KEY", /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/, null],
  // Generic RSA/DSA/EC key material in base64 (16+ chars after a key label)
  [
    "KEY_MATERIAL",
    /(?:privateKey|secretKey|signingKey|private_key|secret_key)\s*[:=]\s*["']?[A-Za-z0-9+/=]{40,}["']?/i,
    /(?:getConfig|env\.|process\.env|KMS|kms|reference|arn:|arn:aws|placeholder|example)/i,
  ],
  // PII dump: name + email + phone/address in one line (log-line signature)
  [
    "PII_DUMP",
    /[A-Z][a-z]+ [A-Z][a-z]+.{0,40}[\w.+-]+@[\w-]+\.[\w.]{2,}.{0,40}(?:\+?\d[\d\s-]{7,}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/,
    /(?:@example\.com|example\.com|test|fixture|sample)/i,
  ],
  // Secrets in comments that look like they were pasted from production
  [
    "PROD_SECRET_COMMENT",
    /(?:production|prod|live)\s*(?:key|secret|token|password)\s*[:=]\s*["']?[A-Za-z0-9_\-\.\/\+]{24,}/i,
    /(?:example|placeholder|your_|YOUR_|\.\.\.)/i,
  ],
];

// ── Walk ─────────────────────────────────────────────────────────────────────

interface Finding {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (EXCLUDE_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs));
    } else if (entry.isFile()) {
      out.push(abs);
    }
  }
  return out;
}

function isText(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return ![".png", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".ttf", ".lock"].includes(ext);
}

function scanFile(file: string, findings: Finding[]): void {
  if (EXCLUDE_FILES.has(path.basename(file))) return;
  if (!isText(file)) return;
  let content: string;
  try {
    content = fs.readFileSync(file, "utf8");
  } catch {
    return;
  }
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const [name, re, allowlist] of PATTERNS) {
      if (!re.test(line)) continue;
      if (allowlist && allowlist.test(line)) continue;
      const trimmed = line.trim().slice(0, 160);
      findings.push({ file, line: i + 1, pattern: name, snippet: trimmed });
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

const targets = ["src", "prisma", "docs", "scripts"].map((t) => {
  const abs = path.join(ROOT, t);
  return fs.existsSync(abs) && fs.statSync(abs).isDirectory() ? walk(abs) : [];
});
// Only scan the committed .env.example - the live .env is gitignored/local
// and its real secrets are not part of the repo's risk surface.
const envFiles = [".env.example", ".env.test", ".env.ci"].filter((f) =>
  fs.existsSync(path.join(ROOT, f)),
);
const files = [
  ...envFiles.map((f) => path.join(ROOT, f)),
  ...targets.flat(),
].filter((f) => f && fs.existsSync(f));

const findings: Finding[] = [];
for (const file of files) scanFile(file, findings);

if (findings.length === 0) {
  console.log(`✅ scan:secrets - clean (${files.length} files scanned)`);
  process.exit(0);
}

console.error(`❌ scan:secrets - ${findings.length} potential secret/PII leak(s):\n`);
for (const f of findings) {
  const rel = path.relative(ROOT, f.file).replace(/\\/g, "/");
  console.error(`  [${f.pattern}] ${rel}:${f.line}`);
  console.error(`    ${f.snippet}\n`);
}
process.exit(1);
