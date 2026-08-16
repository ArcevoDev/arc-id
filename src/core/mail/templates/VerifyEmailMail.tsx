import * as React from "react";
import { EmailSection, EmailText, EmailList } from "@arcevo/facet-emails";
import {
  MailLayout,
  MailButton,
  MailText,
  MailDivider,
  MailLinkFallback,
  tokens as t,
} from "../components";

export interface VerifyEmailMailProps {
  verifyUrl: string;
  name?: string;
}

export const VerifyEmailMail = ({ verifyUrl, name }: VerifyEmailMailProps) => (
  <MailLayout
    previewText="One last step: verify your email and step into your ArcID identity"
    heading="Verify Your Email Address"
    eyebrow="Welcome to ArcID"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} your ArcID profile is nearly ready.
      One small step remains: confirming that this inbox is truly yours.
    </MailText>

    <MailText>
      Verification is the first stone in the foundation of your digital
      identity - the anchor that keeps every credential, passkey, and signature
      tied to you, and only you. It takes a moment, and it unlocks everything.
    </MailText>

    <MailButton href={verifyUrl}>Verify Email Address</MailButton>

    <MailDivider />

    <EmailSection
      style={{
        backgroundColor: t.color.bgMuted,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: t.space.lg,
        marginBottom: t.space.lg,
      }}
    >
      <EmailText
        style={{
          color: t.color.textMuted,
          fontSize: t.font.sizeSm,
          fontWeight: 600,
          marginBottom: t.space.sm,
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

    <MailText variant="small">
      This link expires in <strong>1 hour</strong>. If you didn't create an
      ArcID account, you can safely ignore this email - no action will be
      taken, and nothing will be activated.
    </MailText>

    <MailLinkFallback href={verifyUrl} />
  </MailLayout>
);

export default VerifyEmailMail;
