import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailButton } from "../components/MailButton";

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
  <MailLayout
    previewText="⚠️ Two-factor authentication was disabled on your ArcID account"
    heading="MFA Disabled"
  >
    <MailText>
      Hi {name ? name : "there"}, two-factor authentication was disabled on your
      ArcID account on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
      .
    </MailText>

    <MailSecurityNotice variant="danger">
      🚨 If you did not disable MFA, your account may be compromised.
      {ip ? ` This action originated from IP: ${ip}.` : ""} Reset your password
      immediately.
    </MailSecurityNotice>

    <MailButton href={resetUrl} variant="danger">
      Secure My Account
    </MailButton>

    <MailText variant="small">
      If you intentionally disabled MFA, no further action is required. We
      recommend re-enabling it for maximum security.
    </MailText>
  </MailLayout>
);

export default MfaDisabledAlertMail;
