import * as React from "react";
import {
  MailLayout,
  MailText,
  MailSecurityNotice,
  MailDivider,
} from "../components";

export interface PasswordChangedMailProps {
  name?: string;
  ip?: string;
  changedAt: string; // ISO string
}

export const PasswordChangedMail = ({
  name,
  ip,
  changedAt,
}: PasswordChangedMailProps) => (
  <MailLayout
    previewText="Your ArcID password was changed - review the details"
    heading="Password Changed"
    eyebrow="Account security"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} the password for your ArcID account
      was successfully changed on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
      .
    </MailText>

    <MailSecurityNotice variant="danger" ip={ip}>
      ðŸš¨ If this was you, nothing more to do. If you did not make this change,
      your account may be at risk - reset your password immediately and contact
      support.
    </MailSecurityNotice>

    <MailDivider />

    <MailText variant="small">
      As a precaution, all active sessions were revoked when the password
      changed. You'll need to sign in again on every device.
    </MailText>

    <MailText variant="muted">
      A strong, unique password is a good lock. A passkey is a better one -
      consider switching to passwordless sign-in from your security settings.
    </MailText>
  </MailLayout>
);

export default PasswordChangedMail;
