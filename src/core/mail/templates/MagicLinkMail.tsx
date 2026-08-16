import * as React from "react";
import {
  MailLayout,
  MailButton,
  MailText,
  MailSecurityNotice,
  MailLinkFallback,
} from "../components";

export interface MagicLinkMailProps {
  loginUrl: string;
  name?: string;
  ip?: string;
}

export const MagicLinkMail = ({ loginUrl, name, ip }: MagicLinkMailProps) => (
  <MailLayout
    previewText="Your one-tap sign-in link for ArcID - valid for 15 minutes"
    heading="Secure Sign-In Link"
    eyebrow="Passwordless access"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} a passwordless sign-in was just
      requested for your ArcID account. No passwords, no friction - just a
      single, secure link that knows it's you.
    </MailText>

    <MailButton href={loginUrl}>Sign In to ArcID</MailButton>

    <MailSecurityNotice variant="warning" ip={ip}>
      ðŸ”’ This link expires in <strong>15 minutes</strong> and can only be used
      once. Never forward it - anyone with this link can access your account.
    </MailSecurityNotice>

    <MailText variant="small">
      Didn't request this link? Your account remains secure - simply ignore
      this email and the link will expire on its own.
    </MailText>

    <MailLinkFallback href={loginUrl} />
  </MailLayout>
);

export default MagicLinkMail;
