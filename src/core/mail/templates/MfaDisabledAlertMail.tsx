import * as React from "react";
import {
  MailLayout,
  MailText,
  MailSecurityNotice,
  MailButton,
} from "../components";

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
    previewText="Two-factor authentication was disabled on your ArcID account"
    heading="MFA Disabled"
    eyebrow="Security alert"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} two-factor authentication was
      disabled on your ArcID account on{" "}
      {new Date(changedAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
      .
    </MailText>

    <MailSecurityNotice variant="danger" ip={ip}>
      ðŸš¨ If that was you, all good. If it wasn't, this is the most important
      email you'll read today: someone may have taken control of your account.
      Reset your password immediately.
    </MailSecurityNotice>

    <MailButton href={resetUrl} variant="danger">
      Secure My Account
    </MailButton>

    <MailText variant="small">
      Removed the second lock by accident? Re-enabling MFA takes about a minute
      in your security settings - and we'll send you a fresh set of recovery
      codes when you do.
    </MailText>
  </MailLayout>
);

export default MfaDisabledAlertMail;
