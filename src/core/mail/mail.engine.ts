import * as React from "react";
import {
  renderEmailFromReact,
  renderEmailText,
  toTemplateTree,
  renderEmail,
  type TemplateNode,
} from "@arcevo/facet-emails";
import { ARCID_EMAIL_BRAND, injectEmailCssVars } from "./brand";

/**
 * Compiles a React email element to a complete HTML document string.
 *
 * This wraps facet-emails' `renderEmailFromReact` and injects the ArcID
 * CSS variables into the `<style>` block so that component-level
 * `var(--primary)` / `var(--surface)` references resolve to ArcID colors
 * instead of facet's defaults.
 *
 * Always await before passing html to Resend.
 */
export async function compileMailTemplate(
  element: React.ReactElement,
): Promise<string> {
  const html = await renderEmailFromReact(element, {
    brand: ARCID_EMAIL_BRAND,
  });
  return injectEmailCssVars(html);
}

/**
 * Compiles a React email element to plain-text for email clients that
 * strip HTML.  Uses the framework-agnostic `renderEmailText` path.
 */
export async function compileMailText(
  element: React.ReactElement,
): Promise<string> {
  return renderEmailText(toTemplateTree(element));
}

/**
 * Compiles a template tree (framework-agnostic) to a full HTML document.
 * Used by the facet-emails preview server.
 */
export function compileMailTree(tree: TemplateNode): string {
  const html = renderEmail(tree, { brand: ARCID_EMAIL_BRAND });
  return injectEmailCssVars(html);
}
