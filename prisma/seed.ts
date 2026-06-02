// prisma/seed.ts
import "dotenv/config";
import { prisma } from "@/core/db";
import { config } from "@/core/config";

async function main() {
  console.log("Starting database seeding...");

  const SYSTEM_TENANT_ID = "SYSTEM";

  // 1. Ensure the System Tenant exists
  await prisma.tenant.upsert({
    where: { id: SYSTEM_TENANT_ID },
    update: {},
    create: {
      id: SYSTEM_TENANT_ID,
      name: "System Global",
      slug: "system-global",
    },
  });

  // 2. Upsert Client (associated with system tenant or keep null if your logic allows)
  const directClientId = config.oauth.directClientId || "arcid-direct";
  await prisma.client.upsert({
    where: { clientId: directClientId },
    update: {},
    create: {
      clientId: directClientId,
      tenantId: SYSTEM_TENANT_ID, // Associate with system
      name: "ArcID Native Core Authentication Portal",
      public: false,
      requirePkce: true,
      grantTypes: ["password", "refresh_token", "client_credentials"],
      scopes: ["openid", "profile", "email", "offline_access"],
      redirectUris: {
        create: [
          { uri: `${config.base.apiUrl}/api/auth/callback` },
          { uri: `${config.base.apiUrl}/api/oauth/callback` },
        ],
      },
    },
  });

  // 3. Upsert Global Roles
  const globalRoles = ["ADMIN", "MEMBER", "GUEST"];
  for (const name of globalRoles) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: SYSTEM_TENANT_ID,
          name,
        },
      },
      update: {},
      create: {
        name,
        description: `Global ${name.toLowerCase()} role`,
        tenantId: SYSTEM_TENANT_ID,
      },
    });
  }

  console.log(
    "Seed complete: System tenant, client, and global roles provisioned.",
  );
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
