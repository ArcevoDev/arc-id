import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailSecurityNotice,
  EmailDivider,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

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
  <EmailLayout
    previewText="Your ArcID password was changed - review the details"
    heading="Password Changed"
    brandName="ArcID"
    footerNote="This message was sent by ArcID, the sovereign identity engine. You are receiving it because this address is connected to an ArcID account."
    footerMeta={`© ${new Date().getFullYear()} ArcID. All rights reserved.`}
  >
    <EmailText
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: MAIL_COLOR.textMuted,
        marginBottom: MAIL_SPACE.sm,
      }}
    >
      Account security
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} the password for your ArcID account
      was successfully changed on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}.
    </EmailText>

    <EmailSecurityNotice variant="danger" ip={ip}>
      🚨 If this was you, nothing more to do. If you did not make this change,
      your account may be at risk - reset your password immediately and contact
      support.
    </EmailSecurityNotice>

    <EmailDivider />

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      As a precaution, all active sessions were revoked when the password
      changed. You'll need to sign in again on every device.
    </EmailText>

    <EmailText variant="muted" style={{ marginBottom: MAIL_SPACE.md }}>
      A strong, unique password is a good lock. A passkey is a better one -
      consider switching to passwordless sign-in from your security settings.
    </EmailText>
  </EmailLayout>
);

export default PasswordChangedMail;
