import * as React from "react";
import { Section, Text } from "@react-email/components";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { tokens as t } from "../components/tokens";

export interface MfaCodeMailProps {
  code: string;
  name?: string;
  /** Seconds until expiry — default 600 (10 min) */
  ttlSec?: number;
}

export const MfaCodeMail = ({ code, name, ttlSec = 600 }: MfaCodeMailProps) => {
  const minutes = Math.round(ttlSec / 60);
  return (
    <MailLayout
      previewText={`Your ArcID verification code: ${code}`}
      heading="Verification Code"
    >
      <MailText>
        Hi {name ? name : "there"}, use the code below to complete your sign-in.
      </MailText>

      {/* Big code display */}
      <Section
        style={{
          backgroundColor: t.color.bgMuted,
          border: `1px solid ${t.color.border}`,
          borderRadius: t.radius.md,
          padding: `${t.space.xl} ${t.space.lg}`,
          textAlign: "center",
          marginBottom: t.space.lg,
        }}
      >
        <Text
          style={{
            fontFamily: t.font.mono,
            fontSize: "36px",
            fontWeight: "700",
            letterSpacing: "0.3em",
            color: t.color.text,
            margin: 0,
          }}
        >
          {code}
        </Text>
      </Section>

      <MailText variant="small">
        This code expires in <strong>{minutes} minutes</strong> and can only be
        used once. Never share this code with anyone.
      </MailText>
    </MailLayout>
  );
};

export default MfaCodeMail;
