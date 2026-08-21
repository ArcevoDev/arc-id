import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailDivider,
  EmailSection,
  EmailRow,
  EmailColumn,
  EmailList,
  EmailLink,
} from "@arcevo/facet-emails";
import {
  MAIL_COLOR,
  MAIL_SPACE,
  MAIL_FONT,
  MAIL_RADIUS,
  DEFAULT_MAIL_FOOTER_NOTE,
  DEFAULT_MAIL_FOOTER_META,
} from "../brand";

export interface TenantInviteMailProps {
  inviteeEmail: string;
  tenantName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
  expiresAt: string;
}

export const TenantInviteMail = ({
  inviteeEmail: _inviteeEmail,
  tenantName,
  inviterName,
  role,
  acceptUrl,
  expiresAt,
}: TenantInviteMailProps) => (
  <EmailLayout
    previewText={`${inviterName} invited you to join ${tenantName} on ArcID`}
    heading={`Join ${tenantName}`}
    brandName="ArcID"
    footerNote={DEFAULT_MAIL_FOOTER_NOTE}
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
      Invitation
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      <strong>{inviterName}</strong> has invited you to join{" "}
      <strong>{tenantName}</strong> on ArcID. Accepting gives you a place at
      that organisation's table - with the access and protections of the{" "}
      <strong>{role}</strong> role.
    </EmailText>

    <EmailSection
      style={{
        backgroundColor: MAIL_COLOR.bgMuted,
        border: `1px solid ${MAIL_COLOR.border}`,
        borderRadius: MAIL_RADIUS.md,
        padding: MAIL_SPACE.lg,
        marginBottom: MAIL_SPACE.lg,
      }}
    >
      <EmailRow style={{ marginBottom: MAIL_SPACE.sm }}>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: MAIL_COLOR.textMuted,
              fontSize: MAIL_FONT.sizeSm,
              margin: 0,
            }}
          >
            Organisation
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: MAIL_COLOR.text,
              fontSize: MAIL_FONT.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {tenantName}
          </EmailText>
        </EmailColumn>
      </EmailRow>

      <EmailRow style={{ marginBottom: MAIL_SPACE.sm }}>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: MAIL_COLOR.textMuted,
              fontSize: MAIL_FONT.sizeSm,
              margin: 0,
            }}
          >
            Invited by
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: MAIL_COLOR.text,
              fontSize: MAIL_FONT.sizeSm,
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
              color: MAIL_COLOR.textMuted,
              fontSize: MAIL_FONT.sizeSm,
              margin: 0,
            }}
          >
            Role
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: MAIL_COLOR.text,
              fontSize: MAIL_FONT.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {role}
          </EmailText>
        </EmailColumn>
      </EmailRow>
    </EmailSection>

    <EmailButton href={acceptUrl}>Accept Invitation</EmailButton>

    <EmailDivider />

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      This invitation expires on{" "}
      {new Date(expiresAt).toLocaleDateString("en-US", {
        dateStyle: "long",
      })}.
      If you weren't expecting it, you can safely ignore this email - nothing
      will change on your account.
    </EmailText>

    <EmailText
      variant="small"
      style={{ marginBottom: "4px", marginTop: "24px" }}
    >
      Or paste this link in your browser:
    </EmailText>
    <EmailLink
      href={acceptUrl}
      style={{ fontSize: "12px", wordBreak: "break-all" }}
    >
      {acceptUrl}
    </EmailLink>
  </EmailLayout>
);

export default TenantInviteMail;
