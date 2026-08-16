import * as React from "react";
import {
  EmailSection,
  EmailRow,
  EmailColumn,
  EmailText,
} from "@arcevo/facet-emails";
import {
  MailLayout,
  MailButton,
  MailText,
  MailDivider,
  tokens as t,
} from "../components";

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
    previewText={`A new credential was issued to you by ${issuerName} - it's now in your wallet`}
    heading="A Credential, Yours"
    eyebrow="Verifiable Credential"
  >
    <MailText>
      {holderName ? `Hello ${holderName},` : "Hello,"} a new Verifiable
      Credential has been issued to your ArcID identity by{" "}
      <strong>{issuerName}</strong>. It now lives in your wallet - portable,
      tamper-evident, and ready to present whenever you choose.
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
      <EmailText
        style={{
          color: t.color.text,
          fontSize: t.font.sizeLg,
          fontWeight: "700",
          margin: 0,
          marginBottom: t.space.md,
        }}
      >
        {credentialType}
      </EmailText>
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

    {walletUrl && <MailButton href={walletUrl}>View in Your Wallet</MailButton>}

    <MailText variant="small">
      What makes this different from a paper certificate? This credential is
      cryptographically signed by {issuerName} and tied to your identity - so
      you can present it anywhere it's trusted without showing the underlying
      documents, and without anyone tracking where you show it.
    </MailText>

    <MailDivider />

    <MailText variant="muted" mb="4px">
      Credential ID
    </MailText>
    <MailText variant="small" mb="0">
      <span style={{ fontFamily: t.font.mono, wordBreak: "break-all" }}>
        {credentialId}
      </span>
    </MailText>
  </MailLayout>
);

export default CredentialIssuedMail;
