import * as React from "react";
import { EmailText, EmailLink } from "@arcevo/facet-emails";

interface MailLinkFallbackProps {
  href: string;
  label?: string;
}

export const MailLinkFallback = ({ href, label }: MailLinkFallbackProps) => (
  <>
    <EmailText variant="small" style={{ marginBottom: "4px", marginTop: "24px" }}>
      {label ??
        "If the button above doesn't work, copy and paste this link into your browser:"}
    </EmailText>
    <EmailLink href={href} style={{ fontSize: "12px", wordBreak: "break-all" }}>
      {href}
    </EmailLink>
  </>
);

export default MailLinkFallback;
