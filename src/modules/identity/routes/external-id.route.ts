// src/modules/identity/routes/external-id.route.ts
//
// Self-service external identifier management.
// The user links/unlinks identifiers to their own identity — no tenant
// context required, no permission check beyond authentication.

import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";

import { flowExecutor } from "@/core/flows";
import { linkExternalIdFlow } from "../flows/link-external-id.flow";
import { listExternalIdsFlow } from "../flows/list-external-ids.flow";
import { unlinkExternalIdFlow } from "../flows/unlink-external-id.flow";
import {
  LinkExternalIdSchema,
  ExternalIdResponseSchema,
  EXTERNAL_ID_TYPES,
} from "../validators/external-id.schemas";

export async function externalIdRoute(fastify: FastifyInstance) {
  const withZod = fastify.withTypeProvider<ZodTypeProvider>();

  // POST /external-ids — link a new external identifier to your identity
  withZod.post(
    "/external-ids",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Link an external identifier to your identity",
        description:
          "Self-service linking. The server hashes the value (SHA-256) and stores only the hash. The raw value is never persisted.",
        security: [{ bearerAuth: [] }],
        body: LinkExternalIdSchema,
        response: {
          201: z.object({
            success: z.boolean(),
            data: ExternalIdResponseSchema,
          }),
          409: z.object({
            success: z.boolean(),
            error: z.object({ message: z.string(), code: z.string() }),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(linkExternalIdFlow, req.body, {
        identityId: req.identity.id,
        tenantId: req.identity.tenantId,
        ip: req.ip,
      });

      return reply.status(201).send({ success: true, data: result });
    },
  );

  // GET /external-ids — list your linked external identifiers
  withZod.get(
    "/external-ids",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "List your linked external identifiers",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({
            success: z.boolean(),
            data: z.array(ExternalIdResponseSchema),
          }),
        },
      },
    },
    async (req, reply) => {
      const result = await flowExecutor.run(
        listExternalIdsFlow,
        {},
        {
          identityId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
      );

      return reply.send({ success: true, data: result });
    },
  );

  // DELETE /external-ids/:id — unlink an external identifier
  withZod.delete(
    "/external-ids/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity & Profile"],
        summary: "Unlink an external identifier from your identity",
        description:
          "Only the owning identity can unlink their own identifiers. The record is deleted — already-issued VerifiableCredentials are independent artifacts and are not affected.",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string() }),
        response: {
          200: z.object({
            success: z.boolean(),
            message: z.string(),
          }),
          404: z.object({
            success: z.boolean(),
            error: z.object({ message: z.string(), code: z.string() }),
          }),
        },
      },
    },
    async (req, reply) => {
      await flowExecutor.run(
        unlinkExternalIdFlow,
        { id: req.params.id },
        {
          identityId: req.identity.id,
          tenantId: req.identity.tenantId,
          ip: req.ip,
        },
      );

      return reply.send({
        success: true,
        message: "External identifier unlinked",
      });
    },
  );
}
