import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailDivider } from "../components/MailDivider";

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
    previewText="Your ArcID account deletion has been processed"
    heading="Account Deleted"
    footerNote="This is a final notice from ArcID."
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account has been scheduled for
      deletion as requested on{" "}
      {new Date(deletedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.
    </MailText>

    {graceDays && graceDays > 0 && (
      <MailText>
        You have a <strong>{graceDays}-day</strong> recovery window. To cancel
        the deletion, sign in to your account before the window closes.
      </MailText>
    )}

    <MailDivider />

    <MailText variant="small">
      After the deletion is complete, all your personal data, sessions, and
      credentials will be permanently removed and cannot be recovered.
    </MailText>

    <MailText variant="muted">
      If you did not request account deletion, please contact support
      immediately.
    </MailText>
  </MailLayout>
);

export default AccountDeletionMail;
