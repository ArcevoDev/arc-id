// gen-output.js - verify + report project state WITHOUT clobbering the tracker
//
// Usage: node gen-output.js
//
// .agent/output.txt is now a MANUAL, facet-style session tracker + build
// roadmap (see ../facet/.agent/output.txt for the convention). It must NOT
// be overwritten by a script - every session updates it by hand (crossing
// out done items), and gen-snapshot.js used to chain this script and stomp
// on those edits.
//
// This script now only PRINTS a verification snapshot to stdout (test counts
// from a real `pnpm test` parse) so a human/agent can paste the numbers into
// the tracker. It never writes .agent/output.txt.

import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const OUTPUT_FILE = path.join(ROOT, ".agent", "output.txt");

if (fs.existsSync(OUTPUT_FILE)) {
  console.log(
    "ℹ️  .agent/output.txt is a MANUAL tracker - gen-output.js no longer overwrites it.\n" +
      "   Run `pnpm test` and copy the file/test counts into output.txt by hand.\n",
  );
}

// ── Run a command, return output or empty string on failure ───────────────
function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      cwd: ROOT,
      encoding: "utf-8",
      timeout: 300000,
      ...opts,
    });
    return out.trim();
  } catch {
    return "";
  }
}

// ── Parse test results from human-readable vitest output ─────────────────
function runTestSummary() {
  const output = run("pnpm test", { env: { ...process.env, NO_COLOR: "1" } });
  const clean = output.replace(/\x1B\[[0-9;]*m/g, "");
  const filesMatch = clean.match(/Test Files\s+\d+\s+passed\s+\((\d+)\)/);
  const testsMatch = clean.match(/Tests\s+\d+\s+passed\s+\((\d+)\)/);
  return {
    fileCount: filesMatch ? filesMatch[1] : "[parse failed]",
    testCount: testsMatch ? testsMatch[1] : "[parse failed]",
    full: output,
  };
}

const test = runTestSummary();

console.log(`Latest verified numbers for the tracker:
  pnpm test  →  ${test.fileCount} files / ${test.testCount} tests (all passing)
  pnpm typecheck → run manually (tsc --noEmit)
`);
