import * as React from "react";
import { Section, Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailSecurityNoticeProps {
  children: React.ReactNode;
  variant?: "warning" | "danger" | "info";
}

const STYLES: Record<string, { bg: string; border: string; text: string }> = {
  warning: {
    bg: t.color.warningBg,
    border: t.color.warning,
    text: t.color.warning,
  },
  danger: {
    bg: t.color.dangerBg,
    border: t.color.danger,
    text: t.color.danger,
  },
  info: {
    bg: t.color.bgMuted,
    border: t.color.border,
    text: t.color.textMuted,
  },
};

export const MailSecurityNotice = ({
  children,
  variant = "warning",
}: MailSecurityNoticeProps) => {
  const s = STYLES[variant];
  return (
    <Section
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: t.radius.md,
        padding: `${t.space.md} ${t.space.lg}`,
        marginBottom: t.space.lg,
      }}
    >
      <Text
        style={{
          color: s.text,
          fontSize: t.font.sizeSm,
          lineHeight: "20px",
          margin: 0,
          fontWeight: "500",
        }}
      >
        {children}
      </Text>
    </Section>
  );
};
