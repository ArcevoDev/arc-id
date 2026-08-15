import * as React from "react";
import {
  renderEmailFromReact,
  renderEmailText,
  toTemplateTree,
  type EmailBrand,
} from "@arcevo/facet-emails";
import { tokens as t } from "./components/tokens";

/**
 * ArcID brand tokens, mapped into the facet-emails `brand` option so every
 * layout/button/text/notice primitive inherits the ArcID look.
 */
export const ARCID_EMAIL_BRAND: EmailBrand = {
  primary: t.color.primary,
  background: t.color.bgMuted,
  surface: t.color.bg,
  text: t.color.text,
  muted: t.color.textLight,
  fontFamily: t.font.family,
  radius: 8,
  brandName: "ArcID",
};

/**
 * Compiles a facet-emails React element to a flat HTML string.
 * Always await this before passing html to Resend.
 */
export async function compileMailTemplate(
  element: React.ReactElement,
): Promise<string> {
  return renderEmailFromReact(element, { brand: ARCID_EMAIL_BRAND });
}

/**
 * Compiles to plain-text version for email clients that strip HTML.
 */
export async function compileMailText(
  element: React.ReactElement,
): Promise<string> {
  return renderEmailText(toTemplateTree(element));
}
