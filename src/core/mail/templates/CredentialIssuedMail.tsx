import * as React from "react";
import { Section, Row, Column, Text } from "@react-email/components";
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
    <Section
      style={{
        backgroundColor: t.color.bgMuted,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: t.space.lg,
        marginBottom: t.space.lg,
      }}
    >
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Type
          </Text>
        </Column>
        <Column>
          <Text
            style={{
              color: t.color.text,
              fontSize: t.font.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {credentialType}
          </Text>
        </Column>
      </Row>
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Issuer
          </Text>
        </Column>
        <Column>
          <Text
            style={{
              color: t.color.text,
              fontSize: t.font.sizeSm,
              fontWeight: "600",
              margin: 0,
            }}
          >
            {issuerName}
          </Text>
        </Column>
      </Row>
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text
            style={{
              color: t.color.textMuted,
              fontSize: t.font.sizeSm,
              margin: 0,
            }}
          >
            Issued
          </Text>
        </Column>
        <Column>
          <Text
            style={{ color: t.color.text, fontSize: t.font.sizeSm, margin: 0 }}
          >
            {new Date(issuedAt).toLocaleDateString("en-US", {
              dateStyle: "long",
            })}
          </Text>
        </Column>
      </Row>
      {expiresAt && (
        <Row>
          <Column style={{ width: "40%" }}>
            <Text
              style={{
                color: t.color.textMuted,
                fontSize: t.font.sizeSm,
                margin: 0,
              }}
            >
              Expires
            </Text>
          </Column>
          <Column>
            <Text
              style={{
                color: t.color.text,
                fontSize: t.font.sizeSm,
                margin: 0,
              }}
            >
              {new Date(expiresAt).toLocaleDateString("en-US", {
                dateStyle: "long",
              })}
            </Text>
          </Column>
        </Row>
      )}
    </Section>

    {walletUrl && <MailButton href={walletUrl}>View in Wallet</MailButton>}

    <MailDivider />

    <MailText variant="muted">Credential ID: {credentialId}</MailText>
  </MailLayout>
);

export default CredentialIssuedMail;
