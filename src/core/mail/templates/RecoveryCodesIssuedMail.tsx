import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailCodeBlock,
  EmailSecurityNotice,
  EmailDivider,
  EmailList,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

export interface RecoveryCodesIssuedMailProps {
  codes: string[];
  name?: string;
}

export const RecoveryCodesIssuedMail = ({
  codes,
  name,
}: RecoveryCodesIssuedMailProps) => (
  <EmailLayout
    previewText="Your ArcID recovery codes - save them now, they won't appear again"
    heading="Your Recovery Codes"
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
      Two-factor authentication
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} two-factor authentication is now
      active on your ArcID account. Below are your one-time recovery codes -
      the spare keys that let you back in if you ever lose access to your
      authenticator.
    </EmailText>

    <EmailSecurityNotice variant="warning">
      ⚠️ <strong>These codes will never be shown again.</strong> Each can be
      used exactly once, and only when you need to recover access. Store them
      now, somewhere only you can reach.
    </EmailSecurityNotice>

    <EmailCodeBlock
      codes={codes}
      label="One-time recovery codes (each can be used once):"
      columns={2}
    />

    <EmailDivider />

    <EmailList
      items={[
        "Keep them apart from your phone - if your phone is lost, they should survive it",
        "A password manager, a sealed envelope, or a locked drawer all work well",
        "Treat them like keys to your home: never share, never screenshot into a chat",
      ]}
    />

    <EmailText variant="muted" style={{ marginBottom: MAIL_SPACE.md }}>
      If you ever run low on codes, you can generate a fresh set from your
      security settings at any time.
    </EmailText>
  </EmailLayout>
);

export default RecoveryCodesIssuedMail;
