// prisma/seed.ts
import "dotenv/config";
import { prisma } from "@/core/db";
import { config } from "@/core/config";

async function main() {
  console.log("🌱 ArcID seed starting...");

  const SYSTEM_TENANT_ID = "SYSTEM";

  // ── 1. System Tenant ──────────────────────────────────────────────────────
  await prisma.tenant.upsert({
    where: { id: SYSTEM_TENANT_ID },
    update: {},
    create: {
      id: SYSTEM_TENANT_ID,
      name: "ArcevoCirqle System",
      slug: "system-global",
      sector: "Technology",
    },
  });

  console.log("✅ System tenant provisioned");

  // ── 2. Global Roles (ADMIN, MEMBER, GUEST) ─────────────────────────────────
  const globalRoles = [
    { name: "ADMIN", description: "Full administrative access across all tenant resources" },
    { name: "MEMBER", description: "Standard member access — default role for new registrations" },
    { name: "GUEST", description: "Read-only limited access for federated or unverified identities" },
  ];

  for (const roleData of globalRoles) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId: SYSTEM_TENANT_ID, name: roleData.name } },
      update: {},
      create: { name: roleData.name, description: roleData.description, tenantId: SYSTEM_TENANT_ID },
    });
  }

  console.log("✅ Global roles provisioned (ADMIN, MEMBER, GUEST)");

  // ── 3. ArcID Direct Client ─────────────────────────────────────────────────
  //    The native first-party client used when there's no external OAuth client.
  //    Every user token in the default space is issued to this client.
  const directClientId = config.oauth.directClientId ?? "arcid-direct";
  const apiBase = config.base.apiUrl;

  await prisma.client.upsert({
    where: { clientId: directClientId },
    update: {
      // Keep redirect URIs fresh on every seed
      grantTypes: ["authorization_code", "refresh_token", "client_credentials", "password"],
      scopes: ["openid", "profile", "email", "offline_access"],
    },
    create: {
      clientId: directClientId,
      tenantId: SYSTEM_TENANT_ID,
      name: "ArcID Native Authentication Portal",
      public: false,
      requirePkce: true,
      grantTypes: ["authorization_code", "refresh_token", "client_credentials", "password"],
      scopes: ["openid", "profile", "email", "offline_access"],
      redirectUris: {
        create: [
          { uri: `${apiBase}/api/auth/callback` },
          { uri: `${apiBase}/api/oauth/callback` },
          { uri: "http://localhost:3000/api/auth/callback" },
          { uri: "http://localhost:3000/api/oauth/callback" },
          // Mobile / app scheme for ArcWallet
          { uri: "arcid://oauth/callback" },
        ],
      },
    },
  });

  console.log(`✅ Direct client '${directClientId}' provisioned on SYSTEM tenant`);

  // ── 4. Tenant Policy defaults for SYSTEM ───────────────────────────────────
  await prisma.tenantPolicy.upsert({
    where: { tenantId: SYSTEM_TENANT_ID },
    update: {},
    create: {
      tenantId: SYSTEM_TENANT_ID,
      requireMfa: false,
      sessionTtlMinutes: 10080, // 7 days
      allowPasskeys: true,
    },
  }).catch(() => {
    // TenantPolicy might not exist yet — non-fatal if schema migration is pending
    console.warn("⚠️  TenantPolicy upsert skipped — run prisma migrate dev first");
  });

  console.log("\n🎉 Seed complete:");
  console.log(`   • SYSTEM tenant: ${SYSTEM_TENANT_ID}`);
  console.log(`   • Roles: ADMIN, MEMBER, GUEST`);
  console.log(`   • Direct client: ${directClientId}`);
  console.log(`   • Every new user auto-joins SYSTEM as MEMBER (via register.flow.ts)`);
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });