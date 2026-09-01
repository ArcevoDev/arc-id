import { LandingLayout } from "@arcevo/facet-layout";
import { Footer, CookieConsent } from "@arcevo/facet-components";
import { ConditionalHero } from "./_components/conditional-hero";
import { PublicNavbar } from "@/components/public-navbar";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LandingLayout
      nav={<PublicNavbar />}
      hero={<ConditionalHero />}
      footer={<Footer />}
    >
      {children}
      <CookieConsent />
    </LandingLayout>
  );
}
