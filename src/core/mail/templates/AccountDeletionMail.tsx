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
} from "../brand";

export interface AccountDeletionMailProps {
  name?: string;
  deletedAt: string;
  graceDays?: number;
}

export const AccountDeletionMail = ({
  name,
  deletedAt,
  graceDays,
}: AccountDeletionMailProps) => (
  <EmailLayout
    previewText="Your ArcID account deletion has been scheduled"
    heading="Account Deletion Scheduled"
    brandName="ArcID"
    footerNote="This is an automated notice from ArcID."
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
      Final notice
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} this email confirms that your ArcID
      account was scheduled for deletion on{" "}
      {new Date(deletedAt).toLocaleDateString("en-US", {
        dateStyle: "long",
      })}.
    </EmailText>

    {graceDays && graceDays > 0 && (
      <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
        You have a <strong>{graceDays}-day</strong> window to change your mind.
        If this was a mistake, sign in before the window closes and the
        deletion will be cancelled - no questions asked.
      </EmailText>
    )}

    <EmailDivider />

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      Once deletion completes, your personal data, active sessions, and
      verifiable credentials will be permanently removed. This is not
      reversible.
    </EmailText>

    <EmailSecurityNotice variant="danger">
      If you did not request this deletion, your account may be at risk -
      contact support immediately.
    </EmailSecurityNotice>
  </EmailLayout>
);

export default AccountDeletionMail;
