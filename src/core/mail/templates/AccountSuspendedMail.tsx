import * as React from "react";
import {
  MailLayout,
  MailText,
  MailSecurityNotice,
  MailDivider,
} from "../components";

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
    eyebrow="Important notice"
    footerNote="This is an automated notice from ArcID."
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} your ArcID account has been
      suspended. While it is suspended, you won't be able to sign in or use
      ArcID-integrated services.
    </MailText>

    {reason && (
      <MailSecurityNotice variant="danger">
        <strong>Reason:</strong> {reason}
      </MailSecurityNotice>
    )}

    <MailDivider />

    <MailText>
      If you believe this was a mistake, or if you'd like to appeal, our
      support team can help - include the email address on this account and
      we'll review it promptly.
    </MailText>

    <MailText variant="muted">
      Suspensions are reversible. We'd rather get you back inside with the
      right access than keep you out by mistake.
    </MailText>
  </MailLayout>
);

export default AccountSuspendedMail;
