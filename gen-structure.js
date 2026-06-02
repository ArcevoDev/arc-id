const fs = require("fs");
const path = require("path");

const IGNORED_ITEMS = new Set([
  ".next",
  "node_modules",
  ".git",
  "out",
  ".vercel",
  "coverage",
  ".DS_Store",
  "repo_structure.txt",
]);

function generateTree(dir, indent = "", isLast = true) {
  try {
    const items = fs
      .readdirSync(dir)
      .filter((item) => !IGNORED_ITEMS.has(item))
      .sort((a, b) => {
        const aIsDir = fs.statSync(path.join(dir, a)).isDirectory();
        const bIsDir = fs.statSync(path.join(dir, b)).isDirectory();
        return bIsDir - aIsDir || a.localeCompare(b);
      });

    let treeStr = "";
    items.forEach((item, i) => {
      const itemPath = path.join(dir, item);
      const isItemLast = i === items.length - 1;
      const connector = isItemLast ? "└── " : "├── ";
      const isDir = fs.statSync(itemPath).isDirectory();

      if (isDir) {
        treeStr += `${indent}${connector}${item}/\n`;
        const nextIndent = indent + (isItemLast ? "    " : "│   ");
        treeStr += generateTree(itemPath, nextIndent, isItemLast);
      } else {
        treeStr += `${indent}${connector}${item}\n`;
      }
    });
    return treeStr;
  } catch (err) {
    return "";
  }
}

const rootDir = process.cwd();
const repoName = path.basename(rootDir);

console.log("Parsing Next.js repository structure...");
const finalTree = `${repoName}/\n${generateTree(rootDir)}`;

fs.writeFileSync("repo_structure.txt", finalTree, "utf-8");
console.log("✨ Success! Structure saved to repo_structure.txt");
