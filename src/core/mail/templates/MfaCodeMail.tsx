import * as React from "react";
import { EmailSection, EmailText, EmailDivider } from "@arcevo/facet-emails";
import { MailLayout, MailText, tokens as t } from "../components";

export interface MfaCodeMailProps {
  code: string;
  name?: string;
  /** Seconds until expiry - default 600 (10 min) */
  ttlSec?: number;
}

export const MfaCodeMail = ({ code, name, ttlSec = 600 }: MfaCodeMailProps) => {
  const minutes = Math.round(ttlSec / 60);
  return (
    <MailLayout
      previewText={`Your ArcID verification code is ${code} - valid for ${minutes} minutes`}
      heading="Verification Code"
      eyebrow="Two-factor authentication"
    >
      <MailText>
        {name ? `Hello ${name},` : "Hello,"} a sign-in to your ArcID account is
        waiting on one last proof: the code below. It's the second lock on your
        door - the one only you hold.
      </MailText>

      {/* Big code display */}
      <EmailSection
        style={{
          backgroundColor: t.color.bgMuted,
          border: `1px solid ${t.color.border}`,
          borderRadius: t.radius.md,
          padding: `${t.space.xl} ${t.space.lg}`,
          textAlign: "center",
          marginBottom: t.space.lg,
        }}
      >
        <EmailText
          style={{
            fontFamily: t.font.mono,
            fontSize: "36px",
            fontWeight: "700",
            letterSpacing: "0.3em",
            color: t.color.text,
            margin: 0,
            textAlign: "center",
          }}
        >
          {code}
        </EmailText>
      </EmailSection>

      <MailText variant="small">
        This code expires in <strong>{minutes} minutes</strong> and can only be
        used once.
      </MailText>

      <EmailDivider />

      <MailText variant="muted">
        ArcID will never ask you for this code by phone, chat, or email. If
        someone does, they are not us - end the conversation.
      </MailText>
    </MailLayout>
  );
};

export default MfaCodeMail;
