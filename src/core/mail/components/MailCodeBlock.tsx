import * as React from "react";
import { Section, Text, Row, Column } from "@react-email/components";
import { tokens as t } from "./tokens";

interface MailCodeBlockProps {
  /** Array of code strings — displayed in a grid (2 columns for recovery codes) */
  codes: string[];
  label?: string;
  columns?: 1 | 2;
}

export const MailCodeBlock = ({
  codes,
  label,
  columns = 2,
}: MailCodeBlockProps) => {
  const pairs: string[][] = [];
  if (columns === 2) {
    for (let i = 0; i < codes.length; i += 2) {
      pairs.push([codes[i], codes[i + 1] ?? ""]);
    }
  } else {
    codes.forEach((c) => pairs.push([c]));
  }

  return (
    <Section
      style={{
        backgroundColor: t.color.bgMuted,
        border: `1px solid ${t.color.border}`,
        borderRadius: t.radius.md,
        padding: t.space.lg,
        marginBottom: t.space.lg,
      }}
    >
      {label && (
        <Text
          style={{
            fontSize: t.font.sizeSm,
            color: t.color.textMuted,
            marginBottom: t.space.sm,
            marginTop: 0,
          }}
        >
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
                    fontFamily: t.font.mono,
                    fontSize: t.font.sizeSm,
                    color: t.color.text,
                    fontWeight: "600",
                    letterSpacing: "0.1em",
                    margin: 0,
                    padding: `${t.space.xs} ${t.space.sm}`,
                    backgroundColor: t.color.bg,
                    border: `1px solid ${t.color.border}`,
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
