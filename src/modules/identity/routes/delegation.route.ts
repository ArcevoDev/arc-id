// src/modules/identity/routes/delegation.route.ts
// AccessDelegation — allows a user to grant scoped access to another identity.
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "@/core/errors";
import { AuditLogAction } from "@/prisma-client";

export async function delegationRoute(fastify: FastifyInstance) {
  // GET /identity/delegations — list delegations you've granted
  fastify.get(
    "/delegations",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "List access delegations you have granted",
        security: [{ bearerAuth: [] }],
        response: {
          200: z.object({ success: z.boolean(), data: z.array(z.any()) }),
        },
      },
    },
    async (req, reply) => {
      const delegations = await fastify.db.accessDelegation.findMany({
        where: { grantorId: req.identity.id },
        include: { grantee: { select: { primaryEmail: true, name: true } } },
      });
      return reply.send({ success: true, data: delegations });
    },
  );

  // POST /identity/delegations — grant access to another identity
  fastify.post(
    "/delegations",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Grant another identity scoped access to your resources",
        security: [{ bearerAuth: [] }],
        body: z.object({
          delegateIdentityId: z.string().min(1),
          scopes: z.array(z.string()).min(1),
          expiresAt: z.string().datetime().optional(),
        }),
        response: { 201: z.object({ success: z.boolean(), data: z.any() }) },
      },
    },
    async (req, reply) => {
      const body = req.body as any;

      const delegate = await fastify.db.identity.findUnique({
        where: { id: body.delegateIdentityId },
        select: { id: true },
      });
      if (!delegate) throw ApiError.notFound("Delegate identity not found");

      const delegation = await fastify.db.accessDelegation.create({
        data: {
          grantorId: req.identity.id,
          granteeId: body.delegateIdentityId,
          scopes: body.scopes,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      });

      // Explicit type assertion using the imported AuditLogAction enum
      void fastify.db.auditLog
        .create({
          data: {
            actionId: "DELEGATION_GRANTED" as AuditLogAction,
            identityId: req.identity.id,
            ip: req.ip ?? "0.0.0.0",
            metadata: {
              delegateId: body.delegateIdentityId,
              scopes: body.scopes,
            },
          },
        })
        .catch(() => {});

      return reply.status(201).send({ success: true, data: delegation });
    },
  );

  // DELETE /identity/delegations/:id — revoke a delegation
  fastify.delete(
    "/delegations/:id",
    {
      preHandler: fastify.auth.requireUser,
      schema: {
        tags: ["Identity Vault"],
        summary: "Revoke a previously granted delegation",
        security: [{ bearerAuth: [] }],
        params: z.object({ id: z.string().min(1) }),
        response: { 200: z.object({ success: z.boolean() }) },
      },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };

      const result = await fastify.db.accessDelegation.updateMany({
        where: { id, grantorId: req.identity.id },
        data: { expiresAt: new Date() },
      });

      if (result.count === 0) throw ApiError.notFound("Delegation not found");
      return reply.send({ success: true });
    },
  );
}
