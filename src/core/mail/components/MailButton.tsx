import * as React from "react";
import { EmailButton } from "@arcevo/facet-emails";

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
  <EmailButton href={href} variant={variant === "danger" ? "danger" : "primary"}>
    {children}
  </EmailButton>
);

export default MailButton;
