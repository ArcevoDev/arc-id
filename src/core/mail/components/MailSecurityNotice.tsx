import * as React from "react";
import { EmailSecurityNotice } from "@arcevo/facet-emails";

interface MailSecurityNoticeProps {
  children: React.ReactNode;
  variant?: "warning" | "danger" | "info";
  ip?: string;
  userAgent?: string;
  location?: string;
}

export const MailSecurityNotice = ({
  children,
  variant = "warning",
  ip,
  userAgent,
  location,
}: MailSecurityNoticeProps) => (
  <EmailSecurityNotice
    variant={variant}
    ip={ip}
    userAgent={userAgent}
    location={location}
  >
    {children}
  </EmailSecurityNotice>
);

export default MailSecurityNotice;
