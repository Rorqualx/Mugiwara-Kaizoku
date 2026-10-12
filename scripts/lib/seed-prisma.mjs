/**
 * Database access for the plain-Node seed and admin scripts.
 *
 * Prisma 7 has no built-in engine: `new PrismaClient()` without a driver
 * adapter throws. Every seed script opens its client here so that rule, and
 * the columns a new `User` row needs, are written down once.
 *
 * Plain ESM (.mjs) so `node scripts/...` can load it without a TypeScript
 * loader (scripts/lib/standalone-prisma.ts is the equivalent for bun scripts).
 */

import crypto from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';

/** Small on purpose: seed scripts are sequential. */
const SEED_POOL_SIZE = 2;

/**
 * Open a client on DATABASE_URL.
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ prisma: PrismaClient, close: () => Promise<void> }}
 */
export function createSeedPrisma(env = process.env) {
  const connectionString = env.DATABASE_URL;
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error('DATABASE_URL is not set; cannot open a database connection.');
  }
  const pool = new Pool({ connectionString, max: SEED_POOL_SIZE });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let closed = false;
  /** Disconnect and end the pool so the process can exit on its own. */
  async function close() {
    if (closed) return;
    closed = true;
    await prisma.$disconnect();
    // Prisma ends a pool it was handed on some versions and not on others.
    if (!pool.ended) {
      await pool.end();
    }
  }

  return { prisma, close };
}

/**
 * The `User` columns that have no database default: `id` (no @default) and
 * `updatedAt` (not @updatedAt). Spread into every `prisma.user.create`.
 * @returns {{ id: string, updatedAt: Date }}
 */
export function newUserFields() {
  return { id: crypto.randomUUID(), updatedAt: new Date() };
}
