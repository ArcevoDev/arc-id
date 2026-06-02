import type { Subscription } from "@/prisma-client";

export function presentSubscription(sub: Subscription) {
  return {
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    startedAt: sub.startedAt,
    endsAt: sub.endsAt,
  };
}
