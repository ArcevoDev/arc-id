// Standalone mail-template render check.
// Run: node --import tsx scripts/check-mail-render.ts
// Compiles every template in the registry to HTML + text, verifying each
// renders without throwing through the facet-emails renderer.
import { TEMPLATE_REGISTRY, TEMPLATE_NAMES } from "../src/core/mail/preview/template-registry";
import { compileMailTree } from "../src/core/mail/mail.engine";
import { renderEmailText } from "@arcevo/facet-emails";

let pass = 0;
let fail = 0;

for (const name of TEMPLATE_NAMES) {
  try {
    const template = TEMPLATE_REGISTRY[name];
    const tree =
      typeof template.tree === "function" ? template.tree() : template.tree;
    const html = compileMailTree(tree);
    const text = renderEmailText(tree);
    if (!html || html.length < 200) throw new Error("html too short");
    if (!text || text.length < 20) throw new Error("text too short");
    pass++;
    console.log(`  ok ${name} (${html.length}b html, ${text.length}b text)`);
  } catch (err) {
    fail++;
    console.log(`  FAIL ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n== RESULT: ${pass} passed, ${fail} failed ==`);
process.exit(fail > 0 ? 1 : 0);
