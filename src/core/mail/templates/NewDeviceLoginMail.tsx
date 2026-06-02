import * as React from "react";
import { MailLayout } from "../components/MailLayout";
import { MailText } from "../components/MailText";
import { MailSecurityNotice } from "../components/MailSecurityNotice";
import { MailButton } from "../components/MailButton";
import { MailDivider } from "../components/MailDivider";

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
    previewText="New sign-in detected on your ArcID account"
    heading="New Sign-In Detected"
  >
    <MailText>
      Hi {name ? name : "there"}, a new sign-in was detected on your ArcID
      account from an unrecognized device.
    </MailText>

    <MailSecurityNotice variant="info">
      📍 <strong>IP address:</strong> {ip}
      <br />
      🖥️ <strong>Device:</strong> {userAgent}
      <br />
      🕐 <strong>Time:</strong>{" "}
      {new Date(loginAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}
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
