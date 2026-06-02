import * as React from "react";
import { Link, Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailLinkFallbackProps {
  href: string;
  label?: string;
}

export const MailLinkFallback = ({ href, label }: MailLinkFallbackProps) => (
  <>
    <Text
      style={{
        color: t.color.textMuted,
        fontSize: t.font.sizeSm,
        marginBottom: "4px",
        marginTop: "24px",
      }}
    >
      {label ??
        "If the button above doesn't work, copy and paste this link into your browser:"}
    </Text>
    <Link
      href={href}
      style={{
        color: t.color.link,
        fontSize: t.font.sizeXs,
        wordBreak: "break-all",
      }}
    >
      {href}
    </Link>
  </>
);
