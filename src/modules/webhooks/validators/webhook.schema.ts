import { z } from "zod";

export const EndpointBodySchema = z.object({
  url: z.string().url("Must be a valid URL"),
  // Caller can supply their own secret or let the system generate one.
  secret: z.string().min(16).max(256).optional(),
  // Empty array = receive all event types. Non-empty = receive only listed types.
  eventTypes: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export const EndpointPatchSchema = z.object({
  url: z.string().url().optional(),
  eventTypes: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

export const EndpointParamsSchema = z.object({
  id: z.string().cuid("Invalid resource identifier format"),
});

export const EventListQuerySchema = z.object({
  status: z.enum(["failed", "delivered", "pending"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().cuid().optional(),
});

export const EventParamsSchema = z.object({
  id: z.string().cuid("Invalid resource identifier format"),
});

// Explicit type extractions for route handlers
export type EndpointBody = z.infer<typeof EndpointBodySchema>;
export type EndpointPatch = z.infer<typeof EndpointPatchSchema>;
export type EndpointParams = z.infer<typeof EndpointParamsSchema>;
export type EventListQuery = z.infer<typeof EventListQuerySchema>;
export type EventParams = z.infer<typeof EventParamsSchema>;
