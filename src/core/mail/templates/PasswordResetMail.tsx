import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailSecurityNotice,
  EmailDivider,
  EmailLink,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

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
  <EmailLayout
    previewText="Reset your ArcID password - link valid for 1 hour"
    heading="Password Reset Request"
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
      {name ? `Hello ${name},` : "Hello,"} we received a request to reset the
      password for your ArcID account. If that was you, the button below will
      take you to a secure page where you can choose a new one.
    </EmailText>

    <EmailButton href={resetUrl}>Reset Password</EmailButton>

    <EmailSecurityNotice variant="warning" ip={ip}>
      ⚠️ This link expires in <strong>1 hour</strong>. If you didn't request a
      password reset, no action is needed - your current password remains
      unchanged and your account stays protected.
    </EmailSecurityNotice>

    <EmailDivider />

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      A few quiet notes while you're here: never reuse this password anywhere
      else, and consider a passkey - ArcID supports passwordless sign-in, so
      one day you may not need a password at all.
    </EmailText>

    <EmailText
      variant="small"
      style={{ marginBottom: "4px", marginTop: "24px" }}
    >
      If the button above doesn't work, copy and paste this link into your browser:
    </EmailText>
    <EmailLink
      href={resetUrl}
      style={{ fontSize: "12px", wordBreak: "break-all" }}
    >
      {resetUrl}
    </EmailLink>
  </EmailLayout>
);

export default PasswordResetMail;
