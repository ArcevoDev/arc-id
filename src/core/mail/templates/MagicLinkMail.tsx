import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailLinkFallback } from "../components/MailLinkFallback";

export interface MagicLinkMailProps {
  loginUrl: string;
  name?: string;
  ip?: string;
}

export const MagicLinkMail = ({ loginUrl, name, ip }: MagicLinkMailProps) => (
  <MailLayout
    previewText="Your secure sign-in link for ArcID"
    heading="Secure Sign-In Link"
  >
    <MailText>
      Hi {name ? name : "there"}, we received a passwordless sign-in request for
      your ArcID account. Click the button below to authenticate.
    </MailText>

    <MailButton href={loginUrl}>Sign In to ArcID</MailButton>

    <MailSecurityNotice variant="warning">
      🔒 This link expires in 15 minutes and can only be used once.
      {ip ? ` Request originated from IP: ${ip}` : ""}
    </MailSecurityNotice>

    <MailText variant="small">
      If you didn't request this sign-in link, your account is still secure —
      simply ignore this email.
    </MailText>

    <MailLinkFallback href={loginUrl} />
  </MailLayout>
);

export default MagicLinkMail;
