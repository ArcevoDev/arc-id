import { Icon } from "@arcevo/facet-components";
import { enterpriseLayoutPreset, type LayoutConfig, type NavSection } from "@arcevo/facet-layout";
import { navConfig } from "@/config/nav";

/**
 * ArcID layout config - drives @arcevo/facet-layout's AuthLayout + ConsoleLayout.
 *
 * Merges the facet-layout `enterpriseLayoutPreset` (B2B IAM features) with
 * ArcID's own brand identity + nav tree from @/config/nav.
 *
 * The sidebar nav tree is defined once in @/config/nav (string icon names).
 * facet-layout's NavSection expects icon ReactNodes, so we map the icon
 * name to the facet <Icon /> element here.
 */
export function buildLayoutConfig(): LayoutConfig {
  const navigation: NavSection[] = navConfig.map((section) => ({
    title: section.title,
    items: section.items.map((item) => ({
      href: item.href,
      label: item.label,
      icon: <Icon name={item.icon} className="h-4 w-4" />,
      requiredPermission: item.requiredPermission,
      children: item.children?.map((child) => ({
        href: child.href,
        label: child.label,
        icon: <Icon name={child.icon} className="h-4 w-4" />,
        requiredPermission: child.requiredPermission,
      })),
    })),
  }));

  return {
    // Layer the enterprise preset (tenant switcher, theme toggle, etc.)
    // underneath ArcID's brand + nav overrides.
    ...enterpriseLayoutPreset,
    brand: {
      name: "ArcID",
      tagline: "Sovereign Identity Engine",
      benefits: [
        "Passkey-native authentication",
        "Multi-tenant by design",
        "Verifiable Credentials built-in",
        "WebAuthn + TOTP MFA",
      ],
    },
    navigation,
    features: {
      ...enterpriseLayoutPreset.features,
      tenantSwitcher: true,
      themeToggle: true,
    },
  };
}
