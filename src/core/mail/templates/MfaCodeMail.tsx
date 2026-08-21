import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailSection,
  EmailDivider,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE, MAIL_FONT, MAIL_RADIUS } from "../brand";

export interface MfaCodeMailProps {
  code: string;
  name?: string;
  /** Seconds until expiry - default 600 (10 min) */
  ttlSec?: number;
}

export const MfaCodeMail = ({
  code,
  name,
  ttlSec = 600,
}: MfaCodeMailProps) => {
  const minutes = Math.round(ttlSec / 60);
  return (
    <EmailLayout
      previewText={`Your ArcID verification code is ${code} - valid for ${minutes} minutes`}
      heading="Verification Code"
      brandName="ArcID"
      footerNote="This message was sent by ArcID, the sovereign identity engine. You are receiving it because this address is connected to an ArcID account."
      footerMeta={`© ${new Date().getFullYear()} ArcID. All rights reserved.`}
    >
      <EmailText
        style={{
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: MAIL_COLOR.textMuted,
          marginBottom: MAIL_SPACE.sm,
        }}
      >
        Two-factor authentication
      </EmailText>

      <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
        {name ? `Hello ${name},` : "Hello,"} a sign-in to your ArcID account is
        waiting on one last proof: the code below. It's the second lock on your
        door - the one only you hold.
      </EmailText>

      {/* Big code display */}
      <EmailSection
        style={{
          backgroundColor: MAIL_COLOR.bgMuted,
          border: `1px solid ${MAIL_COLOR.border}`,
          borderRadius: MAIL_RADIUS.md,
          padding: `${MAIL_SPACE.xl} ${MAIL_SPACE.lg}`,
          textAlign: "center",
          marginBottom: MAIL_SPACE.lg,
        }}
      >
        <EmailText
          style={{
            fontFamily: MAIL_FONT.mono,
            fontSize: "36px",
            fontWeight: "700",
            letterSpacing: "0.3em",
            color: MAIL_COLOR.text,
            margin: 0,
            textAlign: "center",
          }}
        >
          {code}
        </EmailText>
      </EmailSection>

      <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
        This code expires in <strong>{minutes} minutes</strong> and can only be
        used once.
      </EmailText>

      <EmailDivider />

      <EmailText variant="muted" style={{ marginBottom: MAIL_SPACE.md }}>
        ArcID will never ask you for this code by phone, chat, or email. If
        someone does, they are not us - end the conversation.
      </EmailText>
    </EmailLayout>
  );
};

export default MfaCodeMail;
