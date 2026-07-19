// src/modules/credentials/services/status-list.service.test.ts
//
// Phase 0 regression: status-list index allocation race.
// The fix uses compare-and-swap via updateMany guarded on the observed
// issuedCount, with retry-on-conflict.  This test verifies that concurrent
// callers either get distinct indices or retry transparently.

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMockDb } from "@/test-utils/mock-db";
import { StatusListService } from "./status-list.service";

describe("StatusListService — Phase 0: CAS index allocation", () => {
  let db: ReturnType<typeof createMockDb>;
  let svc: StatusListService;

  beforeEach(() => {
    db = createMockDb();
    svc = new StatusListService(db);
  });

  it("creates a new list when none exists and allocates index 0", async () => {
    // No existing list → provision one
    db.bitstringStatusList.findFirst.mockResolvedValue(null);

    const newList = {
      id: "urn:uuid:new-list",
      statusPurpose: "REVOCATION" as const,
      encodedList: Buffer.alloc(1),
      maxSize: 131_072,
      issuedCount: 0,
    };
    // create (new list)
    db.bitstringStatusList.create.mockResolvedValue(newList);
    // CAS: updateMany where id= newList.id AND issuedCount=0 → increment
    db.bitstringStatusList.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.allocateIndex("REVOCATION", "tenant-1");

    expect(result.listId).toBe("urn:uuid:new-list");
    expect(result.index).toBe(0);

    // Should have created one list because none existed
    expect(db.bitstringStatusList.create).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing list with remaining capacity", async () => {
    db.bitstringStatusList.findFirst.mockResolvedValue({
      id: "urn:uuid:existing",
      statusPurpose: "REVOCATION",
      encodedList: Buffer.alloc(1),
      maxSize: 131_072,
      issuedCount: 5,
    });
    db.bitstringStatusList.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.allocateIndex("REVOCATION", "tenant-1");

    expect(result.index).toBe(5);
    expect(db.bitstringStatusList.create).not.toHaveBeenCalled();
  });

  it("retries on CAS conflict when updateMany returns count=0", async () => {
    // First call: existing list at issuedCount=5
    // Second call (retry): fresh state after the race is resolved
    const listRecord = {
      id: "urn:uuid:existing",
      statusPurpose: "REVOCATION",
      encodedList: Buffer.alloc(1),
      maxSize: 131_072,
      issuedCount: 5,
    };

    const updatedRecord = {
      ...listRecord,
      issuedCount: 6, // other writer already incremented
    };

    db.bitstringStatusList.findFirst
      .mockResolvedValueOnce(listRecord) // first call: sees 5
      .mockResolvedValueOnce(updatedRecord); // retry: sees 6

    // First CAS: lost the race (count=0 because guard on 5 fails)
    // Second CAS: wins (guard on 6 succeeds)
    db.bitstringStatusList.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    const result = await svc.allocateIndex("REVOCATION", "tenant-1");

    expect(result.index).toBe(6);
    // updateMany should have been called twice (first loss, then retry)
    expect(db.bitstringStatusList.updateMany).toHaveBeenCalledTimes(2);
  });

  it("passes transaction client through when provided", async () => {
    const tx = createMockDb();
    tx.bitstringStatusList.findFirst.mockResolvedValue({
      id: "urn:uuid:tx-list",
      statusPurpose: "REVOCATION",
      encodedList: Buffer.alloc(1),
      maxSize: 131_072,
      issuedCount: 3,
    });
    tx.bitstringStatusList.updateMany.mockResolvedValue({ count: 1 });

    const result = await svc.allocateIndex("REVOCATION", "tenant-1", tx);

    expect(result.listId).toBe("urn:uuid:tx-list");
    expect(result.index).toBe(3);
    // Should have used the transaction client, not the default db
    expect(db.bitstringStatusList.findFirst).not.toHaveBeenCalled();
  });

  it("updateEntry revokes a slot and re-encodes the list", async () => {
    db.statusListEntry.upsert.mockResolvedValue({} as any);
    db.statusListEntry.findMany.mockResolvedValue([{ index: 0, value: 1 }]);
    db.bitstringStatusList.findUniqueOrThrow.mockResolvedValue({
      id: "list-1",
      maxSize: 131_072,
      encodedList: Buffer.alloc(1),
    });
    db.bitstringStatusList.update.mockResolvedValue({} as any);

    await svc.updateEntry("list-1", 0, 1);

    expect(db.statusListEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          statusListId_index: { statusListId: "list-1", index: 0 },
        },
        create: { statusListId: "list-1", index: 0, value: 1 },
      }),
    );
    // Should have re-encoded and updated the list
    expect(db.bitstringStatusList.update).toHaveBeenCalledTimes(1);
  });
});
