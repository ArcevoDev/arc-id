"use client";

import { useEffect, useState } from "react";

/**
 * Typewriter text - cycles through phrases with a type/erase loop.
 * SSR-safe: renders the first phrase immediately, then animates on mount.
 */
export function TypewriterText({
  phrases,
  className,
}: {
  phrases: string[];
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [text, setText] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[index % phrases.length];
    const timer = setTimeout(
      () => {
        if (!deleting) {
          const next = current.slice(0, text.length + 1);
          setText(next);
          if (next === current) {
            // Hold the full phrase, then start deleting.
            setTimeout(() => setDeleting(true), 1800);
          }
        } else {
          const next = current.slice(0, text.length - 1);
          setText(next);
          if (next === "") {
            setDeleting(false);
            setIndex((i) => (i + 1) % phrases.length);
          }
        }
      },
      deleting ? 35 : 70,
    );
    return () => clearTimeout(timer);
  }, [text, deleting, index, phrases]);

  return (
    <span className={className}>
      {text}
      <span className="ml-0.5 inline-block w-0.5 animate-pulse text-primary">|</span>
    </span>
  );
}
