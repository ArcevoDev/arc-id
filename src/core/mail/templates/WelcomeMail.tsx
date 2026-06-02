import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailButton } from "../components/MailButton";
import { MailText } from "../components/MailText";
import { MailDivider } from "../components/MailDivider";

export interface WelcomeMailProps {
  name?: string;
  dashboardUrl: string;
}

export const WelcomeMail = ({ name, dashboardUrl }: WelcomeMailProps) => (
  <MailLayout
    previewText="Welcome to ArcID — your identity is now active"
    heading={`Welcome${name ? `, ${name}` : ""}!`}
  >
    <MailText>
      Your ArcID account is now verified and active. ArcID is your sovereign
      identity layer — secure authentication, multi-tenant access control, and
      verifiable credentials, all in one place.
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
