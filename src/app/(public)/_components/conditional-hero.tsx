"use client";

import { usePathname } from "next/navigation";
import { HomeHero } from "../home/_components/home-hero";

export function ConditionalHero() {
  const pathname = usePathname();
  if (pathname !== "/home") return null;
  return <HomeHero />;
}
