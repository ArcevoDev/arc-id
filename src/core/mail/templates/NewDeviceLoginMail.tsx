import * as React from "react";
import {
  EmailLayout,
  EmailText,
  EmailSecurityNotice,
  EmailButton,
  EmailDivider,
} from "@arcevo/facet-emails";
import { MAIL_COLOR, MAIL_SPACE } from "../brand";

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
  <EmailLayout
    previewText="New sign-in to your ArcID account - was this you?"
    heading="New Sign-In Detected"
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
      Security alert
    </EmailText>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      {name ? `Hello ${name},` : "Hello,"} a new device just signed in to your
      ArcID account. If it was you, welcome back - nothing else to do. If it
      wasn't, the details below will help you act fast.
    </EmailText>

    <EmailSecurityNotice variant="info" ip={ip} userAgent={userAgent}>
      📍 Sign-in from <strong>IP {ip}</strong> on <strong>{userAgent}</strong>{" "}
      at{" "}
      {new Date(loginAt).toLocaleString("en-US", {
        dateStyle: "long",
        timeStyle: "short",
      })}.
    </EmailSecurityNotice>

    <EmailText style={{ marginBottom: MAIL_SPACE.md }}>
      Don't recognise this activity? Revoke the session now - it takes one
      click and immediately signs that device out.
    </EmailText>

    <EmailButton href={revokeUrl} variant="danger">
      Revoke This Session
    </EmailButton>

    <EmailDivider />

    <EmailText variant="small" style={{ marginBottom: MAIL_SPACE.md }}>
      A note for quieter times: with two-factor authentication enabled, a
      stolen password alone is never enough to enter your account.
    </EmailText>
  </EmailLayout>
);

export default NewDeviceLoginMail;
