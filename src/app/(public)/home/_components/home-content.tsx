"use client";

import { HomeFeatures } from "./home-features";
import { HomeDevelop } from "./home-develop";
import { HomeStats } from "./home-stats";

export function HomeContent() {
  return (
    <>
      <HomeFeatures />
      <HomeDevelop />
      <HomeStats />
    </>
  );
}
