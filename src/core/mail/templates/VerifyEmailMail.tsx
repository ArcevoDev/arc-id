import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailDivider,
  EmailSection,
  EmailList,
  EmailLink,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE, MAIL_RADIUS, MAIL_FONT } from "../brand";

export interface VerifyEmailMailProps {
  verifyUrl: string;
  name?: string;
}

export const VerifyEmailMail = ({ verifyUrl, name }: VerifyEmailMailProps) => (
  <EmailLayout
    previewText="One last step: verify your email and step into your ArcID identity"
    heading="Verify Your Email Address"
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
      Welcome to ArcID
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} your ArcID profile is nearly ready.
      One small step remains: confirming that this inbox is truly yours.
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      Verification is the first stone in the foundation of your digital
      identity - the anchor that keeps every credential, passkey, and signature
      tied to you, and only you. It takes a moment, and it unlocks everything.
    </EmailText>

    <EmailButton href={verifyUrl}>Verify Email Address</EmailButton>

    <EmailDivider />

    <EmailSection
      style={{
        backgroundColor: MAIL_COLOR.bgMuted,
        border: `1px solid ${MAIL_COLOR.border}`,
        borderRadius: MAIL_RADIUS.md,
        padding: MAIL_SPACE.lg,
        marginBottom: MAIL_SPACE.lg,
      }}
    >
      <EmailText
        style={{
          color: MAIL_COLOR.textMuted,
          fontSize: MAIL_FONT.sizeSm,
          fontWeight: 600,
          marginBottom: MAIL_SPACE.sm,
        }}
      >
        Once verified, your ArcID account gives you:
      </EmailText>
      <EmailList
        items={[
          "Passkey and passwordless sign-in across connected services",
          "A verifiable identity you carry with you, not stored on someone else's server",
          "Secure multi-tenant access - one identity, many trusted doors",
          "Full control over which data you share, and with whom",
        ]}
      />
    </EmailSection>

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      This link expires in <strong>1 hour</strong>. If you didn't create an
      ArcID account, you can safely ignore this email - no action will be
      taken, and nothing will be activated.
    </EmailText>

    <EmailText
      variant="small"
      style={{ marginBottom: "4px", marginTop: "24px" }}
    >
      If the button above doesn't work, copy and paste this link into your browser:
    </EmailText>
    <EmailLink
      href={verifyUrl}
      style={{ fontSize: "12px", wordBreak: "break-all" }}
    >
      {verifyUrl}
    </EmailLink>
  </EmailLayout>
);

export default VerifyEmailMail;
