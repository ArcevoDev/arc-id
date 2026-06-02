import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Row,
  Column,
  Img,
  Hr,
  Text,
} from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailLayoutProps {
  previewText: string;
  heading: string;
  children: React.ReactNode;
  /** Optional footer note — defaults to standard ArcID footer */
  footerNote?: string;
}

export const MailLayout = ({
  previewText,
  heading,
  children,
  footerNote,
}: MailLayoutProps) => {
  return (
    <Html lang="en" dir="ltr">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>

      <Preview>{previewText}</Preview>

      <Body style={body}>
        {/* ── Outer wrapper ── */}
        <Section style={outer}>
          <Container style={container}>
            {/* ── Header ── */}
            <Section style={header}>
              <Row>
                <Column>
                  <Text style={brand}>ArcID</Text>
                </Column>
              </Row>
            </Section>

            <Hr style={divider} />

            {/* ── Heading ── */}
            <Section style={content}>
              <Text style={headingStyle}>{heading}</Text>

              {/* ── Template body ── */}
              {children}
            </Section>

            <Hr style={divider} />

            {/* ── Footer ── */}
            <Section style={footer}>
              <Text style={footerText}>
                {footerNote ??
                  "This message was sent by ArcID, the sovereign identity engine."}
              </Text>
              <Text style={footerText}>
                If you did not request this, you can safely ignore it. Your
                account will remain secure.
              </Text>
              <Text style={footerMeta}>
                © {new Date().getFullYear()} ArcID. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Section>
      </Body>
    </Html>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const body: React.CSSProperties = {
  backgroundColor: t.color.bgMuted,
  fontFamily: t.font.family,
  margin: 0,
  padding: 0,
};

const outer: React.CSSProperties = {
  padding: `${t.space.xl} ${t.space.md}`,
};

const container: React.CSSProperties = {
  backgroundColor: t.color.bg,
  borderRadius: t.radius.lg,
  border: `1px solid ${t.color.border}`,
  maxWidth: t.maxWidth,
  margin: "0 auto",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  padding: `${t.space.lg} ${t.space.xl}`,
};

const brand: React.CSSProperties = {
  color: t.color.text,
  fontSize: t.font.sizeLg,
  fontWeight: "700",
  letterSpacing: "-0.02em",
  margin: 0,
};

const content: React.CSSProperties = {
  padding: `${t.space.xl} ${t.space.xl}`,
};

const headingStyle: React.CSSProperties = {
  color: t.color.text,
  fontSize: t.font.sizeXl,
  fontWeight: "700",
  lineHeight: "1.2",
  marginTop: 0,
  marginBottom: t.space.lg,
};

const divider: React.CSSProperties = {
  borderColor: t.color.border,
  borderWidth: "1px",
  margin: 0,
};

const footer: React.CSSProperties = {
  padding: `${t.space.lg} ${t.space.xl}`,
};

const footerText: React.CSSProperties = {
  color: t.color.textLight,
  fontSize: t.font.sizeSm,
  lineHeight: "20px",
  margin: `0 0 ${t.space.sm} 0`,
};

const footerMeta: React.CSSProperties = {
  color: t.color.textLight,
  fontSize: t.font.sizeXs,
  marginTop: t.space.md,
};
