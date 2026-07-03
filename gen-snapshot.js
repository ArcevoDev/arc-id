import fs from "fs";
import path from "path";

const IGNORED_ITEMS = new Set([
  // Build outputs & deps
  ".next",
  "node_modules",
  ".git",
  ".husky",
  "out",
  ".vercel",
  "coverage",
  ".DS_Store",
  "generated",
  "repo_structure.txt",
  "arcid_codebase_snapshot.txt",
  "scripts",
  "gen-structure.js",
  "pnpm-lock.yaml",
  "tsconfig.tsbuildinfo",
  // "migrations",
  "public",

  // ── SECURITY: Never include in snapshots ──────────────────────────────────
  // These files contain secrets, private keys, and credentials.
  // Sharing a snapshot that includes them exposes credentials to whoever
  // receives it — AI tools, collaborators, issue trackers, etc.
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  ".env.test",
  "certs", // RSA private keys
  "*.pem", // any PEM files at root level
  "secrets", // common secrets directory name
  ".secrets",
]);

const EXTENSION_BLACKLIST = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".svg",
  ".mp4",
  ".mp3",
  ".pdf",
  ".zip",
  // Also skip PEM/key files wherever they appear in the tree
  ".pem",
  ".key",
  ".p12",
  ".pfx",
  ".der",
]);

function generateTree(dir, indent = "") {
  try {
    const items = fs
      .readdirSync(dir)
      .filter((item) => !IGNORED_ITEMS.has(item))
      .sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
        return (bIsDir ? 1 : 0) - (aIsDir ? 1 : 0) || a.localeCompare(b);
      });

    let treeStr = "";
    items.forEach((item) => {
      const itemPath = path.join(dir, item);
      const isDir = fs.statSync(itemPath).isDirectory();
      const connector = item === items[items.length - 1] ? "└── " : "├── ";

      if (isDir) {
        treeStr += `${indent}${connector}${item}/\n`;
        treeStr += generateTree(
          itemPath,
          indent + (item === items[items.length - 1] ? "    " : "│   "),
        );
      } else {
        treeStr += `${indent}${connector}${item}\n`;
      }
    });
    return treeStr;
  } catch (err) {
    return `[Error reading directory: ${err?.message ?? String(err)}]\n`;
  }
}

function extractContents(dir, rootDir, accumulator = { text: "" }) {
  try {
    const items = fs
      .readdirSync(dir)
      .filter((item) => !IGNORED_ITEMS.has(item));

    items.forEach((item) => {
      const itemPath = path.join(dir, item);
      if (fs.statSync(itemPath).isDirectory()) {
        extractContents(itemPath, rootDir, accumulator);
      } else {
        const ext = path.extname(item).toLowerCase();
        const relativePath = path.relative(rootDir, itemPath);

        accumulator.text += `\n==================================================\nFILE: ${relativePath}\n==================================================\n`;

        if (EXTENSION_BLACKLIST.has(ext)) {
          accumulator.text += `[Binary/Sensitive Skipped]\n\n`;
          return;
        }

        try {
          const contents = fs.readFileSync(itemPath, "utf-8");
          accumulator.text += `\`\`\`${ext.replace(".", "") || "text"}\n${contents}${contents.endsWith("\n") ? "" : "\n"}\`\`\`\n\n`;
        } catch (e) {
          accumulator.text += `[Error reading file: ${e?.message}]\n\n`;
        }
      }
    });
    return accumulator.text;
  } catch (err) {
    return accumulator.text + `[Error crawling scope: ${err?.message}]\n`;
  }
}

const rootDir = process.cwd();
const visualTree = `${path.basename(rootDir)}/\n${generateTree(rootDir)}`;
const fileContentsDump = extractContents(rootDir, rootDir);

fs.writeFileSync(
  "arcid_codebase_snapshot.txt",
  `=== STRUCTURE ===\n${visualTree}\n=== CONTENTS ===\n${fileContentsDump}`,
  "utf-8",
);
console.log(
  "✨ Success! Structure and all contents written to arcid_codebase_snapshot.txt",
);
