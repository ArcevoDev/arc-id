import * as React from "react";
import { Hr } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailDividerProps {
  mt?: string;
  mb?: string;
}

export const MailDivider = ({ mt = "24px", mb = "24px" }: MailDividerProps) => (
  <Hr
    style={{ borderColor: t.color.border, marginTop: mt, marginBottom: mb }}
  />
);
