import * as React from "react";
import { EmailList } from "@arcevo/facet-emails";
import {
  MailLayout,
  MailText,
  MailCodeBlock,
  MailSecurityNotice,
  MailDivider,
} from "../components";

export interface RecoveryCodesIssuedMailProps {
  codes: string[];
  name?: string;
}

export const RecoveryCodesIssuedMail = ({
  codes,
  name,
}: RecoveryCodesIssuedMailProps) => (
  <MailLayout
    previewText="Your ArcID recovery codes - save them now, they won't appear again"
    heading="Your Recovery Codes"
    eyebrow="Two-factor authentication"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} two-factor authentication is now
      active on your ArcID account. Below are your one-time recovery codes -
      the spare keys that let you back in if you ever lose access to your
      authenticator.
    </MailText>

    <MailSecurityNotice variant="warning">
      âš ï¸ <strong>These codes will never be shown again.</strong> Each can be
      used exactly once, and only when you need to recover access. Store them
      now, somewhere only you can reach.
    </MailSecurityNotice>

    <MailCodeBlock
      codes={codes}
      label="One-time recovery codes (each can be used once):"
      columns={2}
    />

    <MailDivider />

    <EmailList
      items={[
        "Keep them apart from your phone - if your phone is lost, they should survive it",
        "A password manager, a sealed envelope, or a locked drawer all work well",
        "Treat them like keys to your home: never share, never screenshot into a chat",
      ]}
    />

    <MailText variant="muted">
      If you ever run low on codes, you can generate a fresh set from your
      security settings at any time.
    </MailText>
  </MailLayout>
);

export default RecoveryCodesIssuedMail;
