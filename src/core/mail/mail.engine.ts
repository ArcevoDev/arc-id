import * as React from "react";
import { render } from "@react-email/components";

/**
 * Compiles a React Email component to a flat HTML string.
 * Always await this before passing html to Resend.
 */
export async function compileMailTemplate(
  element: React.ReactElement,
): Promise<string> {
  return render(element);
}

/**
 * Compiles to plain-text version for email clients that strip HTML.
 */
export async function compileMailText(
  element: React.ReactElement,
): Promise<string> {
  return render(element, { plainText: true });
}
