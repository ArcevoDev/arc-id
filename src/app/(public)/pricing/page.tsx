import { buildMetadata } from "@/components/metadata";
import { PricingContent } from "./_components/pricing-content";

export const metadata = buildMetadata({
  title: "ArcID - Pricing",
  description: "Simple, transparent pricing for sovereign identity infrastructure. Start for free, upgrade as you grow.",
  path: "/pricing",
});

export default function PricingPage() {
  return <PricingContent />;
}
