// src/lib/challenge-store.ts
import { Redis } from "@upstash/redis";
import { config } from "@/core/config";

const redis = new Redis({
  url: config.redis.url || "",
  token: config.redis.token || "",
});

export async function storeChallenge(
  userId: string,
  challenge: string,
): Promise<void> {
  await redis.set(`passkey:challenge:${userId}`, challenge, { ex: 120 }); // 2 min TTL
}

export async function consumeChallenge(userId: string): Promise<string | null> {
  const challenge = await redis.get<string>(`passkey:challenge:${userId}`);
  if (challenge) await redis.del(`passkey:challenge:${userId}`);
  return challenge;
}
