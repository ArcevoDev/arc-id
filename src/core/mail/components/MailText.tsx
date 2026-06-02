import * as React from "react";
import { Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailTextProps {
  children: React.ReactNode;
  variant?: "body" | "small" | "muted";
  mb?: string;
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  body: {
    color: t.color.text,
    fontSize: t.font.sizeMd,
    lineHeight: "26px",
    marginTop: 0,
  },
  small: {
    color: t.color.textMuted,
    fontSize: t.font.sizeSm,
    lineHeight: "22px",
    marginTop: 0,
  },
  muted: {
    color: t.color.textLight,
    fontSize: t.font.sizeSm,
    lineHeight: "20px",
    marginTop: 0,
  },
};

export const MailText = ({
  children,
  variant = "body",
  mb = "16px",
}: MailTextProps) => (
  <Text style={{ ...VARIANT_STYLES[variant], marginBottom: mb }}>
    {children}
  </Text>
);
