// @ts-nocheck - Test file uses an in-memory Prisma stub
import { describe, expect, it } from '@jest/globals';

import {
  claimPackImport,
  markPackReadyForImport,
  PackImportClaimedError,
  STALE_IMPORT_MS,
  waitForPackImportOwner,
} from '@/server/services/packImport/pack-import-claim';

/** In-memory PackDownload table honouring the `where` shapes the claim module uses. */
function createPrisma(row) {
  const table = row ? { ...row } : null;
  const matches = (where) => {
    if (!table || where.id !== table.id) return false;
    if (typeof where.status === 'string') return table.status === where.status;
    if (where.OR) {
      return where.OR.some((cond) => {
        if (cond.status?.in) return cond.status.in.includes(table.status);
        return table.status === cond.status && table.updatedAt < cond.updatedAt.lt;
      });
    }
    return true;
  };
  return {
    table,
    packDownload: {
      updateMany: ({ where, data }) => {
        if (!matches(where)) return Promise.resolve({ count: 0 });
        Object.assign(table, data, { updatedAt: new Date() });
        return Promise.resolve({ count: 1 });
      },
      findUnique: () => Promise.resolve(table ? { status: table.status } : null),
    },
  };
}

const fresh = () => new Date();
const stale = () => new Date(Date.now() - STALE_IMPORT_MS - 1000);

describe('pack-import-claim', () => {
  describe('markPackReadyForImport', () => {
    it.each(['DOWNLOADING', 'COMPLETED', 'FAILED'])('makes a %s pack claimable and records the path', async (status) => {
      const prisma = createPrisma({ id: 1n, status, updatedAt: fresh(), filePath: null });
      await expect(markPackReadyForImport(prisma, 1n, '/downloads/x')).resolves.toBe('ready');
      expect(prisma.table.status).toBe('COMPLETED');
      expect(prisma.table.filePath).toBe('/downloads/x');
    });

    it('does not reset a pack another importer is working on', async () => {
      const prisma = createPrisma({ id: 1n, status: 'IMPORTING', updatedAt: fresh() });
      await expect(markPackReadyForImport(prisma, 1n, '/downloads/x')).resolves.toBe('in-progress');
      expect(prisma.table.status).toBe('IMPORTING');
    });

    it('reclaims an import abandoned for longer than the stale window', async () => {
      const prisma = createPrisma({ id: 1n, status: 'IMPORTING', updatedAt: stale() });
      await expect(markPackReadyForImport(prisma, 1n, '/downloads/x')).resolves.toBe('ready');
    });

    it('reports an already imported pack and leaves it alone', async () => {
      const prisma = createPrisma({ id: 1n, status: 'IMPORTED', updatedAt: fresh() });
      await expect(markPackReadyForImport(prisma, 1n, '/downloads/x')).resolves.toBe('imported');
      expect(prisma.table.status).toBe('IMPORTED');
    });

    it('treats cancelled and missing packs as unavailable', async () => {
      await expect(markPackReadyForImport(createPrisma({ id: 1n, status: 'CANCELLED', updatedAt: fresh() }), 1n, '/x'))
        .resolves.toBe('unavailable');
      await expect(markPackReadyForImport(createPrisma(null), 1n, '/x')).resolves.toBe('unavailable');
    });
  });

  describe('claimPackImport', () => {
    it('lets exactly one of two concurrent importers through', async () => {
      const prisma = createPrisma({ id: 1n, status: 'COMPLETED', updatedAt: fresh() });
      const results = await Promise.allSettled([claimPackImport(prisma, 1n), claimPackImport(prisma, 1n)]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect(rejected.reason).toBeInstanceOf(PackImportClaimedError);
      expect(rejected.reason.currentStatus).toBe('IMPORTING');
      expect(prisma.table.status).toBe('IMPORTING');
    });

    it('rejects a pack that is not COMPLETED', async () => {
      const prisma = createPrisma({ id: 1n, status: 'DOWNLOADING', updatedAt: fresh() });
      await expect(claimPackImport(prisma, 1n)).rejects.toBeInstanceOf(PackImportClaimedError);
      expect(prisma.table.status).toBe('DOWNLOADING');
    });
  });

  describe('waitForPackImportOwner', () => {
    it('returns the owner outcome once it leaves IMPORTING', async () => {
      const prisma = createPrisma({ id: 1n, status: 'IMPORTING', updatedAt: fresh() });
      setTimeout(() => { prisma.table.status = 'IMPORTED'; }, 30);
      await expect(waitForPackImportOwner(prisma, 1n, { pollMs: 10, deadlineMs: 2000 })).resolves.toBe(true);
    });

    it('returns false when the owner fails', async () => {
      const prisma = createPrisma({ id: 1n, status: 'FAILED', updatedAt: fresh() });
      await expect(waitForPackImportOwner(prisma, 1n, { pollMs: 10, deadlineMs: 2000 })).resolves.toBe(false);
    });

    it('gives up at the deadline without claiming success', async () => {
      const prisma = createPrisma({ id: 1n, status: 'IMPORTING', updatedAt: fresh() });
      await expect(waitForPackImportOwner(prisma, 1n, { pollMs: 10, deadlineMs: 40 })).resolves.toBe(false);
    });
  });
});
