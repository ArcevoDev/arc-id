import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailSecurityNotice,
  EmailButton,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

export interface MfaDisabledAlertMailProps {
  name?: string;
  ip?: string;
  resetUrl: string;
  changedAt: string;
}

export const MfaDisabledAlertMail = ({
  name,
  ip,
  resetUrl,
  changedAt,
}: MfaDisabledAlertMailProps) => (
  <EmailLayout
    previewText="Two-factor authentication was disabled on your ArcID account"
    heading="MFA Disabled"
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
      Security alert
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} two-factor authentication was
      disabled on your ArcID account on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}.
    </EmailText>

    <EmailSecurityNotice variant="danger" ip={ip}>
      🚨 If that was you, all good. If it wasn't, this is the most important
      email you'll read today: someone may have taken control of your account.
      Reset your password immediately.
    </EmailSecurityNotice>

    <EmailButton href={resetUrl} variant="danger">
      Secure My Account
    </EmailButton>

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      Removed the second lock by accident? Re-enabling MFA takes about a minute
      in your security settings - and we'll send you a fresh set of recovery
      codes when you do.
    </EmailText>
  </EmailLayout>
);

export default MfaDisabledAlertMail;
