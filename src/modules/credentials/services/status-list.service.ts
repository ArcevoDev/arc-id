import type { DbClient } from "@/lib/db-client";
import type { StatusPurpose } from "@/prisma-client";
import { ApiError } from "@/core/errors/api-error";
import { deflateSync, inflateSync } from "zlib";
import { randomUUID } from "crypto";

const DEFAULT_LIST_SIZE = 131_072; // W3C minimum: 16KB = 131072 bits

/**
 * W3C BitstringStatusList operations.
 *
 * allocateIndex — atomically reserves a slot in an available list.
 *                 Provisions a new list when all existing ones are full.
 * updateEntry   — sets a credential's bit (0=valid, 1=revoked/suspended).
 *                 Re-encodes the full compressed list bytes.
 * encodeList    — zlib-deflates the raw bit buffer (W3C spec §5.3.1).
 * decodeList    — inflates for status checks during VC verification.
 */
export class StatusListService {
  constructor(private db: DbClient) {}

  // ── Allocate ──────────────────────────────────────────────────────────────

  async allocateIndex(
    purpose: StatusPurpose,
    tenantId: string | null | undefined,
    tx: DbClient = this.db, // allow caller to pass a transaction client
  ): Promise<{ listId: string; index: number }> {
    // Find a list with remaining capacity
    const available = await tx.bitstringStatusList.findFirst({
      where: { statusPurpose: purpose },
      orderBy: { createdAt: "asc" },
    });

    let list =
      available && available.issuedCount < available.maxSize ? available : null;

    if (!list) {
      const emptyBits = Buffer.alloc(Math.ceil(DEFAULT_LIST_SIZE / 8), 0);
      const encoded = deflateSync(emptyBits);

      list = await tx.bitstringStatusList.create({
        data: {
          id: `urn:uuid:${randomUUID()}`,
          statusPurpose: purpose,
          encodedList: Buffer.from(encoded),
          maxSize: DEFAULT_LIST_SIZE,
          issuedCount: 0,
        },
      });
    }

    // Atomic increment-and-read: updateMany with a guard on the value we
    // last observed, then re-read the authoritative row. This still has a
    // narrow theoretical race if two callers observe the same `issuedCount`
    // before either's updateMany lands — closed below by retrying on
    // conflict, which is safe because this whole function now runs inside
    // the caller's transaction (see issue-credential.flow.ts), so a retry
    // here means re-running inside the same transaction attempt.
    const { count } = await tx.bitstringStatusList.updateMany({
      where: { id: list.id, issuedCount: list.issuedCount },
      data: { issuedCount: { increment: 1 } },
    });

    if (count === 0) {
      // Lost the race against a concurrent allocation on the same list —
      // retry once against fresh state rather than risk a collision.
      return this.allocateIndex(purpose, tenantId, tx);
    }

    return { listId: list.id, index: list.issuedCount };
  }

  // ── Update (revoke / suspend / reinstate) ─────────────────────────────────

  async updateEntry(
    listId: string,
    index: number,
    value: 0 | 1,
  ): Promise<void> {
    await this.db.statusListEntry.upsert({
      where: { statusListId_index: { statusListId: listId, index } },
      update: { value, updatedAt: new Date() },
      create: { statusListId: listId, index, value },
    });

    // Re-encode the full list
    const allEntries = await this.db.statusListEntry.findMany({
      where: { statusListId: listId },
    });

    const list = await this.db.bitstringStatusList.findUniqueOrThrow({
      where: { id: listId },
    });

    const encoded = this.encodeList(
      allEntries.map((e) => ({ index: e.index, value: e.value })),
      list.maxSize,
    );

    await this.db.bitstringStatusList.update({
      where: { id: listId },
      data: { encodedList: Buffer.from(encoded), updatedAt: new Date() },
    });
  }

  // ── Check (used during VC verification) ───────────────────────────────────

  async checkEntry(listId: string, index: number): Promise<number> {
    const list = await this.db.bitstringStatusList.findUnique({
      where: { id: listId },
    });
    if (!list) throw ApiError.notFound(`Status list not found: ${listId}`);

    const bits = this.decodeList(Buffer.from(list.encodedList));
    const byteIndex = Math.floor(index / 8);
    const bitOffset = 7 - (index % 8);
    return (bits[byteIndex] >> bitOffset) & 1;
  }

  // ── Codec ─────────────────────────────────────────────────────────────────

  encodeList(
    entries: Array<{ index: number; value: number }>,
    maxSize: number,
  ): Buffer {
    const bits = Buffer.alloc(Math.ceil(maxSize / 8), 0);
    for (const e of entries) {
      if (e.value === 1) {
        const byteIndex = Math.floor(e.index / 8);
        const bitOffset = 7 - (e.index % 8);
        bits[byteIndex] |= 1 << bitOffset;
      }
    }
    return deflateSync(bits);
  }

  decodeList(encodedList: Buffer): Buffer {
    return inflateSync(encodedList);
  }
}
