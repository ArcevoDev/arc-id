import * as React from "react";
import { EmailCodeBlock } from "@arcevo/facet-emails";

interface MailCodeBlockProps {
  /** Array of code strings - displayed in a grid (2 columns for recovery codes) */
  codes: string[];
  label?: string;
  columns?: 1 | 2;
}

export const MailCodeBlock = ({
  codes,
  label,
  columns = 2,
}: MailCodeBlockProps) => (
  <EmailCodeBlock codes={codes} label={label} columns={columns} />
);

export default MailCodeBlock;
