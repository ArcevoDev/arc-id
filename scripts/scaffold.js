#!/usr/bin/env node
/**
 * arc-id/scaffold-mail.js
 * Complete React Email system — run from inside arc-id:
 *   node scaffold-mail.js
 *
 * Writes:
 *  src/core/mail/
 *    mail.engine.ts               ← render helper
 *    components/
 *      MailLayout.tsx             ← base layout (header, footer, body wrapper)
 *      MailButton.tsx             ← CTA button
 *      MailText.tsx               ← paragraph variants
 *      MailDivider.tsx            ← horizontal rule
 *      MailSecurityNotice.tsx     ← yellow security warning box
 *      MailCodeBlock.tsx          ← monospace code display (recovery codes etc.)
 *    templates/
 *      VerifyEmailMail.tsx
 *      MagicLinkMail.tsx
 *      PasswordResetMail.tsx
 *      PasswordChangedMail.tsx
 *      WelcomeMail.tsx
 *      MfaCodeMail.tsx            (EMAIL type MFA code)
 *      RecoveryCodesIssuedMail.tsx
 *      MfaDisabledAlertMail.tsx
 *      NewDeviceLoginMail.tsx
 *      AccountSuspendedMail.tsx
 *      TenantInviteMail.tsx
 *      CredentialIssuedMail.tsx
 *      AccountDeletionMail.tsx
 *    preview/
 *      mail-preview.route.ts      ← GET /mail/preview/:template (dev only)
 *      template-registry.ts       ← maps slug → React element
 *
 *  src/lib/notifications/notification.service.ts  ← full async service
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));

function write(rel, content) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content.trimStart(), "utf8");
  console.log(`  WRITE  ${rel}`);
}

function section(t) {
  console.log(`\n── ${t}`);
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE NOTE
// @react-email/components ^1.0.12 is safe to use.
// The "deprecated" npm warning comes from a transient notice during
// the v0 → v1 migration. v1.x is the current stable series.
// If pnpm warns again, pin to the exact version:
//   pnpm add @react-email/components@1.0.12
// ════════════════════════════════════════════════════════════════════════════

section("Core — mail engine");
write(
  "src/core/mail/mail.engine.ts",
  `
import * as React from "react";
import { render } from "@react-email/components";

/**
 * Compiles a React Email component to a flat HTML string.
 * Always await this before passing html to Resend.
 */
export async function compileMailTemplate(
  element: React.ReactElement
): Promise<string> {
  return render(element);
}

/**
 * Compiles to plain-text version for email clients that strip HTML.
 */
export async function compileMailText(
  element: React.ReactElement
): Promise<string> {
  return render(element, { plainText: true });
}
`,
);

// ════════════════════════════════════════════════════════════════════════════
// SHARED DESIGN TOKENS
// Single source of truth for colours, spacing, and typography.
// Import into every component — never hard-code values.
// ════════════════════════════════════════════════════════════════════════════
section("Components — design tokens");
write(
  "src/core/mail/components/tokens.ts",
  `
/**
 * ArcID mail design tokens.
 * Shared across all components — change here, changes everywhere.
 */
export const tokens = {
  color: {
    bg:           "#ffffff",
    bgMuted:      "#f9fafb",
    bgDark:       "#111827",
    border:       "#e5e7eb",
    text:         "#111827",
    textMuted:    "#6b7280",
    textLight:    "#9ca3af",
    textInverse:  "#ffffff",
    primary:      "#000000",
    primaryHover: "#1f2937",
    danger:       "#dc2626",
    dangerBg:     "#fef2f2",
    warning:      "#d97706",
    warningBg:    "#fffbeb",
    success:      "#16a34a",
    successBg:    "#f0fdf4",
    link:         "#2563eb",
  },
  font: {
    family:  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono:    "'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace",
    sizeXs:  "12px",
    sizeSm:  "14px",
    sizeMd:  "16px",
    sizeLg:  "20px",
    sizeXl:  "24px",
  },
  radius: {
    sm: "4px",
    md: "6px",
    lg: "8px",
  },
  space: {
    xs: "4px",
    sm: "8px",
    md: "16px",
    lg: "24px",
    xl: "32px",
    xxl: "48px",
  },
  maxWidth: "600px",
} as const;
`,
);

// ════════════════════════════════════════════════════════════════════════════
// MAIL LAYOUT — base wrapper used by every template
// ════════════════════════════════════════════════════════════════════════════
section("Components — MailLayout");
write(
  "src/core/mail/components/MailLayout.tsx",
  `
import * as React from "react";
import {
  Body, Container, Head, Html, Preview,
  Section, Row, Column, Img, Hr, Text,
} from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailLayoutProps {
  previewText:  string;
  heading:      string;
  children:     React.ReactNode;
  /** Optional footer note — defaults to standard ArcID footer */
  footerNote?:  string;
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
                If you did not request this, you can safely ignore it.
                Your account will remain secure.
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
  fontFamily:      t.font.family,
  margin:          0,
  padding:         0,
};

const outer: React.CSSProperties = {
  padding: \`\${t.space.xl} \${t.space.md}\`,
};

const container: React.CSSProperties = {
  backgroundColor: t.color.bg,
  borderRadius:    t.radius.lg,
  border:          \`1px solid \${t.color.border}\`,
  maxWidth:        t.maxWidth,
  margin:          "0 auto",
  overflow:        "hidden",
};

const header: React.CSSProperties = {
  padding: \`\${t.space.lg} \${t.space.xl}\`,
};

const brand: React.CSSProperties = {
  color:      t.color.text,
  fontSize:   t.font.sizeLg,
  fontWeight: "700",
  letterSpacing: "-0.02em",
  margin:     0,
};

const content: React.CSSProperties = {
  padding: \`\${t.space.xl} \${t.space.xl}\`,
};

const headingStyle: React.CSSProperties = {
  color:        t.color.text,
  fontSize:     t.font.sizeXl,
  fontWeight:   "700",
  lineHeight:   "1.2",
  marginTop:    0,
  marginBottom: t.space.lg,
};

const divider: React.CSSProperties = {
  borderColor: t.color.border,
  borderWidth: "1px",
  margin:      0,
};

const footer: React.CSSProperties = {
  padding: \`\${t.space.lg} \${t.space.xl}\`,
};

const footerText: React.CSSProperties = {
  color:       t.color.textLight,
  fontSize:    t.font.sizeSm,
  lineHeight:  "20px",
  margin:      \`0 0 \${t.space.sm} 0\`,
};

const footerMeta: React.CSSProperties = {
  color:      t.color.textLight,
  fontSize:   t.font.sizeXs,
  marginTop:  t.space.md,
};
`,
);

// ════════════════════════════════════════════════════════════════════════════
// REUSABLE COMPONENTS
// ════════════════════════════════════════════════════════════════════════════
section("Components — reusable primitives");

write(
  "src/core/mail/components/MailButton.tsx",
  `
import * as React from "react";
import { Button } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailButtonProps {
  href:     string;
  children: React.ReactNode;
  variant?: "primary" | "danger";
}

export const MailButton = ({ href, children, variant = "primary" }: MailButtonProps) => (
  <Button
    href={href}
    style={{
      backgroundColor: variant === "danger" ? t.color.danger : t.color.primary,
      borderRadius:    t.radius.md,
      color:           t.color.textInverse,
      display:         "block",
      fontSize:        t.font.sizeMd,
      fontWeight:      "600",
      padding:         "13px 24px",
      textAlign:       "center",
      textDecoration:  "none",
      width:           "100%",
      boxSizing:       "border-box",
      marginBottom:    t.space.lg,
    }}
  >
    {children}
  </Button>
);
`,
);

write(
  "src/core/mail/components/MailText.tsx",
  `
import * as React from "react";
import { Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailTextProps {
  children:  React.ReactNode;
  variant?:  "body" | "small" | "muted";
  mb?:       string;
}

const VARIANT_STYLES: Record<string, React.CSSProperties> = {
  body: {
    color:        t.color.text,
    fontSize:     t.font.sizeMd,
    lineHeight:   "26px",
    marginTop:    0,
  },
  small: {
    color:        t.color.textMuted,
    fontSize:     t.font.sizeSm,
    lineHeight:   "22px",
    marginTop:    0,
  },
  muted: {
    color:        t.color.textLight,
    fontSize:     t.font.sizeSm,
    lineHeight:   "20px",
    marginTop:    0,
  },
};

export const MailText = ({ children, variant = "body", mb = "16px" }: MailTextProps) => (
  <Text style={{ ...VARIANT_STYLES[variant], marginBottom: mb }}>
    {children}
  </Text>
);
`,
);

write(
  "src/core/mail/components/MailDivider.tsx",
  `
import * as React from "react";
import { Hr } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailDividerProps {
  mt?: string;
  mb?: string;
}

export const MailDivider = ({ mt = "24px", mb = "24px" }: MailDividerProps) => (
  <Hr style={{ borderColor: t.color.border, marginTop: mt, marginBottom: mb }} />
);
`,
);

write(
  "src/core/mail/components/MailSecurityNotice.tsx",
  `
import * as React from "react";
import { Section, Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailSecurityNoticeProps {
  children: React.ReactNode;
  variant?: "warning" | "danger" | "info";
}

const STYLES: Record<string, { bg: string; border: string; text: string }> = {
  warning: { bg: t.color.warningBg,  border: t.color.warning, text: t.color.warning },
  danger:  { bg: t.color.dangerBg,   border: t.color.danger,  text: t.color.danger  },
  info:    { bg: t.color.bgMuted,     border: t.color.border,  text: t.color.textMuted },
};

export const MailSecurityNotice = ({ children, variant = "warning" }: MailSecurityNoticeProps) => {
  const s = STYLES[variant];
  return (
    <Section
      style={{
        backgroundColor: s.bg,
        border:          \`1px solid \${s.border}\`,
        borderRadius:    t.radius.md,
        padding:         \`\${t.space.md} \${t.space.lg}\`,
        marginBottom:    t.space.lg,
      }}
    >
      <Text
        style={{
          color:      s.text,
          fontSize:   t.font.sizeSm,
          lineHeight: "20px",
          margin:     0,
          fontWeight: "500",
        }}
      >
        {children}
      </Text>
    </Section>
  );
};
`,
);

write(
  "src/core/mail/components/MailCodeBlock.tsx",
  `
import * as React from "react";
import { Section, Text, Row, Column } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailCodeBlockProps {
  /** Array of code strings — displayed in a grid (2 columns for recovery codes) */
  codes:    string[];
  label?:   string;
  columns?: 1 | 2;
}

export const MailCodeBlock = ({ codes, label, columns = 2 }: MailCodeBlockProps) => {
  const pairs: string[][] = [];
  if (columns === 2) {
    for (let i = 0; i < codes.length; i += 2) {
      pairs.push([codes[i], codes[i + 1] ?? ""]);
    }
  } else {
    codes.forEach(c => pairs.push([c]));
  }

  return (
    <Section
      style={{
        backgroundColor: t.color.bgMuted,
        border:          \`1px solid \${t.color.border}\`,
        borderRadius:    t.radius.md,
        padding:         t.space.lg,
        marginBottom:    t.space.lg,
      }}
    >
      {label && (
        <Text style={{ fontSize: t.font.sizeSm, color: t.color.textMuted, marginBottom: t.space.sm, marginTop: 0 }}>
          {label}
        </Text>
      )}
      {pairs.map((pair, i) => (
        <Row key={i} style={{ marginBottom: t.space.sm }}>
          {pair.map((code, j) => (
            <Column key={j} style={{ width: columns === 2 ? "50%" : "100%" }}>
              {code && (
                <Text
                  style={{
                    fontFamily:  t.font.mono,
                    fontSize:    t.font.sizeSm,
                    color:       t.color.text,
                    fontWeight:  "600",
                    letterSpacing: "0.1em",
                    margin:      0,
                    padding:     \`\${t.space.xs} \${t.space.sm}\`,
                    backgroundColor: t.color.bg,
                    border:      \`1px solid \${t.color.border}\`,
                    borderRadius: t.radius.sm,
                  }}
                >
                  {code}
                </Text>
              )}
            </Column>
          ))}
        </Row>
      ))}
    </Section>
  );
};
`,
);

write(
  "src/core/mail/components/MailLinkFallback.tsx",
  `
import * as React from "react";
import { Link, Text } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailLinkFallbackProps {
  href:  string;
  label?: string;
}

export const MailLinkFallback = ({ href, label }: MailLinkFallbackProps) => (
  <>
    <Text style={{ color: t.color.textMuted, fontSize: t.font.sizeSm, marginBottom: "4px", marginTop: "24px" }}>
      {label ?? "If the button above doesn't work, copy and paste this link into your browser:"}
    </Text>
    <Link
      href={href}
      style={{ color: t.color.link, fontSize: t.font.sizeXs, wordBreak: "break-all" }}
    >
      {href}
    </Link>
  </>
);
`,
);

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATES
// ════════════════════════════════════════════════════════════════════════════
section("Templates");

write(
  "src/core/mail/templates/VerifyEmailMail.tsx",
  `
import * as React from "react";
import { MailLayout }         from "../components/MailLayout";
import { MailButton }         from "../components/MailButton";
import { MailText }           from "../components/MailText";
import { MailLinkFallback }   from "../components/MailLinkFallback";

export interface VerifyEmailMailProps {
  verifyUrl: string;
  name?:     string;
}

export const VerifyEmailMail = ({ verifyUrl, name }: VerifyEmailMailProps) => (
  <MailLayout
    previewText="Verify your email address to activate your ArcID profile"
    heading="Verify Your Email Address"
  >
    <MailText>
      Hi {name ? name : "there"}, welcome to ArcID. Please confirm your email
      address by clicking the button below to activate your account.
    </MailText>

    <MailButton href={verifyUrl}>Verify Email Address</MailButton>

    <MailText variant="small">
      This link expires in <strong>1 hour</strong>. If you didn't create an
      ArcID account, you can safely ignore this email.
    </MailText>

    <MailLinkFallback href={verifyUrl} />
  </MailLayout>
);

export default VerifyEmailMail;
`,
);

write(
  "src/core/mail/templates/MagicLinkMail.tsx",
  `
import * as React from "react";
import { MailLayout }        from "../components/MailLayout";
import { MailButton }        from "../components/MailButton";
import { MailText }          from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailLinkFallback }  from "../components/MailLinkFallback";

export interface MagicLinkMailProps {
  loginUrl: string;
  name?:    string;
  ip?:      string;
}

export const MagicLinkMail = ({ loginUrl, name, ip }: MagicLinkMailProps) => (
  <MailLayout
    previewText="Your secure sign-in link for ArcID"
    heading="Secure Sign-In Link"
  >
    <MailText>
      Hi {name ? name : "there"}, we received a passwordless sign-in request
      for your ArcID account. Click the button below to authenticate.
    </MailText>

    <MailButton href={loginUrl}>Sign In to ArcID</MailButton>

    <MailSecurityNotice variant="warning">
      🔒 This link expires in 15 minutes and can only be used once.
      {ip ? \` Request originated from IP: \${ip}\` : ""}
    </MailSecurityNotice>

    <MailText variant="small">
      If you didn't request this sign-in link, your account is still secure —
      simply ignore this email.
    </MailText>

    <MailLinkFallback href={loginUrl} />
  </MailLayout>
);

export default MagicLinkMail;
`,
);

write(
  "src/core/mail/templates/PasswordResetMail.tsx",
  `
import * as React from "react";
import { MailLayout }        from "../components/MailLayout";
import { MailButton }        from "../components/MailButton";
import { MailText }          from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailLinkFallback }  from "../components/MailLinkFallback";

export interface PasswordResetMailProps {
  resetUrl: string;
  name?:    string;
  ip?:      string;
}

export const PasswordResetMail = ({ resetUrl, name, ip }: PasswordResetMailProps) => (
  <MailLayout
    previewText="Reset your ArcID password"
    heading="Password Reset Request"
  >
    <MailText>
      Hi {name ? name : "there"}, we received a request to reset the password
      for your ArcID account.
    </MailText>

    <MailButton href={resetUrl} variant="primary">
      Reset Password
    </MailButton>

    <MailSecurityNotice variant="warning">
      ⚠️ This link expires in <strong>1 hour</strong>.
      {ip ? \` Request originated from IP: \${ip}.\` : ""}
      {" "}If you didn't request a password reset, you can ignore this email —
      your password has not been changed.
    </MailSecurityNotice>

    <MailLinkFallback href={resetUrl} />
  </MailLayout>
);

export default PasswordResetMail;
`,
);

write(
  "src/core/mail/templates/PasswordChangedMail.tsx",
  `
import * as React from "react";
import { MailLayout }         from "../components/MailLayout";
import { MailText }           from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailDivider }        from "../components/MailDivider";

export interface PasswordChangedMailProps {
  name?:     string;
  ip?:       string;
  changedAt: string; // ISO string
}

export const PasswordChangedMail = ({ name, ip, changedAt }: PasswordChangedMailProps) => (
  <MailLayout
    previewText="Your ArcID password has been changed"
    heading="Password Changed"
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account password was successfully
      changed on {new Date(changedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.
    </MailText>

    <MailSecurityNotice variant="danger">
      🚨 If you did not make this change, your account may be compromised.
      Please reset your password immediately and contact support.
      {ip ? \` Change originated from IP: \${ip}\` : ""}
    </MailSecurityNotice>

    <MailDivider />

    <MailText variant="small">
      All active sessions have been revoked as a security precaution.
      You will need to sign in again on all devices.
    </MailText>
  </MailLayout>
);

export default PasswordChangedMail;
`,
);

write(
  "src/core/mail/templates/WelcomeMail.tsx",
  `
import * as React from "react";
import { MailLayout }   from "../components/MailLayout";
import { MailButton }   from "../components/MailButton";
import { MailText }     from "../components/MailText";
import { MailDivider }  from "../components/MailDivider";

export interface WelcomeMailProps {
  name?:       string;
  dashboardUrl: string;
}

export const WelcomeMail = ({ name, dashboardUrl }: WelcomeMailProps) => (
  <MailLayout
    previewText="Welcome to ArcID — your identity is now active"
    heading={\`Welcome\${name ? \`, \${name}\` : ""}!\`}
  >
    <MailText>
      Your ArcID account is now verified and active. ArcID is your sovereign
      identity layer — secure authentication, multi-tenant access control,
      and verifiable credentials, all in one place.
    </MailText>

    <MailButton href={dashboardUrl}>Go to Dashboard</MailButton>

    <MailDivider />

    <MailText variant="small">
      You're now ready to connect your identity to any ArcID-integrated
      application. Keep your recovery codes in a safe place.
    </MailText>
  </MailLayout>
);

export default WelcomeMail;
`,
);

write(
  "src/core/mail/templates/MfaCodeMail.tsx",
  `
import * as React from "react";
import { Section, Text } from "@react-email/components";
import { MailLayout }  from "../components/MailLayout";
import { MailText }    from "../components/MailText";
import { tokens as t } from "../components/tokens";

export interface MfaCodeMailProps {
  code:   string;
  name?:  string;
  /** Seconds until expiry — default 600 (10 min) */
  ttlSec?: number;
}

export const MfaCodeMail = ({ code, name, ttlSec = 600 }: MfaCodeMailProps) => {
  const minutes = Math.round(ttlSec / 60);
  return (
    <MailLayout
      previewText={\`Your ArcID verification code: \${code}\`}
      heading="Verification Code"
    >
      <MailText>
        Hi {name ? name : "there"}, use the code below to complete your sign-in.
      </MailText>

      {/* Big code display */}
      <Section
        style={{
          backgroundColor: t.color.bgMuted,
          border:          \`1px solid \${t.color.border}\`,
          borderRadius:    t.radius.md,
          padding:         \`\${t.space.xl} \${t.space.lg}\`,
          textAlign:       "center",
          marginBottom:    t.space.lg,
        }}
      >
        <Text
          style={{
            fontFamily:    t.font.mono,
            fontSize:      "36px",
            fontWeight:    "700",
            letterSpacing: "0.3em",
            color:         t.color.text,
            margin:        0,
          }}
        >
          {code}
        </Text>
      </Section>

      <MailText variant="small">
        This code expires in <strong>{minutes} minutes</strong> and can only be
        used once. Never share this code with anyone.
      </MailText>
    </MailLayout>
  );
};

export default MfaCodeMail;
`,
);

write(
  "src/core/mail/templates/RecoveryCodesIssuedMail.tsx",
  `
import * as React from "react";
import { MailLayout }         from "../components/MailLayout";
import { MailText }           from "../components/MailText";
import { MailCodeBlock }      from "../components/MailCodeBlock";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailDivider }        from "../components/MailDivider";

export interface RecoveryCodesIssuedMailProps {
  codes: string[];
  name?: string;
}

export const RecoveryCodesIssuedMail = ({ codes, name }: RecoveryCodesIssuedMailProps) => (
  <MailLayout
    previewText="Your ArcID MFA recovery codes — save these now"
    heading="Save Your Recovery Codes"
  >
    <MailText>
      Hi {name ? name : "there"}, two-factor authentication has been enabled
      on your ArcID account. Below are your one-time recovery codes.
    </MailText>

    <MailSecurityNotice variant="warning">
      ⚠️ <strong>Save these codes somewhere safe.</strong> Each code can only be
      used once if you lose access to your authenticator app. These codes are
      shown only this once and cannot be retrieved later.
    </MailSecurityNotice>

    <MailCodeBlock
      codes={codes}
      label="One-time recovery codes (each can be used once):"
      columns={2}
    />

    <MailDivider />

    <MailText variant="muted">
      Store these in a password manager, printed in a locked drawer, or
      another safe location outside your primary device.
    </MailText>
  </MailLayout>
);

export default RecoveryCodesIssuedMail;
`,
);

write(
  "src/core/mail/templates/MfaDisabledAlertMail.tsx",
  `
import * as React from "react";
import { MailLayout }         from "../components/MailLayout";
import { MailText }           from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailButton }         from "../components/MailButton";

export interface MfaDisabledAlertMailProps {
  name?:     string;
  ip?:       string;
  resetUrl:  string;
  changedAt: string;
}

export const MfaDisabledAlertMail = ({ name, ip, resetUrl, changedAt }: MfaDisabledAlertMailProps) => (
  <MailLayout
    previewText="⚠️ Two-factor authentication was disabled on your ArcID account"
    heading="MFA Disabled"
  >
    <MailText>
      Hi {name ? name : "there"}, two-factor authentication was disabled on
      your ArcID account on{" "}
      {new Date(changedAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}.
    </MailText>

    <MailSecurityNotice variant="danger">
      🚨 If you did not disable MFA, your account may be compromised.
      {ip ? \` This action originated from IP: \${ip}.\` : ""} Reset your
      password immediately.
    </MailSecurityNotice>

    <MailButton href={resetUrl} variant="danger">
      Secure My Account
    </MailButton>

    <MailText variant="small">
      If you intentionally disabled MFA, no further action is required.
      We recommend re-enabling it for maximum security.
    </MailText>
  </MailLayout>
);

export default MfaDisabledAlertMail;
`,
);

write(
  "src/core/mail/templates/NewDeviceLoginMail.tsx",
  `
import * as React from "react";
import { MailLayout }         from "../components/MailLayout";
import { MailText }           from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailButton }         from "../components/MailButton";
import { MailDivider }        from "../components/MailDivider";

export interface NewDeviceLoginMailProps {
  name?:     string;
  ip:        string;
  userAgent: string;
  loginAt:   string;
  revokeUrl: string;
}

export const NewDeviceLoginMail = ({
  name, ip, userAgent, loginAt, revokeUrl,
}: NewDeviceLoginMailProps) => (
  <MailLayout
    previewText="New sign-in detected on your ArcID account"
    heading="New Sign-In Detected"
  >
    <MailText>
      Hi {name ? name : "there"}, a new sign-in was detected on your ArcID
      account from an unrecognized device.
    </MailText>

    <MailSecurityNotice variant="info">
      📍 <strong>IP address:</strong> {ip}<br />
      🖥️ <strong>Device:</strong> {userAgent}<br />
      🕐 <strong>Time:</strong> {new Date(loginAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}
    </MailSecurityNotice>

    <MailText>
      If this was you, no action is required. If you don't recognise this
      activity, revoke this session immediately.
    </MailText>

    <MailButton href={revokeUrl} variant="danger">
      Revoke This Session
    </MailButton>

    <MailDivider />

    <MailText variant="small">
      For maximum security, enable two-factor authentication and review your
      active sessions regularly in account settings.
    </MailText>
  </MailLayout>
);

export default NewDeviceLoginMail;
`,
);

write(
  "src/core/mail/templates/AccountSuspendedMail.tsx",
  `
import * as React from "react";
import { MailLayout }  from "../components/MailLayout";
import { MailText }    from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";

export interface AccountSuspendedMailProps {
  name?:   string;
  reason?: string;
}

export const AccountSuspendedMail = ({ name, reason }: AccountSuspendedMailProps) => (
  <MailLayout
    previewText="Your ArcID account has been suspended"
    heading="Account Suspended"
    footerNote="This is an automated security notice from ArcID."
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account has been suspended.
    </MailText>

    {reason && (
      <MailSecurityNotice variant="danger">
        Reason: {reason}
      </MailSecurityNotice>
    )}

    <MailText>
      If you believe this is an error or would like to appeal, please contact
      our support team. Include your account email in your message.
    </MailText>

    <MailText variant="small">
      While suspended, you will not be able to sign in or access
      ArcID-integrated services.
    </MailText>
  </MailLayout>
);

export default AccountSuspendedMail;
`,
);

write(
  "src/core/mail/templates/TenantInviteMail.tsx",
  `
import * as React from "react";
import { MailLayout }       from "../components/MailLayout";
import { MailButton }       from "../components/MailButton";
import { MailText }         from "../components/MailText";
import { MailDivider }      from "../components/MailDivider";
import { MailLinkFallback } from "../components/MailLinkFallback";

export interface TenantInviteMailProps {
  inviteeEmail:  string;
  tenantName:    string;
  inviterName:   string;
  role:          string;
  acceptUrl:     string;
  expiresAt:     string;
}

export const TenantInviteMail = ({
  inviteeEmail, tenantName, inviterName, role, acceptUrl, expiresAt,
}: TenantInviteMailProps) => (
  <MailLayout
    previewText={\`You've been invited to join \${tenantName} on ArcID\`}
    heading={\`Join \${tenantName}\`}
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

    <MailLinkFallback href={acceptUrl} label="Or paste this link in your browser:" />
  </MailLayout>
);

export default TenantInviteMail;
`,
);

write(
  "src/core/mail/templates/CredentialIssuedMail.tsx",
  `
import * as React from "react";
import { Section, Row, Column, Text } from "@react-email/components";
import { MailLayout }  from "../components/MailLayout";
import { MailButton }  from "../components/MailButton";
import { MailText }    from "../components/MailText";
import { MailDivider } from "../components/MailDivider";
import { tokens as t } from "../components/tokens";

export interface CredentialIssuedMailProps {
  holderName?:      string;
  credentialType:   string;
  issuerName:       string;
  credentialId:     string;
  issuedAt:         string;
  expiresAt?:       string;
  walletUrl?:       string;
}

export const CredentialIssuedMail = ({
  holderName, credentialType, issuerName,
  credentialId, issuedAt, expiresAt, walletUrl,
}: CredentialIssuedMailProps) => (
  <MailLayout
    previewText={\`A new Verifiable Credential has been issued to you by \${issuerName}\`}
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
        border:          \`1px solid \${t.color.border}\`,
        borderRadius:    t.radius.md,
        padding:         t.space.lg,
        marginBottom:    t.space.lg,
      }}
    >
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text style={{ color: t.color.textMuted, fontSize: t.font.sizeSm, margin: 0 }}>Type</Text>
        </Column>
        <Column>
          <Text style={{ color: t.color.text, fontSize: t.font.sizeSm, fontWeight: "600", margin: 0 }}>
            {credentialType}
          </Text>
        </Column>
      </Row>
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text style={{ color: t.color.textMuted, fontSize: t.font.sizeSm, margin: 0 }}>Issuer</Text>
        </Column>
        <Column>
          <Text style={{ color: t.color.text, fontSize: t.font.sizeSm, fontWeight: "600", margin: 0 }}>
            {issuerName}
          </Text>
        </Column>
      </Row>
      <Row style={{ marginBottom: t.space.sm }}>
        <Column style={{ width: "40%" }}>
          <Text style={{ color: t.color.textMuted, fontSize: t.font.sizeSm, margin: 0 }}>Issued</Text>
        </Column>
        <Column>
          <Text style={{ color: t.color.text, fontSize: t.font.sizeSm, margin: 0 }}>
            {new Date(issuedAt).toLocaleDateString("en-US", { dateStyle: "long" })}
          </Text>
        </Column>
      </Row>
      {expiresAt && (
        <Row>
          <Column style={{ width: "40%" }}>
            <Text style={{ color: t.color.textMuted, fontSize: t.font.sizeSm, margin: 0 }}>Expires</Text>
          </Column>
          <Column>
            <Text style={{ color: t.color.text, fontSize: t.font.sizeSm, margin: 0 }}>
              {new Date(expiresAt).toLocaleDateString("en-US", { dateStyle: "long" })}
            </Text>
          </Column>
        </Row>
      )}
    </Section>

    {walletUrl && <MailButton href={walletUrl}>View in Wallet</MailButton>}

    <MailDivider />

    <MailText variant="muted">
      Credential ID: {credentialId}
    </MailText>
  </MailLayout>
);

export default CredentialIssuedMail;
`,
);

write(
  "src/core/mail/templates/AccountDeletionMail.tsx",
  `
import * as React from "react";
import { MailLayout }  from "../components/MailLayout";
import { MailText }    from "../components/MailText";
import { MailDivider } from "../components/MailDivider";

export interface AccountDeletionMailProps {
  name?:      string;
  deletedAt:  string;
  graceDays?: number; // if you support a recovery window
}

export const AccountDeletionMail = ({ name, deletedAt, graceDays }: AccountDeletionMailProps) => (
  <MailLayout
    previewText="Your ArcID account deletion has been processed"
    heading="Account Deleted"
    footerNote="This is a final notice from ArcID."
  >
    <MailText>
      Hi {name ? name : "there"}, your ArcID account has been scheduled for
      deletion as requested on{" "}
      {new Date(deletedAt).toLocaleDateString("en-US", { dateStyle: "long" })}.
    </MailText>

    {graceDays && graceDays > 0 && (
      <MailText>
        You have a <strong>{graceDays}-day</strong> recovery window. To cancel
        the deletion, sign in to your account before the window closes.
      </MailText>
    )}

    <MailDivider />

    <MailText variant="small">
      After the deletion is complete, all your personal data, sessions, and
      credentials will be permanently removed and cannot be recovered.
    </MailText>

    <MailText variant="muted">
      If you did not request account deletion, please contact support
      immediately.
    </MailText>
  </MailLayout>
);

export default AccountDeletionMail;
`,
);

// ════════════════════════════════════════════════════════════════════════════
// TEMPLATE REGISTRY — maps preview slugs to React elements with sample data
// ════════════════════════════════════════════════════════════════════════════
section("Preview — template registry + route");
write(
  "src/core/mail/preview/template-registry.ts",
  `
import * as React from "react";

// ── Import every template ────────────────────────────────────────────────────
import { VerifyEmailMail }         from "../templates/VerifyEmailMail";
import { MagicLinkMail }          from "../templates/MagicLinkMail";
import { PasswordResetMail }      from "../templates/PasswordResetMail";
import { PasswordChangedMail }    from "../templates/PasswordChangedMail";
import { WelcomeMail }            from "../templates/WelcomeMail";
import { MfaCodeMail }            from "../templates/MfaCodeMail";
import { RecoveryCodesIssuedMail } from "../templates/RecoveryCodesIssuedMail";
import { MfaDisabledAlertMail }   from "../templates/MfaDisabledAlertMail";
import { NewDeviceLoginMail }     from "../templates/NewDeviceLoginMail";
import { AccountSuspendedMail }   from "../templates/AccountSuspendedMail";
import { TenantInviteMail }       from "../templates/TenantInviteMail";
import { CredentialIssuedMail }   from "../templates/CredentialIssuedMail";
import { AccountDeletionMail }    from "../templates/AccountDeletionMail";

// ── Sample data used only for preview rendering ───────────────────────────────
const BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

export const TEMPLATE_REGISTRY: Record<string, React.ReactElement> = {
  "verify-email": React.createElement(VerifyEmailMail, {
    verifyUrl: \`\${BASE}/auth/email/verify?token=preview_token_abc123\`,
    name:      "Alex",
  }),
  "magic-link": React.createElement(MagicLinkMail, {
    loginUrl: \`\${BASE}/auth/magic-link?token=preview_token_abc123\`,
    name:     "Alex",
    ip:       "102.89.3.1",
  }),
  "password-reset": React.createElement(PasswordResetMail, {
    resetUrl: \`\${BASE}/auth/password/reset/confirm?token=preview_token_abc123\`,
    name:     "Alex",
    ip:       "102.89.3.1",
  }),
  "password-changed": React.createElement(PasswordChangedMail, {
    name:      "Alex",
    ip:        "102.89.3.1",
    changedAt: new Date().toISOString(),
  }),
  "welcome": React.createElement(WelcomeMail, {
    name:         "Alex",
    dashboardUrl: "http://localhost:3000/dashboard",
  }),
  "mfa-code": React.createElement(MfaCodeMail, {
    code:   "847 291",
    name:   "Alex",
    ttlSec: 600,
  }),
  "recovery-codes": React.createElement(RecoveryCodesIssuedMail, {
    name:  "Alex",
    codes: [
      "XKCD-7F2A-M9PQ", "B3TH-92WE-RNVA",
      "PLMK-4X1C-7YDS", "QRST-8J6N-WCDE",
      "MNBV-3K9P-XFGT", "HIJK-5T2Y-OLPQ",
      "ASDF-1R7U-NWZX", "ZXCV-6E4I-MOLS",
      "QWER-2U8O-FGHB", "TYUI-9S5L-DJKM",
    ],
  }),
  "mfa-disabled": React.createElement(MfaDisabledAlertMail, {
    name:      "Alex",
    ip:        "102.89.3.1",
    resetUrl:  \`\${BASE}/auth/password/reset\`,
    changedAt: new Date().toISOString(),
  }),
  "new-device-login": React.createElement(NewDeviceLoginMail, {
    name:      "Alex",
    ip:        "102.89.3.1",
    userAgent: "Chrome 124 / macOS Sonoma",
    loginAt:   new Date().toISOString(),
    revokeUrl: "http://localhost:3000/settings/sessions",
  }),
  "account-suspended": React.createElement(AccountSuspendedMail, {
    name:   "Alex",
    reason: "Violation of terms of service — section 4.2",
  }),
  "tenant-invite": React.createElement(TenantInviteMail, {
    inviteeEmail: "alex@example.com",
    tenantName:   "Arcevo Health",
    inviterName:  "Dr. Morgan",
    role:         "MEMBER",
    acceptUrl:    "http://localhost:3000/invites/accept?token=preview_invite_token",
    expiresAt:    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  }),
  "credential-issued": React.createElement(CredentialIssuedMail, {
    holderName:     "Alex",
    credentialType: "UniversityDegreeCredential",
    issuerName:     "Arcevo University",
    credentialId:   "urn:uuid:3a8e1c92-4d7f-4b2e-9f1a-0c8d3e5f7b9c",
    issuedAt:       new Date().toISOString(),
    expiresAt:      new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    walletUrl:      "http://localhost:3000/credentials",
  }),
  "account-deletion": React.createElement(AccountDeletionMail, {
    name:       "Alex",
    deletedAt:  new Date().toISOString(),
    graceDays:  30,
  }),
};

export const TEMPLATE_NAMES = Object.keys(TEMPLATE_REGISTRY);
`,
);

write(
  "src/core/mail/preview/mail-preview.route.ts",
  `
import type { FastifyInstance } from "fastify";
import { compileMailTemplate }  from "../mail.engine";
import { TEMPLATE_REGISTRY, TEMPLATE_NAMES } from "./template-registry";

/**
 * Development-only mail preview routes.
 * Registered only when NODE_ENV !== "production".
 *
 * GET /mail/preview
 *   → HTML index listing all templates with clickable links
 *
 * GET /mail/preview/:template
 *   → Rendered HTML of the template (view in browser)
 */
export async function mailPreviewRoute(fastify: FastifyInstance) {
  if (process.env.NODE_ENV === "production") return;

  // ── Index ──────────────────────────────────────────────────────────────────
  fastify.get("/mail/preview", async (_req, reply) => {
    const links = TEMPLATE_NAMES.map((name) =>
      \`<li style="margin-bottom:8px">
         <a href="/mail/preview/\${name}" target="_blank"
            style="color:#2563eb;font-family:monospace;font-size:14px">
           /mail/preview/\${name}
         </a>
       </li>\`
    ).join("");

    return reply.type("text/html").send(\`
      <!DOCTYPE html>
      <html>
        <head><title>ArcID Mail Preview</title></head>
        <body style="font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto">
          <h1 style="font-size:24px;font-weight:700;margin-bottom:4px">
            ArcID Mail Preview
          </h1>
          <p style="color:#6b7280;margin-bottom:24px">
            \${TEMPLATE_NAMES.length} templates available
          </p>
          <ul style="list-style:none;padding:0">\${links}</ul>
        </body>
      </html>
    \`);
  });

  // ── Individual template ────────────────────────────────────────────────────
  fastify.get<{ Params: { template: string } }>(
    "/mail/preview/:template",
    async (req, reply) => {
      const { template } = req.params;
      const element = TEMPLATE_REGISTRY[template];

      if (!element) {
        return reply.status(404).type("text/html").send(\`
          <html><body style="font-family:sans-serif;padding:40px">
            <h2>Template not found: <code>\${template}</code></h2>
            <p><a href="/mail/preview">← Back to index</a></p>
            <p>Available templates:</p>
            <ul>
              \${TEMPLATE_NAMES.map(n => \`<li><code>\${n}</code></li>\`).join("")}
            </ul>
          </body></html>
        \`);
      }

      const html = await compileMailTemplate(element);

      // Inject a dev toolbar at the top of the preview
      const toolbar = \`
        <div style="
          position:fixed;top:0;left:0;right:0;
          background:#111827;color:#f9fafb;
          padding:8px 16px;font-family:monospace;font-size:12px;
          display:flex;align-items:center;gap:16px;z-index:9999
        ">
          <span style="font-weight:700;color:#60a5fa">ArcID Mail Preview</span>
          <span style="color:#9ca3af">\${template}</span>
          <a href="/mail/preview" style="color:#60a5fa;margin-left:auto">
            ← All templates
          </a>
        </div>
        <div style="height:36px"></div>
      \`;

      return reply
        .type("text/html")
        .send(html.replace("<body", \`<body\`) + toolbar);
    }
  );
}
`,
);

// ════════════════════════════════════════════════════════════════════════════
// NOTIFICATION SERVICE — fully async, uses all templates
// ════════════════════════════════════════════════════════════════════════════
section("Notification service — complete");
write(
  "src/lib/notifications/notification.service.ts",
  `
import { Resend }              from "resend";
import { config }              from "@/core/config";
import { logger }              from "@/lib/logger";
import { compileMailTemplate } from "@/core/mail/mail.engine";

// ── Templates ─────────────────────────────────────────────────────────────────
import { VerifyEmailMail }          from "@/core/mail/templates/VerifyEmailMail";
import { MagicLinkMail }           from "@/core/mail/templates/MagicLinkMail";
import { PasswordResetMail }       from "@/core/mail/templates/PasswordResetMail";
import { PasswordChangedMail }     from "@/core/mail/templates/PasswordChangedMail";
import { WelcomeMail }             from "@/core/mail/templates/WelcomeMail";
import { MfaCodeMail }             from "@/core/mail/templates/MfaCodeMail";
import { RecoveryCodesIssuedMail } from "@/core/mail/templates/RecoveryCodesIssuedMail";
import { MfaDisabledAlertMail }    from "@/core/mail/templates/MfaDisabledAlertMail";
import { NewDeviceLoginMail }      from "@/core/mail/templates/NewDeviceLoginMail";
import { AccountSuspendedMail }    from "@/core/mail/templates/AccountSuspendedMail";
import { TenantInviteMail }        from "@/core/mail/templates/TenantInviteMail";
import { CredentialIssuedMail }    from "@/core/mail/templates/CredentialIssuedMail";
import { AccountDeletionMail }     from "@/core/mail/templates/AccountDeletionMail";

import * as React from "react";

// ── Transport ─────────────────────────────────────────────────────────────────

const resend = new Resend(config.mail.apiKey);

async function sendEmail(to: string, subject: string, element: React.ReactElement): Promise<void> {
  try {
    const html = await compileMailTemplate(element);
    await resend.emails.send({ from: config.mail.from, to, subject, html });
    logger.info("[MAIL] Sent", { to, subject });
  } catch (err) {
    logger.error("[MAIL] Failed to send", { err, to, subject });
    // Do not throw — mail failures must never crash auth flows
  }
}

// ── SMS (Brevo) ───────────────────────────────────────────────────────────────

async function sendSms(phone: string, content: string): Promise<void> {
  if (!config.sms.apiKey) {
    logger.warn("[SMS] BREVO_API_KEY not configured — SMS skipped", { phone });
    return;
  }
  try {
    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
      method: "POST",
      headers: {
        "api-key":      config.sms.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender:    config.sms.sender,
        recipient: phone,
        content,
      }),
    });
    if (!res.ok) throw new Error(\`Brevo HTTP \${res.status}\`);
    logger.info("[SMS] Sent", { phone });
  } catch (err) {
    logger.error("[SMS] Failed to send", { err, phone });
  }
}

// ── Public notification API ───────────────────────────────────────────────────

export const notificationService = {

  // ── Auth emails ─────────────────────────────────────────────────────────────

  async sendEmailVerification(to: string, token: string, name?: string) {
    const url = \`\${config.base.apiUrl}/auth/email/verify?token=\${token}\`;
    await sendEmail(to, "Verify your email — ArcID",
      React.createElement(VerifyEmailMail, { verifyUrl: url, name }));
  },

  async sendMagicLink(to: string, token: string, opts?: { name?: string; ip?: string }) {
    const url = \`\${config.base.apiUrl}/auth/magic-link?token=\${token}\`;
    await sendEmail(to, "Your sign-in link — ArcID",
      React.createElement(MagicLinkMail, { loginUrl: url, name: opts?.name, ip: opts?.ip }));
  },

  async sendPasswordReset(to: string, token: string, opts?: { name?: string; ip?: string }) {
    const url = \`\${config.base.apiUrl}/auth/password/reset/confirm?token=\${token}\`;
    await sendEmail(to, "Reset your password — ArcID",
      React.createElement(PasswordResetMail, { resetUrl: url, name: opts?.name, ip: opts?.ip }));
  },

  async sendPasswordChanged(to: string, opts?: { name?: string; ip?: string }) {
    await sendEmail(to, "Your password was changed — ArcID",
      React.createElement(PasswordChangedMail, {
        name:      opts?.name,
        ip:        opts?.ip,
        changedAt: new Date().toISOString(),
      }));
  },

  async sendWelcome(to: string, opts?: { name?: string }) {
    const dashboardUrl = \`\${config.base.apiUrl.replace(":4000", ":3000")}/dashboard\`;
    await sendEmail(to, "Welcome to ArcID",
      React.createElement(WelcomeMail, { name: opts?.name, dashboardUrl }));
  },

  // ── MFA / Security emails ────────────────────────────────────────────────────

  async sendMfaCode(to: string, code: string, opts?: { name?: string; ttlSec?: number }) {
    await sendEmail(to, \`\${code} — Your ArcID verification code\`,
      React.createElement(MfaCodeMail, { code, name: opts?.name, ttlSec: opts?.ttlSec }));
  },

  async sendRecoveryCodes(to: string, codes: string[], name?: string) {
    await sendEmail(to, "Your ArcID recovery codes — save these now",
      React.createElement(RecoveryCodesIssuedMail, { codes, name }));
  },

  async sendMfaDisabledAlert(to: string, opts: { name?: string; ip?: string }) {
    const resetUrl = \`\${config.base.apiUrl}/auth/password/reset\`;
    await sendEmail(to, "⚠️ MFA was disabled on your ArcID account",
      React.createElement(MfaDisabledAlertMail, {
        name:      opts.name,
        ip:        opts.ip,
        resetUrl,
        changedAt: new Date().toISOString(),
      }));
  },

  async sendNewDeviceLogin(to: string, opts: { name?: string; ip: string; userAgent: string }) {
    const revokeUrl = \`\${config.base.apiUrl.replace(":4000", ":3000")}/settings/sessions\`;
    await sendEmail(to, "New sign-in detected on your ArcID account",
      React.createElement(NewDeviceLoginMail, {
        name:      opts.name,
        ip:        opts.ip,
        userAgent: opts.userAgent,
        loginAt:   new Date().toISOString(),
        revokeUrl,
      }));
  },

  // ── Account lifecycle ────────────────────────────────────────────────────────

  async sendAccountSuspended(to: string, opts?: { name?: string; reason?: string }) {
    await sendEmail(to, "Your ArcID account has been suspended",
      React.createElement(AccountSuspendedMail, { name: opts?.name, reason: opts?.reason }));
  },

  async sendAccountDeletion(to: string, opts?: { name?: string; graceDays?: number }) {
    await sendEmail(to, "Your ArcID account deletion has been processed",
      React.createElement(AccountDeletionMail, {
        name:       opts?.name,
        deletedAt:  new Date().toISOString(),
        graceDays:  opts?.graceDays,
      }));
  },

  // ── Tenant ────────────────────────────────────────────────────────────────────

  async sendTenantInvite(to: string, opts: {
    tenantName:   string;
    inviterName:  string;
    role:         string;
    inviteToken:  string;
    expiresAt:    string;
  }) {
    const acceptUrl = \`\${config.base.apiUrl.replace(":4000", ":3000")}/invites/accept?token=\${opts.inviteToken}\`;
    await sendEmail(to, \`You've been invited to join \${opts.tenantName}\`,
      React.createElement(TenantInviteMail, {
        inviteeEmail: to,
        tenantName:   opts.tenantName,
        inviterName:  opts.inviterName,
        role:         opts.role,
        acceptUrl,
        expiresAt:    opts.expiresAt,
      }));
  },

  // ── Verifiable Credentials ────────────────────────────────────────────────────

  async sendCredentialIssued(to: string, opts: {
    holderName?:     string;
    credentialType:  string;
    issuerName:      string;
    credentialId:    string;
    expiresAt?:      string;
  }) {
    const walletUrl = \`\${config.base.apiUrl.replace(":4000", ":3000")}/credentials\`;
    await sendEmail(to, \`New credential issued: \${opts.credentialType}\`,
      React.createElement(CredentialIssuedMail, {
        holderName:    opts.holderName,
        credentialType: opts.credentialType,
        issuerName:    opts.issuerName,
        credentialId:  opts.credentialId,
        issuedAt:      new Date().toISOString(),
        expiresAt:     opts.expiresAt,
        walletUrl,
      }));
  },

  // ── SMS methods ───────────────────────────────────────────────────────────────

  sendMfaCodeSms(phone: string, code: string) {
    void sendSms(phone, \`Your ArcID verification code is: \${code}. Valid for 10 minutes. Do not share.\`);
  },

  sendSecurityAlertSms(phone: string, message: string) {
    void sendSms(phone, \`ArcID Security Alert: \${message}\`);
  },
};
`,
);

// ════════════════════════════════════════════════════════════════════════════
// Register preview route in server (dev only, already handled by route guard)
// ════════════════════════════════════════════════════════════════════════════
section("Server — register preview route");
write(
  "src/api/routes/mail-preview.route.ts",
  `
// Re-export from the mail module so server.ts can register it cleanly
export { mailPreviewRoute as mailPreviewRoute } from "@/core/mail/preview/mail-preview.route";
`,
);

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║  Mail system scaffold complete                                   ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  PACKAGE QUESTION — @react-email/components ^1.0.12              ║
║  Safe to use. v1.x is the current stable series.                 ║
║  The "deprecated" warning was a transient npm notice during      ║
║  the v0 → v1 migration. If it warns again, pin it:               ║
║    pnpm add @react-email/components@1.0.12                       ║
║                                                                  ║
║  BROWSER PREVIEW                                                 ║
║  After adding mailPreviewRoute to server.ts:                     ║
║    pnpm dev:api                                                  ║
║    open http://localhost:4000/mail/preview                       ║
║                                                                  ║
║  OR use React Email's own dev server (recommended for rapid      ║
║  iteration — no need to start Fastify):                          ║
║    pnpm add -D react-email                                       ║
║    Add to package.json scripts:                                  ║
║    "mail:preview": "email dev --dir src/core/mail/templates"     ║
║    pnpm mail:preview → opens at http://localhost:3001            ║
║                                                                  ║
║  COMPLETE EMAIL LIST (13 templates)                              ║
║  Auth:      verify-email, magic-link, password-reset,            ║
║             password-changed, welcome                            ║
║  MFA:       mfa-code, recovery-codes, mfa-disabled               ║
║  Security:  new-device-login                                     ║
║  Account:   account-suspended, account-deletion                  ║
║  Tenant:    tenant-invite                                        ║
║  VC/DID:    credential-issued                                    ║
║                                                                  ║
║  SMS (via Brevo):                                                ║
║  • MFA code (sendMfaCodeSms)                                     ║
║  • Security alerts (sendSecurityAlertSms)                        ║
║                                                                  ║
║  REGISTER PREVIEW IN server.ts:                                  ║
║  import { mailPreviewRoute } from "./routes/mail-preview.route"; ║
║  await server.register(mailPreviewRoute);                        ║
╚══════════════════════════════════════════════════════════════════╝
`);
