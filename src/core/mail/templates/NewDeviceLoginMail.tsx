import * as React from "react";
import {
  MailLayout,
  MailText,
  MailSecurityNotice,
  MailButton,
  MailDivider,
} from "../components";

export interface NewDeviceLoginMailProps {
  name?: string;
  ip: string;
  userAgent: string;
  loginAt: string;
  revokeUrl: string;
}

export const NewDeviceLoginMail = ({
  name,
  ip,
  userAgent,
  loginAt,
  revokeUrl,
}: NewDeviceLoginMailProps) => (
  <MailLayout
    previewText="New sign-in to your ArcID account - was this you?"
    heading="New Sign-In Detected"
    eyebrow="Security alert"
  >
    <MailText>
      {name ? `Hello ${name},` : "Hello,"} a new device just signed in to your
      ArcID account. If it was you, welcome back - nothing else to do. If it
      wasn't, the details below will help you act fast.
    </MailText>

    <MailSecurityNotice variant="info" ip={ip} userAgent={userAgent}>
      ðŸ“ Sign-in from <strong>IP {ip}</strong> on <strong>{userAgent}</strong>{" "}
      at{" "}
      {new Date(loginAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
      .
    </MailSecurityNotice>

    <MailText>
      Don't recognise this activity? Revoke the session now - it takes one
      click and immediately signs that device out.
    </MailText>

    <MailButton href={revokeUrl} variant="danger">
      Revoke This Session
    </MailButton>

    <MailDivider />

    <MailText variant="small">
      A note for quieter times: with two-factor authentication enabled, a
      stolen password alone is never enough to enter your account.
    </MailText>
  </MailLayout>
);

export default NewDeviceLoginMail;
