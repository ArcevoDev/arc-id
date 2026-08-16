import * as React from "react";
import { EmailSecurityNotice } from "@arcevo/facet-emails";

interface MailSecurityNoticeProps {
  children: React.ReactNode;
  variant?: "warning" | "danger" | "info";
}

export const MailSecurityNotice = ({
  children,
  variant = "warning",
}: MailSecurityNoticeProps) => (
  <EmailSecurityNotice variant={variant}>{children}</EmailSecurityNotice>
);

export default MailSecurityNotice;
