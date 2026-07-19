// prisma/seed.ts
//
// Uses a raw PrismaClient — NOT the isolated client from @/core/db.
// Seed scripts run outside the HTTP server and legitimately cross tenant
// boundaries (creating the SYSTEM tenant itself, global roles, etc.).
// The tenant-isolation extension is designed for HTTP request paths only.
//
// CHANGE FROM PREVIOUS VERSION:
//   Step 8 (new) — seeds a real EC P-256 TenantSigningKey for the SYSTEM
//   tenant and wires it into the DID document's verificationMethod array.
//
//   Previously the DID was seeded with publicKeyBytes: Buffer.from([]) and
//   verificationMethod: []. The signing.service.ts does a findFirst by tenantId
//   to resolve the private key for VC signing — if no key exists, every call
//   to POST /credentials/issue would throw "No active signing key found".
//
//   The fix: generate a real EC P-256 keypair at seed time, store it in
//   TenantSigningKey, and backfill the DID document with the public JWK.
//   In production the private key should be KMS-wrapped (kmsProvider field);
//   for development the raw PKCS8 PEM is stored as bytes directly.

import "dotenv/config";
import { PrismaClient, KeyType } from "@prisma-client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { generateKeyPair, exportSPKI, exportPKCS8, exportJWK } from "jose";
import { randomUUID } from "crypto";

const DATABASE_URL = process.env.DATABASE_URL!;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL, max: 5 });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SYSTEM_TENANT_ID = "SYSTEM";
const DIRECT_CLIENT_ID = process.env.ARCID_DIRECT_CLIENT_ID ?? "arcid-direct";
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@arcevocirqle.com.ng";

if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
  console.error(
    "[seed] ADMIN_PASSWORD must be set explicitly when NODE_ENV=production. " +
      "Refusing to seed a known-default admin password against a production database.",
  );
  process.exit(1);
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "ArcID@Dev2025!";

if (process.env.NODE_ENV === "production") {
  // Defense in depth — even if ADMIN_PASSWORD is set, reject the known
  // dev default so a copy-pasted .env.example value can't slip through.
  if (ADMIN_PASSWORD === "ArcID@Dev2025!") {
    console.error(
      "[seed] ADMIN_PASSWORD is set to the known development default. " +
        "Set a unique, strong password before seeding production.",
    );
    process.exit(1);
  }
}

// Derive the did:web identifier from API_BASE.
// Production: API_BASE = https://api.arcevocirqle.com.ng → did:web:api.arcevocirqle.com.ng
// Development: http://localhost:4000 → did:web:localhost
function deriveDidWeb(base: string): string {
  try {
    const url = new URL(base);
    const host = url.host; // includes port if non-standard
    return `did:web:${host}`;
  } catch {
    return "did:web:localhost";
  }
}

async function main() {
  console.log("🌱 ArcID seed starting...\n");

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
  console.log("✅ System tenant");

  // ── 2. SYSTEM Subscription ────────────────────────────────────────────────
  const existingSub = await prisma.subscription.findUnique({
    where: { tenantId: SYSTEM_TENANT_ID },
  });
  if (!existingSub) {
    await prisma.subscription.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        plan: "ENTERPRISE",
        status: "ACTIVE",
        billingIntegrations: {
          create: {
            providerName: "SYSTEM",
            externalCustomerId: "SYS_OVERRIDE_ROOT",
            externalSubId: "SUB_SYS_ACTIVE",
            metadata: {
              allocation: "unlimited",
              reason: "Root Infra Operator",
            },
          },
        },
      },
    });
    console.log("✅ SYSTEM subscription (ENTERPRISE)");
  } else {
    console.log("ℹ️  SYSTEM subscription already exists");
  }

  // ── 3. Global Roles ───────────────────────────────────────────────────────
  for (const r of [
    {
      name: "ADMIN",
      description: "Full administrative access across all tenant resources",
    },
    {
      name: "MEMBER",
      description: "Standard member access — default for new registrations",
    },
    {
      name: "GUEST",
      description:
        "Read-only limited access for federated or unverified identities",
    },
  ]) {
    await prisma.role.upsert({
      where: { tenantId_name: { tenantId: SYSTEM_TENANT_ID, name: r.name } },
      update: { description: r.description },
      create: {
        tenantId: SYSTEM_TENANT_ID,
        name: r.name,
        description: r.description,
      },
    });
  }
  console.log("✅ Roles: ADMIN, MEMBER, GUEST");

  // ── 3b. Seed Permissions ──────────────────────────────────────────────────
  const ALL_PERMISSIONS = [
    { action: "member:add", description: "Add members to tenant" },
    { action: "member:remove", description: "Remove members from tenant" },
    { action: "did:manage", description: "Manage tenant DIDs" },
    { action: "policy:update", description: "Update tenant policy" },
    { action: "signing-key:manage", description: "Manage tenant signing keys" },
    { action: "client:create", description: "Create OAuth clients" },
    { action: "client:read", description: "List OAuth clients" },
    { action: "client:delete", description: "Delete OAuth clients" },
    { action: "idp:manage", description: "Manage IdP connections" },
    {
      action: "project:manage",
      description: "Create, update, and delete projects",
    },
    { action: "onboarding:manage", description: "Manage onboarding flows" },
    {
      action: "webhook:manage",
      description: "Create, update, and delete webhook endpoints",
    },
    {
      action: "webhook:read:events",
      description: "Read webhook delivery events",
    },
    {
      action: "webhook:events:retry",
      description: "Manually retry failed webhook events",
    },
    {
      action: "audit:read:any",
      description: "Read audit logs across any tenant (SYSTEM only)",
    },
    {
      action: "admin:system",
      description:
        "Access system admin dashboard and manage identities (SYSTEM only)",
    },
    {
      action: "credential:issue",
      description: "Issue verifiable credentials on behalf of a tenant",
    },
    {
      action: "credential:offer",
      description: "Create credential offers for holders to accept",
    },
  ] as const;

  const permissionRecords: { id: string; action: string }[] = [];
  for (const p of ALL_PERMISSIONS) {
    const record = await prisma.permission.upsert({
      where: { action: p.action },
      update: { description: p.description },
      create: { action: p.action, description: p.description },
    });
    permissionRecords.push(record);
  }
  console.log(`✅ ${ALL_PERMISSIONS.length} permissions`);

  // ── 3c. Wire ADMIN role to all permissions ────────────────────────────────
  const seedAdminRole = await prisma.role.findUniqueOrThrow({
    where: { tenantId_name: { tenantId: SYSTEM_TENANT_ID, name: "ADMIN" } },
  });

  for (const perm of permissionRecords) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: seedAdminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: { roleId: seedAdminRole.id, permissionId: perm.id },
    });
  }
  console.log(`✅ ADMIN role → ${permissionRecords.length} permissions`);

  // ── 4. Tenant Policy ──────────────────────────────────────────────────────
  await prisma.tenantPolicy.upsert({
    where: { tenantId: SYSTEM_TENANT_ID },
    update: {},
    create: {
      tenantId: SYSTEM_TENANT_ID,
      requireMfa: false,
      sessionTtlMinutes: 10080, // 7 days
      allowPasskeys: true,
    },
  });
  console.log("✅ SYSTEM tenant policy");

  // ── 5. Wallet Project ─────────────────────────────────────────────────────
  const walletProjectSlug = "arcwallet";
  const existingWalletProject = await prisma.project.findUnique({
    where: { slug: walletProjectSlug },
  });
  if (!existingWalletProject) {
    await prisma.project.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        name: "ArcWallet",
        slug: walletProjectSlug,
        category: "wallet",
      },
    });
    console.log("✅ Wallet project (arcwallet, category: wallet)");
  } else {
    console.log("ℹ️  Wallet project already exists");
  }

  // ── 6 + 7. TenantSigningKey + Root DID ────────────────────────────────────
  //
  // CRITICAL FIX: The previous seed created the DID with an empty
  // publicKeyBytes and verificationMethod: []. The signing service resolves
  // the private key via TenantSigningKey.findFirst({ where: { tenantId } }).
  // Without a real key row, every VC issuance call throws at runtime.
  //
  // We generate a real EC P-256 keypair here, store it, and write the
  // public JWK into the DID document's verificationMethod array.
  //
  // Key generation is idempotent: if a TenantSigningKey for SYSTEM already
  // exists we skip both the key and the DID upsert (the DID is already
  // correct from a previous seed run).

  const systemDid = deriveDidWeb(API_BASE);

  const existingKey = await prisma.tenantSigningKey.findFirst({
    where: { tenantId: SYSTEM_TENANT_ID, status: "ACTIVE" },
    select: { id: true },
  });

  if (!existingKey) {
    // Generate EC P-256 keypair
    const { privateKey, publicKey } = await generateKeyPair("ES256", {
      extractable: true,
    });

    const privatePkcs8 = await exportPKCS8(privateKey);
    const publicSpki = await exportSPKI(publicKey);
    const publicJwk = await exportJWK(publicKey);

    const kid = `${systemDid}#key-1-${randomUUID().slice(0, 8)}`;

    await prisma.tenantSigningKey.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        kid,
        privateKey: Buffer.from(privatePkcs8, "utf8"),
        publicKey: Buffer.from(publicSpki, "utf8"),
        algorithm: "ES256",
        kmsProvider: null, // dev: raw storage. production: set to "aws_kms" or similar
        status: "ACTIVE",
      },
    });
    console.log(`✅ SYSTEM signing key (ES256, kid: ${kid})`);

    // Build DID document with the real public JWK
    const didDocument = {
      id: systemDid,
      "@context": [
        "https://www.w3.org/ns/did/v1",
        "https://w3id.org/security/suites/jws-2020/v1",
      ],
      verificationMethod: [
        {
          id: kid,
          type: "JsonWebKey2020",
          controller: systemDid,
          publicKeyJwk: { ...publicJwk, kid },
        },
      ],
      authentication: [kid],
      assertionMethod: [kid],
      keyAgreement: [],
      capabilityInvocation: [kid],
      capabilityDelegation: [kid],
    };

    await prisma.decentralizedIdentifier.upsert({
      where: { tenantId: SYSTEM_TENANT_ID },
      update: {
        id: systemDid,
        keyType: KeyType.JsonWebKey2020,
        publicKeyBytes: Buffer.from(publicSpki, "utf8"),
        didDocument,
      },
      create: {
        id: systemDid,
        tenantId: SYSTEM_TENANT_ID,
        keyType: KeyType.JsonWebKey2020,
        publicKeyBytes: Buffer.from(publicSpki, "utf8"),
        didDocument,
      },
    });
    console.log(`✅ Root DID: ${systemDid} (verificationMethod wired)`);
  } else {
    // Key already exists — just ensure the DID row is present
    await prisma.decentralizedIdentifier.upsert({
      where: { tenantId: SYSTEM_TENANT_ID },
      update: {},
      create: {
        id: systemDid,
        tenantId: SYSTEM_TENANT_ID,
        keyType: KeyType.JsonWebKey2020,
        publicKeyBytes: Buffer.from([]),
        didDocument: {
          id: systemDid,
          "@context": ["https://www.w3.org/ns/did/v1"],
          verificationMethod: [],
          authentication: [],
          assertionMethod: [],
        },
      },
    });
    console.log(`ℹ️  SYSTEM signing key already exists — skipping keygen`);
    console.log(`ℹ️  Root DID: ${systemDid}`);
  }

  // ── 8. Direct OAuth Client ────────────────────────────────────────────────
  const existingClient = await prisma.client.findUnique({
    where: { clientId: DIRECT_CLIENT_ID },
  });
  if (!existingClient) {
    await prisma.client.create({
      data: {
        clientId: DIRECT_CLIENT_ID,
        tenantId: SYSTEM_TENANT_ID,
        name: "ArcID Native Authentication Portal",
        public: false,
        requirePkce: true,
        grantTypes: [
          "authorization_code",
          "refresh_token",
          "client_credentials",
          "password",
        ],
        scopes: ["openid", "profile", "email", "offline_access"],
        redirectUris: {
          create: [
            { uri: `${API_BASE}/api/auth/callback` },
            { uri: `${API_BASE}/api/oauth/callback` },
            { uri: "http://localhost:3000/api/auth/callback" },
            { uri: "http://localhost:3000/api/oauth/callback" },
            { uri: "arcid://oauth/callback" },
          ],
        },
      },
    });
    console.log(`✅ Direct client '${DIRECT_CLIENT_ID}'`);
  } else {
    console.log(`ℹ️  Direct client '${DIRECT_CLIENT_ID}' already exists`);
  }

  // ── 9. ArcWallet OAuth Client ─────────────────────────────────────────────
  const WALLET_CLIENT_ID = "arcwallet-app";
  const existingWalletClient = await prisma.client.findUnique({
    where: { clientId: WALLET_CLIENT_ID },
  });
  if (!existingWalletClient) {
    const walletProject = await prisma.project.findUniqueOrThrow({
      where: { slug: "arcwallet" },
      select: { id: true },
    });

    await prisma.client.create({
      data: {
        clientId: WALLET_CLIENT_ID,
        tenantId: SYSTEM_TENANT_ID,
        projectId: walletProject.id,
        name: "ArcWallet Mobile Application",
        public: true,
        requirePkce: true,
        grantTypes: ["authorization_code", "refresh_token"],
        scopes: ["openid", "profile", "email", "offline_access"],
        redirectUris: {
          create: [
            { uri: "https://wallet.arcevocirqle.com.ng/oauth/callback" },
            { uri: "ng.arcevocirqle.arcwallet://oauth/callback" },
          ],
        },
      },
    });
    console.log(`✅ ArcWallet client '${WALLET_CLIENT_ID}'`);
  } else {
    console.log(`ℹ️  ArcWallet client '${WALLET_CLIENT_ID}' already exists`);
  }

  // ── 10. System Administrator ──────────────────────────────────────────────
  const existingAdmin = await prisma.identity.findUnique({
    where: { primaryEmail: ADMIN_EMAIL },
  });
  if (!existingAdmin) {
    const argon2 = await import("argon2");
    const passwordHash = await argon2.hash(ADMIN_PASSWORD, {
      type: argon2.argon2id,
    });

    const adminIdentity = await prisma.identity.create({
      data: {
        primaryEmail: ADMIN_EMAIL,
        name: "System Administrator",
        status: "ACTIVE",
        emailVerified: true,
      },
    });

    await prisma.localAccount.create({
      data: { identityId: adminIdentity.id, email: ADMIN_EMAIL, passwordHash },
    });

    const adminRole = await prisma.role.findUniqueOrThrow({
      where: { tenantId_name: { tenantId: SYSTEM_TENANT_ID, name: "ADMIN" } },
    });

    await prisma.tenantMembership.create({
      data: {
        identityId: adminIdentity.id,
        tenantId: SYSTEM_TENANT_ID,
        roleId: adminRole.id,
        status: "ACTIVE",
      },
    });

    console.log("✅ System administrator seeded");
    console.log(`   📧  ${ADMIN_EMAIL}`);
    console.log(`   🔑  ${ADMIN_PASSWORD}`);
    console.log(`   🏷️  ADMIN @ SYSTEM  |  Plan: ENTERPRISE`);
  } else {
    console.log(`ℹ️  Admin already exists: ${ADMIN_EMAIL}`);
  }

  console.log("\n🎉 Seed complete.");
  console.log(
    "\n⚠️  PRODUCTION NOTE: The SYSTEM signing key private key is stored as raw\n" +
      "   bytes in the database. Before going to production, either:\n" +
      "   a) Rotate the key via POST /tenants/SYSTEM/signing-keys (PRO plan)\n" +
      "      and set kmsProvider to your KMS name, or\n" +
      "   b) Set DATABASE_ENCRYPTION_KEY and enable at-rest encryption\n" +
      "      in your Postgres provider (Supabase, Neon, RDS all support this).",
  );
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
