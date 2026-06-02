import * as React from "react";
import { Button } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailButtonProps {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "danger";
}

export const MailButton = ({
  href,
  children,
  variant = "primary",
}: MailButtonProps) => (
  <Button
    href={href}
    style={{
      backgroundColor: variant === "danger" ? t.color.danger : t.color.primary,
      borderRadius: t.radius.md,
      color: t.color.textInverse,
      display: "block",
      fontSize: t.font.sizeMd,
      fontWeight: "600",
      padding: "13px 24px",
      textAlign: "center",
      textDecoration: "none",
      width: "100%",
      boxSizing: "border-box",
      marginBottom: t.space.lg,
    }}
  >
    {children}
  </Button>
);
