// src/core/db/tenant-isolation.ts
import { Prisma, PrismaClient } from "@prisma-client";
import { ApiError } from "@/core/errors";

const REQUIRED_TENANT_MODELS = new Set([
  "TenantBranding",
  "TenantSigningKey",
  "IdpConnection",
  "Role",
  "TenantMembership",
  "Project",
  "TenantPolicy",
  "WebhookEndpoint",
]);

const OPTIONAL_TENANT_MODELS = new Set([
  "Client",
  "AccessDelegation",
  "AuditLog",
  "WebhookEvent",
  "Subscription",
]);

const WRITE_ACTIONS = new Set([
  "create",
  "createMany",
  "update",
  "updateMany",
  "upsert",
]);

/**
 * Extract the tenantId from a Prisma operation args object.
 *
 * Prisma write arg shapes by operation:
 *
 *   create      → args.data.tenantId
 *   update      → args.data.tenantId
 *   createMany  → args.data is an array — check first element
 *   updateMany  → args.data.tenantId
 *   upsert      → args.create.tenantId  ← DIFFERENT: no args.data for upsert
 *                 (args.update.tenantId as fallback)
 *
 * The previous implementation used `args.data?.tenantId` for every action
 * including upsert. For upsert, Prisma's args are `{ where, create, update }`
 * — there is no `data` field. This caused every upsert on a REQUIRED_TENANT_MODEL
 * to throw TENANT_ISOLATION_VIOLATION even when tenantId was correctly supplied
 * in args.create.
 */
function extractTenantId(action: string, args: any): string | null | undefined {
  if (!args) return undefined;

  switch (action) {
    case "createMany": {
      const data = args.data;
      if (Array.isArray(data) && data.length > 0) return data[0].tenantId;
      return undefined;
    }

    case "upsert":
      // Prisma upsert: { where, create, update } — no args.data
      // Prefer create.tenantId (the authoritative value for new records).
      // Fall back to update.tenantId so callers that set it in both branches work.
      return args.create?.tenantId ?? args.update?.tenantId;

    default:
      // create, update, updateMany all use args.data
      return args.data?.tenantId;
  }
}

function hasTenantId(value: string | null | undefined): boolean {
  return typeof value === "string" && value.length > 0;
}

export function withTenantIsolation<T extends PrismaClient>(client: T) {
  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!WRITE_ACTIONS.has(operation)) return query(args);

          const isRequired = REQUIRED_TENANT_MODELS.has(model ?? "");
          const isOptional = OPTIONAL_TENANT_MODELS.has(model ?? "");

          if (!isRequired && !isOptional) return query(args);

          const tenantIdValue = extractTenantId(operation, args);

          if (isRequired && !hasTenantId(tenantIdValue)) {
            throw new ApiError(
              `[TenantIsolation] ${operation} on ${model} requires tenantId in data payload. ` +
                `Got: ${JSON.stringify(tenantIdValue)}. ` +
                `This is a server-side programming error — the route or flow must supply tenantId.`,
              500,
              "TENANT_ISOLATION_VIOLATION",
            );
          }

          if (
            isOptional &&
            !hasTenantId(tenantIdValue) &&
            process.env.NODE_ENV !== "production"
          ) {
            console.warn(
              `[TenantIsolation] ${operation} on ${model} has no tenantId. ` +
                `If this is a system-level record, this is expected. ` +
                `If it belongs to a tenant, add tenantId to the data payload.`,
            );
          }

          return query(args);
        },
      },
    },
  });
}

export type IsolatedPrismaClient = ReturnType<
  typeof withTenantIsolation<PrismaClient>
>;
