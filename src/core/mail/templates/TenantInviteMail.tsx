import * as React from "react";
import { EmailSection, EmailRow, EmailColumn, EmailText } from "@arcevo/facet-emails";
import {
  MailLayout,
  MailButton,
  MailText,
  MailDivider,
  MailLinkFallback,
  tokens as t,
} from "../components";

export interface TenantInviteMailProps {
  inviteeEmail: string;
  tenantName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}

export const TenantInviteMail = ({
  inviteeEmail,
  tenantName,
  inviterName,
  role,
  acceptUrl,
  expiresAt,
}: TenantInviteMailProps) => (
  <MailLayout
    previewText={`${inviterName} invited you to join ${tenantName} on ArcID`}
    heading={`Join ${tenantName}`}
    eyebrow="Invitation"
  >
    <MailText>
      <strong>{inviterName}</strong> has invited you to join{" "}
      <strong>{tenantName}</strong> on ArcID. Accepting gives you a place at
      that organisation's table - with the access and protections of the{" "}
      <strong>{role}</strong> role.
    </MailText>

    <EmailSection
      style={{
        backgroundColor: t.color.bgMuted,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: t.space.lg,
        marginBottom: t.space.lg,
      }}
    >
      <EmailRow style={{ marginBottom: t.space.sm }}>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Organisation
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: t.color.text,
              fontSize: t.font.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {tenantName}
          </EmailText>
        </EmailColumn>
      </EmailRow>
      <EmailRow style={{ marginBottom: t.space.sm }}>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Invited by
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: t.color.text,
              fontSize: t.font.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {inviterName}
          </EmailText>
        </EmailColumn>
      </EmailRow>
      <EmailRow>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Role
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: t.color.text,
              fontSize: t.font.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {role}
          </EmailText>
        </EmailColumn>
      </EmailRow>
    </EmailSection>

    <MailButton href={acceptUrl}>Accept Invitation</MailButton>

    <MailDivider />

    <MailText variant="small">
      This invitation expires on{" "}
      {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}.
      If you weren't expecting it, you can safely ignore this email - nothing
      will change on your account.
    </MailText>

    <MailLinkFallback
      href={acceptUrl}
      label="Or paste this link in your browser:"
    />
  </MailLayout>
);

export default TenantInviteMail;
