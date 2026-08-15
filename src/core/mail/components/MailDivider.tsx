import * as React from "react";
import { EmailDivider } from "@arcevo/facet-emails";

interface MailDividerProps {
  mt?: string;
  mb?: string;
}

export const MailDivider = ({ mt = "24px", mb = "24px" }: MailDividerProps) => (
  <EmailDivider />
);

export default MailDivider;
