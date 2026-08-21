import * as React from "react";
import {
  EmailLayout,
  EmailButton,
  EmailText,
  EmailDivider,
  EmailSection,
  EmailList,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE, MAIL_RADIUS, MAIL_FONT } from "../brand";

export interface WelcomeMailProps {
  name?: string;
  dashboardUrl: string;
}

export const WelcomeMail = ({ name, dashboardUrl }: WelcomeMailProps) => (
  <EmailLayout
    previewText="Welcome to ArcID - your sovereign identity is now active"
    heading={`Welcome${name ? `, ${name}` : ""}`}
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
      Your identity is live
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      This is the beginning of something quietly significant: your digital
      identity now belongs to you. Not to a platform, not to a database - to
      you, carried in your own pocket, presented on your own terms.
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      ArcID is your sovereign identity layer - passkey-native sign-in,
      multi-tenant access control, and verifiable credentials you can take
      anywhere it's trusted.
    </EmailText>

    <EmailButton href={dashboardUrl}>Go to Dashboard</EmailButton>

    <EmailDivider />

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
          color: MAIL_COLOR.textMuted,
          fontSize: MAIL_FONT.sizeSm,
          fontWeight: 600,
          marginBottom: MAIL_SPACE.sm,
        }}
      >
        Three things worth doing this week:
      </EmailText>
      <EmailList
        items={[
          "Set up a passkey - the fastest, most phishing-resistant way to sign in",
          "Enable two-factor authentication and save your recovery codes somewhere safe",
          "Review your active sessions and revoke anything you don't recognise",
        ]}
      />
    </EmailSection>

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      If you ever need help, your dashboard has a support path for every
      question. Welcome to the other side of the door.
    </EmailText>
  </EmailLayout>
);

export default WelcomeMail;
