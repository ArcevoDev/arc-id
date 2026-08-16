import * as React from "react";
import { EmailLayout, EmailText } from "@arcevo/facet-emails";

interface MailLayoutProps {
  previewText: string;
  heading: string;
  /** Optional eyebrow label above the heading (e.g. "SECURITY ALERT"). */
  eyebrow?: string;
  children: React.ReactNode;
  /** Optional footer note - defaults to standard ArcID footer */
  footerNote?: string;
}

/**
 * ArcID mail shell. Thin wrapper over the facet-emails EmailLayout.
 * The ArcID design tokens are passed as the renderer `brand` option by
 * mail.engine.ts, so layout, button, text, and notice primitives all
 * inherit the ArcID look.
 */
export const MailLayout = ({
  previewText,
  heading,
  eyebrow,
  children,
  footerNote,
}: MailLayoutProps) => (
  <EmailLayout
    previewText={previewText}
    heading={heading}
    brandName="ArcID"
    footerNote={
      footerNote ??
      "This message was sent by ArcID, the sovereign identity engine. You are receiving it because this address is connected to an ArcID account."
    }
    footerMeta={`© ${new Date().getFullYear()} ArcID. All rights reserved.`}
  >
    {eyebrow ? (
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "#6b7280",
          marginBottom: "8px",
        }}
      >
        {eyebrow}
      </div>
    ) : null}
    {children}
  </EmailLayout>
);

export default MailLayout;
