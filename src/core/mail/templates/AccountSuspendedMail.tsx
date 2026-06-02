import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";

export interface AccountSuspendedMailProps {
  name?: string;
  reason?: string;
}

export const AccountSuspendedMail = ({
  name,
  reason,
}: AccountSuspendedMailProps) => (
  <MailLayout
    previewText="Your ArcID account has been suspended"
    heading="Account Suspended"
    footerNote="This is an automated security notice from ArcID."
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account has been suspended.
    </MailText>

    {reason && (
      <MailSecurityNotice variant="danger">Reason: {reason}</MailSecurityNotice>
    )}

    <MailText>
      If you believe this is an error or would like to appeal, please contact
      our support team. Include your account email in your message.
    </MailText>

    <MailText variant="small">
      While suspended, you will not be able to sign in or access
      ArcID-integrated services.
    </MailText>
  </MailLayout>
);

export default AccountSuspendedMail;
