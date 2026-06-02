import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailLinkFallback } from "../components/MailLinkFallback";

export interface PasswordResetMailProps {
  resetUrl: string;
  name?: string;
  ip?: string;
}

export const PasswordResetMail = ({
  resetUrl,
  name,
  ip,
}: PasswordResetMailProps) => (
  <MailLayout
    previewText="Reset your ArcID password"
    heading="Password Reset Request"
  >
    <MailText>
      Hi {name ? name : "there"}, we received a request to reset the password
      for your ArcID account.
    </MailText>

    <MailButton href={resetUrl} variant="primary">
      Reset Password
    </MailButton>

    <MailSecurityNotice variant="warning">
      ⚠️ This link expires in <strong>1 hour</strong>.
      {ip ? ` Request originated from IP: ${ip}.` : ""} If you didn't request a
      password reset, you can ignore this email — your password has not been
      changed.
    </MailSecurityNotice>

    <MailLinkFallback href={resetUrl} />
  </MailLayout>
);

export default PasswordResetMail;
