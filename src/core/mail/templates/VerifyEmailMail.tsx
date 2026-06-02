import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailLinkFallback } from "../components/MailLinkFallback";

export interface VerifyEmailMailProps {
  verifyUrl: string;
  name?: string;
}

export const VerifyEmailMail = ({ verifyUrl, name }: VerifyEmailMailProps) => (
  <MailLayout
    previewText="Verify your email address to activate your ArcID profile"
    heading="Verify Your Email Address"
  >
    <MailText>
      Hi {name ? name : "there"}, welcome to ArcID. Please confirm your email
      address by clicking the button below to activate your account.
    </MailText>

    <MailButton href={verifyUrl}>Verify Email Address</MailButton>

    <MailText variant="small">
      This link expires in <strong>1 hour</strong>. If you didn't create an
      ArcID account, you can safely ignore this email.
    </MailText>

    <MailLinkFallback href={verifyUrl} />
  </MailLayout>
);

export default VerifyEmailMail;
