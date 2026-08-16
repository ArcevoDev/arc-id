import * as React from "react";
import { EmailSection, EmailText, EmailList } from "@arcevo/facet-emails";
import {
  MailLayout,
  MailButton,
  MailText,
  MailDivider,
  tokens as t,
} from "../components";

export interface WelcomeMailProps {
  name?: string;
  dashboardUrl: string;
}

export const WelcomeMail = ({ name, dashboardUrl }: WelcomeMailProps) => (
  <MailLayout
    previewText="Welcome to ArcID - your sovereign identity is now active"
    heading={`Welcome${name ? `, ${name}` : ""}`}
    eyebrow="Your identity is live"
  >
    <MailText>
      This is the beginning of something quietly significant: your digital
      identity now belongs to you. Not to a platform, not to a database - to
      you, carried in your own pocket, presented on your own terms.
    </MailText>

    <MailText>
      ArcID is your sovereign identity layer - passkey-native sign-in,
      multi-tenant access control, and verifiable credentials you can take
      anywhere it's trusted.
    </MailText>

    <MailButton href={dashboardUrl}>Go to Dashboard</MailButton>

    <MailDivider />

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
          color: t.color.textMuted,
          fontSize: t.font.sizeSm,
          fontWeight: 600,
          marginBottom: t.space.sm,
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

    <MailText variant="small">
      If you ever need help, your dashboard has a support path for every
      question. Welcome to the other side of the door.
    </MailText>
  </MailLayout>
);

export default WelcomeMail;
