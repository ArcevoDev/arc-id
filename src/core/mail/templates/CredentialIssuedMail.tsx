import * as React from "react";
import {
  EmailSection,
  EmailRow,
  EmailColumn,
  EmailText,
} from "@arcevo/facet-emails";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailDivider } from "../components/MailDivider";
import { tokens as t } from "../components/tokens";

export interface CredentialIssuedMailProps {
  holderName?: string;
  credentialType: string;
  issuerName: string;
  credentialId: string;
  issuedAt: string;
  expiresAt?: string;
  walletUrl?: string;
}

export const CredentialIssuedMail = ({
  holderName,
  credentialType,
  issuerName,
  credentialId,
  issuedAt,
  expiresAt,
  walletUrl,
}: CredentialIssuedMailProps) => (
  <MailLayout
    previewText={`A new Verifiable Credential has been issued to you by ${issuerName}`}
    heading="Credential Issued"
  >
    <MailText>
      Hi {holderName ? holderName : "there"}, a new Verifiable Credential has
      been issued to your ArcID identity by <strong>{issuerName}</strong>.
    </MailText>

    {/* Credential detail card */}
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
            Type
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
            {credentialType}
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
            Issuer
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
            {issuerName}
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
            Issued
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{ color: t.color.text, fontSize: t.font.sizeSm, margin: 0 }}
          >
            {new Date(issuedAt).toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
          </EmailText>
        </EmailColumn>
      </EmailRow>
      {expiresAt && (
        <EmailRow>
          <EmailColumn style={{ width: "40%" }}>
            <EmailText
              style={{
                color: t.color.textMuted,
                fontSize: t.font.sizeSm,
                margin: 0,
              }}
            >
              Expires
            </EmailText>
          </EmailColumn>
          <EmailColumn>
            <EmailText
              style={{
                color: t.color.text,
                fontSize: t.font.sizeSm,
                margin: 0,
              }}
            >
              {new Date(expiresAt).toLocaleDateString("en-US", {
                dateStyle: "long",
              })}
            </EmailText>
          </EmailColumn>
        </EmailRow>
      )}
    </EmailSection>

    {walletUrl && <MailButton href={walletUrl}>View in Wallet</MailButton>}

    <MailDivider />

    <MailText variant="muted">Credential ID: {credentialId}</MailText>
  </MailLayout>
);

export default CredentialIssuedMail;
