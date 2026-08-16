import * as React from "react";
import { EmailLayout } from "@arcevo/facet-emails";

interface MailLayoutProps {
  previewText: string;
  heading: string;
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
  children,
  footerNote,
}: MailLayoutProps) => (
  <EmailLayout
    previewText={previewText}
    heading={heading}
    brandName="ArcID"
    footerNote={
      footerNote ??
      "This message was sent by ArcID, the sovereign identity engine."
    }
    footerMeta={`© ${new Date().getFullYear()} ArcID. All rights reserved.`}
  >
    {children}
  </EmailLayout>
);

export default MailLayout;
