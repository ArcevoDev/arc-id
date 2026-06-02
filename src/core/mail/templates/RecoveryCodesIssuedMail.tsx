import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailCodeBlock } from "../components/MailCodeBlock";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailDivider } from "../components/MailDivider";

export interface RecoveryCodesIssuedMailProps {
  codes: string[];
  name?: string;
}

export const RecoveryCodesIssuedMail = ({
  codes,
  name,
}: RecoveryCodesIssuedMailProps) => (
  <MailLayout
    previewText="Your ArcID MFA recovery codes — save these now"
    heading="Save Your Recovery Codes"
  >
    <MailText>
      Hi {name ? name : "there"}, two-factor authentication has been enabled on
      your ArcID account. Below are your one-time recovery codes.
    </MailText>

    <MailSecurityNotice variant="warning">
      ⚠️ <strong>Save these codes somewhere safe.</strong> Each code can only be
      used once if you lose access to your authenticator app. These codes are
      shown only this once and cannot be retrieved later.
    </MailSecurityNotice>

    <MailCodeBlock
      codes={codes}
      label="One-time recovery codes (each can be used once):"
      columns={2}
    />

    <MailDivider />

    <MailText variant="muted">
      Store these in a password manager, printed in a locked drawer, or another
      safe location outside your primary device.
    </MailText>
  </MailLayout>
);

export default RecoveryCodesIssuedMail;
