import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailDivider } from "../components/MailDivider";
import { MailLinkFallback } from "../components/MailLinkFallback";

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
    previewText={`You've been invited to join ${tenantName} on ArcID`}
    heading={`Join ${tenantName}`}
  >
    <MailText>
      <strong>{inviterName}</strong> has invited <strong>{inviteeEmail}</strong>{" "}
      to join <strong>{tenantName}</strong> on ArcID as a{" "}
      <strong>{role}</strong>.
    </MailText>

    <MailButton href={acceptUrl}>Accept Invitation</MailButton>

    <MailDivider />

    <MailText variant="small">
      This invitation expires on{" "}
      {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}.
      If you weren't expecting this invitation, you can safely ignore it.
    </MailText>

    <MailLinkFallback
      href={acceptUrl}
      label="Or paste this link in your browser:"
    />
  </MailLayout>
);

export default TenantInviteMail;
