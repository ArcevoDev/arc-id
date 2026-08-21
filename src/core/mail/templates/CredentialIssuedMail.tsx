import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailDivider,
  EmailSection,
  EmailRow,
  EmailColumn,
} from "@arcevo/facet-emails";
import {
  MAIL_COLOR,
  MAIL_SPACE,
  MAIL_FONT,
  MAIL_RADIUS,
  DEFAULT_MAIL_FOOTER_NOTE,
  DEFAULT_MAIL_FOOTER_META,
} from "../brand";

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
  <EmailLayout
    previewText={`A new credential was issued to you by ${issuerName} - it's now in your wallet`}
    heading="A Credential, Yours"
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
      Verifiable Credential
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {holderName ? `Hello ${holderName},` : "Hello,"} a new Verifiable
      Credential has been issued to your ArcID identity by{" "}
      <strong>{issuerName}</strong>. It now lives in your wallet - portable,
      tamper-evident, and ready to present whenever you choose.
    </EmailText>

    {/* Credential detail card */}
    <EmailSection
      style={{
        backgroundColor: MAIL_COLOR.bgMuted,
        border: `1px solid ${MAIL_COLOR.border}`,
        borderRadius: MAIL_RADIUS.md,
        padding: MAIL_SPACE.lg,
        marginBottom: MAIL_SPACE.lg,
      }}
    >
      <EmailText
        style={{
          color: MAIL_COLOR.text,
          fontSize: MAIL_FONT.sizeLg,
          fontWeight: "700",
          margin: 0,
          marginBottom: MAIL_SPACE.md,
        }}
      >
        {credentialType}
      </EmailText>

      <EmailRow style={{ marginBottom: MAIL_SPACE.sm }}>
        <EmailColumn style={{ width: "40%" }}>
          <EmailText
            style={{
              color: MAIL_COLOR.textMuted,
              fontSize: MAIL_FONT.sizeSm,
              margin: 0,
            }}
          >
            Issuer
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
            {issuerName}
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
            Issued
          </EmailText>
        </EmailColumn>
        <EmailColumn>
          <EmailText
            style={{
              color: MAIL_COLOR.text,
              fontSize: MAIL_FONT.sizeSm,
              margin: 0,
            }}
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
                color: MAIL_COLOR.textMuted,
                fontSize: MAIL_FONT.sizeSm,
                margin: 0,
              }}
            >
              Expires
            </EmailText>
          </EmailColumn>
          <EmailColumn>
            <EmailText
              style={{
                color: MAIL_COLOR.text,
                fontSize: MAIL_FONT.sizeSm,
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

    {walletUrl && (
      <EmailButton href={walletUrl}>View in Your Wallet</EmailButton>
    )}

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      What makes this different from a paper certificate? This credential is
      cryptographically signed by {issuerName} and tied to your identity - so
      you can present it anywhere it's trusted without showing the underlying
      documents, and without anyone tracking where you show it.
    </EmailText>

    <EmailDivider />

    <EmailText
      variant="muted"
      style={{ marginBottom: MAIL_SPACE.xs }}
    >
      Credential ID
    </EmailText>

    <EmailText variant="small" style={{ marginBottom: 0 }}>
      <span
        style={{
          fontFamily: MAIL_FONT.mono,
          fontSize: MAIL_FONT.sizeXs,
          wordBreak: "break-all",
        }}
      >
        {credentialId}
      </span>
    </EmailText>
  </EmailLayout>
);

export default CredentialIssuedMail;
