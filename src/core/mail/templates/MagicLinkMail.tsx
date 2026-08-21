import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailSecurityNotice,
  EmailLink,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

export interface MagicLinkMailProps {
  loginUrl: string;
  name?: string;
  ip?: string;
}

export const MagicLinkMail = ({ loginUrl, name, ip }: MagicLinkMailProps) => (
  <EmailLayout
    previewText="Your one-tap sign-in link for ArcID - valid for 15 minutes"
    heading="Secure Sign-In Link"
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
      Passwordless access
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} a passwordless sign-in was just
      requested for your ArcID account. No passwords, no friction - just a
      single, secure link that knows it's you.
    </EmailText>

    <EmailButton href={loginUrl}>Sign In to ArcID</EmailButton>

    <EmailSecurityNotice variant="warning" ip={ip}>
      🔒 This link expires in <strong>15 minutes</strong> and can only be used
      once. Never forward it - anyone with this link can access your account.
    </EmailSecurityNotice>

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      Didn't request this link? Your account remains secure - simply ignore
      this email and the link will expire on its own.
    </EmailText>

    <EmailText
      variant="small"
      style={{ marginBottom: "4px", marginTop: "24px" }}
    >
      If the button above doesn't work, copy and paste this link into your browser:
    </EmailText>
    <EmailLink
      href={loginUrl}
      style={{ fontSize: "12px", wordBreak: "break-all" }}
    >
      {loginUrl}
    </EmailLink>
  </EmailLayout>
);

export default MagicLinkMail;
