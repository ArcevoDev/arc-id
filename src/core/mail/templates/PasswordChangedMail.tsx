import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailDivider } from "../components/MailDivider";

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
    previewText="Your ArcID password has been changed"
    heading="Password Changed"
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account password was successfully
      changed on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
      .
    </MailText>

    <MailSecurityNotice variant="danger">
      🚨 If you did not make this change, your account may be compromised.
      Please reset your password immediately and contact support.
      {ip ? ` Change originated from IP: ${ip}` : ""}
    </MailSecurityNotice>

    <MailDivider />

    <MailText variant="small">
      All active sessions have been revoked as a security precaution. You will
      need to sign in again on all devices.
    </MailText>
  </MailLayout>
);

export default PasswordChangedMail;
