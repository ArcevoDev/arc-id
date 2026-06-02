const fs = require("fs");
const path = require("path");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes("node_modules") && !file.includes(".next")) {
        results = results.concat(walk(file));
      }
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      results.push(file);
    }
  });
  return results;
}

console.log("Analyzing flow logs for positional argument mismatches...");
const files = walk(path.join(process.cwd(), "src"));

// Target pattern: ctx.logger?.error({ meta }, "message")
const logRegex = /ctx\.logger(\??)\.error\(([^,]+),[[:space:]]*"([^"]+)"\)/g;

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, "utf8");
  if (logRegex.test(content)) {
    // Flip the meta payload and string message positions smoothly
    const fixedContent = content.replace(
      logRegex,
      'ctx.logger$1.error("$3", $2)',
    );
    fs.writeFileSync(filePath, fixedContent, "utf8");
    console.log(
      `✨ Safely Realigned Logs inside: ${path.relative(process.cwd(), filePath)}`,
    );
  }
});
console.log("Done structural alignment optimization!");
