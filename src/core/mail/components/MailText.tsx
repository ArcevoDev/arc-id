import * as React from "react";
import { EmailText } from "@arcevo/facet-emails";

interface MailTextProps {
  children: React.ReactNode;
  variant?: "body" | "small" | "muted";
  mb?: string;
}

const VARIANT_MAP = {
  body: "default",
  small: "small",
  muted: "muted",
} as const;

export const MailText = ({
  children,
  variant = "body",
  mb = "16px",
}: MailTextProps) => (
  <EmailText variant={VARIANT_MAP[variant]} style={{ marginBottom: mb }}>
    {children}
  </EmailText>
);

export default MailText;
