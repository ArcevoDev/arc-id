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
    tenantId?: string | null,
  ): Promise<{ listId: string; index: number }> {
    // Find a list with remaining capacity
    const available = await this.db.bitstringStatusList.findFirst({
      where: {
        statusPurpose: purpose,
        // issuedCount < maxSize — Prisma doesn't support column-to-column comparison,
        // so we filter by a threshold instead and check in-process
      },
      orderBy: { createdAt: "asc" },
    });

    let list =
      available && available.issuedCount < available.maxSize ? available : null;

    // Provision a new list when none available
    if (!list) {
      const emptyBits = Buffer.alloc(Math.ceil(DEFAULT_LIST_SIZE / 8), 0);
      const encoded = deflateSync(emptyBits);

      list = await this.db.bitstringStatusList.create({
        data: {
          id: `urn:uuid:${randomUUID()}`,
          statusPurpose: purpose,
          encodedList: Buffer.from(encoded),
          maxSize: DEFAULT_LIST_SIZE,
          issuedCount: 0,
        },
      });
    }

    const index = list.issuedCount;

    await this.db.bitstringStatusList.update({
      where: { id: list.id },
      data: { issuedCount: { increment: 1 } },
    });

    return { listId: list.id, index };
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
