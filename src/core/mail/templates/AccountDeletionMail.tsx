import * as React from "react";
import {
  MailLayout,
  MailText,
  MailSecurityNotice,
  MailDivider,
} from "../components";

export interface AccountDeletionMailProps {
  name?: string;
  deletedAt: string;
  graceDays?: number; // if you support a recovery window
}

export const AccountDeletionMail = ({
  name,
  deletedAt,
  graceDays,
}: AccountDeletionMailProps) => (
  <MailLayout
    previewText="Your ArcID account deletion has been scheduled"
    heading="Account Deletion Scheduled"
    eyebrow="Final notice"
    footerNote="This is an automated notice from ArcID."
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} this email confirms that your ArcID
      account was scheduled for deletion on{" "}
      {new Date(deletedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.
    </MailText>

    {graceDays && graceDays > 0 && (
      <MailText>
        You have a <strong>{graceDays}-day</strong> window to change your mind.
        If this was a mistake, sign in before the window closes and the
        deletion will be cancelled - no questions asked.
      </MailText>
    )}

    <MailDivider />

    <MailText variant="small">
      Once deletion completes, your personal data, active sessions, and
      verifiable credentials will be permanently removed. This is not
      reversible.
    </MailText>

    <MailSecurityNotice variant="danger">
      If you did not request this deletion, your account may be at risk -
      contact support immediately.
    </MailSecurityNotice>
  </MailLayout>
);

export default AccountDeletionMail;
