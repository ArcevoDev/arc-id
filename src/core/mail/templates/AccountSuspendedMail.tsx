import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailSecurityNotice,
  EmailDivider,
} from "@arcevo/facet-emails";
import {
  MAIL_COLOR,
  MAIL_SPACE,
  DEFAULT_MAIL_FOOTER_NOTE,
  DEFAULT_MAIL_FOOTER_META,
} from "../brand";

export interface AccountSuspendedMailProps {
  name?: string;
  reason?: string;
}

export const AccountSuspendedMail = ({
  name,
  reason,
}: AccountSuspendedMailProps) => (
  <EmailLayout
    previewText="Your ArcID account has been suspended"
    heading="Account Suspended"
    brandName="ArcID"
    footerNote="This is an automated notice from ArcID."
    footerMeta={DEFAULT_MAIL_FOOTER_META}
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
      Important notice
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} your ArcID account has been
      suspended. While it is suspended, you won't be able to sign in or use
      ArcID-integrated services.
    </EmailText>

    {reason && (
      <EmailSecurityNotice variant="danger">
        <strong>Reason:</strong> {reason}
      </EmailSecurityNotice>
    )}

    <EmailDivider />

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      If you believe this was a mistake, or if you'd like to appeal, our
      support team can help - include the email address on this account and
      we'll review it promptly.
    </EmailText>

    <EmailText
      variant="muted"
      style={{ marginBottom: MAIL_SPACE.md }}
    >
      Suspensions are reversible. We'd rather get you back inside with the
      right access than keep you out by mistake.
    </EmailText>
  </EmailLayout>
);

export default AccountSuspendedMail;
