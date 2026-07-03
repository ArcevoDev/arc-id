import {
  UserStatus,
  SubscriptionPlan,
  AuditLogAction,
  VcFormat,
} from "@/prisma-client";

export interface IdentityProfile {
  id: string;
  primaryEmail: string | null;
  name: string | null;
  status: UserStatus;
  picture: string | null;
  createdAt: string | Date;
}

export interface WorkspaceTenant {
  id: string;
  name: string;
  slug: string;
  plan: SubscriptionPlan;
}

export interface VerificationTelemetry {
  id: string;
  issuerDid: string;
  subjectDid: string;
  format: VcFormat;
  issuedAt: string | Date;
}

export interface ActiveAuditLog {
  id: string;
  actionId: AuditLogAction;
  actorEmail: string;
  ip: string | null;
  createdAt: string | Date;
}
